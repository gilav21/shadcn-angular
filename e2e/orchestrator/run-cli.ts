import fs from 'node:fs';
import { run } from './spawn.js';
import { CLI_DIST, FIXTURE_APP, REPO_ROOT } from './paths.js';

/**
 * Lazy build of the CLI: if `dist/index.js` is missing or older than any
 * source under `src/`, run `npm run build`. Saves ~15s on warm reruns.
 */
export async function ensureCliBuilt(): Promise<void> {
    if (!shouldRebuildCli()) return;
    console.log('[e2e] Building CLI…');
    await run('npm', ['run', 'build'], { cwd: REPO_ROOT + '/packages/cli' });
}

function shouldRebuildCli(): boolean {
    if (!fs.existsSync(CLI_DIST)) return true;
    const distMtime = fs.statSync(CLI_DIST).mtimeMs;
    const srcDir = REPO_ROOT + '/packages/cli/src';
    return walkMtimes(srcDir).some(t => t > distMtime);
}

function walkMtimes(dir: string): number[] {
    const out: number[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = dir + '/' + entry.name;
        if (entry.isDirectory()) {
            out.push(...walkMtimes(p));
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            out.push(fs.statSync(p).mtimeMs);
        }
    }
    return out;
}

/** Runs the local CLI inside the fixture-app with the given args. */
export async function runCli(args: readonly string[]): Promise<void> {
    await run('node', [CLI_DIST, ...args], { cwd: FIXTURE_APP });
}

/** Runs `npm install` inside the fixture-app. Cached after first cold run. */
export async function npmInstall(): Promise<void> {
    await run('npm', ['install', '--no-audit', '--no-fund'], { cwd: FIXTURE_APP });
}
