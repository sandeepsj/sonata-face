import type { AppConfig } from './types';

// Local development config — used by `npm run dev`.
// Committed to git. No secrets.
export const config: AppConfig = {
	apiBaseUrl: 'http://localhost:8080',
	heartbeatIntervalMs: 25_000,
	defaultPageSize: 10
};
