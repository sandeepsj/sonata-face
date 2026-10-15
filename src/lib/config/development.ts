import type { AppConfig } from './types';

// Local development config — used by `npm run dev`.
// Committed to git. No secrets.
export const config: AppConfig = {
	// Same origin: vite.config.ts proxies /api and /heartbeat to the backend (API_TARGET, default :18080)
	apiBaseUrl: '',
	heartbeatIntervalMs: 25_000,
	defaultPageSize: 10
};
