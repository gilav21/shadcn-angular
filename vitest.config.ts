import { defineConfig } from 'vite';

import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig(({ mode }) => ({
    plugins: [angular({
        tsconfig: 'tsconfig.json'
    })],
    test: {
        globals: true,
        setupFiles: ['packages/test-setup.ts'],
        // environment: 'jsdom',
        include: ['packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'demo/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        reporters: ['default'],
        // Vitest browser config
        browser: {
            enabled: true,
            headless: false, // set to true in CI
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
        },
    },
}));