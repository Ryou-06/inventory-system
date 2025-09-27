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
				quantity: Number(newItem.quantity)
			});

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

<div class="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">

	<!-- Header & Controls -->
	<div class="flex-shrink-0 p-6">
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

		<div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
			<div class="flex flex-col lg:flex-row justify-between items-center gap-4">
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

				<button
					class="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-3"
					on:click={() => (showModal = true)}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
					</svg>
					Add New Item
				</button>
			</div>
		</div>
	</div>

	<!-- Scrollable Table -->
	<div class="flex-1 overflow-auto p-6">
		<div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-auto max-h-full">
			<table class="w-full">
				<thead class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 sticky top-0 z-10">
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
										Low Stock
									</span>
								{:else}
									<span class="inline-flex items-center px-3 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
										In Stock
									</span>
								{/if}
							</td>
							<td class="px-6 py-5 text-center">
								<div class="flex items-center justify-center gap-2">
									<button
										class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
										on:click={() => startEdit(item)}
									>
										Edit
									</button>
									<button
										class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95"
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

			{#if filteredItems.length === 0}
				<div class="text-center py-16">
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

<!-- Snackbar -->
{#if showSnackbar}
	<div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-3">
		<span class="font-medium">{snackbarMessage}</span>
	</div>
{/if}

<!-- Modal -->
{#if showModal}
	<div 
		class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
		on:click={closeModal}
	>
		<div 
			class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-6"
			on:click|stopPropagation
		>
			<h2 class="text-2xl font-bold mb-4">{isEditing ? 'Edit Item' : 'Add New Item'}</h2>
			<div class="flex flex-col gap-4">
				<input type="text" placeholder="Item Name" bind:value={newItem.name} class="px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"/>
				<input type="text" placeholder="Description" bind:value={newItem.description} class="px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"/>
				<input type="number" placeholder="Quantity" bind:value={newItem.quantity} class="px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"/>
			</div>
			<div class="flex justify-end gap-4 mt-6">
				<button class="px-6 py-2 bg-gray-300 rounded-xl hover:bg-gray-400" on:click={closeModal}>Cancel</button>
				<button 
					class="px-6 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
					on:click={isEditing ? saveEdit : addItem}
				>
					{isEditing ? 'Save Changes' : 'Add Item'}
				</button>
			</div>
		</div>
	</div>
{/if}
