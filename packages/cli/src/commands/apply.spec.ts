import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import prompts from 'prompts';
import { apply } from './apply.js';
import { resolveAddonInfo } from '../core/apply-core.js';
import { performInstall } from '../core/install.js';
import { getDefaultConfig } from '../utils/config.js';
import { emptyMergeReport, type MergeReport } from '../core/merge.js';
import type { ApplyOptions } from '../core/apply-wire.js';

const { spinner } = vi.hoisted(() => {
    const s = { start: vi.fn(), succeed: vi.fn(), fail: vi.fn() };
    s.start.mockImplementation(() => s);
    return { spinner: s };
});

vi.mock('ora', () => ({ default: vi.fn(() => spinner) }));
vi.mock('prompts', () => ({ default: vi.fn() }));
vi.mock('../core/install.js', () => ({ performInstall: vi.fn() }));

const promptsMock = vi.mocked(prompts);
const installMock = vi.mocked(performInstall);

/** Thrown in place of `process.exit`, so `never`-returning paths are assertable. */
class ProcessExit extends Error {
    constructor(readonly code: number) {
        super(`process.exit(${code})`);
    }
}

const ADDON = 'data-table/context-menu';
const addonInfo = resolveAddonInfo(ADDON, '@/components/ui');
const OPTS: ApplyOptions = { branch: 'master' };

/** A standalone component with an inline template and an `imports: []` array. */
function inlineComponent(template: string, className: string): string {
    return `import { Component } from '@angular/core';

@Component({
  selector: 'app-x',
  standalone: true,
  imports: [],
  template: \`${template}\`,
})
export class ${className} {}
`;
}

/** A component whose template lives in a sibling `.html` file. */
function externalComponent(className: string, templateUrl: string): string {
    return `import { Component } from '@angular/core';

@Component({
  selector: 'app-y',
  standalone: true,
  imports: [],
  templateUrl: '${templateUrl}',
})
export class ${className} {}
`;
}

function installResult(mergeReport: MergeReport = emptyMergeReport(), warnings: string[] = []) {
    return { installed: [], skipped: [], declined: [], pruned: [], warnings, mergeReport };
}

describe('apply', () => {
    let dir: string;
    let logs: string[];
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let writeSpy: ReturnType<typeof vi.spyOn>;

    const out = () => logs.join('\n');
    const appFile = (name: string) => path.join(dir, 'src', 'app', name);
    const read = (p: string) => fs.readFile(p, 'utf-8');

    /** Write `components.json` + the addon's base contract files (unless suppressed). */
    async function scaffold({ contract = true } = {}): Promise<void> {
        await fs.outputJson(path.join(dir, 'components.json'), getDefaultConfig());
        if (!contract) return;
        const uiDir = path.join(dir, 'src', 'components', 'ui');
        for (const f of addonInfo.requiresBaseFiles) {
            await fs.outputFile(path.join(uiDir, f), '// contract\n');
        }
    }

    beforeEach(async () => {
        chalk.level = 0;
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apply-cmd-'));
        logs = [];
        vi.clearAllMocks();
        spinner.start.mockImplementation(() => spinner);
        installMock.mockResolvedValue(installResult());
        vi.spyOn(process, 'cwd').mockReturnValue(dir);
        exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
            throw new ProcessExit(typeof code === 'number' ? code : 0);
        });
        writeSpy = vi.spyOn(fs, 'writeFile');
        vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
            logs.push(args.map(a => String(a)).join(' '));
        });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await fs.remove(dir);
    });

    it('exits 1 with the init hint when components.json is missing', async () => {
        await expect(apply(ADDON, [], { ...OPTS })).rejects.toThrow(ProcessExit);
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(out()).toContain('components.json not found');
        expect(out()).toContain('init');
        expect(installMock).not.toHaveBeenCalled();
    });

    it('exits 1 for a component that is not an addon, listing the real addons', async () => {
        await scaffold();
        await expect(apply('button', [], { ...OPTS })).rejects.toThrow(ProcessExit);
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(out()).toContain('"button" is not an addon');
        expect(out()).toContain(ADDON);
    });

    it('--dry-run writes nothing and reports the instances it would wire', async () => {
        await scaffold();
        const file = appFile('foo.component.ts');
        const original = inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'FooComponent');
        await fs.outputFile(file, original);
        writeSpy.mockClear();

        await apply(ADDON, ['FooComponent'], { ...OPTS, dryRun: true });

        expect(writeSpy).not.toHaveBeenCalled();
        expect(await read(file)).toBe(original);
        expect(out()).toContain('[dry-run] FooComponent: would wire 1 instance(s)');
        // A dry run must not install either.
        expect(installMock).not.toHaveBeenCalled();
    });

    it('--yes wires every scanned usage, in both inline and templateUrl components', async () => {
        await scaffold();
        const inlineFile = appFile('inline.component.ts');
        const tsFile = appFile('ext.component.ts');
        const htmlFile = appFile('ext.component.html');
        await fs.outputFile(inlineFile, inlineComponent(`<${addonInfo.tag} />`, 'InlineComponent'));
        await fs.outputFile(tsFile, externalComponent('ExtComponent', './ext.component.html'));
        await fs.outputFile(htmlFile, `<${addonInfo.tag}></${addonInfo.tag}>`);

        await apply(ADDON, [], { ...OPTS, yes: true });

        expect(installMock).toHaveBeenCalledOnce();
        expect(await read(inlineFile)).toContain(addonInfo.selector);
        expect(await read(htmlFile)).toContain(addonInfo.selector);
        // The external component's directive import is wired into the .ts, not the .html.
        const extTs = await read(tsFile);
        expect(extTs).toContain(`import { ${addonInfo.symbol} } from '${addonInfo.module}';`);
        expect(extTs).toMatch(new RegExp(`imports:\\s*\\[${addonInfo.symbol}`));
        expect(out()).toContain('InlineComponent: wired 1 instance(s)');
        expect(out()).toContain('ExtComponent: wired 1 instance(s)');
        expect(promptsMock).not.toHaveBeenCalled();
    });

    it('wires only the named component classes and warns about names that match nothing', async () => {
        await scaffold();
        const foo = appFile('foo.component.ts');
        const bar = appFile('bar.component.ts');
        await fs.outputFile(foo, inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'FooComponent'));
        await fs.outputFile(bar, inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'BarComponent'));

        await apply(ADDON, ['FooComponent', 'GhostComponent'], { ...OPTS, yes: true });

        expect(out()).toContain('No component class found for: GhostComponent');
        expect(await read(foo)).toContain(addonInfo.selector);
        expect(await read(bar)).not.toContain(addonInfo.selector);
    });

    it('warns that --scan ignores the named component(s) and scans instead', async () => {
        await scaffold();
        const bar = appFile('bar.component.ts');
        await fs.outputFile(bar, inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'BarComponent'));

        await apply(ADDON, ['FooComponent'], { ...OPTS, yes: true, scan: true });

        expect(out()).toContain('--scan ignores the named component(s): FooComponent');
        expect(await read(bar)).toContain(addonInfo.selector);
    });

    it('reports "No <tag> usages found" and wires nothing when the app never uses the base', async () => {
        await scaffold();
        const file = appFile('foo.component.ts');
        const original = inlineComponent('<div>no addon here</div>', 'FooComponent');
        await fs.outputFile(file, original);
        writeSpy.mockClear();

        await apply(ADDON, [], { ...OPTS, yes: true });

        expect(out()).toContain(`No <${addonInfo.tag}> usages found`);
        expect(out()).toContain('Nothing to wire.');
        expect(writeSpy).not.toHaveBeenCalled();
        expect(await read(file)).toBe(original);
    });

    it('prints the manual snippet and wires 0 when the .ts has no imports[] to edit', async () => {
        await scaffold();
        const file = appFile('legacy.component.ts');
        const original = `import { Component } from '@angular/core';

@Component({
  selector: 'app-legacy',
  template: \`<${addonInfo.tag}></${addonInfo.tag}>\`,
})
export class LegacyComponent {}
`;
        await fs.outputFile(file, original);
        writeSpy.mockClear();

        await apply(ADDON, [], { ...OPTS, yes: true });

        expect(out()).toContain('Could not auto-wire LegacyComponent');
        expect(out()).toContain(`import { ${addonInfo.symbol} } from '${addonInfo.module}';`);
        expect(out()).toContain(`on the <${addonInfo.tag}> tag: ${addonInfo.selector}`);
        expect(out()).toContain('No instances wired');
        expect(writeSpy).not.toHaveBeenCalled();
        expect(await read(file)).toBe(original);
    });

    it('prompts for the target component when several use the tag and --yes is absent', async () => {
        await scaffold();
        const foo = appFile('foo.component.ts');
        const bar = appFile('bar.component.ts');
        await fs.outputFile(foo, inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'FooComponent'));
        await fs.outputFile(bar, inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'BarComponent'));
        // Pick exactly one of the offered choices — the BarComponent target.
        promptsMock.mockImplementation(async (questions: unknown) => {
            const q = questions as { choices: { title: string; value: unknown }[] };
            const choice = q.choices.find(c => c.title.startsWith('BarComponent'));
            return { picked: choice ? [choice.value] : [] };
        });

        await apply(ADDON, [], { ...OPTS });

        expect(promptsMock).toHaveBeenCalledOnce();
        expect(await read(bar)).toContain(addonInfo.selector);
        expect(await read(foo)).not.toContain(addonInfo.selector);
    });

    it('prompts for which instances to wire when a component has several unwired ones', async () => {
        await scaffold();
        const file = appFile('foo.component.ts');
        const template = `<${addonInfo.tag} id="a"></${addonInfo.tag}><${addonInfo.tag} id="b"></${addonInfo.tag}>`;
        await fs.outputFile(file, inlineComponent(template, 'FooComponent'));
        promptsMock.mockImplementation(async (questions: unknown) => {
            const q = questions as { choices: { value: { ids: string[] } }[] };
            return { picked: q.choices.filter(c => c.value.ids.includes('b')).map(c => c.value) };
        });

        await apply(ADDON, [], { ...OPTS });

        const after = await read(file);
        expect(after).toContain(`id="b" ${addonInfo.selector}`);
        expect(after).not.toContain(`id="a" ${addonInfo.selector}`);
        expect(out()).toContain('FooComponent: wired 1 instance(s)');
    });

    it('reports "already wired" without re-inserting the selector', async () => {
        await scaffold();
        const file = appFile('foo.component.ts');
        await fs.outputFile(file, inlineComponent(
            `<${addonInfo.tag} ${addonInfo.selector}></${addonInfo.tag}>`, 'FooComponent',
        ));

        await apply(ADDON, ['FooComponent'], { ...OPTS, yes: true });

        const after = await read(file);
        expect([...after.matchAll(new RegExp(addonInfo.selector, 'g'))]).toHaveLength(1);
        expect(out()).toContain('FooComponent: already wired');
        expect(out()).toContain('No instances wired');
    });

    it('exits 1 when the installed base predates the addon (missing contract file)', async () => {
        await scaffold({ contract: false });
        await fs.outputFile(appFile('foo.component.ts'),
            inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'FooComponent'));

        await expect(apply(ADDON, [], { ...OPTS, yes: true })).rejects.toThrow(ProcessExit);

        expect(exitSpy).toHaveBeenCalledWith(1);
        const failure = String(spinner.fail.mock.calls[0][0]);
        expect(failure).toContain(`predates the ${ADDON} addon`);
        expect(failure).toContain(addonInfo.requiresBaseFiles[0]);
        expect(spinner.succeed).not.toHaveBeenCalled();
    });

    it('exits 1 when the install itself throws', async () => {
        await scaffold();
        installMock.mockRejectedValue(new Error('network down'));

        await expect(apply(ADDON, [], { ...OPTS, yes: true })).rejects.toThrow(ProcessExit);

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(spinner.fail).toHaveBeenCalledWith('Install failed');
    });

    it('wires, then exits 1 when a merge wrote conflict markers under --yes', async () => {
        await scaffold();
        const file = appFile('foo.component.ts');
        await fs.outputFile(file, inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'FooComponent'));
        installMock.mockResolvedValue(installResult(
            { ...emptyMergeReport(), mergedConflicted: ['data-table/data-table.component.ts'] },
        ));

        await expect(apply(ADDON, [], { ...OPTS, yes: true })).rejects.toThrow(ProcessExit);

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(out()).toContain('Conflict markers');
        // The wiring still happened before the non-zero exit.
        expect(await read(file)).toContain(addonInfo.selector);
    });

    it('does NOT exit on conflict markers in an interactive run (the dev can resolve them)', async () => {
        await scaffold();
        await fs.outputFile(appFile('foo.component.ts'),
            inlineComponent(`<${addonInfo.tag}></${addonInfo.tag}>`, 'FooComponent'));
        installMock.mockResolvedValue(installResult(
            { ...emptyMergeReport(), mergedConflicted: ['data-table/data-table.component.ts'] },
        ));

        await apply(ADDON, ['FooComponent'], { ...OPTS });

        expect(exitSpy).not.toHaveBeenCalled();
        expect(out()).toContain('Conflict markers');
    });

    it('prints the install warnings returned by performInstall', async () => {
        await scaffold();
        installMock.mockResolvedValue(installResult(emptyMergeReport(), ['Skipped data-table.component.ts: edited']));

        await apply(ADDON, [], { ...OPTS, yes: true });

        expect(out()).toContain('Skipped data-table.component.ts: edited');
    });

    it('carries the registry and overwrite defaults from components.json into the install options', async () => {
        const config = getDefaultConfig();
        config.registry = 'https://example.test/registry';
        config.update = { overwrite: true };
        await fs.outputJson(path.join(dir, 'components.json'), config);
        for (const f of addonInfo.requiresBaseFiles) {
            await fs.outputFile(path.join(dir, 'src', 'components', 'ui', f), '// contract\n');
        }

        const options: ApplyOptions = { ...OPTS, yes: true };
        await apply(ADDON, [], options);

        expect(options.registry).toBe('https://example.test/registry');
        expect(options.overwrite).toBe(true);
        expect(installMock).toHaveBeenCalledWith(expect.objectContaining({
            components: [ADDON],
            cwd: dir,
            options: expect.objectContaining({ registry: 'https://example.test/registry', overwrite: true }),
        }));
    });
});
