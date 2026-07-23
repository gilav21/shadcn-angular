import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { setTestRunnerCore } from './set-test-runner.js';
import { getConfig, type Config } from '../utils/config.js';

const SPEC_REL = 'button/button.component.spec.ts';
const SPEC_SRC = "import { describe, it, expect, vi } from 'vitest';\n\ndescribe('button', () => { it('works', () => expect(1).toBe(1)); });\n";
const SHIM_REL = 'testing/vitest-compat.ts';
const OPTIONS = { branch: 'master' };

describe('setTestRunnerCore', () => {
    let dir: string;
    let uiDir: string;
    let libDir: string;

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'set-runner-'));
        await fs.writeJson(path.join(dir, 'components.json'), {
            style: 'default',
            tailwind: { css: 'src/styles.scss', baseColor: 'neutral', theme: 'zinc', cssVariables: true },
            aliases: { components: '@/components', utils: '@/components/lib', ui: '@/components/ui' },
        });
        uiDir = path.join(dir, 'src', 'components', 'ui');
        libDir = path.join(dir, 'src', 'components', 'lib');
        await fs.ensureDir(path.join(uiDir, 'button'));
        await fs.writeFile(path.join(uiDir, SPEC_REL), SPEC_SRC);
        await fs.writeJson(path.join(dir, 'components.lock.json'), {
            version: 2,
            files: { [SPEC_REL]: { sha256: 'stale', component: 'button' } },
        });
    });

    afterEach(async () => { await fs.remove(dir); });

    const readSpec = (): Promise<string> => fs.readFile(path.join(uiDir, SPEC_REL), 'utf-8');
    const shimExists = (): Promise<boolean> => fs.pathExists(path.join(libDir, SHIM_REL));
    const readConfig = async (): Promise<Config> => await getConfig(dir) as Config;

    it('switches vitest → jest: rewrites the import, installs the shim, persists the runner', async () => {
        const result = await setTestRunnerCore('jest', dir, OPTIONS);

        expect(result.runner).toBe('jest');
        expect(result.rewritten).toEqual([SPEC_REL]);
        expect(result.shim).toBe('installed');
        expect(await readSpec()).toContain("from '@/components/lib/testing/vitest-compat'");
        expect(await readSpec()).not.toContain("from 'vitest'");
        expect(await shimExists()).toBe(true);
        expect((await readConfig()).tests).toEqual({ include: true, runner: 'jest' });
    });

    it('round-trips jest → vitest: rewrites back, removes the shim', async () => {
        await setTestRunnerCore('jest', dir, OPTIONS);
        const result = await setTestRunnerCore('vitest', dir, OPTIONS);

        expect(result.runner).toBe('vitest');
        expect(result.rewritten).toEqual([SPEC_REL]);
        expect(result.shim).toBe('removed');
        expect(await readSpec()).toContain("from 'vitest'");
        expect(await shimExists()).toBe(false);
        expect((await readConfig()).tests?.runner).toBe('vitest');
    });

    it('is idempotent — switching to the current runner rewrites nothing', async () => {
        const result = await setTestRunnerCore('vitest', dir, OPTIONS);
        expect(result.rewritten).toEqual([]);
        expect(await readSpec()).toBe(SPEC_SRC);
    });

    it('preserves local spec edits through a switch', async () => {
        const edited = SPEC_SRC.replace("it('works'", "it('is edited'");
        await fs.writeFile(path.join(uiDir, SPEC_REL), edited);
        await setTestRunnerCore('jest', dir, OPTIONS);
        const out = await readSpec();
        expect(out).toContain("it('is edited'");
        expect(out).toContain('vitest-compat');
    });

    it('dry-run writes nothing', async () => {
        const result = await setTestRunnerCore('jest', dir, { ...OPTIONS, dryRun: true });
        expect(result.dryRun).toBe(true);
        expect(result.rewritten).toEqual([SPEC_REL]);
        expect(await readSpec()).toBe(SPEC_SRC);
        expect(await shimExists()).toBe(false);
        expect((await readConfig()).tests).toBeUndefined();
    });

    it('throws when the project is not initialized', async () => {
        const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'set-runner-empty-'));
        try {
            await expect(setTestRunnerCore('jest', empty, OPTIONS)).rejects.toThrow(/not initialized/);
        } finally {
            await fs.remove(empty);
        }
    });
});
