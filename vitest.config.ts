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
            // Ratchet, not aspiration: set just below the levels measured on
            // 2026-07-12 (statements 88.98 / branches 74.33 / functions 91.51 /
            // lines 91.39). Raise them when coverage rises; never lower them to
            // make a run pass.
            thresholds: {
                statements: 87,
                branches: 73,
                functions: 90,
                lines: 90,
            },
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