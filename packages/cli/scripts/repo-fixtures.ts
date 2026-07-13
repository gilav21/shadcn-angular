/**
 * Fixture repos for the maintainer scripts' subprocess tests. TEST SUPPORT ONLY
 * — nothing here ships, and nothing here is imported by a script.
 *
 * Every maintainer entry script resolves its roots from its OWN location
 * (`SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))`, then `../../..`), so
 * `cwd` cannot redirect them: run in place, they read and WRITE the real repo's
 * registry, components and demo tree. The only way to drive them destructively
 * (a seeded gap, a `--fix`, a scaffold) without mutating the working copy is to
 * copy the script into a throwaway repo so that its own `REPO_ROOT` resolves
 * inside the fixture. That copy is what {@link copyScripts} does; the tests then
 * point `tsx` at the COPY.
 *
 * Consequence worth knowing: a subprocess test contributes NOTHING to the v8
 * coverage of the script it drives (the child process is not instrumented). The
 * value bought here is the argv → stdout/stderr → exit-code → filesystem
 * CONTRACT, which the in-process `*-lib` unit tests cannot see.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPTS_DIR, '../../..');

/** A finished subprocess run. A non-zero exit is DATA here, never a throw. */
export interface Run {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
    /** stdout + stderr, for assertions that do not care which stream carried it. */
    readonly output: string;
}

/**
 * A throwaway repo root. The `"type": "module"` package.json is load-bearing:
 * without it `tsx` compiles the copied scripts as CommonJS and their top-level
 * `await main()` fails to transform.
 */
export function createRepo(prefix: string): string {
    const root = mkdtempSync(path.join(os.tmpdir(), `shadcn-${prefix}-`));
    writeFileSync(path.join(root, 'package.json'), '{\n  "type": "module"\n}\n');
    return root;
}

export function removeRepo(root: string): void {
    rmSync(root, { recursive: true, force: true });
}

/** Writes a repo-relative file, creating its parents. Returns the absolute path. */
export function write(root: string, rel: string, content: string): string {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
    return file;
}

/** Copies real scripts into the fixture, so their `REPO_ROOT` lands inside it. */
export function copyScripts(root: string, names: readonly string[]): void {
    const dir = path.join(root, 'packages/cli/scripts');
    mkdirSync(dir, { recursive: true });
    for (const name of names) {
        copyFileSync(path.join(SCRIPTS_DIR, name), path.join(dir, name));
    }
}

/** Absolute path of a script copied into the fixture by {@link copyScripts}. */
export function fixtureScript(root: string, name: string): string {
    return path.join(root, 'packages/cli/scripts', name);
}

/**
 * Runs a script under `tsx`, exactly as the npm scripts and git hooks do.
 * `stdin` is ignored, so `isTTY` is false in the child and the scripts that
 * prompt (`new-component`) take their non-interactive fallbacks instead of
 * hanging the suite.
 */
export function runScript(script: string, args: readonly string[] = []): Run {
    const result = spawnSync('npx', ['tsx', script, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    return { status: result.status ?? -1, stdout, stderr, output: stdout + stderr };
}

export function git(root: string, ...args: string[]): string {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8' }).trim();
}

export function commitAll(root: string, message: string): void {
    git(root, 'add', '-A');
    git(root, 'commit', '--no-verify', '-m', message);
}

/**
 * `git init` + a first commit. Identity and signing are forced locally so the
 * fixture is independent of the machine's git config.
 *
 * A commit is required, not optional: `check-completeness` and `release-cli`
 * both shell out to `git log`, which FAILS on a repo with no commits.
 */
export function gitInitCommit(root: string, message = 'chore: fixture'): void {
    git(root, 'init', '-b', 'master');
    git(root, 'config', 'user.email', 'fixture@example.com');
    git(root, 'config', 'user.name', 'Fixture');
    git(root, 'config', 'commit.gpgsign', 'false');
    // Without this, `git add` warns about LF→CRLF on every fixture file and the
    // noise lands in the test runner's stderr.
    git(root, 'config', 'core.autocrlf', 'false');
    commitAll(root, message);
}
