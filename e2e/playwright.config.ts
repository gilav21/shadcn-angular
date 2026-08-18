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
 * Workers = 1 because one `playwright test` process drives exactly one
 * ng-serve / one fixture-app / one harness page. Suite-level parallelism is
 * the orchestrator's job: it runs several of these processes at once, each
 * against its own fixture clone and port, and tells this config which one via
 * `E2E_BASE_URL` / `E2E_OUTPUT_DIR`.
 */
export default defineConfig({
    testDir: 'harness',
    testMatch: '**/*.spec.ts',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    outputDir: process.env['E2E_OUTPUT_DIR'] ?? 'test-results',
    timeout: 30_000,
    expect: {
        timeout: 5_000,
    },
    use: {
        baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4250',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
        actionTimeout: 5_000,
    },
});
