import { defineConfig } from 'vite';

import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig(({ mode: _mode }) => ({
    plugins: [angular({
        tsconfig: 'tsconfig.json'
    })],
    optimizeDeps: {
        exclude: ['npm-run-path'],
    },
    test: {
        globals: true,
        setupFiles: ['packages/test-setup.ts'],
        // environment: 'jsdom',
        include: ['packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'demo/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['**/node_modules/**', '**/dist/**', 'packages/cli/**'],
        reporters: ['default'],
        // Coverage for SonarQube (sonar.javascript.lcov.reportPaths=coverage/lcov.info).
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'lcov'],
            reportsDirectory: './coverage',
            include: ['packages/components/**/*.ts'],
            exclude: [
                '**/*.spec.ts',
                '**/*.stories.ts',
                '**/*-demo.component.ts',
                '**/*-fixtures.ts',
                '**/index.ts',
                '**/*.types.ts',
                '**/*-locales.ts',
            ],
        },
        // Vitest browser config
        browser: {
            enabled: true,
            headless: !!process.env['CI'] || !!process.env['HEADLESS'],
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
        },
    },
}));