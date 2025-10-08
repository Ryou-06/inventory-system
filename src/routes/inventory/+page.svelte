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
		where
	} from 'firebase/firestore';
	import { onAuthStateChanged, signOut } from 'firebase/auth';
	import { goto } from '$app/navigation';

	interface Item {
		id: string;
		uniqueId: number;
		name: string;
		description: string;
		quantity: number;
	}

	let items: Item[] = [];
	let filteredItems: Item[] = [];
	let showModal = false;
	let isEditing = false;
	let editingId: string | null = null;
	let searchQuery = '';
	let lowStockThreshold = 20;
	let userEmail: string | null = null;
	let loading = true;

	let newItem = {
		name: '',
		description: '',
		quantity: ''
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

	// ✅ Logout function
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
					uniqueId: data.uniqueId ?? 0
				});
			});

			loadedItems.sort((a, b) => a.name.localeCompare(b.name));
			items = loadedItems;
			filterItems();
		} catch (error) {
			console.error('Error fetching items:', error);
		}
	}

	function filterItems() {
		if (!searchQuery) {
			filteredItems = items;
		} else {
			const query = searchQuery.toLowerCase();
			filteredItems = items.filter(
				(item) =>
					item.name.toLowerCase().includes(query) ||
					item.description.toLowerCase().includes(query)
			);
		}
	}

	$: searchQuery, filterItems();

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

			await addDoc(collection(db, 'inventory'), {
				uniqueId: newId,
				name: newItem.name,
				description: newItem.description,
				quantity: Number(newItem.quantity),
				userId: user.uid,
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

	function startEdit(item: Item) {
		isEditing = true;
		editingId = item.id;
		newItem = {
			name: item.name,
			description: item.description,
			quantity: item.quantity.toString()
		};
		showModal = true;
	}

	async function saveEdit() {
		try {
			if (!editingId) return;
			await updateDoc(doc(db, 'inventory', editingId), {
				name: newItem.name,
				description: newItem.description,
				quantity: Number(newItem.quantity)
			});
			closeModal();
			await loadItems();
			triggerSnackbar('Successfully updated');
		} catch (error) {
			console.error('Error saving edit:', error);
		}
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
		newItem = { name: '', description: '', quantity: '' };
	}
</script>

<div class="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
	<!-- ✅ Header -->
	<div class="flex-shrink-0 p-6">
		<div class="flex items-center justify-between mb-8">
			<div class="flex items-center gap-4">
				<div
					class="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
					<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
					</svg>
				</div>
				<div>
					<h1 class="text-4xl font-bold text-gray-800 mb-2">Inventory Items</h1>
					<p class="text-gray-600">Manage your inventory items</p>
				</div>
			</div>
		</div>

		<!-- Search + Add -->
		<div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
			<div class="flex flex-col lg:flex-row justify-between items-center gap-4">
				<div class="relative flex-1 max-w-md">
					<input
						type="text"
						placeholder="Search items..."
						bind:value={searchQuery}
						class="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg" />
					<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
						</svg>
					</div>
				</div>

				<button
					class="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-3"
					on:click={() => (showModal = true)}>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
					</svg>
					Add New Item
				</button>
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
								<div class="flex items-center">
									<div
										class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4">
										<span class="text-white font-semibold text-sm">{item.name.charAt(0).toUpperCase()}</span>
									</div>
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

<!-- ✅ Modal -->
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