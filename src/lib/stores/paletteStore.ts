import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Palette = 'terracotta' | 'indigo' | 'olive' | 'rosewood';
const STORAGE_KEY = 'sonata.palette';

function load(): Palette {
	if (!browser) return 'indigo';
	const v = localStorage.getItem(STORAGE_KEY);
	if (v === 'terracotta' || v === 'indigo' || v === 'olive' || v === 'rosewood') return v;
	return 'indigo';
}

function apply(p: Palette) {
	if (!browser) return;
	if (p === 'terracotta') {
		document.documentElement.removeAttribute('data-palette');
	} else {
		document.documentElement.setAttribute('data-palette', p);
	}
}

function create() {
	const { subscribe, set } = writable<Palette>(load());

	function init() {
		if (!browser) return;
		const p = load();
		set(p);
		apply(p);
	}

	function setPalette(p: Palette) {
		set(p);
		if (browser) {
			localStorage.setItem(STORAGE_KEY, p);
			apply(p);
		}
	}

	function current(): Palette {
		return get({ subscribe });
	}

	return { subscribe, init, setPalette, current };
}

export const paletteStore = create();
