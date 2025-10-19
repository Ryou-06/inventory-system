		<script lang="ts">
			import { onMount } from 'svelte';
			import { db, auth } from '$lib/firebase';
			import {
				collection,
				getDocs,
				getDoc,
				addDoc,
				updateDoc,
				deleteDoc,
				setDoc,
				doc,
				query,
				where,
				orderBy,
				writeBatch
			} from 'firebase/firestore';
			import { onAuthStateChanged, signOut } from 'firebase/auth';
			import { goto } from '$app/navigation';

		interface Item {
			id: string;
			uniqueId?: string; // ✅ add this line
			name: string;
			description: string;
			quantity: number;
			category?: string;
			productionDate?: string;
			expirationDate?: string;
			imageUrl?: string;
			userId?: string;
			createdAt?: Date;
		}



			let items: Item[] = [];
			let filteredItems: Item[] = [];
			let showModal = false;
			let showImageModal = false;
			let isEditing = false;
			let editingId: string | null = null;
			let selectedItemForImage: Item | null = null;
			let searchQuery = '';
			let lowStockThreshold = 20;
			let userEmail: string | null = null;
			let loading = true;
			let uploadingImage = false;
			let fileInput: HTMLInputElement | null = null; // bind this to the input
			let previewUrl: string | null = null;
			let deductProductImage = null; // optional for modal preview
			let showDeductModal = false;   // for Deduct modal ✅
			let deductProductName = '';    // product to deduct
			let deductAmount = '';         // amount to deduct
			let alertThreshold = 7;	
			let categoryFilter = "All";





			// Default image URL (placeholder)
			const defaultImageUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=400&fit=crop';

			// ImgBB API Key (from environment variable)
			const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

			const categories = [
		"All",
		"Frozen Product",
		"Warehouse Product",
		"Fresh Produce",
		"Grocery Item",
		"Restaurant Supply",
		"Personal Care"
	];

		let newItem: {
			name: string;
			description: string;
			quantity: string;
			category: string;            // ✅ added
			productionDate: string;      // ✅ added
			expirationDate: string;      // ✅ added
			imageFile: File | null;
		} = {
			name: '',
			description: '',
			quantity: '',
			category: '',
			productionDate: '',
			expirationDate: '',
			imageFile: null
		};



			let showSnackbar = false;
			let snackbarMessage = '';

			function triggerSnackbar(message: string) {
				snackbarMessage = message;
				showSnackbar = true;
				setTimeout(() => {
					showSnackbar = false;
				}, 2000);
			}

			onMount(() => {
				onAuthStateChanged(auth, async (user) => {
					if (!user) {
						console.log('User not logged in — redirecting to login');
						goto('/');
					} else {
						console.log('✅ Logged in as:', user.email);
						userEmail = user.email;
						await loadItems();
					}
					loading = false;
				});
			});


		onMount(async () => {
			const q = query(collection(db, 'inventory'), orderBy('productionDate', 'asc'));
			const querySnapshot = await getDocs(q);

			items = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			})) as Item[];

			filteredItems = items;
			loading = false;
		});



			// ✅ Compress image before upload
		async function compressImage(file: File): Promise<File> {
			const bitmap = await createImageBitmap(file);
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d')!;
			canvas.width = 800; // resize width
			canvas.height = (bitmap.height / bitmap.width) * 800;
			ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

			return new Promise((resolve) => {
				canvas.toBlob(
					(blob) => resolve(new File([blob!], file.name, { type: file.type })),
					file.type,
					0.7 // compression quality (0.7 = 70%)
				);
			});
		}

		function isNearExpiration(expirationDate?: string): boolean {
			if (!expirationDate) return false;
			const expDate = new Date(expirationDate);
			const today = new Date();
			const diffTime = expDate.getTime() - today.getTime();
			const diffDays = diffTime / (1000 * 60 * 60 * 24);
			return diffDays <= alertThreshold && diffDays >= 0;
		}

			async function logoutUser() {
				try {
					await signOut(auth);
					goto('/');
				} catch (error) {
					console.error('Logout failed:', error);
				}
			}

		async function loadItems() {
		try {
			const user = auth.currentUser;
			if (!user) {
			console.warn('User not logged in — skipping item load.');
			return;
			}

			const q = query(collection(db, 'inventory'), where('userId', '==', user.uid));
			const querySnapshot = await getDocs(q);

			const loadedItems: Item[] = [];
			querySnapshot.forEach((docSnapshot) => {
			const data = docSnapshot.data();
			loadedItems.push({
				id: docSnapshot.id,
				name: data.name,
				description: data.description,
				quantity: data.quantity,
				category: data.category || '',
				productionDate: data.productionDate || '',
				expirationDate: data.expirationDate || '',
				uniqueId: data.uniqueId ?? 0,
				imageUrl: data.imageUrl || defaultImageUrl
			});
			});

			// Sort by expiration date (FIFO)
			loadedItems.sort((a, b) => {
			if (!a.expirationDate) return 1;
			if (!b.expirationDate) return -1;
			return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
			});

			items = loadedItems;
			filterItems();
		} catch (error) {
			console.error('Error fetching items:', error);
		}
		}

// 🔍 Unified filtering (Search + Category)
function filterItems() {
	const query = searchQuery.toLowerCase();

	filteredItems = items.filter((item) => {
		const matchesSearch =
			item.name.toLowerCase().includes(query) ||
			item.description.toLowerCase().includes(query);

		const matchesCategory =
			categoryFilter === "All" || item.category === categoryFilter;

		return matchesSearch && matchesCategory;
	});
}

// Re-run whenever searchQuery or categoryFilter changes
$: [searchQuery, categoryFilter], filterItems();


			function isLowStock(quantity: number): boolean {
				return quantity <= lowStockThreshold;
			}

		async function addItem() {
			try {
				if (!newItem.name || !newItem.quantity) {
					alert('Please fill in all required fields');
					return;
				}

				const user = auth.currentUser;
				if (!user) {
					alert('You must be logged in to add items!');
					return;
				}

				const counterDoc = doc(db, 'counters', 'inventoryCounter');
				const counterSnapshot = await getDoc(counterDoc);
				let newId = 1;

				if (counterSnapshot.exists()) {
					const counterData = counterSnapshot.data();
					if (counterData.lastId) newId = counterData.lastId + 1;
				}

				let imageUrl = defaultImageUrl;

				// 🖼️ If the user selected an image, upload to ImgBB
				if (newItem.imageFile) {
					if (!IMGBB_API_KEY) {
						alert('ImgBB API key missing. Please add VITE_IMGBB_API_KEY to your .env file');
						return;
					}

					const base64Image = await fileToBase64(newItem.imageFile);
					const formData = new FormData();
					formData.append('image', base64Image.split(',')[1]);

					const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
						method: 'POST',
						body: formData
					});

					const data = await response.json();

					if (data.success) {
						imageUrl = data.data.url;
					} else {
						console.warn('⚠️ ImgBB upload failed, using default image.');
					}
				}

		await addDoc(collection(db, 'inventory'), {
			uniqueId: newId,
			name: newItem.name,
			description: newItem.description,
			quantity: Number(newItem.quantity),
			category: newItem.category || '',
			productionDate: newItem.productionDate || null,
			expirationDate: newItem.expirationDate || null,
			userId: user.uid,
			imageUrl,
			createdAt: new Date()
		});

				await setDoc(counterDoc, { lastId: newId });

				closeModal();
				await loadItems();
				triggerSnackbar('Successfully added');
			} catch (error) {
				console.error('Error adding item:', error);
			}
		}

		async function handleDeductSubmit() {
		const amountToDeduct = Number(deductAmount);
		if (!deductProductName || !amountToDeduct || amountToDeduct <= 0) {
			alert('Please select a product and enter a valid quantity.');
			return;
		}

		const user = auth.currentUser;
		if (!user) {
			alert('You must be logged in.');
			return;
		}

		showDeductModal = false;

		try {
			// Simple query - just userId and name (NO orderBy - no index needed!)
			const q = query(
			collection(db, 'inventory'),
			where('userId', '==', user.uid),
			where('name', '==', deductProductName)
			);

			const snapshot = await getDocs(q);

			if (snapshot.empty) {
			alert('No batches found for that product.');
			return;
			}

			// Sort in JavaScript by expiration date (FIFO - earliest first)
			const docs = snapshot.docs.sort((a, b) => {
			const dateA = a.data().expirationDate || '9999-12-31';
			const dateB = b.data().expirationDate || '9999-12-31';
			return dateA.localeCompare(dateB); // Ascending order (earliest first)
			});

			console.log('📦 Sorted batches for FIFO deduction:');
			docs.forEach((doc, idx) => {
			console.log(`  ${idx + 1}. Expiration: ${doc.data().expirationDate}, Qty: ${doc.data().quantity}`);
			});

			let remaining = amountToDeduct;
			let totalAvailable = 0;

			// Calculate total available
			docs.forEach((doc) => {
			totalAvailable += Number(doc.data().quantity) || 0;
			});

			if (totalAvailable < remaining) {
			alert(`Not enough stock. Available: ${totalAvailable}, Requested: ${amountToDeduct}`);
			return;
			}

			const batch = writeBatch(db);
			let deductedDetails = [];

			// Deduct from batches in FIFO order
			for (const docSnap of docs) {
			if (remaining <= 0) break;

			const data = docSnap.data();
			const docRef = doc(db, 'inventory', docSnap.id);
			const qty = Number(data.quantity) || 0;
			const expDate = data.expirationDate || 'No date';

			if (qty > remaining) {
				// Partial deduction from this batch
				batch.update(docRef, { quantity: qty - remaining });
				deductedDetails.push(`${remaining} from batch (expires ${expDate})`);
				console.log(`✅ Deducted ${remaining} from batch (expires ${expDate}), remaining: ${qty - remaining}`);
				remaining = 0;
			} else {
				// Full deduction - delete this batch
				batch.delete(docRef);
				deductedDetails.push(`${qty} from batch (expires ${expDate})`);
				console.log(`✅ Deducted ${qty} from batch (expires ${expDate}), DELETED`);
				remaining -= qty;
			}
			}

			// Commit all changes
			await batch.commit();
			await loadItems();

			// Use snackbar instead of alert
			triggerSnackbar(`✅ Deducted ${amountToDeduct} ${deductProductName} using FIFO method`);

			console.log(`✅ FIFO deduction complete: ${amountToDeduct} units removed`);
			console.log(`Details:\n${deductedDetails.join('\n')}`);
		} catch (err) {
			console.error('❌ Deduction failed:', err);
			alert('Error deducting item. Please try again.');
		} finally {
			deductAmount = '';
			deductProductName = '';
		}
		}

		function startEdit(item: Item) {
			isEditing = true;
			editingId = item.id;

			newItem = {
				name: item.name,
				description: item.description,
				quantity: item.quantity.toString(),
				category: item.category || '',
				productionDate: item.productionDate || '',
				expirationDate: item.expirationDate || '',	
				imageFile: null
			};

			console.log('Editing category:', item.category);
			showModal = true;
		}



		async function saveEdit() {
			if (!editingId) return;

			// Find the original item
			const originalItem = items.find(item => item.id === editingId);
			if (!originalItem) return;

			let imageUrl = originalItem.imageUrl; // keep existing image if not changed

			// Upload new image if provided
			if (newItem.imageFile) {
				if (!IMGBB_API_KEY) {
					alert('ImgBB API key missing.');
					return;
				}

				const base64Image = await fileToBase64(newItem.imageFile);
				const formData = new FormData();
				formData.append('image', base64Image.split(',')[1]);

				const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
					method: 'POST',
					body: formData
				});
				const data = await response.json();
				if (data.success) {
					imageUrl = data.data.url;
				}
			}

			// Update Firestore
		const itemRef = doc(db, 'inventory', editingId);
		await updateDoc(itemRef, {
			name: newItem.name,
			description: newItem.description,
			quantity: Number(newItem.quantity),
			category: newItem.category || '',
			productionDate: newItem.productionDate || null,
			expirationDate: newItem.expirationDate || null,
			imageUrl
		});

			closeModal();
			await loadItems();
			triggerSnackbar('Item updated successfully');
		}


			async function deleteItem(id: string) {
				try {
					if (!confirm('Are you sure you want to delete this item?')) return;
					await deleteDoc(doc(db, 'inventory', id));
					await loadItems();
					triggerSnackbar('Successfully deleted');
				} catch (error) {
					console.error('Error deleting item:', error);
				}
			}

		function closeModal() {
		showModal = false;
		isEditing = false;
		editingId = null;
		newItem = {
			name: '',
			description: '',
			quantity: '',
			category: '',
			productionDate: '',
			expirationDate: '',
			imageFile: null
		};
		previewUrl = null;
		}


			// Image Upload Functions
			function openImageModal(item: Item) {
				selectedItemForImage = item;
				showImageModal = true;
			}

			function closeImageModal() {
				showImageModal = false;
				selectedItemForImage = null;
			}

		function closeDeductModal() {
		showDeductModal = false;
		deductAmount = '';
		deductProductName = '';
		}


			// ✨ NEW: Upload to ImgBB
			async function handleImageUpload(event: Event) {
				const input = event.target as HTMLInputElement;
				if (!input.files || input.files.length === 0 || !selectedItemForImage) return;

				const file = input.files[0];
				
				// Validate file type
				if (!file.type.startsWith('image/')) {
					alert('Please select an image file');
					return;
				}

				// Validate file size (max 32MB - ImgBB limit)
				if (file.size > 32 * 1024 * 1024) {
					alert('Image size should be less than 32MB');
					return;
				}

				if (!IMGBB_API_KEY) {
					alert('ImgBB API key is missing. Please add VITE_IMGBB_API_KEY to your .env file');
					return;
				}

				uploadingImage = true;

				try {
					// Convert image to base64
					const base64Image = await fileToBase64(file);

					// Upload to ImgBB
					const formData = new FormData();
					formData.append('image', base64Image.split(',')[1]); // Remove data:image/xxx;base64, prefix

					const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
						method: 'POST',
						body: formData
					});

					const data = await response.json();

					if (data.success) {
						const imageUrl = data.data.url;

						// Update Firestore with the new image URL
						await updateDoc(doc(db, 'inventory', selectedItemForImage.id), {
							imageUrl: imageUrl
						});

						await loadItems();
						closeImageModal();
						triggerSnackbar('Image uploaded successfully');
					} else {
						throw new Error(data.error?.message || 'Upload failed');
					}
				} catch (error) {
					console.error('Error uploading image:', error);
					alert('Failed to upload image. Please try again.');
				} finally {
					uploadingImage = false;
				}
			}

			// Helper function to convert file to base64
			function fileToBase64(file: File): Promise<string> {
				return new Promise((resolve, reject) => {
					const reader = new FileReader();
					reader.readAsDataURL(file);
					reader.onload = () => resolve(reader.result as string);
					reader.onerror = error => reject(error);
				});
			}


			async function addItemWithOptionalImage(
			name: string,
			description: string,
			quantity: number,
			userId: string,
			uniqueId: number,
			imageFile?: File
		) {
			try {
				// Default image URL (placeholder)
				let imageUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=400&fit=crop';

				// Upload image only if the user selected one
				if (imageFile) {
					const formData = new FormData();
					formData.append('image', imageFile);

					const response = await fetch(
						`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_API_KEY}`,
						{
							method: 'POST',
							body: formData
						}
					);

					const data = await response.json();

					if (data && data.data && data.data.url) {
						imageUrl = data.data.url;
					} else {
						console.warn('⚠️ ImgBB upload failed, using default image.');
					}
				}

				// Store the item in Firestore (with the image URL)
				await addDoc(collection(db, 'inventory'), {
					name,
					description,
					quantity,
					userId,
					uniqueId,
					createdAt: new Date(),
					imageUrl
				});

				console.log('✅ Item added successfully with image URL:', imageUrl);
			} catch (error) {
				console.error('❌ Error adding item with optional image:', error);
			}
		}

		</script>

		<div class="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
			<!-- ✅ Header -->
			<div class="flex-shrink-0 p-6">
				<div class="flex items-center justify-between mb-8">
					<div class="flex items-center gap-4">
						<div>
							<h1 class="text-4xl font-bold text-gray-800 mb-2">Inventory Items</h1>
							<p class="text-gray-600">Smart Quantity Logistics - Manage your inventory items</p>
						</div>
					</div>			
				</div>

<!-- Search + Add -->
<div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
	<div class="flex flex-col lg:flex-row justify-between items-center gap-4">
		
		<!-- Search + Category Filter -->
		<div class="flex items-center gap-3 w-full lg:flex-1">
			<!-- Search Input -->
			<div class="relative flex-1 max-w-md">
				<input
					type="text"
					placeholder="Search items..."
					bind:value={searchQuery}
					class="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg"
				/>
				<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
					</svg>
				</div>
			</div>

			<!-- Category Filter -->
			<select
				bind:value={categoryFilter}
				class="px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 text-gray-800 font-medium hover:shadow-md cursor-pointer"
			>
				{#each categories as cat}
					<option value={cat}>{cat}</option>
				{/each}
			</select>
		</div>

		<!-- Action Buttons Section -->
		<div class="flex items-center gap-3">
		<!-- Add New Item Button -->
		<button
			class="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-3"
			on:click={() => {
			showModal = true;          // ✅ open Add modal
			showDeductModal = false;   // ✅ close Deduct modal
			}}>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
			</svg>
			Add New Item
		</button>

		<!-- Deduct Item Button -->
		<button
			class="px-8 py-4 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-3"
			on:click={() => {
			showDeductModal = true;    // ✅ open Deduct modal
			showModal = false;         // ✅ close Add modal
			deductProductName = '';	
			deductAmount = '';
			}}>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
			</svg>
			Deduct Item
		</button>
		</div>

			
					</div>
				</div>
			</div>

			<!-- ✅ Table -->
			<div class="flex-1 overflow-auto p-6">
				<div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-auto max-h-full">
					<table class="w-full">
						<thead
							class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 sticky top-0 z-10">
							<tr>
								<th class="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider"></th>
								<th class="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Item
									Name</th>
								<th
									class="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">
									Description</th>
								<th
									class="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">
									Quantity</th>
								<th
									class="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">
									Status</th>
								<th
									class="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">
									Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each filteredItems as item (item.id)}
								<tr class="hover:bg-gray-50 transition-colors duration-200">
									<td class="px-6 py-5">
										<button 
											on:click={() => openImageModal(item)}
											class="relative group cursor-pointer">
											<img 
												src={item.imageUrl || defaultImageUrl} 
												alt={item.name}
												class="w-16 h-16 object-cover rounded-xl shadow-md group-hover:opacity-75 transition-opacity duration-200" />
											<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 rounded-xl">
												<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
												</svg>
											</div>
										</button>
									</td>
									<td class="px-6 py-5">
										<div class="flex items-center">
											<!-- <div -->
												<!-- class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4"> -->
												<!-- <span class="text-white font-semibold text-sm">{item.name.charAt(0).toUpperCase()}</span> -->
											<!-- </div> -->
											<div>
												<p class="text-lg font-semibold text-gray-800">{item.name}</p>
												<p class="text-sm text-gray-500">ID: {item.uniqueId}</p>
											</div>
										</div>
									</td>
									<td class="px-6 py-5">
										<p class="text-gray-700 max-w-xs break-words">{item.description || 'No description'}</p>
									</td>
									<td class="px-6 py-5 text-center">
										<span class="text-2xl font-bold text-gray-800">{item.quantity}</span>
									</td>
		<td class="px-6 py-5 text-center">
		<div class="flex items-center justify-center gap-2 h-full">
			<!-- Stock Status -->
			{#if isLowStock(item.quantity)}
			<span
				class="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
				Low Stock
			</span>
			{:else}
			<span
				class="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
				In Stock
			</span>
			{/if}

			<!-- Expiration Alert -->
			{#if isNearExpiration(item.expirationDate)}
			<span
				class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
				⚠️ Expiring Soon
			</span>
			{/if}
		</div>	
		</td>


									<td class="px-6 py-5 text-center">
										<div class="flex items-center justify-center gap-2">
											<button
												class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
												on:click={() => startEdit(item)}>
												Edit
											</button>
											<button
												class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
												on:click={() => deleteItem(item.id)}>
												Delete
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					{#if filteredItems.length === 0}
						<div class="text-center py-16">
							<h3 class="text-xl font-semibold text-gray-700 mb-2">No items found</h3>
							<p class="text-gray-500 mb-6">
								{searchQuery ? 'Try adjusting your search criteria' : 'Get started by adding your first item'}
							</p>
							{#if !searchQuery}
								<button
									class="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-300"
									on:click={() => (showModal = true)}>
									Add Your First Item
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- ✅ Snackbar -->
		{#if showSnackbar}
			<div
				class="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-3">
				<span class="font-medium">{snackbarMessage}</span>
			</div>
		{/if}

	<!-- ✅ Image Upload Modal -->
	{#if showImageModal && selectedItemForImage}
		<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
			on:click={closeImageModal}>
			<div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
				on:click|stopPropagation>
				<!-- Modal Header -->
				<div class="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
					<div class="flex items-center justify-between">	
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
								<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
								</svg>
							</div>
							<h2 class="text-2xl font-bold text-white">Update Item Image</h2>
						</div>
						<button 
							on:click={closeImageModal}
							class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors duration-200">
							<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
							</svg>
						</button>
					</div>
				</div>

					<!-- Modal Body -->
					<div class="p-8">
						<div class="text-center mb-6">
							<img 
								src={selectedItemForImage.imageUrl || defaultImageUrl} 
								alt={selectedItemForImage.name}
								class="w-48 h-48 object-cover rounded-2xl mx-auto shadow-lg mb-4" />
							<h3 class="text-xl font-bold text-gray-800">{selectedItemForImage.name}</h3>
							<p class="text-sm text-gray-500">Click below to upload a new image</p>
						</div>

						<label class="block">	
							<input
								type="file"
								accept="image/*"
								on:change={handleImageUpload}
								disabled={uploadingImage}
								class="hidden" />
							<div class="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2 {uploadingImage ? 'opacity-60 cursor-not-allowed' : ''}">
								{#if uploadingImage}
									<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Uploading to ImgBB...
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
									</svg>
									Choose Image
								{/if}
							</div>
						</label>

						<p class="text-xs text-gray-500 text-center mt-4">
							Supported formats: JPG, PNG, GIF (Max 32MB)
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- ✅ Add/Edit Item Modal -->
		{#if showModal}
			<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
				on:click={closeModal}>
				<div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300"
					on:click|stopPropagation>
					<!-- Modal Header -->
					<div class="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
									<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										{#if isEditing}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
										{:else}
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
										{/if}
									</svg>
								</div>
								<h2 class="text-2xl font-bold text-white">{isEditing ? 'Edit Item' : 'Add New Item'}</h2>
							</div>
							<button 
								on:click={closeModal}
								class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors duration-200">
								<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
								</svg>
							</button>
						</div>
					</div>
					

					<!-- Modal Body -->
				<div class="p-8">
					<!-- Two Column Grid Layout -->
					<div class="grid grid-cols-2 gap-6">
						<!-- Left Column -->
						<div class="space-y-5">
							<!-- Item Name Input -->
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-2">
									Item Name <span class="text-red-500">*</span>
								</label>
								<div class="relative">
									<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
										</svg>
									</div>
									<input 
										type="text" 
										placeholder="Enter item name" 
										bind:value={newItem.name}
										class="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg text-gray-800 placeholder-gray-400" />
								</div>
							</div>

							<!-- Quantity Input -->
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-2">
									Quantity <span class="text-red-500">*</span>
								</label>
								<div class="relative">
									<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
										</svg>
									</div>
									<input 
										type="number" 
										placeholder="Enter quantity" 
										bind:value={newItem.quantity}
										min="0"
										class="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg text-gray-800 placeholder-gray-400" />
								</div>
							</div>

							<!-- Category Dropdown -->
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-2">
									Category <span class="text-red-500">*</span>
								</label>
								<div class="relative">
									<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
										</svg>
									</div>
									<select
										bind:value={newItem.category}
										class="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg text-gray-800"
										required>
										<option value="" disabled>Select Category</option>
										<option value="Frozen Product">Frozen Product</option>
										<option value="Warehouse Product">Warehouse Product</option>
										<option value="Fresh Produce">Fresh Produce</option>
										<option value="Grocery Item">Grocery Item</option>
										<option value="Restaurant Supply">Restaurant Supply</option>
										<option value="Personal Care">Personal Care</option>
									</select>
								</div>
							</div>

							<!-- Production Date -->
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-2">
									Production Date
								</label>
								<input
									type="date"
									bind:value={newItem.productionDate}
									class="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg text-gray-800" />
							</div>
						</div>

						<!-- Right Column -->
						<div class="space-y-5">
							<!-- Description Input -->
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-2">
									Description
								</label>
								<div class="relative">
									<div class="absolute left-4 top-4 text-gray-400">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
										</svg>
									</div>
									<textarea 
										placeholder="Enter description (optional)" 
										bind:value={newItem.description}
										rows="3"
										class="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg text-gray-800 placeholder-gray-400 resize-none"></textarea>
								</div>
							</div>

							<!-- Expiration Date -->
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-2">
									Expiration Date
								</label>
								<input
									type="date"
									bind:value={newItem.expirationDate}
									class="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg text-gray-800" />
							</div>

							<!-- Image Upload (Optional) -->
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-2">
									Item Image <span class="text-gray-500 text-sm font-normal">(optional)</span>
								</label>

								<div class="relative flex items-center gap-4">
									<!-- Image Preview -->
									{#if previewUrl}
										<img
											src={previewUrl}
											alt="Preview"
											class="w-20 h-20 object-cover rounded-xl border-2 border-gray-200" />
									{:else}
										<img
											src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&h=100&fit=crop"
											alt="Default"
											class="w-20 h-20 object-cover rounded-xl border-2 border-gray-200" />
									{/if}

									<!-- Upload Button -->
									<button
										type="button"
										class="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-gray-700 font-semibold text-sm transition-all duration-300 hover:shadow-md active:scale-95 flex items-center"
										on:click={() => fileInput?.click()}>
										<svg
											class="inline-block w-5 h-5 mr-2 text-gray-600"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 4v16m8-8H4" />
										</svg>
										Select Image
									</button>

									<!-- Hidden File Input -->
									<input
										type="file"
										bind:this={fileInput}
										accept="image/*"
										class="hidden"
										on:change={async (event: Event) => {
											const input = event.target as HTMLInputElement;
											const file = input.files?.[0];
											if (file) {
												const compressedFile = await compressImage(file);
												newItem.imageFile = compressedFile;
												previewUrl = URL.createObjectURL(compressedFile);
											}
										}} />
								</div>
							</div>
						</div>
					</div>

						<!-- Action Buttons -->
						<div class="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
							<button 
								class="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-300 hover:shadow-md active:scale-95"
								on:click={closeModal}>
								Cancel
							</button>
							<button 
								class="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
								on:click={isEditing ? saveEdit : addItem}>
								{#if isEditing}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
									</svg>
									Save Changes
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
									</svg>
									Add Item
								{/if}
							</button>	
						</div>
					</div>
				</div>
			</div>
		{/if}


	{#if showDeductModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
		on:click={() => closeDeductModal()}>
		<div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
		on:click|stopPropagation>
		<!-- Modal Header -->
		<div class="bg-gradient-to-r from-yellow-500 to-amber-600 px-8 py-6">
			<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
				<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
				</svg>
				</div>
				<h2 class="text-2xl font-bold text-white">Deduct / Use Item</h2>
			</div>
			<button 
				on:click={closeDeductModal}
				class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors duration-200">
				<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
				</svg>
			</button>
			</div>
		</div>

		<!-- Modal Body -->
		<div class="p-8">
			<div class="space-y-5">
			<!-- Product Selection -->
			<div>
				<label class="block text-sm font-semibold text-gray-700 mb-2">
				Select Product <span class="text-red-500">*</span>
				</label>
				<div class="relative">
				<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
					</svg>
				</div>
				<select
					bind:value={deductProductName}
					class="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-yellow-500 focus:bg-white transition-all duration-300 focus:shadow-lg text-gray-800"
					required>
					<option value="" disabled selected>Choose a product</option>
					{#each [...new Set(items.map(i => i.name))] as productName}
					<option value={productName}>{productName}</option>
					{/each}
				</select>
				</div>
			</div>

			<!-- Quantity to Deduct -->
			<div>
				<label class="block text-sm font-semibold text-gray-700 mb-2">
				Quantity to Deduct <span class="text-red-500">*</span>
				</label>
				<div class="relative">
				<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
					</svg>
				</div>
				<input
					type="number"
					min="1"
					placeholder="Enter quantity"
					bind:value={deductAmount}
					class="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-yellow-500 focus:bg-white transition-all duration-300 focus:shadow-lg text-gray-800 placeholder-gray-400"
				/>
				</div>
			</div>

			<!-- Info Box -->
			<div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-xl">
				<p class="text-sm text-yellow-800">
				<strong>FIFO Method:</strong> Items will be automatically deducted from the batch that expires first.
				</p>
			</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
			<button 
				class="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all duration-300 hover:shadow-md active:scale-95"
				on:click={closeDeductModal}>
				Cancel
			</button>
			<button 
				class="px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
				on:click={handleDeductSubmit}>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
				</svg>
				Deduct Stock
			</button>
			</div>
		</div>
		</div>
	</div>
	{/if}
