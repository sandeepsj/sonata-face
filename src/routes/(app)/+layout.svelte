<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto, afterNavigate } from '$app/navigation';
	import {
		Users,
		BookOpen,
		IndianRupee,
		Banknote,
		PanelLeftClose,
		PanelLeftOpen,
		Search,
		LogOut,
		Palette as PaletteIcon,
		ChevronDown,
		Star,
		History,
		ShieldCheck,
		UserCog,
		RefreshCcw
	} from 'lucide-svelte';
	import { authStore, canAccess } from '$lib/stores/authStore';
	import type { AccessLevel, RoutePath } from '$lib/api/types';
	import { features } from '$lib/config/features';
	import NoPermission from '$lib/components/NoPermission.svelte';
	import NotAvailable from '$lib/components/NotAvailable.svelte';
	import { paletteStore, type Palette } from '$lib/stores/paletteStore';
	import {
		recentsStore,
		favoritesStore,
		sidebarCollapsedStore
	} from '$lib/stores/recentsStore';

	let { children } = $props();

	let paletteOpen = $state(false);
	let userMenuOpen = $state(false);
	let searchQuery = $state('');

	const PALETTES: { id: Palette; label: string; swatch: string }[] = [
		{ id: 'terracotta', label: 'Terracotta', swatch: 'oklch(0.58 0.155 38)' },
		{ id: 'indigo', label: 'Indigo Ink', swatch: 'oklch(0.46 0.14 264)' },
		{ id: 'olive', label: 'Olive Grove', swatch: 'oklch(0.50 0.10 130)' },
		{ id: 'rosewood', label: 'Rosewood', swatch: 'oklch(0.46 0.16 0)' }
	];

	function isActive(href: string): boolean {
		const path = $page.url.pathname;
		if (href === '/students') return path === '/students' || path.startsWith('/students/');
		return path === href || path.startsWith(href + '/');
	}

	function handleLogout() {
		authStore.logout();
	}

	function setPalette(p: Palette) {
		paletteStore.setPalette(p);
		paletteOpen = false;
	}

	function handleSearch(e: KeyboardEvent) {
		if (e.key === 'Enter' && searchQuery.trim()) {
			goto(`/students?q=${encodeURIComponent(searchQuery.trim())}`);
			searchQuery = '';
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.palette-dd') && !target.closest('.palette-trigger')) paletteOpen = false;
		if (!target.closest('.user-dd') && !target.closest('.sb-user')) userMenuOpen = false;
	}

	onMount(() => {
		paletteStore.init();
		recentsStore.init();
		favoritesStore.init();
		sidebarCollapsedStore.init();
		document.addEventListener('click', handleClickOutside);
		// Role changes show in /users/me before they reach the token, so re-read it periodically
		// (the store refreshes the token when the routes differ)
		const meTimer = setInterval(() => authStore.loadMe(true), ME_REFRESH_MS);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			clearInterval(meTimer);
		};
	});

	const ME_REFRESH_MS = 60_000;

	// ...and after each navigation (throttled in the store)
	afterNavigate(() => authStore.loadMe());

	/** `legacy`: needs endpoints that aren't on the backend yet; shown only with `features.legacyFeeModel`. */
	type NavItem = { href: string; label: string; icon: typeof Users; route: RoutePath; level?: AccessLevel; legacy?: boolean };

	const NAV: NavItem[] = [
		{ href: '/students', label: 'Students', icon: Users, route: '/api/students/**' },
		{ href: '/courses', label: 'Courses', icon: BookOpen, route: '/api/courses/**' },
		{ href: '/dues', label: 'Dues', icon: IndianRupee, route: '/api/dues/**', legacy: true },
		{ href: '/payments', label: 'Payments', icon: Banknote, route: '/api/payments/**', legacy: true }
	];

	const ADMIN_NAV: NavItem[] = [
		{ href: '/admin/users', label: 'Users', icon: UserCog, route: '/api/users/**' },
		{ href: '/admin/roles', label: 'Roles', icon: ShieldCheck, route: '/api/roles/**' },
		{ href: '/admin/dues-rebuild', label: 'Dues rebuild', icon: RefreshCcw, route: '/api/dues/**', legacy: true }
	];

	type Guard = { re: RegExp; route: RoutePath; what: string; legacy?: boolean };

	// Which route each screen needs to read (most specific prefix first)
	const GUARDS: Guard[] = [
		{ re: /^\/students\/[^/]+\/sessions/, route: '/api/student-sessions/**', what: 'sessions' },
		{ re: /^\/students\/[^/]+\/dues/, route: '/api/dues/**', what: 'dues', legacy: true },
		{ re: /^\/students\/[^/]+\/(payments|manage-payments|receipts)/, route: '/api/payments/**', what: 'payments', legacy: true },
		{ re: /^\/students\/[^/]+\/timeline/, route: '/api/payments/**', what: 'the fee timeline', legacy: true },
		{ re: /^\/students\/add/, route: '/api/students/**', what: 'adding students' },
		{ re: /^\/students/, route: '/api/students/**', what: 'students' },
		{ re: /^\/courses/, route: '/api/courses/**', what: 'courses' },
		{ re: /^\/dues/, route: '/api/dues/**', what: 'dues', legacy: true },
		{ re: /^\/payments/, route: '/api/payments/**', what: 'payments', legacy: true },
		{ re: /^\/admin\/dues-rebuild/, route: '/api/dues/**', what: 'dues recalculation', legacy: true },
		{ re: /^\/admin\/roles/, route: '/api/roles/**', what: 'roles' },
		{ re: /^\/admin/, route: '/api/users/**', what: 'users' }
	];
	let guard = $derived(GUARDS.find((g) => g.re.test($page.url.pathname)));
	let unavailable = $derived(!!guard?.legacy && !features.legacyFeeModel);
	let allowed = $derived(!guard || !$authStore.user || $canAccess(guard.route));

	let nav = $derived(NAV.filter((i) => (!i.legacy || features.legacyFeeModel) && $canAccess(i.route, i.level)));
	let adminNav = $derived(ADMIN_NAV.filter((i) => (!i.legacy || features.legacyFeeModel) && $canAccess(i.route, i.level)));

	function pageCrumbs(path: string) {
		const parts = path.split('/').filter(Boolean);
		const crumbs: { label: string; href: string }[] = [];
		let acc = '';
		for (const p of parts) {
			acc += '/' + p;
			const label = p
				.replace(/-/g, ' ')
				.replace(/\b\w/g, (c) => c.toUpperCase());
			crumbs.push({ label, href: acc });
		}
		return crumbs;
	}

	let crumbs = $derived(pageCrumbs($page.url.pathname));
	let userInitial = $derived(($authStore.user?.email || 'U').charAt(0).toUpperCase());
</script>

<svelte:head>
	<title>Revathi Arts and Music School</title>
</svelte:head>

<div class="app-shell" data-collapsed={$sidebarCollapsedStore}>
	<aside class="sidebar">
		<div class="sb-brand">
			{#if !$sidebarCollapsedStore}
				<div>
					<div class="sb-name">Revathi <em>Arts</em></div>
					<div class="sb-tag">Music School</div>
				</div>
				<button class="sb-collapse" onclick={() => sidebarCollapsedStore.toggle()} aria-label="Collapse sidebar">
					<PanelLeftClose size={16} strokeWidth={1.6} />
				</button>
			{/if}
		</div>

		{#if $sidebarCollapsedStore}
			<div style="display:flex; justify-content:center; padding: 8px;">
				<button class="sb-collapse" onclick={() => sidebarCollapsedStore.toggle()} aria-label="Expand sidebar">
					<PanelLeftOpen size={16} strokeWidth={1.6} />
				</button>
			</div>
		{/if}

		<nav class="sb-section" style="display:flex; flex-direction:column; gap:2px;">
			{#if !$sidebarCollapsedStore}<div class="sb-label">Workspace</div>{/if}
			{#each nav as item}
				<a class="sb-link" class:active={isActive(item.href)} href={item.href}>
					<item.icon size={16} strokeWidth={1.6} />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		{#if adminNav.length > 0}
			<nav class="sb-section" style="display:flex; flex-direction:column; gap:2px;">
				{#if !$sidebarCollapsedStore}<div class="sb-label">Admin</div>{/if}
				{#each adminNav as item}
					<a class="sb-link" class:active={isActive(item.href)} href={item.href}>
						<item.icon size={16} strokeWidth={1.6} />
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>
		{/if}

		{#if !$sidebarCollapsedStore && $favoritesStore.length > 0}
			<div class="sb-divider"></div>
			<div class="sb-section" style="display:flex; flex-direction:column; gap:2px;">
				<div class="sb-label">
					<span style="display:inline-flex; align-items:center; gap:6px;">
						<Star size={10} strokeWidth={1.8} /> Favorites
					</span>
				</div>
				{#each $favoritesStore.slice(0, 5) as fav}
					<a class="sb-recent-item" href="/students/{fav.id}">
						<span class="sb-recent-avatar">{(fav.name || '?').charAt(0).toUpperCase()}</span>
						<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{fav.name}</span>
					</a>
				{/each}
			</div>
		{/if}

		{#if !$sidebarCollapsedStore && $recentsStore.length > 0}
			<div class="sb-divider"></div>
			<div class="sb-section" style="display:flex; flex-direction:column; gap:2px;">
				<div class="sb-label">
					<span style="display:inline-flex; align-items:center; gap:6px;">
						<History size={10} strokeWidth={1.8} /> Recent
					</span>
				</div>
				{#each $recentsStore as rec}
					<a class="sb-recent-item" href="/students/{rec.id}">
						<span class="sb-recent-avatar">{(rec.name || '?').charAt(0).toUpperCase()}</span>
						<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{rec.name}</span>
						{#if rec.admissionNo}<span class="sb-recent-meta">{rec.admissionNo}</span>{/if}
					</a>
				{/each}
			</div>
		{/if}

		<div class="sb-foot">
			<div style="position: relative;">
				<button class="sb-user" onclick={() => (userMenuOpen = !userMenuOpen)}>
					<span class="sb-avatar">{userInitial}</span>
					{#if !$sidebarCollapsedStore}
						<span class="sb-user-info">
							<span class="sb-user-name">{($authStore.user?.roles ?? []).map((r) => r.name).join(', ') || 'No role'}</span>
							<span class="sb-user-email">{$authStore.user?.email || 'user@school'}</span>
						</span>
						<ChevronDown size={14} strokeWidth={1.6} style="color: var(--fg-muted);" />
					{/if}
				</button>
				{#if userMenuOpen}
					<div
						class="user-dd"
						style="position: absolute; bottom: calc(100% + 6px); left: 0; min-width: 180px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-pop); padding: 4px; z-index: 50;"
					>
						<button class="mselect-opt" onclick={handleLogout}>
							<LogOut size={14} strokeWidth={1.6} />
							<span>Log out</span>
						</button>
					</div>
				{/if}
			</div>
		</div>
	</aside>

	<div class="main">
		<header class="topbar">
			<div class="crumbs">
				<a href="/students" style="display:inline-flex; align-items:center; gap:6px;">Home</a>
				{#each crumbs as c, i}
					<span class="sep">/</span>
					{#if i === crumbs.length - 1}
						<span class="last">{c.label}</span>
					{:else}
						<a href={c.href}>{c.label}</a>
					{/if}
				{/each}
			</div>

			<div class="topbar-actions">
				{#if $canAccess('/api/students/**')}
				<div class="search-box" style="width: 280px;">
					<Search size={14} strokeWidth={1.6} />
					<input
						type="text"
						placeholder="Search students…"
						bind:value={searchQuery}
						onkeydown={handleSearch}
					/>
					<span class="kbd">↵</span>
				</div>
				{/if}

				<div style="position: relative;">
					<button class="btn-s btn-secondary-s btn-icon-s palette-trigger" onclick={() => (paletteOpen = !paletteOpen)} aria-label="Change palette">
						<PaletteIcon size={14} strokeWidth={1.6} />
					</button>
					{#if paletteOpen}
						<div
							class="palette-dd"
							style="position: absolute; right: 0; top: calc(100% + 6px); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-pop); padding: 4px; z-index: 50; min-width: 180px;"
						>
							{#each PALETTES as p}
								<button
									class="mselect-opt"
									class:is-sel={$paletteStore === p.id}
									onclick={() => setPalette(p.id)}
								>
									<span class="mselect-swatch" style="background: {p.swatch};"></span>
									<span>{p.label}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</header>

		<div style="flex: 1; min-width: 0;">
			{#if unavailable}
				<NotAvailable what={guard ? guard.what[0].toUpperCase() + guard.what.slice(1) : undefined} />
			{:else if allowed}
				{@render children?.()}
			{:else}
				<NoPermission what={guard?.what} />
			{/if}
		</div>
	</div>
</div>
