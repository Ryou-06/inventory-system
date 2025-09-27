<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import {
		collection,
		getDocs,
		addDoc,
		updateDoc,
		deleteDoc,
		doc
	} from 'firebase/firestore';

	interface Item {
		id: string;
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
					quantity: data.quantity
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

			await addDoc(collection(db, 'inventory'), {
				name: newItem.name,
				description: newItem.description,
				quantity: Number(newItem.quantity)
			});
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

<h1 class="text-2xl font-bold mb-4">Inventory</h1>

<!-- Snackbar -->
{#if showSnackbar}
	<div class="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded shadow-lg z-50 transition-opacity duration-300"
		style="min-width: 200px; text-align: center;">
		{snackbarMessage}
	</div>
{/if}

<div class="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
	<input
		type="text"
		placeholder="Search items..."
		bind:value={searchQuery}
		class="w-full md:w-64 px-4 py-2 border rounded-lg"
	/>
	<button
		class="w-full md:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
		on:click={() => (showModal = true)}
	>
		➕ Add Item
	</button>
</div>

<div class="overflow-x-auto">
	<table class="w-full border-collapse border border-gray-300">
		<thead class="bg-gray-100">
			<tr>
				<th class="border border-gray-300 px-4 py-2">Name</th>
				<th class="border border-gray-300 px-4 py-2">Description</th>
				<th class="border border-gray-300 px-4 py-2">Quantity</th>
				<th class="border border-gray-300 px-4 py-2">Status</th>
				<th class="border border-gray-300 px-4 py-2">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each filteredItems as item (item.id)}
				<tr class="hover:bg-gray-50">
					<td class="border border-gray-300 px-4 py-2">{item.name}</td>
					<td class="border border-gray-300 px-4 py-2">{item.description}</td>
					<td class="border border-gray-300 px-4 py-2">{item.quantity}</td>
					<td class="border border-gray-300 px-4 py-2">
						{#if isLowStock(item.quantity)}
							<span class="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm">
								Low Stock
							</span>
						{:else}
							<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
								In Stock
							</span>
						{/if}
					</td>
					<td class="border border-gray-300 px-4 py-2 text-center">
						<button
							class="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
							on:click={() => startEdit(item)}
						>
							✏️ Edit
						</button>
						<button
							class="ml-2 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
							on:click={() => deleteItem(item.id)}
						>
							🗑 Delete
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if showModal}
	<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
		<div class="bg-white p-6 rounded-lg shadow-lg w-96">
			<h2 class="text-xl font-bold mb-4">
				{isEditing ? 'Edit Item' : 'Add Item'}
			</h2>
			<input
				type="text"
				placeholder="Name *"
				bind:value={newItem.name}
				class="w-full border p-2 mb-2 rounded"
				required
			/>
			<input
				type="text"
				placeholder="Description"
				bind:value={newItem.description}
				class="w-full border p-2 mb-2 rounded"
			/>
			<input
				type="number"
				placeholder="Quantity *"
				bind:value={newItem.quantity}
				class="w-full border p-2 mb-4 rounded"
				min="0"
				required
			/>
			<div class="flex justify-end space-x-2">
				<button
					class="px-4 py-2 bg-gray-400 text-white rounded"
					on:click={closeModal}
				>
					Cancel
				</button>
				{#if isEditing}
					<button
						class="px-4 py-2 bg-blue-600 text-white rounded"
						on:click={saveEdit}
					>
						Save
					</button>
				{:else}
					<button
						class="px-4 py-2 bg-green-600 text-white rounded"
						on:click={addItem}
					>
						Add
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}