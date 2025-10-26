<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { authStore } from '$lib/stores/authStore';
	import { setAuthFunctions } from '$lib/api/config';

	let { children } = $props();
	let currentTheme = $state('light');

	// Public routes that don't require authentication
	const publicRoutes = ['/login', '/signup'];

	function setTheme(theme: string) {
		currentTheme = theme;
		document.documentElement.setAttribute('data-theme', theme);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('theme', theme);
		}
	}

	function loadThemeFromStorage() {
		if (typeof localStorage !== 'undefined') {
			const savedTheme = localStorage.getItem('theme');
			if (savedTheme) {
				setTheme(savedTheme);
			} else {
				setTheme('light');
			}
		} else {
			setTheme('light');
		}
	}

	onMount(() => {
		loadThemeFromStorage();
		
		// Initialize auth store from localStorage
		authStore.init();

		// Set auth functions for API config to use
		setAuthFunctions(
			() => authStore.getAccessToken(),
			() => authStore.refreshToken()
		);

		// Subscribe to page changes to check auth
		const unsubscribe = page.subscribe(($page) => {
			if (browser) {
				const currentPath = $page.url.pathname;
				const isPublicRoute = publicRoutes.some(route => currentPath.startsWith(route));
				const isAuthenticated = authStore.isAuthenticated();

				// Redirect to login if not authenticated and trying to access protected route
				if (!isAuthenticated && !isPublicRoute) {
					goto('/login');
				}
				// Redirect to students if authenticated and on login/signup
				else if (isAuthenticated && isPublicRoute) {
					goto('/students');
				}
			}
		});

		return () => {
			unsubscribe();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Revathi Arts and Music School</title>
	<script>
		(function() {
			const savedTheme = localStorage.getItem('theme') || 'light';
			document.documentElement.setAttribute('data-theme', savedTheme);
		})();
	</script>
</svelte:head>

{@render children?.()}

