#!/usr/bin/env tsx
/**
 * Local release flow for the two COMPILED npm packages. Like `release-cli`,
 * this runs on the maintainer's machine on purpose.
 *
 *   npm run release:package -- <rte|data-table> <patch|minor|major> [flags]
 *
 * In order:
 *   1. Refuses a dirty tree / a non-master branch  (--allow-dirty, --allow-branch)
 *   2. Prints the RELEASE-REQUIRED VERDICT — did anything that ends up inside
 *      the tarball change since the last `<id>-v*` tag? If not, aborts unless
 *      you pass --force.
 *   3. Bumps `packages/<id>-package/package.json` and prepends its CHANGELOG.
 *      The bump happens BEFORE the build, because ng-packagr copies the version
 *      from the source package.json into the tarball — building first would
 *      pack the OLD version.
 *   4. Runs the package preflight: stage → ng build → npm pack → the package
 *      e2e legs. On failure the two bumped files are reverted.  (--skip-preflight)
 *   5. Commits exactly those two files, creates the ANNOTATED tag, pushes.
 *   6. STOPS and prints the manual `npm publish` command.
 *
 * It never runs `npm publish`: publishing needs 2FA, which is interactive.
 *
 * --dry-run does 1-3 in memory and prints exactly what 4-6 would do, changing
 * nothing on disk or in git.
 *
 * This file is nothing but the WIRING: it supplies the real subprocess,
 * filesystem and console implementations of `ReleaseEffects` and hands them to
 * `runRelease`, which owns the whole sequence and is unit-tested against a fake
 * port (a subprocess test contributes no v8 coverage).
 *
 * The repo root is resolved from this file's OWN location, so `cwd` cannot
 * redirect it and the subprocess tests can drive a copy inside a throwaway repo.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { nodeReleaseEffects, runRelease } from './release-package-lib.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');

const git = (args: readonly string[]): string =>
    execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf-8' }).trim();

/** The composed effects, exported so the wiring itself is checkable. */
export const EFFECTS = nodeReleaseEffects(REPO_ROOT, {
    git,
    /** A non-zero exit is an expected answer here ("no such tag"), not an error. */
    gitProbe: (args) => {
        try {
            return execFileSync('git', ['-C', REPO_ROOT, ...args], {
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
        } catch {
            return null;
        }
    },
    /** Through the shell: on Windows `npm` is a `.cmd` shim Node will not spawn with `shell: false`. */
    npm: (command) => { execSync(`npm ${command}`, { cwd: REPO_ROOT, stdio: 'inherit' }); },
    log: (line) => console.log(line),
    error: (line) => console.error(line),
    readFile: (absPath) => readFileSync(absPath, 'utf-8'),
    exists: existsSync,
    writeFile: writeFileSync,
    deleteFile: (absPath) => rmSync(absPath, { force: true }),
    now: () => new Date(),
});

export function main(argv: readonly string[]): number {
    return runRelease(argv, EFFECTS);
}

/**
 * Exit only when RUN, never when imported. Guarding on the entry URL is what
 * lets a test import this module to check its wiring without the import
 * terminating the test process — and without ever reaching a git write.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
