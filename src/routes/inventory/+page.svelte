<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import {
		collection,
		getDocs,
        getDoc, 
		addDoc,
		updateDoc,
		deleteDoc,
        setDoc,
		doc
	} from 'firebase/firestore';

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
	let lowStockThreshold = 10;

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
		loadItems();
	});

async function loadItems() {
	try {
		const querySnapshot = await getDocs(collection(db, 'inventory'));
		const loadedItems: Item[] = [];
		querySnapshot.forEach((docSnapshot) => {
			const data = docSnapshot.data();
			loadedItems.push({
				id: docSnapshot.id,
				name: data.name,
				description: data.description,
				quantity: data.quantity,
				// Include uniqueId if you want to display it
				uniqueId: data.uniqueId ?? 0
			});
		});
		loadedItems.sort((a, b) => a.name.localeCompare(b.name));
		items = loadedItems;
		filterItems();
	} catch (error) {
		console.error("Error fetching items:", error);
	}
}

	function filterItems() {
		if (!searchQuery) {
			filteredItems = items;
		} else {
			const query = searchQuery.toLowerCase();
			filteredItems = items.filter(
				item =>
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

		// Reference to counter doc
		const counterDoc = doc(db, 'counters', 'inventoryCounter');
		const counterSnapshot = await getDoc(counterDoc);

		let newId = 1;

		// If counter exists, increment lastId
		if (counterSnapshot.exists()) {
			const counterData = counterSnapshot.data();
			if (counterData.lastId) newId = counterData.lastId + 1;
		}

		// Add new item with uniqueId
		await addDoc(collection(db, 'inventory'), {
			uniqueId: newId,
			name: newItem.name,
			description: newItem.description,
			quantity: Number(newItem.quantity)
		});

		// Update counter (or create if it doesn't exist)
		await setDoc(counterDoc, { lastId: newId });

		closeModal();
		await loadItems();
		triggerSnackbar('Successfully added');
	} catch (error) {
		console.error("Error adding item:", error);
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
			console.error("Error saving edit:", error);
		}
	}

	async function deleteItem(id: string) {
		try {
			if (!confirm('Are you sure you want to delete this item?')) return;
			await deleteDoc(doc(db, 'inventory', id));
			await loadItems();
			triggerSnackbar('Successfully deleted');
		} catch (error) {
			console.error("Error deleting item:", error);
		}
	}

	function closeModal() {
		showModal = false;
		isEditing = false;
		editingId = null;
		newItem = { name: '', description: '', quantity: '' };
	}
</script>

<!-- Inventory Page Container -->
<div class="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
	<div class="flex-1 overflow-auto p-6">  
		
		<!-- Page Header -->
		<div class="mb-8">
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
					<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
					</svg>
				</div>
				<div>
					<h1 class="text-4xl font-bold text-gray-800 mb-2">Inventory Items</h1>
					<p class="text-gray-600">Manage your inventory items</p>
				</div>
			</div>
		</div>

		<!-- Controls Section -->
		<div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
			<div class="flex flex-col lg:flex-row justify-between items-center gap-4">
				<!-- Search Bar -->
				<div class="relative flex-1 max-w-md">
					<input
						type="text"
						placeholder="Search items..."
						bind:value={searchQuery}
						class="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg"
					/>
					<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
						</svg>
					</div>
				</div>

				<!-- Add Item Button -->
				<button
					class="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center gap-3"
					on:click={() => (showModal = true)}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
					</svg>
					Add New Item
				</button>
			</div>
		</div>

		<!-- Items Table -->
		<div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
						<tr>
							<th class="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Item Name</th>
							<th class="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Description</th>
							<th class="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Quantity</th>
							<th class="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Status</th>
							<th class="px-6 py-5 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each filteredItems as item (item.id)}
							<tr class="hover:bg-gray-50 transition-colors duration-200">
								<td class="px-6 py-5">
									<div class="flex items-center">
										<div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4">
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
										<span class="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
											<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
											</svg>
											Low Stock
										</span>
									{:else}
										<span class="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
											<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
											</svg>
											In Stock
										</span>
									{/if}
								</td>
								<td class="px-6 py-5 text-center">
									<div class="flex items-center justify-center gap-2">
										<button
											class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
											on:click={() => startEdit(item)}
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
											</svg>
											Edit
										</button>
										<button
											class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
											on:click={() => deleteItem(item.id)}
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
											</svg>
											Delete
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				
				<!-- Empty State -->
				{#if filteredItems.length === 0}
					<div class="text-center py-16">
						<div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
							<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
							</svg>
						</div>
						<h3 class="text-xl font-semibold text-gray-700 mb-2">No items found</h3>
						<p class="text-gray-500 mb-6">
							{searchQuery ? 'Try adjusting your search criteria' : 'Get started by adding your first item'}
						</p>
						{#if !searchQuery}
							<button
								class="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-300"
								on:click={() => (showModal = true)}
							>
								Add Your First Item
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Enhanced Snackbar -->
{#if showSnackbar}
	<div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-3">
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
		</svg>
		<span class="font-medium">{snackbarMessage}</span>
	</div>
{/if}

<!-- Modern Modal -->
{#if showModal}
	<div 
		class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300"
		on:click={closeModal}
	>
		<div 
			class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in slide-in-from-bottom-8 zoom-in-95 duration-300"
			on:click|stopPropagation
		>
			<div class="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 text-center overflow-hidden">
				<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-pulse"></div>
				
				<div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
					{#if isEditing}
						<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
						</svg>
					{:else}
						<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
						</svg>
					{/if}
				</div>
				
				<h2 class="text-2xl font-bold mb-2">
					{isEditing ? 'Edit Item' : 'Add New Item'}
				</h2>
				<p class="text-white/80 text-sm">
					{isEditing ? 'Update item information' : 'Fill in the details below'}
				</p>
			</div>

			<div class="p-8">
				<div class="mb-6">
					<label class="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
						Item Name <span class="text-red-500">*</span>
					</label>
					<div class="relative group">
						<input 
							type="text" 
							placeholder="Enter item name"
							bind:value={newItem.name}
							required
							class="w-full px-4 py-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg focus:-translate-y-0.5 group-hover:border-gray-300"
						>
						<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 .987.024 1.5.07l1.5.07V2a1 1 0 011-1h2a1 1 0 011 1v1.14l1.5-.07A10.51 10.51 0 0122 3h0a1 1 0 011 1v2a1 1 0 01-1 1h-1.5l-.5 2h.5a1 1 0 011 1v2a1 1 0 01-1 1H3a1 1 0 01-1-1V9a1 1 0 011-1h.5L4 6H3a1 1 0 01-1-1V3a1 1 0 011-1z"></path>
							</svg>
						</div>
					</div>
				</div>

				<div class="mb-6">
					<label class="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
						Description
					</label>
					<div class="relative group">
						<input 
							type="text" 
							placeholder="Enter description (optional)"
							bind:value={newItem.description}
							class="w-full px-4 py-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg focus:-translate-y-0.5 group-hover:border-gray-300"
						>
						<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
							</svg>
						</div>
					</div>
				</div>

				<div class="mb-8">
					<label class="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
						Quantity <span class="text-red-500">*</span>
					</label>
					<div class="relative group">
						<input 
							type="number" 
							placeholder="0"
							bind:value={newItem.quantity}
							min="0"
							required
							class="w-full px-4 py-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-300 focus:shadow-lg focus:-translate-y-0.5 group-hover:border-gray-300"
						>
						<div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
							</svg>
						</div>
					</div>
				</div>

				<div class="flex gap-3">
					<button
						class="flex-1 px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-semibold transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
						on:click={closeModal}
					>
						Cancel
					</button>
					
					{#if isEditing}
						<button
							class="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
							on:click={saveEdit}
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
							</svg>
							Update Item
						</button>
					{:else}
						<button
							class="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
							on:click={addItem}
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
							</svg>
							Add Item
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}