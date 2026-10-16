/**
 * Authentication Store
 * Manages tokens, the current user and their routes (`[{path, read, write}]`).
 *
 * The backend decides access from the routes inside the access token, which change only at the next
 * refresh. GET /api/users/me reads the database, so it is re-read on navigation and periodically; when its
 * routes differ from the token's, the token is refreshed straight away.
 */

import { writable, get, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { auth, users, configureAuth, errorMessage, type ApiError } from '$lib/api/client';
import type { AccessLevel, RoleRef, RouteAccess, RoutePath } from '$lib/api/types';
import { toast } from './toastStore';
import { features } from '$lib/config/features';

const STORAGE_KEYS = {
	ACCESS_TOKEN: 'accessToken',
	REFRESH_TOKEN: 'refreshToken',
	USER: 'user',
	TOKEN_ROUTES: 'tokenRoutes'
};

export interface User {
	id?: number;
	email: string;
	roles: RoleRef[];
	/** From /api/users/me (the database): drives what the UI shows. */
	routes: RouteAccess[];
}

export interface AuthState {
	isAuthenticated: boolean;
	accessToken: string | null;
	refreshToken: string | null;
	user: User | null;
	loading: boolean;
	error: string | null;
	/** Routes carried by the current access token (from login/refresh). */
	tokenRoutes: RouteAccess[];
}

const initialState: AuthState = {
	isAuthenticated: false,
	accessToken: null,
	refreshToken: null,
	user: null,
	loading: false,
	error: null,
	tokenRoutes: []
};

/** Minimum gap between two /users/me reads triggered by navigation. */
const ME_THROTTLE_MS = 10_000;

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);
	let lastMeAt = 0;

	function persist(state: AuthState) {
		if (!browser) return;
		if (state.accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, state.accessToken);
		if (state.refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, state.refreshToken);
		if (state.user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
		localStorage.setItem(STORAGE_KEYS.TOKEN_ROUTES, JSON.stringify(state.tokenRoutes));
	}

	const store = {
		subscribe,

		/** Restore the session from localStorage and wire the API client. */
		init() {
			configureAuth({
				getAccessToken: () => get({ subscribe }).accessToken,
				refresh: () => store.refreshToken(),
				onAuthLost: () => store.logout(),
				onForbidden: (e: ApiError) => toast.error(errorMessage(e))
			});
			if (!browser) return;

			const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
			const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
			const userJson = localStorage.getItem(STORAGE_KEYS.USER);
			const tokenRoutesJson = localStorage.getItem(STORAGE_KEYS.TOKEN_ROUTES);
			if (accessToken && refreshToken) {
				let user: User | null = null;
				let tokenRoutes: RouteAccess[] = [];
				try {
					const parsed = userJson ? JSON.parse(userJson) : null;
					// users stored before routes existed have `permissions` instead: start empty, /me fills it in
					if (parsed) user = { ...parsed, roles: parsed.roles ?? [], routes: Array.isArray(parsed.routes) ? parsed.routes : [] };
					const tr = tokenRoutesJson ? JSON.parse(tokenRoutesJson) : null;
					if (Array.isArray(tr)) tokenRoutes = tr;
				} catch {
					user = null;
				}
				update((s) => ({ ...s, isAuthenticated: true, accessToken, refreshToken, user, tokenRoutes }));
				store.loadMe(true);
			}
		},

		/** Re-read /api/users/me, and refresh the token if its routes are out of date. Throttled unless `force`. */
		async loadMe(force = false) {
			const s = get({ subscribe });
			if (!s.isAuthenticated) return;
			const now = Date.now();
			if (!force && now - lastMeAt < ME_THROTTLE_MS) return;
			lastMeAt = now;
			try {
				const me = await users.me();
				const routes = me.routes ?? [];
				update((st) => {
					const next = { ...st, user: { id: me.id, email: me.email, roles: me.roles ?? [], routes } };
					persist(next);
					return next;
				});
				// A role change shows in /me at once but reaches the token only at the next refresh
				if (!sameRoutes(routes, get({ subscribe }).tokenRoutes)) await store.refreshToken();
			} catch (e) {
				// 401 is handled by the client (refresh, then logout); keep the cached user otherwise
				console.warn('[auth] /users/me failed', e);
			}
		},

		async login(email: string, password: string) {
			update((s) => ({ ...s, loading: true, error: null }));
			try {
				const res = await auth.login(email, password);
				const next: AuthState = {
					isAuthenticated: true,
					accessToken: res.accessToken,
					refreshToken: res.refreshToken,
					user: { email, roles: [], routes: res.routes ?? [] },
					loading: false,
					error: null,
					tokenRoutes: res.routes ?? []
				};
				set(next);
				persist(next);
				await store.loadMe(true);
				goto(landingPath(get({ subscribe }).user?.routes ?? []));
				return true;
			} catch (e) {
				update((s) => ({
					...s,
					loading: false,
					error: e instanceof Error ? e.message : 'Login failed'
				}));
				return false;
			}
		},

		/** Sign-up returns the user with no roles and no tokens, so log in straight after. */
		async signup(email: string, password: string) {
			update((s) => ({ ...s, loading: true, error: null }));
			try {
				await auth.signup(email, password);
			} catch (e) {
				update((s) => ({
					...s,
					loading: false,
					error: e instanceof Error ? e.message : 'Signup failed'
				}));
				return false;
			}
			return store.login(email, password);
		},

		/** Exchange the refresh token for a new access token. */
		async refreshToken(): Promise<boolean> {
			const s = get({ subscribe });
			if (!s.refreshToken) return false;
			try {
				const res = await auth.refresh(s.refreshToken);
				update((st) => {
					const next = {
						...st,
						accessToken: res.accessToken,
						refreshToken: res.refreshToken || st.refreshToken,
						tokenRoutes: res.routes ?? [],
						user: st.user && res.routes ? { ...st.user, routes: res.routes } : st.user
					};
					persist(next);
					return next;
				});
				return true;
			} catch (e) {
				console.warn('[auth] token refresh failed', e);
				return false;
			}
		},

		getAccessToken(): string | null {
			return get({ subscribe }).accessToken;
		},

		isAuthenticated(): boolean {
			return get({ subscribe }).isAuthenticated;
		},

		logout() {
			if (browser) {
				localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
				localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
				localStorage.removeItem(STORAGE_KEYS.USER);
				localStorage.removeItem(STORAGE_KEYS.TOKEN_ROUTES);
			}
			const wasAuthenticated = get({ subscribe }).isAuthenticated;
			set(initialState);
			if (wasAuthenticated || (browser && !location.pathname.startsWith('/login'))) goto('/login');
		},

		clearError() {
			update((s) => ({ ...s, error: null }));
		}
	};
	return store;
}

export const authStore = createAuthStore();

// ---------- routes ----------

/** Only routes with a flag set count, in any order. */
function sameRoutes(a: readonly RouteAccess[], b: readonly RouteAccess[]): boolean {
	const key = (rs: readonly RouteAccess[]) =>
		rs
			.filter((r) => r.read || r.write)
			.map((r) => `${r.path}:${r.read ? 'r' : ''}${r.write ? 'w' : ''}`)
			.sort()
			.join('|');
	return key(a) === key(b);
}

/**
 * Whether `routes` allow `level` on `path`. GET needs `read`; POST/PUT/PATCH/DELETE need `write`.
 * The two flags are independent: write does not imply read.
 */
export function can(routes: readonly RouteAccess[], path: RoutePath, level: AccessLevel = 'read'): boolean {
	return routes.some((r) => r.path === path && r[level]);
}

/** `$canAccess('/api/payments/**', 'write')` for the current user */
export const canAccess = derived(authStore, ($a) => {
	const routes = $a.user?.routes ?? [];
	return (path: RoutePath, level: AccessLevel = 'read') => can(routes, path, level);
});

/** First page this user may open. */
export function landingPath(routes: readonly RouteAccess[]): string {
	if (can(routes, '/api/students/**')) return '/students';
	if (can(routes, '/api/payments/**')) return '/payments';
	if (features.missingEndpoints && can(routes, '/api/dues/**')) return '/dues';
	if (can(routes, '/api/courses/**')) return '/courses';
	if (can(routes, '/api/fee-structures/**')) return '/fees';
	if (can(routes, '/api/users/**')) return '/admin/users';
	if (can(routes, '/api/roles/**')) return '/admin/roles';
	return '/no-access';
}
