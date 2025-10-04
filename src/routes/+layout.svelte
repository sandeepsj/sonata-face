<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
	let currentTheme = $state('light');

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

