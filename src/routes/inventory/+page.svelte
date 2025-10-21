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
		uniqueId?: string;
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
	let fileInput: HTMLInputElement | null = null;
	let previewUrl: string | null = null;
	let showDeductModal = false;
	let deductProductName = '';
	let deductAmount = '';
	let alertThreshold = 7;
	let categoryFilter = "All";

	const defaultImageUrl = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=400&fit=crop';
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
		category: string;
		productionDate: string;
		expirationDate: string;
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

	let formErrors: {
		name?: string;
		quantity?: string;
		category?: string;
		description?: string;
		productionDate?: string;
		expirationDate?: string;
	} = {};

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

	async function compressImage(file: File): Promise<File> {
		const bitmap = await createImageBitmap(file);
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;
		canvas.width = 800;
		canvas.height = (bitmap.height / bitmap.width) * 800;
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

		return new Promise((resolve) => {
			canvas.toBlob(
				(blob) => resolve(new File([blob!], file.name, { type: file.type })),
				file.type,
				0.7
			);
		});
	}

	function validateForm(): boolean {
		formErrors = {};

		if (!newItem.name.trim()) {
			formErrors.name = 'Item name is required';
		}

		if (!newItem.quantity || Number(newItem.quantity) <= 0) {
			formErrors.quantity = 'Quantity must be greater than 0';
		}

		if (!newItem.category.trim()) {
			formErrors.category = 'Category is required';
		}

		if (!newItem.description.trim()) {
			formErrors.description = 'Description is required';
		}

		if (!newItem.productionDate.trim()) {
			formErrors.productionDate = 'Production date is required';
		}

		if (!newItem.expirationDate.trim()) {
			formErrors.expirationDate = 'Expiration date is required';
		}

		return Object.keys(formErrors).length === 0;
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

	$: [searchQuery, categoryFilter], filterItems();

	function isLowStock(quantity: number): boolean {
		return quantity <= lowStockThreshold;
	}

	async function addItem() {
		try {
			if (!validateForm()) {
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

			const docs = snapshot.docs.sort((a, b) => {
				const dateA = a.data().expirationDate || '9999-12-31';
				const dateB = b.data().expirationDate || '9999-12-31';
				return dateA.localeCompare(dateB);
			});

			let remaining = amountToDeduct;
			let totalAvailable = 0;

			docs.forEach((doc) => {
				totalAvailable += Number(doc.data().quantity) || 0;
			});

			if (totalAvailable < remaining) {
				alert(`Not enough stock. Available: ${totalAvailable}, Requested: ${amountToDeduct}`);
				return;
			}

			const batch = writeBatch(db);
			let deductedDetails = [];

			for (const docSnap of docs) {
				if (remaining <= 0) break;

				const data = docSnap.data();
				const docRef = doc(db, 'inventory', docSnap.id);
				const qty = Number(data.quantity) || 0;
				const expDate = data.expirationDate || 'No date';

				if (qty > remaining) {
					batch.update(docRef, { quantity: qty - remaining });
					deductedDetails.push(`${remaining} from batch (expires ${expDate})`);
					remaining = 0;
				} else {
					batch.delete(docRef);
					deductedDetails.push(`${qty} from batch (expires ${expDate})`);
					remaining -= qty;
				}
			}

			await batch.commit();
			await loadItems();

			triggerSnackbar(`✅ Deducted ${amountToDeduct} ${deductProductName} using FIFO method`);
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

		showModal = true;
	}

	async function saveEdit() {
		if (!editingId) return;

		if (!validateForm()) {
			return;
		}

		const originalItem = items.find(item => item.id === editingId);
		if (!originalItem) return;

		let imageUrl = originalItem.imageUrl;

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

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0 || !selectedItemForImage) return;

		const file = input.files[0];

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file');
			return;
		}

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
			const base64Image = await fileToBase64(file);

			const formData = new FormData();
			formData.append('image', base64Image.split(',')[1]);

			const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
				method: 'POST',
				body: formData
			});

			const data = await response.json();

			if (data.success) {
				const imageUrl = data.data.url;

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

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = error => reject(error);
		});
	}
</script>

<div class="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">


	<!-- Page Header -->
	<div class="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
		<h2 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Inventory Items</h2>
		<p class="text-sm sm:text-base text-gray-600 mt-1">Smart Quantity Logistics - Manage your inventory items</p>
	</div>

	<!-- Search & Filter Bar -->
	<div class="flex-shrink-0 px-4 sm:px-6 lg:px-8 pb-4">
		<div class="bg-white rounded-lg sm:rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100">
			<div class="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
				<!-- Search Input -->
				<div class="relative flex-1 w-full">
					<input
						type="text"
						placeholder="Search items..."
						bind:value={searchQuery}
						class="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-gray-50 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-sm sm:text-base"
					/>
					<svg class="absolute left-3 top-2.5 sm:top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
				</div>

				<!-- Category Filter -->
				<select
					bind:value={categoryFilter}
					class="w-full sm:w-auto px-4 py-2.5 sm:py-3 bg-gray-50 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 text-sm sm:text-base"
				>
					{#each categories as cat}
						<option value={cat}>{cat}</option>
					{/each}
				</select>

				<!-- Action Buttons -->
				<div class="flex gap-2 w-full sm:w-auto">
					<button
						class="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm sm:text-base rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
						on:click={() => { showModal = true; showDeductModal = false; }}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
						</svg>
						<span class="hidden sm:inline">Add New Item</span>
						<span class="sm:hidden">Add</span>
					</button>

					<button
						class="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white text-sm sm:text-base rounded-lg sm:rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
						on:click={() => { showDeductModal = true; showModal = false; }}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
						</svg>
						<span class="hidden sm:inline">Deduct Item</span>
						<span class="sm:hidden">Use</span>
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Items Container -->
	<div class="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
		{#if filteredItems.length === 0}
			<div class="text-center py-16">
				<h3 class="text-lg sm:text-xl font-semibold text-gray-700 mb-2">No items found</h3>
				<p class="text-sm sm:text-base text-gray-500">
					{searchQuery ? 'Try adjusting your search criteria' : 'Get started by adding your first item'}
				</p>
			</div>
		{:else}
			<!-- Mobile Card View -->
			<div class="sm:hidden space-y-4 pb-8">
				{#each filteredItems as item (item.id)}
					<div class="bg-white rounded-lg p-4 shadow-lg border border-gray-100">
						<!-- Image & Basic Info -->
						<div class="flex gap-3 mb-4">
							<button on:click={() => openImageModal(item)} class="relative group flex-shrink-0">
								<img
									src={item.imageUrl || defaultImageUrl}
									alt={item.name}
									class="w-20 h-20 object-cover rounded-lg shadow-md group-hover:opacity-75 transition-opacity"
								/>
								<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
									<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
									</svg>
								</div>
							</button>

							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-gray-900 text-base truncate">{item.name}</h3>
								<p class="text-xs text-gray-500">ID: {item.uniqueId}</p>
								<p class="text-sm text-gray-700 mt-1 line-clamp-2">{item.description}</p>
							</div>
						</div>

						<!-- Quantity -->
						<div class="flex items-center justify-between mb-3">
							<span class="text-3xl font-bold text-gray-900">{item.quantity}</span>
							<span class="text-xs text-gray-500">units</span>
						</div>

						<!-- Status Badges -->
						<div class="flex flex-wrap gap-2 mb-3">
							{#if isLowStock(item.quantity)}
								<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
									Low Stock
								</span>
							{:else}
								<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
									In Stock
								</span>
							{/if}

							{#if isNearExpiration(item.expirationDate)}
								<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
									⚠️ Expiring
								</span>
							{/if}
						</div>

						<!-- Category & Dates -->
						<div class="text-sm text-gray-600 space-y-1 mb-4 pb-4 border-b border-gray-200">
							<p><span class="font-medium">Category:</span> {item.category || 'N/A'}</p>
							{#if item.expirationDate}
								<p><span class="font-medium">Expires:</span> {new Date(item.expirationDate).toLocaleDateString()}</p>
							{/if}
						</div>

						<!-- Action Buttons -->
						<div class="flex gap-2">
							<button
								class="flex-1 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-all"
								on:click={() => startEdit(item)}
							>
								Edit
							</button>
							<button
								class="flex-1 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all"
								on:click={() => deleteItem(item.id)}
							>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop Table View -->
			<div class="hidden sm:block bg-white rounded-lg sm:rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
				<table class="w-full">
					<thead class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 sticky top-0">
						<tr>
							<th class="px-6 py-5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider"></th>
							<th class="px-6 py-5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item Name</th>
							<th class="px-6 py-5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Description</th>
							<th class="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Quantity</th>
							<th class="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
							<th class="px-6 py-5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each filteredItems as item (item.id)}
							<tr class="hover:bg-gray-50 transition-colors">
								<td class="px-6 py-5">
									<button on:click={() => openImageModal(item)} class="relative group cursor-pointer">
										<img
											src={item.imageUrl || defaultImageUrl}
											alt={item.name}
											class="w-16 h-16 object-cover rounded-lg shadow-md group-hover:opacity-75 transition-opacity"
										/>
										<div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg">
											<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
											</svg>
										</div>
									</button>
								</td>
								<td class="px-6 py-5">
									<div>
										<p class="text-base font-semibold text-gray-900">{item.name}</p>
										<p class="text-sm text-gray-600">ID: {item.uniqueId}</p>
									</div>
								</td>
								<td class="px-6 py-5">
									<p class="text-base text-gray-700 max-w-xs break-words">{item.description || 'No description'}</p>
								</td>
								<td class="px-6 py-5 text-center">
									<span class="text-2xl font-bold text-gray-900">{item.quantity}</span>
								</td>
								<td class="px-6 py-5 text-center">
									<div class="flex items-center justify-center gap-2 flex-wrap">
										{#if isLowStock(item.quantity)}
											<span class="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
												Low Stock
											</span>
										{:else}
											<span class="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
												In Stock
											</span>
										{/if}

										{#if isNearExpiration(item.expirationDate)}
											<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
												⚠️ Expiring
											</span>
										{/if}
									</div>
								</td>
								<td class="px-6 py-5 text-center">
									<div class="flex items-center justify-center gap-2">
										<button
											class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-all"
											on:click={() => startEdit(item)}
										>
											Edit
										</button>
										<button
											class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-all"
											on:click={() => deleteItem(item.id)}
										>
											Delete
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Snackbar Notification -->
{#if showSnackbar}
	<div class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300 text-sm sm:text-base">
		<span class="font-medium">{snackbarMessage}</span>
	</div>
{/if}

<!-- Image Upload Modal -->
{#if showImageModal && selectedItemForImage}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
			<!-- Modal Header -->
			<div class="bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-8 py-4 sm:py-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 sm:gap-3">
						<div class="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center">
							<svg class="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
							</svg>
						</div>
						<h2 class="text-lg sm:text-2xl font-bold text-white">Update Item Image</h2>
					</div>
					<button 
						on:click={closeImageModal}
						class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors duration-200"
					>
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="p-4 sm:p-8">
				<div class="text-center mb-6">
					<img 
						src={selectedItemForImage.imageUrl || defaultImageUrl} 
						alt={selectedItemForImage.name}
						class="w-32 h-32 sm:w-48 sm:h-48 object-cover rounded-2xl mx-auto shadow-lg mb-4"
					/>
					<h3 class="text-lg sm:text-xl font-bold text-gray-800">{selectedItemForImage.name}</h3>
					<p class="text-xs sm:text-sm text-gray-500 mt-1">Click below to upload a new image</p>
				</div>

				<label class="block">
					<input
						type="file"
						accept="image/*"
						on:change={handleImageUpload}
						disabled={uploadingImage}
						class="hidden"
					/>
					<div class="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg sm:rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2 {uploadingImage ? 'opacity-60 cursor-not-allowed' : ''} text-sm sm:text-base">
						{#if uploadingImage}
							<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
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

<!-- Add/Edit Item Modal -->
{#if showModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200 overflow-y-auto">
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 md:my-auto overflow-hidden animate-in zoom-in-95 duration-300">
			<!-- Modal Header -->
			<div class="bg-gradient-to-r from-blue-600 to-purple-600 px-4 sm:px-8 py-4 sm:py-6 sticky top-0">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 sm:gap-3">
						<div class="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center">
							<svg class="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{#if isEditing}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
								{:else}
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
								{/if}
							</svg>
						</div>
						<h2 class="text-lg sm:text-2xl font-bold text-white">{isEditing ? 'Edit Item' : 'Add New Item'}</h2>
					</div>
					<button 
						on:click={closeModal}
						class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors duration-200"
					>
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="p-4 sm:p-8">
				<!-- Two Column Grid Layout -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
					<!-- Left Column -->
					<div class="space-y-4">
						<!-- Item Name -->
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-2">
								Item Name <span class="text-red-500">*</span>
							</label>
							<input 
								type="text" 
								placeholder="Enter item name" 
								bind:value={newItem.name}
								class="w-full px-3 sm:px-4 py-2.5 bg-gray-50 border-2 {formErrors.name ? 'border-red-500' : 'border-gray-200'} rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-sm sm:text-base"
							/>
							{#if formErrors.name}
								<p class="text-red-500 text-xs mt-1">{formErrors.name}</p>
							{/if}
						</div>

						<!-- Quantity -->
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-2">
								Quantity <span class="text-red-500">*</span>
							</label>
							<input 
								type="number" 
								placeholder="Enter quantity" 
								bind:value={newItem.quantity}
								min="0"
								class="w-full px-3 sm:px-4 py-2.5 bg-gray-50 border-2 {formErrors.quantity ? 'border-red-500' : 'border-gray-200'} rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-sm sm:text-base"
							/>
							{#if formErrors.quantity}
								<p class="text-red-500 text-xs mt-1">{formErrors.quantity}</p>
							{/if}
						</div>

						<!-- Category -->
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-2">
								Category <span class="text-red-500">*</span>
							</label>
							<select
								bind:value={newItem.category}
								class="w-full px-3 sm:px-4 py-2.5 bg-gray-50 border-2 {formErrors.category ? 'border-red-500' : 'border-gray-200'} rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-sm sm:text-base"
								required
							>
								<option value="" disabled>Select Category</option>
								<option value="Frozen Product">Frozen Product</option>
								<option value="Warehouse Product">Warehouse Product</option>
								<option value="Fresh Produce">Fresh Produce</option>
								<option value="Grocery Item">Grocery Item</option>
								<option value="Restaurant Supply">Restaurant Supply</option>
								<option value="Personal Care">Personal Care</option>
							</select>
							{#if formErrors.category}
								<p class="text-red-500 text-xs mt-1">{formErrors.category}</p>
							{/if}
						</div>

						<!-- Production Date -->
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-2">
								Production Date <span class="text-red-500">*</span>
							</label>
							<input
								type="date"
								bind:value={newItem.productionDate}
								class="w-full px-3 sm:px-4 py-2.5 bg-gray-50 border-2 {formErrors.productionDate ? 'border-red-500' : 'border-gray-200'} rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-sm sm:text-base"
							/>
							{#if formErrors.productionDate}
								<p class="text-red-500 text-xs mt-1">{formErrors.productionDate}</p>
							{/if}
						</div>
					</div>

					<!-- Right Column -->
					<div class="space-y-4">
						<!-- Description -->
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-2">
								Description <span class="text-red-500">*</span>
							</label>
							<textarea 
								placeholder="Enter description"
								bind:value={newItem.description}
								rows="3"
								class="w-full px-3 sm:px-4 py-2.5 bg-gray-50 border-2 {formErrors.description ? 'border-red-500' : 'border-gray-200'} rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-sm sm:text-base resize-none"
							/>
							{#if formErrors.description}
								<p class="text-red-500 text-xs mt-1">{formErrors.description}</p>
							{/if}
						</div>

						<!-- Expiration Date -->
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-2">
								Expiration Date <span class="text-red-500">*</span>
							</label>
							<input
								type="date"
								bind:value={newItem.expirationDate}
								class="w-full px-3 sm:px-4 py-2.5 bg-gray-50 border-2 {formErrors.expirationDate ? 'border-red-500' : 'border-gray-200'} rounded-lg sm:rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-sm sm:text-base"
							/>
							{#if formErrors.expirationDate}
								<p class="text-red-500 text-xs mt-1">{formErrors.expirationDate}</p>
							{/if}
						</div>

						<!-- Image Upload -->
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-2">
								Item Image <span class="text-gray-500 font-normal text-xs">(optional)</span>
							</label>
							<div class="flex items-center gap-3">
								{#if previewUrl}
									<img
										src={previewUrl}
										alt="Preview"
										class="w-16 h-16 object-cover rounded-lg border-2 border-gray-200"
									/>
								{:else}
									<img
										src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&h=100&fit=crop"
										alt="Default"
										class="w-16 h-16 object-cover rounded-lg border-2 border-gray-200"
									/>
								{/if}
								<button
									type="button"
									class="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-700 font-semibold text-xs sm:text-sm transition-all"
									on:click={() => fileInput?.click()}
								>
									Select Image
								</button>
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
									}}
								/>
							</div>
						</div>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-2 pt-4 border-t border-gray-200">
					<button 
						class="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all text-sm sm:text-base"
						on:click={closeModal}
					>
						Cancel
					</button>
					<button 
						class="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all text-sm sm:text-base"
						on:click={isEditing ? saveEdit : addItem}
					>
						{isEditing ? 'Save Changes' : 'Add Item'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Deduct Modal -->
{#if showDeductModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
		<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
			<!-- Modal Header -->
			<div class="bg-gradient-to-r from-yellow-500 to-amber-600 px-4 sm:px-8 py-4 sm:py-6">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 sm:gap-3">
						<div class="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl flex items-center justify-center">
							<svg class="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
							</svg>
						</div>
						<h2 class="text-lg sm:text-2xl font-bold text-white">Deduct / Use Item</h2>
					</div>
					<button 
						on:click={closeDeductModal}
						class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
					>
						<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="p-4 sm:p-8 space-y-4">
				<!-- Product Selection -->
				<div>
					<label class="block text-sm font-semibold text-gray-700 mb-2">
						Select Product <span class="text-red-500">*</span>
					</label>
					<select
						bind:value={deductProductName}
						class="w-full px-3 sm:px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:border-yellow-500 focus:bg-white transition-all text-sm sm:text-base"
						required
					>
						<option value="" disabled selected>Choose a product</option>
						{#each [...new Set(items.map(i => i.name))] as productName}
							<option value={productName}>{productName}</option>
						{/each}
					</select>
				</div>

				<!-- Quantity to Deduct -->
				<div>
					<label class="block text-sm font-semibold text-gray-700 mb-2">
						Quantity to Deduct <span class="text-red-500">*</span>
					</label>
					<input
						type="number"
						min="1"
						placeholder="Enter quantity"
						bind:value={deductAmount}
						class="w-full px-3 sm:px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:border-yellow-500 focus:bg-white transition-all text-sm sm:text-base"
					/>
				</div>

				<!-- Info Box -->
				<div class="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-lg">
					<p class="text-xs sm:text-sm text-yellow-800">
						<strong>FIFO Method:</strong> Items will be deducted from the batch that expires first.
					</p>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-2 pt-4 border-t border-gray-200">
					<button 
						class="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all text-sm sm:text-base"
						on:click={closeDeductModal}
					>
						Cancel
					</button>
					<button 
						class="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white rounded-lg font-semibold transition-all text-sm sm:text-base"
						on:click={handleDeductSubmit}
					>
						Deduct Stock
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}