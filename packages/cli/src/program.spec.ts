import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProgram } from './program.js';
import { loadRegistry } from './registry/load.js';
import { add } from './commands/add.js';
import { why } from './commands/why.js';
import { getDefaultConfig } from './utils/config.js';

// `createProgram` is the wiring under test: the preAction hook decides which
// registry the manifest comes from, and commander hands the same value to the
// action. The commands themselves are covered by their own specs, so the
// actions are stubbed and the registry loader records what it was asked for.
vi.mock('./registry/load.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./registry/load.js')>(),
    loadRegistry: vi.fn(async () => undefined),
}));
vi.mock('./commands/add.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./commands/add.js')>(),
    add: vi.fn(async () => undefined),
}));
vi.mock('./commands/why.js', async (importOriginal) => ({
    ...await importOriginal<typeof import('./commands/why.js')>(),
    why: vi.fn(async () => undefined),
}));
vi.mock('./commands/help.js', () => ({ help: vi.fn(async () => undefined) }));

const FORK = 'https://git.example/org/fork/-/raw/main/packages/components';
const FLAG = 'https://mirror.example/components';

let project: string;

const configWith = (registry?: unknown): string =>
    JSON.stringify({ ...getDefaultConfig(), ...(registry === undefined ? {} : { registry }) });

const run = (...argv: string[]): Promise<unknown> =>
    createProgram().parseAsync(['node', 'shadcn-angular', ...argv]);

/** The registry the manifest was loaded from. */
const loadedFrom = (): string | undefined =>
    (vi.mocked(loadRegistry).mock.calls[0][0] as { registry?: string }).registry;

/** The registry the command's own action saw in its options. */
const actionSaw = (action: unknown): string | undefined =>
    ((action as ReturnType<typeof vi.fn>).mock.calls[0][1] as { registry?: string }).registry;

beforeEach(() => {
    vi.clearAllMocks();
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'program-'));
    vi.spyOn(process, 'cwd').mockReturnValue(project);
});

afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(project, { recursive: true, force: true });
});

describe('the registry a command loads its manifest from', () => {
    it.each([
        { row: 'the flag only', file: undefined, flag: FLAG, expected: FLAG },
        { row: 'components.json only', file: configWith(FORK), flag: undefined, expected: FORK },
        { row: 'both: the flag wins', file: configWith(FORK), flag: FLAG, expected: FLAG },
        { row: 'neither', file: configWith(), flag: undefined, expected: undefined },
        { row: 'a components.json that is not valid JSON', file: '{ "registry": ', flag: undefined, expected: undefined },
        { row: 'a components.json whose registry is not a string', file: configWith(5), flag: undefined, expected: undefined },
    ])('is the same source the files come from: $row', async ({ file, flag, expected }) => {
        if (file !== undefined) fs.writeFileSync(path.join(project, 'components.json'), file);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await run('add', 'button', ...(flag ? ['--registry', flag] : []));

        expect(loadedFrom()).toBe(expected);
        expect(actionSaw(add)).toBe(expected);
        // A broken components.json is reported by the command, not twice by the hook.
        expect(errors).not.toHaveBeenCalled();
    });

    it('also holds for a read-only command', async () => {
        fs.writeFileSync(path.join(project, 'components.json'), configWith(FORK));

        await run('why', 'button');

        expect(loadedFrom()).toBe(FORK);
        expect(actionSaw(why)).toBe(FORK);
    });

    it('is untouched for a command that declares no --registry', async () => {
        fs.writeFileSync(path.join(project, 'components.json'), configWith(FORK));

        await run('help');

        expect(loadedFrom()).toBeUndefined();
    });
});
