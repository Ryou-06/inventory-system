<script lang="ts">
	import { onMount } from 'svelte';
	import { db, auth } from '$lib/firebase';
	import { collection, getDocs, query, where } from 'firebase/firestore';
	import { onAuthStateChanged } from 'firebase/auth';
	import { goto } from '$app/navigation';

	interface Item {
		id: string;
		uniqueId: number;
		name: string;
		description: string;
		quantity: number;
		category?: string;
		expirationDate?: string;
		createdAt?: any;
		imageUrl?: string;
	}

	let items: Item[] = [];	
	let lowStockThreshold = 20;
	let expirationThreshold = 7;
	let loading = true;
	let userEmail: string | null = null;

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
					uniqueId: data.uniqueId ?? 0,
					category: data.category || '',
					expirationDate: data.expirationDate || '',
					createdAt: data.createdAt?.toDate?.() || new Date(),
					imageUrl: data.imageUrl || ''
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

	function isExpiringSoon(expirationDate?: string): boolean {
		if (!expirationDate) return false;
		const expDate = new Date(expirationDate);
		const today = new Date();
		const diffTime = expDate.getTime() - today.getTime();
		const diffDays = diffTime / (1000 * 60 * 60 * 24);
		return diffDays <= expirationThreshold && diffDays >= 0;
	}

	// Main Statistics
	$: totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
	$: lowStockItems = items.filter(item => isLowStock(item.quantity)).length;
	$: expiringSoonItems = items.filter(item => isExpiringSoon(item.expirationDate)).length;
	$: uniqueProducts = new Set(items.map(item => item.name)).size;

	// Additional Statistics
	$: totalBatches = items.length;
	
	$: itemsAddedThisWeek = (() => {
		const oneWeekAgo = new Date();
		oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
		return items.filter(item => {
			const createdDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
			return createdDate >= oneWeekAgo;
		}).length;
	})();

	$: mostStockedCategory = (() => {
		const categoryTotals: Record<string, number> = {};
		items.forEach(item => {
			const cat = item.category || 'Uncategorized';
			categoryTotals[cat] = (categoryTotals[cat] || 0) + item.quantity;
		});
		
		let maxCategory = 'N/A';
		let maxQuantity = 0;
		Object.entries(categoryTotals).forEach(([cat, qty]) => {
			if (qty > maxQuantity) {
				maxQuantity = qty;
				maxCategory = cat;
			}
		});
		
		return maxCategory;
	})();

	$: categoryDistribution = (() => {
		const categoryTotals: Record<string, number> = {};
		items.forEach(item => {
			const cat = item.category || 'Uncategorized';
			categoryTotals[cat] = (categoryTotals[cat] || 0) + 1;
		});
		return Object.entries(categoryTotals).map(([name, count]) => ({ name, count }));
	})();

	$: recentItems = [...items]
		.sort((a, b) => {
			const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
			const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
			return dateB - dateA;
		})
		.slice(0, 5);

	$: expiringItemsList = items
		.filter(item => isExpiringSoon(item.expirationDate))
		.sort((a, b) => {
			if (!a.expirationDate) return 1;
			if (!b.expirationDate) return -1;
			return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
		})
		.slice(0, 5);
</script>

{#if loading}
	<div class="fixed inset-0 bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
		<div class="text-center">
			<div class="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
				<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
				</svg>
			</div>
			<p class="text-lg font-semibold text-gray-700">Loading Dashboard...</p>
		</div>
	</div>
{:else}
	<div class="h-screen overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50">
		<div class="max-w-[1800px] mx-auto p-4 md:p-6 lg:p-8 pb-8">
			
			<!-- Dashboard Header -->
			<div class="mb-6 lg:mb-8">
				<div class="flex items-center gap-4">
					<div>
						<h1 class="text-3xl lg:text-4xl font-bold text-gray-800 mb-1">My SQL Dashboard</h1>
						<p class="text-sm lg:text-base text-gray-600">Smart Quantity Logistics - Real-time Overview</p>
					</div>
				</div>
			</div>

			<!-- Main Statistics Cards -->
			<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs lg:text-sm font-medium text-gray-600 uppercase tracking-wide">Total Quantity</p>
							<p class="text-2xl lg:text-3xl font-bold text-gray-800 mt-1">{totalQuantity}</p>
							<p class="text-xs lg:text-sm text-gray-500 mt-1">Units in stock</p>
						</div>
						<div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
							<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
							</svg>
						</div>
					</div>
				</div>
				
				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs lg:text-sm font-medium text-gray-600 uppercase tracking-wide">Low Stock</p>
							<p class="text-2xl lg:text-3xl font-bold text-orange-600 mt-1">{lowStockItems}</p>
							<p class="text-xs lg:text-sm text-gray-500 mt-1">Need restocking</p>
						</div>
						<div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
							<svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
							</svg>
						</div>
					</div>
				</div>
				
				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs lg:text-sm font-medium text-gray-600 uppercase tracking-wide">Expiring Soon</p>
							<p class="text-2xl lg:text-3xl font-bold text-red-600 mt-1">{expiringSoonItems}</p>
							<p class="text-xs lg:text-sm text-gray-500 mt-1">Within 7 days</p>
						</div>
						<div class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
							<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
						</div>
					</div>
				</div>

				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs lg:text-sm font-medium text-gray-600 uppercase tracking-wide">Product Types</p>
							<p class="text-2xl lg:text-3xl font-bold text-green-600 mt-1">{uniqueProducts}</p>
							<p class="text-xs lg:text-sm text-gray-500 mt-1">Different products</p>
						</div>
						<div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
							</svg>
						</div>
					</div>
				</div>
			</div>

			<!-- Secondary Statistics -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
							<svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
							</svg>
						</div>
						<div>
							<p class="text-xs lg:text-sm font-medium text-gray-600">Added This Week</p>
							<p class="text-xl lg:text-2xl font-bold text-gray-800">{itemsAddedThisWeek}</p>
						</div>
					</div>
				</div>

				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
							<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
							</svg>
						</div>
						<div>
							<p class="text-xs lg:text-sm font-medium text-gray-600">Top Category</p>
							<p class="text-lg lg:text-xl font-bold text-gray-800 truncate">{mostStockedCategory}</p>
						</div>
					</div>
				</div>

				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
							<svg class="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
							</svg>
						</div>
						<div>
							<p class="text-xs lg:text-sm font-medium text-gray-600">Total Batches</p>
							<p class="text-xl lg:text-2xl font-bold text-gray-800">{totalBatches}</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100 mb-6 lg:mb-8">
				<h2 class="text-lg lg:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
					<svg class="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
					</svg>
					Quick Actions
				</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<a 
						href="/inventory"
						class="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
						</svg>
						View All Items
					</a>
					
					<a 
						href="/inventory"
						class="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
						</svg>
						Add New Item
					</a>
				</div>
			</div>

			<!-- Two Column Layout -->
			<div class="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
				<!-- Category Distribution -->
				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100">
					<h2 class="text-lg lg:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
						<svg class="w-5 h-5 lg:w-6 lg:h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
						</svg>
						Category Distribution
					</h2>
					<div class="space-y-3">
						{#each categoryDistribution as cat}
							<div class="flex items-center justify-between gap-3">
								<div class="flex items-center gap-3 flex-1 min-w-0">
									<div class="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0"></div>
									<span class="text-sm lg:text-base text-gray-700 font-medium truncate">{cat.name}</span>
								</div>
								<div class="flex items-center gap-3 flex-shrink-0">
									<div class="w-24 lg:w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
										<div 
											class="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
											style="width: {(cat.count / totalBatches) * 100}%"
										></div>
									</div>
									<span class="text-gray-800 font-bold text-sm w-6 text-right">{cat.count}</span>
								</div>
							</div>
						{/each}
						{#if categoryDistribution.length === 0}
							<p class="text-gray-500 text-center py-4 text-sm lg:text-base">No categories yet</p>
						{/if}
					</div>
				</div>

				<!-- Recent Activity -->
				<div class="bg-white rounded-2xl p-5 lg:p-6 shadow-lg border border-gray-100">
					<h2 class="text-lg lg:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
						<svg class="w-5 h-5 lg:w-6 lg:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
						Recent Items Added
					</h2>
					<div class="space-y-3">
						{#each recentItems as item}
							<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
								<img 
									src={item.imageUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&h=100&fit=crop'} 
									alt={item.name}
									class="w-12 h-12 object-cover rounded-lg flex-shrink-0"
								/>
								<div class="flex-1 min-w-0">
									<p class="text-sm lg:text-base font-semibold text-gray-800 truncate">{item.name}</p>
									<p class="text-xs lg:text-sm text-gray-500">Qty: {item.quantity} • {item.category || 'No category'}</p>
								</div>
								<div class="text-xs text-gray-400 flex-shrink-0">
									{item.createdAt instanceof Date ? item.createdAt.toLocaleDateString() : new Date(item.createdAt).toLocaleDateString()}
								</div>
							</div>
						{/each}
						{#if recentItems.length === 0}
							<p class="text-gray-500 text-center py-4 text-sm lg:text-base">No items added yet</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Critical Alerts -->
			{#if expiringSoonItems > 0 || lowStockItems > 0}
				<div class="space-y-4 lg:space-y-6">
					{#if expiringSoonItems > 0}
						<div class="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-2xl p-5 lg:p-6 shadow-lg">
							<div class="flex flex-col md:flex-row md:items-start gap-4">
								<div class="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
									<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
									</svg>
								</div>
								<div class="flex-1">
									<h3 class="text-base lg:text-lg font-bold text-red-800 mb-2">⚠️ Expiration Alert</h3>
									<p class="text-sm lg:text-base text-red-700 mb-3">You have {expiringSoonItems} item{expiringSoonItems !== 1 ? 's' : ''} expiring within 7 days</p>
									
									<div class="space-y-2">
										{#each expiringItemsList as item}
											<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/70 p-3 rounded-lg">
												<div class="flex items-center gap-3">
													<img 
														src={item.imageUrl || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=100&h=100&fit=crop'} 
														alt={item.name}
														class="w-10 h-10 object-cover rounded-lg flex-shrink-0"
													/>
													<div>
														<p class="text-sm lg:text-base font-semibold text-gray-800">{item.name}</p>
														<p class="text-xs lg:text-sm text-gray-600">Qty: {item.quantity}</p>
													</div>
												</div>
												<div class="text-left sm:text-right">
													<p class="text-xs lg:text-sm font-semibold text-red-700">
														Expires: {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : 'N/A'}
													</p>
												</div>
												</div>
										{/each}
									</div>

									<a 
										href="/inventory"
										class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md mt-4 text-sm lg:text-base"
									>
										View All Expiring Items
										<svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
										</svg>
									</a>
								</div>
							</div>
						</div>
					{/if}

					{#if lowStockItems > 0}
						<div class="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500 rounded-2xl p-5 lg:p-6 shadow-lg">
							<div class="flex items-center gap-4">
								<div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
									<svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
									</svg>
								</div>
								<div class="flex-1">
									<h3 class="text-base lg:text-lg font-bold text-orange-800">Low Stock Alert</h3>
									<p class="text-sm lg:text-base text-orange-700">You have {lowStockItems} item{lowStockItems !== 1 ? 's' : ''} running low on stock</p>
								</div>
								<a 
									href="/inventory"
									class="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-md text-sm lg:text-base flex-shrink-0"
								>
									View Items
									<svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
									</svg>
								</a>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div class="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-2xl p-5 lg:p-6 shadow-lg">
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
							</svg>
						</div>
						<div>
							<h3 class="text-base lg:text-lg font-bold text-green-800">All Good!</h3>
							<p class="text-sm lg:text-base text-green-700">Your inventory is healthy with no critical alerts</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}