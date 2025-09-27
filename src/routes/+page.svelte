<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import { collection, getDocs } from 'firebase/firestore';

	interface Item {
		id: string;
		name: string;
		description: string;
		quantity: number;
	}

	let items: Item[] = [];
	let totalItems = 0;
	let totalQuantity = 0;
	let lowStockItems = 0;
	let lowStockThreshold = 10;

	onMount(async () => {
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
		items = loadedItems;
		totalItems = items.length;
		totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
		lowStockItems = items.filter(item => item.quantity <= lowStockThreshold).length;
	});
</script>

<h1 class="text-2xl font-bold mb-4">Inventory Management</h1>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
	<div class="bg-blue-100 p-4 rounded-lg">
		<h3 class="font-bold text-blue-800">Total Items</h3>
		<p class="text-2xl">{totalItems}</p>
	</div>
	<div class="bg-green-100 p-4 rounded-lg">
		<h3 class="font-bold text-green-800">Total Quantity</h3>
		<p class="text-2xl">{totalQuantity}</p>
	</div>
	<div class="bg-red-100 p-4 rounded-lg">
		<h3 class="font-bold text-red-800">Low Stock Items</h3>
		<p class="text-2xl">{lowStockItems}</p>
	</div>
</div>

<a href="/inventory" class="inline-block px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition">
	View Inventory
</a>