<script lang="ts">
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import { collection, getDocs } from 'firebase/firestore';

	interface Item {
		id: string;
		uniqueId: number;
		name: string;
		description: string;
		quantity: number;
	}

	let items: Item[] = [];
	let lowStockThreshold = 10;

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
			items = loadedItems;
		} catch (error) {
			console.error("Error fetching items:", error);
		}
	}

	function isLowStock(quantity: number): boolean {
		return quantity <= lowStockThreshold;
	}

	// Statistics
	$: totalItems = items.length;
	$: lowStockItems = items.filter(item => isLowStock(item.quantity)).length;
	$: totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
</script>

<!-- Dashboard Container with gradient background -->
<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
	<div class="max-w-7xl mx-auto">
		
		<!-- Dashboard Header -->
		<div class="mb-8">
			<div class="flex items-center gap-4 mb-6">
				<div class="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center">
					<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
					</svg>
				</div>
				<div>
					<h1 class="text-4xl font-bold text-gray-800 mb-2">Inventory Management</h1>
					<p class="text-gray-600">Overview of your inventory system</p>
				</div>
			</div>
		</div>

		<!-- Statistics Cards -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
			<div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Items</p>
						<p class="text-3xl font-bold text-gray-800 mt-1">{totalItems}</p>
						<p class="text-sm text-gray-500 mt-1">Items in inventory</p>
					</div>
					<div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
						</svg>
					</div>
				</div>
			</div>
			
			<div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-600 uppercase tracking-wide">Low Stock</p>
						<p class="text-3xl font-bold text-red-600 mt-1">{lowStockItems}</p>
						<p class="text-sm text-gray-500 mt-1">Items need restocking</p>
					</div>
					<div class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
						<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
						</svg>
					</div>
				</div>
			</div>
			
			<div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Quantity</p>
						<p class="text-3xl font-bold text-green-600 mt-1">{totalQuantity}</p>
						<p class="text-sm text-gray-500 mt-1">Units in stock</p>
					</div>
					<div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
						<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path>
						</svg>
					</div>
				</div>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-8">
			<h2 class="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
			<div class="flex flex-col sm:flex-row gap-4">
				<a 
					href="/inventory"
					class="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
					</svg>
					View All Items
				</a>
				
				<a 
					href="/inventory"
					class="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
					</svg>
					Add New Item
				</a>
			</div>
		</div>

		<!-- Recent Activity or Summary -->
		{#if lowStockItems > 0}
			<div class="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
						<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-bold text-red-800">Low Stock Alert</h3>
						<p class="text-red-700">You have {lowStockItems} items running low on stock</p>
					</div>
				</div>
				<a 
					href="/inventory"
					class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md"
				>
					View Low Stock Items
					<svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
					</svg>
				</a>
			</div>
		{:else}
			<div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
						<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-bold text-green-800">All Good!</h3>
						<p class="text-green-700">Your inventory is well-stocked with no low stock items</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>