import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execa } from 'execa';
import { getPackageManager, installPackages } from './package-manager.js';

vi.mock('execa', () => ({ execa: vi.fn(async () => ({})) }));

const NPX_AGENT = 'npm/11.5.1 node/v22.0.0 win32 x64 workspaces/false';
const PNPM_AGENT = 'pnpm/9.15.9 npm/? node/v22.0.0';

let sandbox: string;
let savedAgent: string | undefined;

beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'pm-'));
    savedAgent = process.env['npm_config_user_agent'];
    vi.mocked(execa).mockClear();
});

afterEach(async () => {
    if (savedAgent === undefined) delete process.env['npm_config_user_agent'];
    else process.env['npm_config_user_agent'] = savedAgent;
    vi.restoreAllMocks();
    await fs.remove(sandbox);
});

function setAgent(agent: string | undefined): void {
    if (agent === undefined) delete process.env['npm_config_user_agent'];
    else process.env['npm_config_user_agent'] = agent;
}

/** A repository at `<sandbox>/repo` (its `.git` marks the boundary of the walk) holding `files`. */
async function repo(files: Record<string, string>): Promise<string> {
    const root = path.join(sandbox, 'repo');
    await fs.ensureDir(path.join(root, '.git'));
    for (const [rel, content] of Object.entries(files)) {
        await fs.outputFile(path.join(root, rel), content);
    }
    return root;
}

describe('getPackageManager', () => {
    // The first row is the reported bug: `npx` always sets the user agent to npm.
    it.each([
        { name: 'pnpm lockfile beats the npx user agent', files: { 'pnpm-lock.yaml': '' }, agent: NPX_AGENT, cwd: '', expected: 'pnpm' },
        { name: 'yarn.lock', files: { 'yarn.lock': '' }, agent: NPX_AGENT, cwd: '', expected: 'yarn' },
        { name: 'bun.lock (text, Bun 1.2+)', files: { 'bun.lock': '' }, agent: NPX_AGENT, cwd: '', expected: 'bun' },
        { name: 'bun.lockb (binary, older Bun)', files: { 'bun.lockb': '' }, agent: NPX_AGENT, cwd: '', expected: 'bun' },
        { name: 'package-lock.json beats a pnpm user agent', files: { 'package-lock.json': '{}' }, agent: PNPM_AGENT, cwd: '', expected: 'npm' },
        { name: 'npm-shrinkwrap.json beats a pnpm user agent', files: { 'npm-shrinkwrap.json': '{}' }, agent: PNPM_AGENT, cwd: '', expected: 'npm' },
        {
            name: 'lockfile at the repository root, project in apps/web',
            files: { 'pnpm-lock.yaml': '', 'apps/web/package.json': '{"name":"web"}' }, agent: NPX_AGENT, cwd: 'apps/web', expected: 'pnpm',
        },
        {
            name: 'packageManager field beats a lockfile in the same directory',
            files: { 'package.json': '{"packageManager":"yarn@4.1.0"}', 'package-lock.json': '{}' }, agent: NPX_AGENT, cwd: '', expected: 'yarn',
        },
        {
            name: 'packageManager with a corepack hash suffix',
            files: { 'package.json': '{"packageManager":"pnpm@9.1.0+sha512.abc"}' }, agent: NPX_AGENT, cwd: '', expected: 'pnpm',
        },
        {
            name: 'a nested package.json without the field defers to the root that has it',
            files: { 'package.json': '{"packageManager":"bun@1.2.0"}', 'apps/web/package.json': '{"name":"web"}' }, agent: NPX_AGENT, cwd: 'apps/web', expected: 'bun',
        },
        {
            name: 'a package.json that is not JSON does not hide the lockfile beside it',
            files: { 'package.json': '{ not json', 'yarn.lock': '' }, agent: NPX_AGENT, cwd: '', expected: 'yarn',
        },
        { name: 'nothing declared: the invoking tool decides', files: {}, agent: 'pnpm/9.0.0 npm/? node/v22.0.0', cwd: '', expected: 'pnpm' },
        { name: 'nothing declared and no user agent: npm', files: {}, agent: undefined, cwd: '', expected: 'npm' },
    ])('detects the package manager that owns the project: $name', async ({ files, agent, cwd, expected }) => {
        const root = await repo(files);
        setAgent(agent);

        expect(await getPackageManager(path.join(root, cwd))).toBe(expected);
    });

    it('ignores a lockfile above the repository root', async () => {
        await fs.outputFile(path.join(sandbox, 'yarn.lock'), '');
        const root = await repo({ 'package.json': '{}' });
        setAgent(undefined);

        expect(await getPackageManager(root)).toBe('npm');
    });

    it('breaks a multi-lockfile tie by user agent, else by precedence with a warning', async () => {
        const root = await repo({ 'yarn.lock': '', 'package-lock.json': '{}' });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        setAgent('yarn/1.22.22 npm/? node/v22.0.0');
        expect(await getPackageManager(root)).toBe('yarn');
        setAgent(NPX_AGENT);
        expect(await getPackageManager(root)).toBe('npm');
        expect(warn).not.toHaveBeenCalled();

        setAgent(undefined);
        expect(await getPackageManager(root)).toBe('yarn');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toBe(
            'Found several lockfiles (yarn.lock, package-lock.json); using yarn. ' +
            'Delete the ones you don\'t use, or set "packageManager" in package.json.',
        );
    });
});

describe('installPackages', () => {
    it('runs the manager that owns the project, not the one that launched the CLI', async () => {
        const root = await repo({ 'pnpm-lock.yaml': '' });
        setAgent(NPX_AGENT);

        await installPackages(['zod'], { cwd: root });

        expect(execa).toHaveBeenCalledWith('pnpm', ['add', '--', 'zod'], { cwd: root });
    });

    // `--` ends option parsing, so a package spec can never be read as a flag
    // (`--registry=…`). Verified 2026-10-03 on npm 11.5.1, pnpm 9.15.9,
    // yarn 1.22.22, yarn 4.18.1 and bun 1.2.23: after `--` each treats the token
    // as a package spec, and `-D -- <pkg>` still installs normally.
    // Dev rows plus the runtime-dependency form every production caller uses.
    it.each([
        { lock: 'package-lock.json', dev: true, bin: 'npm', argv: ['install', '-D', '--', 'zod', '@scope/pkg@^1.2.3'] },
        { lock: 'package-lock.json', dev: false, bin: 'npm', argv: ['install', '--', 'zod', '@scope/pkg@^1.2.3'] },
        { lock: 'pnpm-lock.yaml', dev: true, bin: 'pnpm', argv: ['add', '-D', '--', 'zod', '@scope/pkg@^1.2.3'] },
        { lock: 'yarn.lock', dev: true, bin: 'yarn', argv: ['add', '-D', '--', 'zod', '@scope/pkg@^1.2.3'] },
        { lock: 'yarn.lock', dev: false, bin: 'yarn', argv: ['add', '--', 'zod', '@scope/pkg@^1.2.3'] },
        { lock: 'bun.lock', dev: true, bin: 'bun', argv: ['add', '-d', '--', 'zod', '@scope/pkg@^1.2.3'] },
    ])('installPackages separates options from package specs with -- for every verified package manager: $bin (dev: $dev)', async ({ lock, dev, bin, argv }) => {
        const root = await repo({ [lock]: '' });
        setAgent(undefined);

        await installPackages(['zod', '@scope/pkg@^1.2.3'], { cwd: root, dev });

        expect(execa).toHaveBeenCalledWith(bin, argv, { cwd: root });
    });
});
