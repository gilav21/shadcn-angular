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
        // Two classes of failure hid behind this number, and only one is gone.
        //
        // The first was not a scheduling artefact at all: files sharing a
        // worker share its window, and a few specs tore down stubbed globals by
        // deleting them (`matchMedia`) or never restoring them
        // (`getBoundingClientRect`), so whichever file that worker picked up
        // next inherited a broken window. Retrying could never help — the
        // window stayed broken — which is why those tests burned every attempt.
        // Those teardowns are fixed, and `packages/test-setup.ts` resets the
        // globals at each file boundary so a leak cannot outlive its file.
        //
        // The second is real and remains: on a loaded machine a handful of
        // geometry/animation specs (tour, hover-card, select, number-ticker)
        // still miss a frame and measure the wrong layout. Measured over
        // matched runs, the guard makes no difference to these — they need the
        // retry. Fix them at the source and drive this back to 0; do not raise
        // it to absorb anything new.
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