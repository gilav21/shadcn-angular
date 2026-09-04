/**
 * `npm run build:package -- <rte|data-table>` — stage → ng build → npm pack.
 *
 * Also the module the e2e orchestrator and the release preflight import for
 * `buildPackageTarball`. Nothing but WIRING: it resolves the repo root and
 * hands the real subprocess and filesystem primitives to `nodeBuildEffects`.
 * Every structural gate, the build ORDER and the path layout live in
 * `package-build-lib.ts`, where they are unit-tested without a multi-minute
 * ng-packagr build.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { memoisedBuilder, nodeBuildEffects, packsDir, runBuild } from './package-build-lib.js';
import { stagePackage } from './stage-package-lib.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');

/** Where `npm pack` drops tarballs. Re-exported: the e2e orchestrator reads it. */
export const PACKS_DIR = packsDir(REPO_ROOT);

/** The composed effects, exported so the wiring itself is checkable. */
export const EFFECTS = nodeBuildEffects(REPO_ROOT, {
    stage: (id) => { stagePackage(id, REPO_ROOT); },
    exec: (command, args, cwd) => execFileSync(command, [...args], {
        cwd,
        encoding: 'utf-8',
        shell: true,
        stdio: ['ignore', 'pipe', 'inherit'],
    }),
    readDir: readdirSync,
    readFile: (p) => readFileSync(p, 'utf-8'),
    mkdirp: (p) => { mkdirSync(p, { recursive: true }); },
    exists: existsSync,
});

/** The memoised builder the e2e orchestrator and the release preflight call. */
export const buildPackageTarball = memoisedBuilder(EFFECTS);

/** An absolute path made repo-relative, which is how the tarball is reported. */
export const toRepoRelative = (absPath: string): string => path.relative(REPO_ROOT, absPath);

async function main(): Promise<number> {
    const outcome = await runBuild(process.argv.slice(2), buildPackageTarball, toRepoRelative);
    for (const line of outcome.stdout) console.log(line);
    for (const line of outcome.stderr) console.error(line);
    return outcome.status;
}

export { main as runPackageBuildCli };
