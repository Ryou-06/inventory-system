<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Modern Navbar with gradient and glass effect -->
<nav class="relative bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 backdrop-blur-lg shadow-2xl border-b border-white/10">
	<!-- Animated background overlay -->
	<div class="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-pulse"></div>

	<div class="relative z-10 w-full px-6 py-4 flex justify-between items-center">
		<!-- Brand / Logo on the left -->
		<div class="flex items-center gap-4">
			<div class="relative">
				<div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-all duration-300 hover:shadow-blue-500/25">
					<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
					</svg>
				</div>
				<div class="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-600/20 blur-md animate-ping opacity-75"></div>
			</div>

			<div class="text-left">
				<h1 class="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
					Inventory System
				</h1>
				<p class="text-sm text-gray-300 font-medium">Smart Management</p>
			</div>
		</div>

		<!-- Buttons / Links on the right -->
		<div class="flex items-center gap-2">
			<!-- Home Link -->
			<a 
				href="/" 
				class="group relative px-6 py-3 text-white font-medium rounded-xl hover:bg-white/10 transition-all duration-300 flex items-center gap-2 hover:shadow-lg backdrop-blur-sm border border-transparent hover:border-white/20"
			>
				<span>Home</span>
				<svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
				</svg>
				<div class="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500 group-hover:w-full transition-all duration-300"></div>
			</a>

			<!-- User profile button -->
			<button class="group relative ml-4 w-10 h-10 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-xl flex items-center justify-center hover:from-blue-500/30 hover:to-purple-600/30 transition-all duration-300 backdrop-blur-sm border border-white/10 hover:border-white/20">
				<svg class="w-5 h-5 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
				</svg>
			</button>
		</div>
	</div>

	<!-- Bottom gradient line -->
	<div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
</nav>

<main>	
	{@render children?.()}		
</main>
