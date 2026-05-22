import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the per-component e2e suite.
 *
 * The orchestrator (`e2e/orchestrator/run.ts`) starts and stops `ng serve`
 * itself, so we deliberately do NOT set a `webServer` block — that would
 * make `playwright test` try to start its own server, racing the
 * orchestrator. The orchestrator-managed lifecycle is what lets a single
 * `npm run e2e -- button` reuse `node_modules` across components.
 *
 * Workers = 1 because there's exactly one ng-serve / one fixture-app /
 * one port; parallel specs would all hit the same harness page.
 */
export default defineConfig({
    testDir: 'harness',
    testMatch: '**/*.spec.ts',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    timeout: 30_000,
    expect: {
        timeout: 5_000,
    },
    use: {
        baseURL: 'http://localhost:4250',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
        actionTimeout: 5_000,
    },
});
