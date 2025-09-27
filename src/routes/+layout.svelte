<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- ✅ Added Navbar -->
<nav class="bg-gray-800 text-white px-6 py-3 flex justify-between items-center">
	<div class="text-lg font-bold">📦 Inventory System</div>

	<div class="space-x-4">
		<a href="/" class="hover:text-gray-300">Home</a>
		<!-- <a href="/inventory" class="hover:text-gray-300">Inventory</a> -->
	</div>
</nav>

<!-- ✅ Keep your current children rendering -->
<main class="p-6">
	{@render children?.()}
</main>
