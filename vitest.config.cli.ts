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
        // Coverage for SonarQube — merged with the component lcov via
        // sonar.javascript.lcov.reportPaths. The CLI is a shipped package with
        // its own (node) test suite, so it gets measured here, not in the
        // browser component run.
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'lcov'],
            reportsDirectory: './coverage-cli',
            include: ['packages/cli/src/**/*.ts', 'packages/cli/scripts/**/*.ts'],
            exclude: [
                '**/*.spec.ts',
                '**/*.test.ts',
                '**/dist/**',
            ],
            // Ratchet, not aspiration: set just below the levels measured on
            // 2026-07-12 (statements 58.97 / branches 54.87 / functions 64.48 /
            // lines 59.98). The CLI suite is far less covered than the component
            // suite — raise these as it improves; never lower them to pass.
            thresholds: {
                statements: 57,
                branches: 53,
                functions: 62,
                lines: 58,
            },
        },
    },
});
