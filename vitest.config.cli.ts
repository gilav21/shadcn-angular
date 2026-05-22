import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'packages/cli/src/**/*.{test,spec}.ts',
            'packages/cli/scripts/**/*.{test,spec}.ts',
            'e2e/orchestrator/**/*.{test,spec}.ts',
        ],
        exclude: ['**/node_modules/**', '**/dist/**'],
        reporters: ['default'],
    },
});
