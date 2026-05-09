import type { AppConfig } from './types';
import { config as devConfig } from './development';
import { config as prodConfig } from './production';

// Pick at build time: Vite tree-shakes the unused branch in production bundles.
//   npm run dev   → import.meta.env.DEV === true  → development config
//   npm run build → import.meta.env.DEV === false → production config
export const config: AppConfig = import.meta.env.DEV ? devConfig : prodConfig;

export type { AppConfig };
