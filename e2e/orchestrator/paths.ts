import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Main shadcn-angular repo root. */
export const REPO_ROOT = path.resolve(here, '../..');

/** The pristine Angular fixture that each per-component test resets to. */
export const FIXTURE_APP = path.join(REPO_ROOT, 'e2e/fixture-app');

/** Built CLI entry point — must exist before running the orchestrator. */
export const CLI_DIST = path.join(REPO_ROOT, 'packages/cli/dist/index.js');

/** Per-component harness folder (TS + spec). */
export function harnessDir(name: string): string {
    return path.join(REPO_ROOT, 'e2e/harness', name);
}

/** Where harness pages get copied inside the fixture-app. */
export const FIXTURE_TEST_PAGES = path.join(FIXTURE_APP, 'src/app/test-pages');

/** Files in the fixture-app the orchestrator overwrites per test. */
export const FIXTURE_APP_ROUTES = path.join(FIXTURE_APP, 'src/app/app.routes.ts');

/** Root for per-worker fixture clones (gitignored). */
export const WORKERS_ROOT = path.join(REPO_ROOT, 'e2e/.workers');

/**
 * Dev-server port for worker 0; worker N listens on `DEV_SERVER_PORT + N`.
 * Playwright's baseURL follows via the `E2E_BASE_URL` env var, so the port is
 * no longer hardcoded on both sides.
 */
export const DEV_SERVER_PORT = 4250;
export const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
