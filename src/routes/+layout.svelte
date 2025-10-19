<script lang="ts">
	import { page } from '$app/stores';
	import { auth } from '$lib/firebase';
	import { onAuthStateChanged } from 'firebase/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	import '../app.css';

	let user: any = null;
	let currentPath = '';

	// Subscribe to page store to get current path
	$: currentPath = $page.url.pathname;

	onMount(() => {
		onAuthStateChanged(auth, (firebaseUser) => {
			user = firebaseUser;
		});
	});

	async function handleLogout() {
		try {
			await auth.signOut();
			goto('/');
		} catch (error) {
			console.error('Logout failed:', error);
		}	
	}
</script>

<!-- Only show navbar if NOT on login or register pages -->
{#if currentPath !== '/' && currentPath !== '/register'}
<!-- Updated Navbar with Improved Logo -->

<nav class="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
	<div class="px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">
			<!-- Left: Enhanced Logo/Brand -->
			<div class="flex items-center gap-3">
				<!-- Enhanced Logo Icon -->
				<div class="relative group cursor-pointer">
					<div class="w-11 h-11 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md transform group-hover:scale-105 transition-all duration-300">
						<!-- SQL Database Icon -->
						<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
						</svg>
						<!-- Small Analytics Badge -->
						<div class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded flex items-center justify-center shadow-sm">
							<svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
							</svg>
						</div>
					</div>
				</div>
				
				<!-- Brand Text -->
				<div class="hidden sm:block">
					<h1 class="text-lg font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
						My SQL
					</h1>
					<p class="text-xs text-gray-500 font-medium -mt-0.5">Smart Quantity Logistics</p>
				</div>
			</div>

			<!-- Right: Navigation Items -->
			<div class="flex items-center gap-2 sm:gap-3">
				{#if user}
					<!-- User Email Display -->
					<div class="hidden md:flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-gray-200">
						<div class="w-7 h-7 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
							<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
							</svg>
						</div>
						<span class="text-sm font-medium text-gray-700">{user.email}</span>
					</div>

					<!-- Dashboard Button -->
					<a
						href="/landing"
						class="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
						</svg>
						<span class="hidden sm:inline">Dashboard</span>
					</a>

					<!-- Logout Button -->
					<button
						on:click={handleLogout}
						class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
						</svg>
						<span class="hidden sm:inline">Logout</span>
					</button>
				{:else}
					<!-- Login Button -->
					<a href="/"
						class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-all duration-300 hover:shadow-md active:scale-95 flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
						</svg>
						<span class="hidden sm:inline">Login</span>
					</a>

					<!-- Register Button -->
					<a href="/register"
						class="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
						</svg>
						<span class="hidden sm:inline">Register</span>
					</a>
				{/if}
			</div>
		</div>
	</div>
</nav>
{/if}	

<!-- Page Content -->
<slot />