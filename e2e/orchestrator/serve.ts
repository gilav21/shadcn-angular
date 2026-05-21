import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { run } from './spawn.js';
import { DEV_SERVER_PORT, DEV_SERVER_URL, FIXTURE_APP } from './paths.js';

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
export async function serve(): Promise<ServerHandle> {
    await assertPortFree();

    // shell: true is required on Windows so the `.cmd` shim for npx can
    // be launched. Args are static — no injection surface.
    const child = spawn(
        'npx',
        ['ng', 'serve', '--port', String(DEV_SERVER_PORT), '--no-open'],
        {
            cwd: FIXTURE_APP,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
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

    await waitForReady(() => crashed);

    return {
        stop: () => stopChild(child),
    };
}

async function waitForReady(getCrashed: () => Error | null): Promise<void> {
    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const crashed = getCrashed();
        if (crashed) throw crashed;
        if (await pingOk()) return;
        await sleep(READY_POLL_MS);
    }
    throw new Error(`ng serve did not become ready within ${SERVE_TIMEOUT_MS}ms`);
}

async function pingOk(): Promise<boolean> {
    try {
        const res = await fetch(DEV_SERVER_URL);
        // 200 OK or any 3xx/4xx still means the server is listening. We
        // only treat 5xx and network errors as "not ready yet".
        return res.status < 500;
    } catch {
        return false;
    }
}

async function assertPortFree(): Promise<void> {
    const inUse = await isPortInUse(DEV_SERVER_PORT);
    if (inUse) {
        throw new Error(
            `Port ${DEV_SERVER_PORT} is already in use. ` +
            `Likely a leaked ng-serve from a previous run. ` +
            (isWindows
                ? `Run: netstat -ano | findstr :${DEV_SERVER_PORT}  then  taskkill /F /PID <pid>`
                : `Run: lsof -i :${DEV_SERVER_PORT}  then  kill -9 <pid>`),
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
 * Tree-kills `ng serve` and all its descendants. `child.kill()` on
 * Windows only terminates the immediate process (npx.cmd → cmd.exe → node
 * → ng → @angular/build), so we shell out to `taskkill /F /T /PID` which
 * walks the process tree. On POSIX, `kill -- -PID` does the same via the
 * process group, but `tree-kill`-style `pkill -P` is more portable here.
 */
async function stopChild(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.pid === undefined) return;

    if (isWindows) {
        try {
            await run('taskkill', ['/F', '/T', '/PID', String(child.pid)]);
        } catch {
            // Already dead is fine.
        }
    } else {
        try {
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
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
