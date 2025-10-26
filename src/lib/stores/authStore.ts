/**
 * Authentication Store
 * Manages authentication state, tokens, and user session
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import type { AuthState, User, AuthResponse } from '$lib/types/auth';
import { AuthService } from '$lib/api/authService';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
};

const initialState: AuthState = {
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  loading: false,
  error: null,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,

    /**
     * Initialize auth state from localStorage
     */
    init() {
      if (!browser) return;

      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const userJson = localStorage.getItem(STORAGE_KEYS.USER);

      if (accessToken && refreshToken) {
        const user = userJson ? JSON.parse(userJson) : null;
        update(state => ({
          ...state,
          isAuthenticated: true,
          accessToken,
          refreshToken,
          user,
        }));
      }
    },

    /**
     * Save tokens and user data to localStorage and store
     */
    setAuth(authResponse: AuthResponse, email?: string) {
      if (!browser) return;

      const user: User = { email: email || '' };

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, authResponse.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, authResponse.refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

      update(state => ({
        ...state,
        isAuthenticated: true,
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        user,
        error: null,
      }));
    },

    /**
     * Login user
     */
    async login(email: string, password: string) {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await AuthService.login({ email, password });
        this.setAuth(response, email);
        update(state => ({ ...state, loading: false }));
        goto('/students');
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage,
        }));
        return false;
      }
    },

    /**
     * Signup new user
     */
    async signup(email: string, password: string) {
      update(state => ({ ...state, loading: true, error: null }));

      try {
        const response = await AuthService.signup({ email, password });
        this.setAuth(response, email);
        update(state => ({ ...state, loading: false }));
        goto('/students');
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Signup failed';
        update(state => ({
          ...state,
          loading: false,
          error: errorMessage,
        }));
        return false;
      }
    },

    /**
     * Refresh access token
     */
    async refreshToken(): Promise<boolean> {
      const state = get(authStore);
      if (!state.refreshToken) return false;

      try {
        const response = await AuthService.refresh(state.refreshToken);
        this.setAuth(response, state.user?.email);
        return true;
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.logout();
        return false;
      }
    },

    /**
     * Get current access token
     */
    getAccessToken(): string | null {
      const state = get(authStore);
      return state.accessToken;
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
      const state = get(authStore);
      return state.isAuthenticated;
    },

    /**
     * Logout user
     */
    logout() {
      if (browser) {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
      }

      set(initialState);
      goto('/login');
    },

    /**
     * Clear error message
     */
    clearError() {
      update(state => ({ ...state, error: null }));
    },
  };
}

export const authStore = createAuthStore();
