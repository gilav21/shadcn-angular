import os from 'node:os';

/**
 * Argv parsing for the orchestrator, kept out of `run.ts` so each flag can be
 * handled by a small named function instead of another branch in one loop.
 */

/** Flags that take no value. */
export const VALUELESS_FLAGS = new Set(['--headed', '--ui', '--debug', '--remote']);

export interface FlagState {
    headed: boolean;
    ui: boolean;
    debug: boolean;
    remote: boolean;
    branch?: string;
    workers: number;
}

/**
 * How many specs to run at once by default.
 *
 * Each worker holds an `ng serve` and a browser, so the ceiling is set by I/O
 * and memory rather than cores — and it is very different per platform.
 * Measured on the same 32-core machine:
 *
 *   Linux (WSL2, ext4), 178 specs:  1 → 30.6min, 4 → 5.4, 8 → 3.8, 12 → 3.2
 *   Windows (NTFS),      20 specs:  1 →  2.8min, 4 → 2.2, 6 → 3.7, 8 → FAILS
 *
 * Windows peaks at 4 and gets *slower* beyond it; at 8 the dev servers starve
 * each other and time out ("ng serve did not become ready within 120000ms"),
 * failing 9 of 20 specs. NTFS file-watching plus esbuild is simply heavier than
 * ext4. So cap by platform, then scale down for smaller machines.
 */
export function defaultWorkers(): number {
    const cores = os.cpus().length || 1;
    const cap = process.platform === 'win32' ? 4 : 8;
    return Math.max(1, Math.min(cap, Math.floor(cores / 2)));
}

function fail(message: string): never {
    console.error(`[e2e] ${message}`);
    process.exit(2);
}

/** Reads the value after a flag, rejecting a missing one or another flag. */
function valueFor(raw: readonly string[], index: number, flag: string): string {
    const value = raw[index];
    if (!value || value.startsWith('--')) {
        fail(`${flag} requires a value`);
    }
    return value;
}

function applyValuelessFlag(state: FlagState, arg: string): boolean {
    switch (arg) {
        case '--headed': state.headed = true; return true;
        case '--ui': state.ui = true; return true;
        case '--debug': state.debug = true; return true;
        case '--remote': state.remote = true; return true;
        default: return false;
    }
}

function parseWorkerCount(value: string): number {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) {
        fail(`--workers needs a positive integer (got ${value})`);
    }
    return count;
}

export function parseRawArgs(raw: readonly string[]): { state: FlagState; names: string[] } {
    const state: FlagState = {
        headed: false,
        ui: false,
        debug: false,
        remote: false,
        workers: defaultWorkers(),
    };
    const names: string[] = [];
    const unknownFlags: string[] = [];

    for (let i = 0; i < raw.length; i++) {
        const arg = raw[i];
        if (arg === '--branch') {
            state.branch = valueFor(raw, ++i, '--branch');
        } else if (arg === '--workers') {
            state.workers = parseWorkerCount(valueFor(raw, ++i, '--workers'));
        } else if (!applyValuelessFlag(state, arg)) {
            if (arg.startsWith('--')) unknownFlags.push(arg);
            else names.push(arg);
        }
    }

    if (unknownFlags.length > 0) {
        console.error(`[e2e] Unknown flag(s): ${unknownFlags.join(', ')}`);
        console.error(
            `[e2e] Available flags: ${[...VALUELESS_FLAGS].join(', ')}, --branch <name>, --workers <n>`,
        );
        process.exit(2);
    }

    // `--branch` only makes sense against a remote fetch.
    if (state.branch) state.remote = true;

    // The interactive modes attach a terminal to one browser; several at once
    // would be unusable, so they force sequential execution.
    if (state.ui || state.debug || state.headed) state.workers = 1;

    return { state, names };
}
