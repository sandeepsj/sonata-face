import type { AppConfig } from './types';

// Production config — used by `npm run build` and Vercel deploys.
// Committed to git. No secrets.
export const config: AppConfig = {
	apiBaseUrl: 'https://sonata-brain.onrender.com',
	heartbeatIntervalMs: 25_000,
	defaultPageSize: 10
};
