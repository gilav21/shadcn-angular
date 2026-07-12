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
            // Ratchet, not aspiration: measured 2026-07-13 on a clean tree with all
            // 643 CLI tests passing. `npm run coverage` reports slightly lower than a
            // standalone `coverage:cli` run (it sweeps a few more files into the
            // denominator), so the ratchet is set below the LOWER of the two — the
            // one that actually gates: statements 58.25 / branches 54.44 /
            // functions 63.28 / lines 59.27.
            // The CLI suite is far less covered than the component suite — raise
            // these as it improves; never lower them to make a run pass.
            thresholds: {
                statements: 57,
                branches: 53,
                functions: 62,
                lines: 58,
            },
        },
    },
});
