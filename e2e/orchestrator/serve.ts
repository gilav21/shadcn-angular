import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { run } from './spawn.js';
import { DEV_SERVER_PORT, FIXTURE_APP } from './paths.js';

const SERVE_TIMEOUT_MS = 120_000;
const READY_POLL_MS = 500;
const isWindows = process.platform === 'win32';

export interface ServerHandle {
    stop(): Promise<void>;
}

/**
 * Spawns `ng serve` on the configured port, resolves once the server
 * answers a GET / with any status (so we know it's listening, not that
 * the app is bug-free — that's the test's job).
 *
 * Fails fast if the port is already in use — almost always means a leaked
 * server from a previous run. Easier to fix the leak than to chase moving
 * ports through Playwright config.
 */
export async function serve(
    cwd: string = FIXTURE_APP,
    port: number = DEV_SERVER_PORT,
): Promise<ServerHandle> {
    await assertPortFree(port);

    // shell: true is required on Windows so the `.cmd` shim for npx can
    // be launched. Args are static — no injection surface.
    //
    // detached: true is the key to cross-platform tree-kill on POSIX —
    // it puts the child in its own process group so that, on stop(), a
    // `process.kill(-pid, SIGTERM)` reaches every descendant (npx →
    // node → @angular/build → its workers) rather than just the npx
    // shim. Windows ignores `detached` here and we tree-kill via
    // `taskkill /F /T /PID`.
    const child = spawn(
        'npx',
        ['ng', 'serve', '--port', String(port), '--no-open'],
        {
            cwd,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: !isWindows,
        },
    );

    child.stdout?.on('data', chunk => process.stdout.write(chunk));
    child.stderr?.on('data', chunk => process.stderr.write(chunk));

    let crashed: Error | null = null;
    child.on('exit', code => {
        if (code !== null && code !== 0) {
            crashed = new Error(`ng serve exited unexpectedly with code ${code}`);
        }
    });

    await waitForReady(port, () => crashed);

    return {
        stop: () => stopChild(child, port),
    };
}

async function waitForReady(port: number, getCrashed: () => Error | null): Promise<void> {
    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const crashed = getCrashed();
        if (crashed) throw crashed;
        if (await pingOk(port)) return;
        await sleep(READY_POLL_MS);
    }
    throw new Error(`ng serve did not become ready within ${SERVE_TIMEOUT_MS}ms`);
}

async function pingOk(port: number): Promise<boolean> {
    try {
        const res = await fetch(`http://localhost:${port}`);
        // 200 OK or any 3xx/4xx still means the server is listening. We
        // only treat 5xx and network errors as "not ready yet".
        return res.status < 500;
    } catch {
        return false;
    }
}

async function assertPortFree(port: number): Promise<void> {
    const inUse = await isPortInUse(port);
    if (inUse) {
        throw new Error(
            `Port ${port} is already in use. ` +
            `Likely a leaked ng-serve from a previous run. ` +
            (isWindows
                ? `Run: netstat -ano | findstr :${port}  then  taskkill /F /PID <pid>`
                : `Run: lsof -i :${port}  then  kill -9 <pid>`),
        );
    }
}

function isPortInUse(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const tester = net.createServer()
            .once('error', (err: NodeJS.ErrnoException) => {
                resolve(err.code === 'EADDRINUSE');
            })
            .once('listening', () => {
                tester.close(() => resolve(false));
            })
            .listen(port, '127.0.0.1');
    });
}

/**
 * Tree-kills `ng serve` and all its descendants, then blocks until the
 * dev-server port is actually free again so the next spec's preflight
 * doesn't race a partially-released socket.
 *
 * Windows: `child.kill()` terminates only the npx.cmd shim → cmd.exe →
 * node → ng tree's root, leaving descendants holding ports.
 * `taskkill /F /T /PID` walks the tree.
 *
 * POSIX: ng serve is spawned with `detached: true`, which puts it in
 * its own process group. `process.kill(-pid, SIGTERM)` then signals
 * every member of that group. Without `detached: true`, `-pid` doesn't
 * resolve to a group and the descendant `ng` / `node` processes
 * outlive the orchestrator — the symptom is a stale dev server still
 * watching the fixture, recompiling on reset, and emitting Vite error
 * overlays that intercept Playwright clicks for the next spec.
 */
async function stopChild(child: ChildProcess, port: number): Promise<void> {
    if (child.exitCode !== null || child.pid === undefined) return;

    if (isWindows) {
        try {
            await run('taskkill', ['/F', '/T', '/PID', String(child.pid)]);
        } catch {
            // Already dead is fine.
        }
    } else {
        try {
            // SIGTERM first; if anything's still alive after the grace
            // window, SIGKILL the whole group.
            process.kill(-child.pid, 'SIGTERM');
        } catch {
            child.kill('SIGTERM');
        }
    }

    await new Promise<void>(resolve => {
        if (child.exitCode !== null) return resolve();
        child.once('exit', () => resolve());
        setTimeout(() => resolve(), 5_000).unref();
    });

    // Hard-kill anything still alive on POSIX. taskkill /F already
    // covers Windows.
    // eslint-disable-next-line sonarjs/different-types-comparison -- child.pid is number|undefined per Node.js types; guard is genuine
    if (!isWindows && child.pid !== undefined && child.exitCode === null) {
        try {
            process.kill(-child.pid, 'SIGKILL');
        } catch {
            // Group is gone — fine.
        }
    }

    // Wait until the port is observably free. The OS keeps a socket in
    // TIME_WAIT briefly after close; without SO_REUSEADDR the next
    // bind() will fail. Poll for up to 10s with a 100ms cadence.
    await waitForPortFree(port, 10_000);
}

async function waitForPortFree(port: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!(await isPortInUse(port))) return;
        await sleep(100);
    }
    // We'd rather let the next spec hit the explicit "port in use"
    // assertion than hang here forever — fall through.
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
