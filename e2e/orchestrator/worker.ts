import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { DEV_SERVER_PORT, FIXTURE_APP, WORKERS_ROOT } from './paths.js';
import { resetFixtureApp } from './reset-app.js';

/**
 * Directories inside a fixture that must SURVIVE a reset. `node_modules` is
 * the whole reason the suite is not an hour longer — re-installing 600+
 * Angular transitive deps per component would dominate every other cost — and
 * the build caches are nearly as expensive to rebuild.
 */
const PRESERVED = new Set(['node_modules', '.angular', 'dist']);

/**
 * One isolated place to install a component and drive a browser at it.
 *
 * Worker 0 is the canonical `e2e/fixture-app`, so a single-worker run behaves
 * exactly as the suite always has, and `npm run e2e:reset` still applies to
 * it. Workers 1..N-1 are clones under `e2e/.workers/`, each with its own
 * dev-server port, so specs can run concurrently instead of queueing on one
 * fixture, one port and one harness page.
 */
export interface Worker {
    readonly index: number;
    readonly fixtureApp: string;
    readonly port: number;
    readonly baseUrl: string;
    /** Restores this fixture to its pristine, committed state. */
    reset(): Promise<void>;
}

/**
 * Finds a port nothing can bind, starting at `from` and counting up.
 *
 * A fixed port-per-worker is not dependable: a leaked dev server holds one, and
 * on Windows a WSL2 relay can reserve a range that shows in neither `netstat`
 * nor `netsh excludedportrange` while still failing every bind. Asking the OS
 * what is actually free costs milliseconds and removes a whole class of
 * "port already in use" failures that have nothing to do with the tests.
 */
async function findFreePort(from: number): Promise<number> {
    for (let port = from; port < from + 200; port++) {
        const free = await new Promise<boolean>(resolve => {
            const probe = net.createServer()
                .once('error', () => resolve(false))
                .once('listening', () => probe.close(() => resolve(true)))
                .listen(port, '127.0.0.1');
        });
        if (free) return port;
    }
    throw new Error(`No free port found in ${from}..${from + 200}`);
}

/** `e2e/.workers/_pristine` — tracked fixture files, extracted once from git. */
function pristineDir(): string {
    return path.join(WORKERS_ROOT, '_pristine');
}

function workerFixture(index: number): string {
    return path.join(WORKERS_ROOT, `w${index}`, 'fixture-app');
}

/**
 * Clones a directory tree using hardlinks, falling back to a real copy per
 * file when the filesystem refuses one (a cross-device `node_modules`, or a
 * Windows volume without the privilege).
 *
 * Hardlinking is what makes extra workers cheap: a fixture's node_modules is
 * ~274MB, and linking it costs neither the bytes nor the minutes a copy would.
 * It is safe here because nothing writes THROUGH a link — a reset only ever
 * deletes and rewrites the small tracked tree, and npm replaces a package by
 * unlinking it first rather than editing in place.
 */
function hardlinkTree(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            hardlinkTree(from, to);
        } else if (entry.isSymbolicLink()) {
            try {
                fs.symlinkSync(fs.readlinkSync(from), to);
            } catch {
                // A dangling or unsupported link is not worth failing a clone.
            }
        } else {
            try {
                fs.linkSync(from, to);
            } catch {
                fs.copyFileSync(from, to);
            }
        }
    }
}

function cloneTree(src: string, dest: string): void {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    hardlinkTree(src, dest);
}

/**
 * Snapshots the fixture's committed files so a clone can be reset without git.
 * The clones live under a gitignored directory, so `git checkout` cannot
 * restore them the way it restores the canonical fixture.
 *
 * The snapshot is taken from the canonical fixture immediately after a reset,
 * when it is by definition identical to HEAD. That avoids piping `git archive`
 * through `tar`, which is not portable — Windows resolves `tar` to a build that
 * rejects the invocation outright.
 */
async function ensurePristine(): Promise<void> {
    const dir = pristineDir();
    if (fs.existsSync(dir)) return;

    await resetFixtureApp();
    fs.mkdirSync(dir, { recursive: true });
    for (const entry of fs.readdirSync(FIXTURE_APP)) {
        if (PRESERVED.has(entry)) continue;
        fs.cpSync(path.join(FIXTURE_APP, entry), path.join(dir, entry), { recursive: true });
    }
}

/** Deletes everything a test could have written, keeping the caches. */
function scrub(fixture: string): void {
    if (!fs.existsSync(fixture)) return;
    for (const entry of fs.readdirSync(fixture)) {
        if (PRESERVED.has(entry)) continue;
        fs.rmSync(path.join(fixture, entry), { recursive: true, force: true });
    }
}

function restorePristine(fixture: string): void {
    const src = pristineDir();
    for (const entry of fs.readdirSync(src)) {
        fs.cpSync(path.join(src, entry), path.join(fixture, entry), { recursive: true });
    }
}

function makeClone(index: number, port: number): Worker {
    const fixture = workerFixture(index);
    if (!fs.existsSync(fixture)) {
        cloneTree(FIXTURE_APP, fixture);
    }
    return {
        index,
        fixtureApp: fixture,
        port,
        baseUrl: `http://localhost:${port}`,
        reset: async () => {
            scrub(fixture);
            restorePristine(fixture);
        },
    };
}

/**
 * Builds `count` workers. Worker 0 always maps to the canonical fixture, so
 * `--workers 1` is exactly the old behaviour.
 */
export async function createWorkers(count: number): Promise<Worker[]> {
    const port0 = await findFreePort(DEV_SERVER_PORT);
    const workers: Worker[] = [{
        index: 0,
        fixtureApp: FIXTURE_APP,
        port: port0,
        baseUrl: `http://localhost:${port0}`,
        reset: resetFixtureApp,
    }];
    if (count <= 1) return workers;

    await ensurePristine();
    // node_modules is what makes a clone worth having; without it every clone
    // would cold-install on its first spec and give back the time we came for.
    if (!fs.existsSync(path.join(FIXTURE_APP, 'node_modules'))) {
        throw new Error(
            'e2e/fixture-app/node_modules is missing — run a single-worker pass first ' +
            '(`npm run e2e -- button`) so the clones have something to copy.',
        );
    }
    let next = port0 + 1;
    for (let i = 1; i < count; i++) {
        const port = await findFreePort(next);
        next = port + 1;
        workers.push(makeClone(i, port));
    }
    return workers;
}

/** Removes every clone. The canonical fixture is left alone. */
export function removeWorkerClones(): void {
    fs.rmSync(WORKERS_ROOT, { recursive: true, force: true });
}
