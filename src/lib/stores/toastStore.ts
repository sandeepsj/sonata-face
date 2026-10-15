import { writable } from 'svelte/store';

export interface Toast {
	id: number;
	kind: 'ok' | 'error' | 'info';
	message: string;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);
	let next = 1;

	function push(kind: Toast['kind'], message: string, ms = 4500) {
		const id = next++;
		update((list) => {
			// don't stack identical messages (e.g. several 403s from one page load)
			if (list.some((t) => t.message === message)) return list;
			return [...list, { id, kind, message }];
		});
		setTimeout(() => dismiss(id), ms);
	}

	function dismiss(id: number) {
		update((list) => list.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		ok: (m: string) => push('ok', m),
		error: (m: string) => push('error', m, 6000),
		info: (m: string) => push('info', m),
		dismiss
	};
}

export const toast = createToastStore();
