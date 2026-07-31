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
        // Real browser, real timers, ~370 files in flight: when the machine is
        // loaded, a starved rAF / effect flush can miss its window and drop an
        // assertion that passes 8/8 in isolation. That is a scheduling artefact,
        // not a product failure, and failing the gate on it teaches people to
        // bypass the hook. Retried tests are still REPORTED as flaky, so this
        // suppresses nothing — it just stops the noise from being fatal. Drive
        // this number back down as the offending specs are made deterministic.
        retry: 2,
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
                // Consumer-only: the vitest→jest shim runs under the installed
                // jest consumer (e2e/jest-fixture), never under this browser suite.
                '**/testing/vitest-compat.ts',
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
        // Vitest browser config.
        //
        // Headless by DEFAULT, opt into a visible browser with `HEADED=1`
        // (`npm run test:headed`). Headed is not a harmless preference here: the
        // suite opens a file-per-iframe, Chrome backgrounds all but the visible
        // one, and backgrounded frames get their `requestAnimationFrame`
        // throttled. Every animation/pointer assertion in the suite then misses
        // its window — a full headed run failed 110 tests on an unmodified
        // master while the same run headless was green. Debugging one spec
        // headed is fine (a handful of frames stay live); running the suite
        // headed is not.
        browser: {
            enabled: true,
            headless: !process.env['HEADED'],
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
        },
    },
}));