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
            // Ratchet, not aspiration: re-measured 2026-07-13 after covering the
            // previously-untested shipped commands (apply, doctor, update, add,
            // migrate, install, breaking-scan, MCP write-tools) — 1078 CLI tests:
            // statements 76.5 / branches 70.93 / functions 79.65 / lines 77.16.
            // Set a couple of points below the measured values so an unrelated PR
            // isn't gated by noise, but a real regression still trips.
            // Raise these as coverage improves; never lower them to make a run pass.
            //
            // NOTE: the maintainer entry scripts (check-completeness, new-component,
            // release-cli, sync-registry) are driven by SUBPROCESS tests, and v8 does
            // not instrument child processes — they read as ~0% here despite having a
            // pinned argv/exit-code contract. That drags these numbers down; it is a
            // measurement artifact, not an untested surface.
            thresholds: {
                statements: 74,
                branches: 68,
                functions: 77,
                lines: 74,
            },
        },
    },
});
