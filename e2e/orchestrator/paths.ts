import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Main shadcn-angular repo root. */
export const REPO_ROOT = path.resolve(here, '../..');

/** The pristine Angular fixture that each per-component test resets to. */
export const FIXTURE_APP = path.join(REPO_ROOT, 'e2e/fixture-app');

/**
 * The Angular 21 fixture. The compiled npm packages declare a peer range
 * spanning Angular 20 and 21 (spec C-17), so their legs run in both this and
 * {@link FIXTURE_APP} — that pair is the evidence for the README's claim that
 * both majors are supported. The copy-model specs stay on the Angular 20
 * fixture, which is what proves THEY still work on 20.
 */
export const FIXTURE_APP_21 = path.join(REPO_ROOT, 'e2e/fixture-app-21');

/** Every pristine fixture, keyed by the `fixture` field of a spec. */
export const FIXTURE_APPS = {
    ng20: FIXTURE_APP,
    ng21: FIXTURE_APP_21,
} as const;

/** Where `npm pack` writes package tarballs (under the gitignored workers root). */
export const PACKS_DIR = path.join(REPO_ROOT, 'e2e/.workers/_packs');

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
