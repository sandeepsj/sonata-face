<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { authStore } from '$lib/stores/authStore';
	import { setAuthFunctions, API_CONFIG } from '$lib/api/config';
	import { HeartbeatService } from '$lib/api/heartbeatService';

	let { children } = $props();
	let currentTheme = $state('light');
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	let serverDown = $state(false);
	let retrying = $state(false);
	let consecutiveFailures = $state(0);
	const MAX_FAILURES_BEFORE_ALERT = 2; // Show modal after 2 consecutive failures

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

	async function handleHeartbeat() {
		const success = await HeartbeatService.ping();
		
		if (success) {
			// Reset failure count and close modal if server is back
			consecutiveFailures = 0;
			if (serverDown) {
				serverDown = false;
				retrying = false;
			}
		} else {
			consecutiveFailures++;
			
			// Show modal after consecutive failures
			if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
				serverDown = true;
			}
		}
	}

	function startHeartbeat() {
		if (!browser) return;

		// Send initial heartbeat
		handleHeartbeat();

		// Set up interval to ping every 25 seconds
		heartbeatInterval = setInterval(handleHeartbeat, API_CONFIG.HEARTBEAT_INTERVAL);
	}

	function stopHeartbeat() {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}
	}

	async function retryConnection() {
		retrying = true;
		await handleHeartbeat();
		
		// If still down after retry, keep retrying every 5 seconds
		if (serverDown) {
			setTimeout(() => {
				if (serverDown && retrying) {
					retryConnection();
				}
			}, 5000);
		}
	}

	function dismissModal() {
		serverDown = false;
		retrying = false;
		consecutiveFailures = 0;
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

		// Start heartbeat
		startHeartbeat();

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

	onDestroy(() => {
		// Clean up heartbeat interval when component is destroyed
		stopHeartbeat();
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

<!-- Server Down Modal -->
{#if serverDown}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="font-bold text-lg flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6 text-error"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				Server Connection Lost
			</h3>
			<p class="py-4">
				{#if retrying}
					<span class="flex items-center gap-2">
						<span class="loading loading-spinner loading-sm"></span>
						Attempting to reconnect to the server...
					</span>
				{:else}
					The server appears to be down or unreachable. You can retry the connection or wait for the server to come back online.
				{/if}
			</p>
			<div class="modal-action">
				<button
					class="btn btn-ghost"
					onclick={dismissModal}
					disabled={retrying}
				>
					Dismiss
				</button>
				<button
					class="btn btn-primary"
					onclick={retryConnection}
					disabled={retrying}
				>
					{#if retrying}
						<span class="loading loading-spinner loading-sm"></span>
						Retrying...
					{:else}
						Retry Now
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
