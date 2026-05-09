import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'sonata-theme-mode';

function systemPrefers(): ResolvedTheme {
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadMode(): ThemeMode {
	if (!browser) return 'system';
	const v = localStorage.getItem(STORAGE_KEY);
	if (v === 'light' || v === 'dark' || v === 'system') return v;
	return 'system';
}

function applyTheme(mode: ThemeMode) {
	if (!browser) return;
	const resolved: ResolvedTheme = mode === 'system' ? systemPrefers() : mode;
	document.documentElement.setAttribute('data-theme', resolved);
	document.documentElement.style.colorScheme = resolved;
}

function createThemeStore() {
	const { subscribe, set } = writable<ThemeMode>(loadMode());

	let mediaQuery: MediaQueryList | null = null;
	const handleSystemChange = () => {
		const m = get({ subscribe });
		if (m === 'system') applyTheme('system');
	};

	function init() {
		if (!browser) return;
		const mode = loadMode();
		set(mode);
		applyTheme(mode);
		mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQuery.addEventListener('change', handleSystemChange);
	}

	function setMode(mode: ThemeMode) {
		set(mode);
		if (browser) {
			localStorage.setItem(STORAGE_KEY, mode);
			applyTheme(mode);
		}
	}

	function cycle() {
		const order: ThemeMode[] = ['light', 'dark', 'system'];
		const cur = get({ subscribe });
		const next = order[(order.indexOf(cur) + 1) % order.length];
		setMode(next);
	}

	function resolved(): ResolvedTheme {
		const m = get({ subscribe });
		return m === 'system' ? systemPrefers() : m;
	}

	return { subscribe, init, setMode, cycle, resolved };
}

export const themeStore = createThemeStore();
