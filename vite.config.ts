import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// In dev the app calls the API on its own origin and Vite forwards it to the backend,
// so the backend's CORS list (production origin only) doesn't get in the way.
// (read via globalThis: the project has no Node type definitions)
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const API_TARGET = env.API_TARGET || 'http://localhost:18080';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		proxy: Object.fromEntries(
			['/api', '/heartbeat'].map((path) => [
				path,
				{
					target: API_TARGET,
					// drop the browser's Origin so the backend treats it as a same-origin call
					configure: (proxy) =>
						(proxy as unknown as { on: (e: string, cb: (req: { removeHeader: (h: string) => void }) => void) => void }).on(
							'proxyReq',
							(req) => req.removeHeader('origin')
						)
				}
			])
		)
	}
});
