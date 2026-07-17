#!/usr/bin/env node
/**
 * Drive the real-jest validation for one or more components.
 *
 *   node e2e/jest-fixture/run.mjs button badge …
 *
 * Resets the fixture's installed sources, installs each component with
 * `add --include-tests` (runner jest, from components.json), seeds the baseline
 * `lib/utils.ts` that `init` normally provides, then runs jest. Exits non-zero
 * if the install or the jest run fails — this is the jest leg of the
 * `--include-tests` verification gate, complementing the vitest jsdom leg in
 * `verify-portable.ts`.
 *
 * Requires the CLI to be built (`npm run build:cli`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(FIXTURE_DIR, '../..');
const CLI = path.join(REPO_ROOT, 'packages/cli/dist/index.js');
const JEST_BIN = path.join(REPO_ROOT, 'node_modules/jest/bin/jest.js');
const BASELINE_UTILS = path.join(REPO_ROOT, 'packages/components/lib/utils.ts');

function run(cmd, args, cwd) {
    const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
    return result.status === 0;
}

function seedBaselineLib() {
    // `init` installs lib/utils.ts (the `cn` helper every component imports);
    // this fixture skips init, so seed it after the component install.
    const dest = path.join(FIXTURE_DIR, 'src/components/lib/utils.ts');
    if (existsSync(dest)) return;
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(BASELINE_UTILS, dest);
}

function main() {
    const components = process.argv.slice(2).filter(a => !a.startsWith('--'));
    if (components.length === 0) {
        console.error('Usage: node e2e/jest-fixture/run.mjs <component...>');
        process.exit(2);
    }
    if (!existsSync(CLI)) {
        console.error(`CLI not built at ${CLI} — run "npm run build:cli" first.`);
        process.exit(2);
    }

    rmSync(path.join(FIXTURE_DIR, 'src'), { recursive: true, force: true });
    rmSync(path.join(FIXTURE_DIR, 'components.lock.json'), { force: true });

    if (!run(process.execPath, [CLI, 'add', ...components, '--include-tests', '--yes'], FIXTURE_DIR)) {
        console.error('Component install failed.');
        process.exit(1);
    }
    seedBaselineLib();

    if (!run(process.execPath, [JEST_BIN, '--config', 'jest.config.cjs'], FIXTURE_DIR)) {
        console.error('\nJest run failed — the shipped specs do not pass under a real jest consumer.');
        process.exit(1);
    }
    console.log('\nJest leg passed for: ' + components.join(', '));
}

main();
