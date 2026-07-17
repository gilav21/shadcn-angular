import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { detectTestRunner, hasJestGlobals, resolveRunner, resolveTestInstall } from './test-runner.js';
import { getConfig, type Config } from './config.js';

vi.mock('prompts', () => ({ default: vi.fn() }));

const promptMock = vi.mocked(prompts);

const BASE_CONFIG = {
    style: 'default' as const,
    tailwind: { css: 'src/styles.scss', baseColor: 'neutral' as const, theme: 'zinc' as const, cssVariables: true },
    aliases: { components: '@/components', utils: '@/components/lib', ui: '@/components/ui' },
};

async function makeProject(pkg: Record<string, unknown>, tests?: Config['tests']): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-runner-'));
    await fs.writeJson(path.join(dir, 'package.json'), pkg);
    await fs.writeJson(path.join(dir, 'components.json'), tests ? { ...BASE_CONFIG, tests } : BASE_CONFIG);
    return dir;
}

describe('detectTestRunner', () => {
    let dir: string;
    afterEach(async () => { if (dir) await fs.remove(dir); });

    it('detects vitest from devDependencies', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0' } });
        expect(detectTestRunner(dir)).toBe('vitest');
    });

    it('detects jest from jest-preset-angular', async () => {
        dir = await makeProject({ devDependencies: { 'jest-preset-angular': '^14.0.0' } });
        expect(detectTestRunner(dir)).toBe('jest');
    });

    it('returns both when both are present', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0', jest: '^29.0.0' } });
        expect(detectTestRunner(dir)).toBe('both');
    });

    it('returns none when neither is present', async () => {
        dir = await makeProject({ devDependencies: { typescript: '^5.0.0' } });
        expect(detectTestRunner(dir)).toBe('none');
    });

    it('detects jest from a config file even without a dep', async () => {
        dir = await makeProject({});
        await fs.writeFile(path.join(dir, 'jest.config.js'), 'module.exports = {};');
        expect(detectTestRunner(dir)).toBe('jest');
    });

    it('treats a missing package.json as none', async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-runner-'));
        expect(detectTestRunner(dir)).toBe('none');
    });
});

describe('hasJestGlobals', () => {
    let dir: string;
    afterEach(async () => { if (dir) await fs.remove(dir); });

    it('is true when @jest/globals is a devDependency', async () => {
        dir = await makeProject({ devDependencies: { '@jest/globals': '^30.0.0' } });
        expect(hasJestGlobals(dir)).toBe(true);
    });

    it('is false when absent', async () => {
        dir = await makeProject({ devDependencies: { jest: '^29.0.0' } });
        expect(hasJestGlobals(dir)).toBe(false);
    });
});

describe('resolveRunner', () => {
    let dir: string;
    beforeEach(() => promptMock.mockReset());
    afterEach(async () => { if (dir) await fs.remove(dir); });

    it('prefers the persisted runner over detection', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0' } }, { runner: 'jest' });
        const config = await getConfig(dir) as Config;
        expect(await resolveRunner(config, dir, { interactive: true })).toBe('jest');
        expect(promptMock).not.toHaveBeenCalled();
    });

    it('uses unambiguous detection without prompting', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0' } });
        const config = await getConfig(dir) as Config;
        expect(await resolveRunner(config, dir, { interactive: true })).toBe('vitest');
        expect(promptMock).not.toHaveBeenCalled();
    });

    it('prompts when ambiguous and interactive', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0', jest: '^29.0.0' } });
        const config = await getConfig(dir) as Config;
        promptMock.mockResolvedValue({ runner: 'jest' });
        expect(await resolveRunner(config, dir, { interactive: true })).toBe('jest');
        expect(promptMock).toHaveBeenCalledOnce();
    });

    it('falls back to vitest non-interactively when ambiguous', async () => {
        dir = await makeProject({});
        const config = await getConfig(dir) as Config;
        expect(await resolveRunner(config, dir, { interactive: false })).toBe('vitest');
        expect(promptMock).not.toHaveBeenCalled();
    });
});

describe('resolveTestInstall', () => {
    let dir: string;
    beforeEach(() => promptMock.mockReset());
    afterEach(async () => { if (dir) await fs.remove(dir); });

    const read = async (): Promise<Config> => await getConfig(dir) as Config;

    it('is off by default with no flag and no config', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0' } });
        const result = await resolveTestInstall(await read(), {}, dir);
        expect(result.includeTests).toBe(false);
    });

    it('honours persisted tests.include', async () => {
        dir = await makeProject({ devDependencies: { jest: '^29.0.0' } }, { include: true, runner: 'jest' });
        const result = await resolveTestInstall(await read(), {}, dir);
        expect(result).toEqual({ includeTests: true, runner: 'jest' });
    });

    it('--no-tests wins over persisted include', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0' } }, { include: true, runner: 'vitest' });
        const result = await resolveTestInstall(await read(), { tests: false }, dir);
        expect(result.includeTests).toBe(false);
    });

    it('persists tests on first explicit --include-tests', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0' } });
        const result = await resolveTestInstall(await read(), { includeTests: true, yes: true }, dir);
        expect(result).toEqual({ includeTests: true, runner: 'vitest' });
        expect((await read()).tests).toEqual({ include: true, runner: 'vitest' });
    });

    it('honours an explicit runner override and persists it', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0' } });
        const result = await resolveTestInstall(await read(), { includeTests: true, runner: 'jest', yes: true }, dir);
        expect(result.runner).toBe('jest');
        expect((await read()).tests?.runner).toBe('jest');
    });

    it('does not persist on a dry run', async () => {
        dir = await makeProject({ devDependencies: { vitest: '^2.0.0' } });
        await resolveTestInstall(await read(), { includeTests: true, dryRun: true }, dir);
        expect((await read()).tests).toBeUndefined();
    });
});
