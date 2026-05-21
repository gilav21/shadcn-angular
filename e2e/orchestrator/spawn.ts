import { spawn, type SpawnOptions } from 'node:child_process';

/**
 * Thin promise wrapper around `child_process.spawn`. Resolves on exit
 * code 0, rejects otherwise with the captured exit code.
 *
 * We use this instead of `execa` because execa 9's transitive
 * `unicorn-magic` ships a malformed `exports` field that fails to
 * resolve under Node 25 + tsx. Node's built-in `spawn` does everything
 * we need (status code, inherit stdio, shell, cwd) without the breakage.
 */
export async function run(
    command: string,
    args: readonly string[],
    options: SpawnOptions = {},
): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            stdio: 'inherit',
            shell: process.platform === 'win32',
            ...options,
        });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) resolve();
            else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

/** Capture stdout of a command. Useful for git status. */
export async function capture(
    command: string,
    args: readonly string[],
    options: SpawnOptions = {},
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            stdio: ['ignore', 'pipe', 'inherit'],
            shell: process.platform === 'win32',
            ...options,
        });
        const chunks: Buffer[] = [];
        child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) resolve(Buffer.concat(chunks).toString('utf-8'));
            else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

/**
 * Like `capture` but merges stderr into the returned string and returns
 * the combined output even on a non-zero exit code (with the exit code
 * attached to the error if you want to throw). Used for CLI-regression
 * specs that need to assert on warnings/prompts the CLI emits.
 */
export async function captureBoth(
    command: string,
    args: readonly string[],
    options: SpawnOptions = {},
): Promise<{ stdout: string; code: number }> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
            ...options,
        });
        const chunks: Buffer[] = [];
        child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
        child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk));
        child.on('error', reject);
        child.on('exit', code => {
            resolve({ stdout: Buffer.concat(chunks).toString('utf-8'), code: code ?? -1 });
        });
    });
}
