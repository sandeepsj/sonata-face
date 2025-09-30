<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { BookOpen, User, Menu, Sun, Moon } from 'lucide-svelte';

	let { children } = $props();
	let mobileMenuOpen = $state(false);

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function toggleTheme() {
		// DaisyUI theme switching
		const themes = ['light', 'dark', 'cupcake', 'emerald', 'corporate', 'forest'];
		const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
		const currentIndex = themes.indexOf(currentTheme);
		const nextIndex = (currentIndex + 1) % themes.length;
		document.documentElement.setAttribute('data-theme', themes[nextIndex]);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Revathi Arts and Music School</title>
</svelte:head>

<!-- DaisyUI Navigation -->
<div class="navbar bg-base-100 shadow-lg sticky top-0 z-50">
	<div class="navbar-start">
		<div class="dropdown md:hidden">
			<div tabindex="0" role="button" class="btn btn-ghost btn-circle">
				<Menu class="w-5 h-5" />
			</div>
			<ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
				<li><a href="/">Dashboard</a></li>
				<li><a href="/students">Students</a></li>
				<li><a href="/courses">Courses</a></li>
				<li><a href="/reports">Reports</a></li>
			</ul>
		</div>
		<BookOpen class="w-8 h-8 text-primary mr-2" />
		<a href="/" class="btn btn-ghost text-xl">Revathi Arts and Music School</a>
	</div>
	
	<div class="navbar-center hidden md:flex">
		<ul class="menu menu-horizontal px-1">
			<li><a href="/">Dashboard</a></li>
			<li><a href="/students">Students</a></li>
			<li><a href="/courses">Courses</a></li>
			<li><a href="/reports">Reports</a></li>
		</ul>
	</div>
	
	<div class="navbar-end">
		<button class="btn btn-ghost btn-circle" onclick={toggleTheme}>
			<Sun class="w-5 h-5" />
		</button>
		<div class="dropdown dropdown-end">
			<div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
				<div class="w-10 rounded-full">
					<User class="w-5 h-5 m-auto mt-2" />
				</div>
			</div>
			<ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
				<li><a href="/profile">Profile</a></li>
				<li><a href="/settings">Settings</a></li>
				<li><a href="/logout">Logout</a></li>
			</ul>
		</div>
	</div>
</div>

<!-- Main Content -->
<main class="min-h-screen bg-base-200">
	{@render children?.()}
</main>
