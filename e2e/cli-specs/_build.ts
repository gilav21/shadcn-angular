import { spawn } from 'node:child_process';

/**
 * A build gate that treats Angular template diagnostics as FAILURES, not noise.
 *
 * The default `ng build` returns exit 0 for *warning*-level diagnostics —
 * including NG8113 ("directive is not used within the template"), the exact
 * signal a silently-broken selector rename emits. The render specs only check
 * "server answered < 500", and `prod-build.ts` only checks "exit 0 + a dist/
 * dir exists", so a green-build / dead-UI regression (e.g. a directive selector
 * renamed out from under a consumer template) sails straight through.
 *
 * This helper captures the combined build output and fails on any `NG####`
 * diagnostic even when the exit code is 0, closing the entire silent-regression
 * blind spot. TS errors already fail the build with a non-zero exit, but the
 * captured output lets a spec additionally assert on a specific code (e.g.
 * TS2305 for a missing lib export).
 */

export interface BuildResult {
    /** Combined stdout + stderr of the build. */
    readonly output: string;
    /** Process exit code (`-1` if the process was killed without one). */
    readonly code: number;
}

export interface BuildOptions {
    /** Run `--configuration production` (slower, full optimizer). Default false. */
    readonly production?: boolean;
    /** NG diagnostic codes to tolerate (e.g. a known-benign `['NG0000']`). */
    readonly allow?: readonly string[];
}

/** Matches Angular diagnostic codes like `NG8113`, `NG2008`. */
const NG_DIAGNOSTIC = /\bNG\d{4}\b/g;

/** All distinct `NG####` codes found in build output. */
export function findNgDiagnostics(output: string): string[] {
    return [...new Set(output.match(NG_DIAGNOSTIC) ?? [])];
}

function captureCombined(command: string, args: readonly string[], cwd: string): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
        });
        const chunks: Buffer[] = [];
        child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
        child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk));
        child.on('error', reject);
        child.on('exit', code => {
            resolve({ output: Buffer.concat(chunks).toString('utf-8'), code: code ?? -1 });
        });
    });
}

/** Runs `npm install` in the fixture app (needed before a build). Throws on failure. */
export async function npmInstall(fixtureApp: string): Promise<void> {
    const { output, code } = await captureCombined(
        'npm', ['install', '--no-audit', '--no-fund'], fixtureApp,
    );
    if (code !== 0) throw new Error(`npm install failed (exit ${code}):\n${tail(output)}`);
}

/** Runs `ng build` in the fixture app and returns the captured output + exit code. */
export function ngBuild(fixtureApp: string, options: BuildOptions = {}): Promise<BuildResult> {
    const args = ['ng', 'build'];
    if (options.production) args.push('--configuration', 'production');
    return captureCombined('npx', args, fixtureApp);
}

/** Last `lines` lines of build output, for compact error messages. */
function tail(output: string, lines = 40): string {
    return output.split('\n').slice(-lines).join('\n');
}

/**
 * Asserts a build succeeded AND emitted no fatal Angular diagnostics. Throws on
 * a non-zero exit, or on any `NG####` code not in `allow`. This is the gate
 * that catches warning-only regressions a plain exit-code check misses.
 */
export function assertCleanBuild(result: BuildResult, allow: readonly string[] = []): void {
    if (result.code !== 0) {
        throw new Error(`ng build failed (exit ${result.code}):\n${tail(result.output)}`);
    }
    const fatal = findNgDiagnostics(result.output).filter(code => !allow.includes(code));
    if (fatal.length > 0) {
        throw new Error(
            `ng build exited 0 but emitted Angular diagnostics treated as failures: ` +
            `${fatal.join(', ')}\n${tail(result.output)}`,
        );
    }
}

/**
 * Convenience: run `ng build` in the fixture app and assert it is clean. Returns
 * the captured output so the caller can make further assertions (or assert the
 * ABSENCE of a specific TS error). Throws via `assertCleanBuild` on any failure.
 */
export async function buildClean(
    fixtureApp: string,
    options: BuildOptions = {},
): Promise<string> {
    const result = await ngBuild(fixtureApp, options);
    assertCleanBuild(result, options.allow);
    return result.output;
}
