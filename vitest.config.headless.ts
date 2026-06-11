import { defineConfig } from 'vite';

import angular from '@analogjs/vite-plugin-angular';

/**
 * Headless Vitest configuration for running tests without a browser.
 *
 * Uses jsdom instead of Playwright/Chromium, so tests can run in CI,
 * containers, or any Linux environment without a display server.
 *
 * Usage:
 *   npm run test:headless
 *   npx vitest --config vitest.config.headless.ts
 */
export default defineConfig(({ mode: _mode }) => ({
	plugins: [
		angular({
			tsconfig: 'tsconfig.json',
		}),
	],
	optimizeDeps: {
		exclude: ['npm-run-path'],
	},
	test: {
		globals: true,
		setupFiles: ['packages/test-setup.headless.ts'],
		environment: 'jsdom',
		include: [
			'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
			'demo/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
		],
		exclude: ['**/node_modules/**', '**/dist/**'],
		reporters: ['default'],
	},
}));
