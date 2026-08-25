import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig(({ mode: _mode }) => ({
    plugins: [angular({
        tsconfig: 'tsconfig.json'
    })],
    resolve: {
        alias: {
            // The recipes under e2e/recipes import through the consumer alias so
            // they compile unchanged in a real consumer app. The demo renders
            // those same files, and Vite does not read tsconfig paths, so the
            // prefix is mapped here too — the demo build maps it in
            // demo/tsconfig.app.json.
            '@/components': fileURLToPath(new URL('./packages/components', import.meta.url)),
        },
    },
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
        // The second class was NOT a frame race either: a spec's
        // `Element.prototype.getBoundingClientRect` stub was not in effect when
        // the component measured, so it read real layout. Verified by bypassing
        // the stub deliberately and reproducing the exact failing numbers —
        // `tour` gives 36/57, `hover-card` gives 101.578px. Waiting harder could
        // never fix these; the measurement was already wrong.
        //
        // All of it is now fixed, by the treatment `tour` proved: pin the rect as
        // an *own* property on the measured element. That shadows the prototype
        // whatever the ordering and dies with the element, so it cannot leak.
        // Each was verified by destroying the prototype stub outright and
        // re-running: `dock` 48/48, `select.coverage` 79/79, `hover-card` 33/33.
        // The `select` probe also surfaced a second measurement the fix had
        // missed — `getClippingRect` measures the overflow *ancestor*, not just
        // the trigger.
        //
        // `rich-text-slash-commands` was a different bug wearing the same
        // costume: its caret rect was installed only `if (!('getBoundingClientRect'
        // in Range.prototype))`, which is true in jsdom but false in the real
        // browser this suite runs in — so it was never installed at all and every
        // menu position came from live layout.
        //
        // `number-ticker`'s digit suite was the last, and also not something to
        // wait out: it stubbed `requestAnimationFrame` to merely enqueue, which
        // strips the zoneless scheduler of its frame leg, so change detection
        // advanced only when the test pumped a frame by hand and every assertion
        // rode on how that interleaved with the timer leg. It now installs the
        // animate stubs alone and settles with `whenStable()` — verified by
        // starving rAF completely (never firing, the throttled-iframe condition)
        // and still passing 16/16.
        //
        // Retries are therefore off. Six consecutive full runs at `--retry=0`
        // were clean (375 files / 7979 tests), against a previous rate of ~1 spec
        // per 2-3 runs. If something flakes again, fix the measurement or the
        // scheduling at source — do not raise this to absorb it.
        retry: 0,
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