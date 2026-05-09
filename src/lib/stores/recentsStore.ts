import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface RecentItem {
	id: string;
	name: string;
	admissionNo?: string;
}

const RECENTS_KEY = 'sonata.recents';
const FAVORITES_KEY = 'sonata.favorites';
const SIDEBAR_KEY = 'sonata.sidebar.collapsed';
const MAX_RECENTS = 5;

function loadRecents(): RecentItem[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(RECENTS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENTS);
	} catch {}
	return [];
}

function loadFavorites(): RecentItem[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(FAVORITES_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed;
	} catch {}
	return [];
}

function loadCollapsed(): boolean {
	if (!browser) return false;
	return localStorage.getItem(SIDEBAR_KEY) === 'true';
}

function createRecents() {
	const { subscribe, set, update } = writable<RecentItem[]>(loadRecents());

	function init() {
		if (!browser) return;
		set(loadRecents());
	}

	function push(item: RecentItem) {
		if (!browser) return;
		update((items) => {
			const filtered = items.filter((i) => i.id !== item.id);
			const next = [item, ...filtered].slice(0, MAX_RECENTS);
			localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
			return next;
		});
	}

	function clear() {
		if (browser) localStorage.removeItem(RECENTS_KEY);
		set([]);
	}

	return { subscribe, init, push, clear };
}

function createFavorites() {
	const { subscribe, set, update } = writable<RecentItem[]>(loadFavorites());

	function init() {
		if (!browser) return;
		set(loadFavorites());
	}

	function toggle(item: RecentItem): boolean {
		let isFav = false;
		update((items) => {
			const existing = items.find((i) => i.id === item.id);
			let next: RecentItem[];
			if (existing) {
				next = items.filter((i) => i.id !== item.id);
				isFav = false;
			} else {
				next = [...items, item];
				isFav = true;
			}
			if (browser) localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
			return next;
		});
		return isFav;
	}

	function isFav(id: string): boolean {
		return get({ subscribe }).some((i) => i.id === id);
	}

	return { subscribe, init, toggle, isFav };
}

function createSidebarCollapsed() {
	const { subscribe, set } = writable<boolean>(loadCollapsed());

	function init() {
		if (!browser) return;
		set(loadCollapsed());
	}

	function toggle() {
		const next = !get({ subscribe });
		set(next);
		if (browser) localStorage.setItem(SIDEBAR_KEY, String(next));
	}

	function setVal(v: boolean) {
		set(v);
		if (browser) localStorage.setItem(SIDEBAR_KEY, String(v));
	}

	return { subscribe, init, toggle, set: setVal };
}

export const recentsStore = createRecents();
export const favoritesStore = createFavorites();
export const sidebarCollapsedStore = createSidebarCollapsed();
