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
        // The second is real and remains, though it is now much smaller and its
        // shape is known. Four causes were found and fixed at source:
        //
        //   - `number-ticker` stubbed rAF *while fake timers were installed*,
        //     so `vi.stubGlobal` recorded the fake rAF as the original and
        //     unstubbing after `useRealTimers` put that back over the native
        //     one. It queues into a clock that no longer exists, so it never
        //     fires. A full-suite probe found 19 files inheriting it and
        //     re-leaking it down the worker's chain; the popover positioning
        //     suite awaits a real frame and hung, timing out all 13 of its
        //     tests. `packages/test-setup.ts` now also resets the frame globals
        //     at the file boundary so this cannot propagate again.
        //   - `number-ticker`'s digit suite waited only for `prevDigit` to
        //     seed, which the effect does without touching the DOM. With the
        //     view unrendered the digit change takes the component's silent
        //     "no .flex container" fallback and creates no animation at all.
        //   - `tour` waited on `cardPos`, which already returns a clamped
        //     non-zero position from the *un-measured* default rect, so the
        //     wait passed before anything was measured.
        //   - a demo spec slept a fixed 200ms for an async parse.
        //
        // What remains is one class, and it is NOT a frame race: a spec's
        // `Element.prototype.getBoundingClientRect` stub is not in effect when
        // the component measures, so it reads real layout. Verified by
        // bypassing the stub deliberately and reproducing the exact failing
        // numbers — `tour` gives 36/57, `hover-card` gives 101.578px. Seen in
        // `hover-card`, `dock`, `select.coverage` and `rich-text-slash-commands`.
        // Waiting harder cannot fix these; the measurement is already wrong.
        // `tour` is fixed by stubbing the rect on the target element instance
        // instead of the prototype — the same treatment should retire the rest,
        // and then this can go to 0. Do not raise it to absorb anything new,
        // and do not lower it on a lucky streak: failures are ~1 spec per 2-3
        // full runs under load and can be 0 for three runs in a row.
        retry: 2,
        // Coverage for SonarQube (sonar.javascript.lcov.reportPaths=coverage/lcov.info).
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'lcov'],
            reportsDirectory: './coverage',
            // Emit the report even when a spec fails. This defaults to false,
            // which means a single flaky failure writes NO lcov at all — and
            // because `npm run coverage` chains with `&&`, the run then leaves
            // the previous lcov stale (or absent) and the Sonar scan silently
            // scores the whole library on the CLI report alone. That reads as a
            // catastrophic coverage drop rather than as the flake it is.
            reportOnFailure: true,
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