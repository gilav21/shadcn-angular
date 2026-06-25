import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { componentFileHash } from './baseline.js';

// Control the baseline set: only PRISTINE_CONTENT is a "pristine shadcn file".
const PRISTINE_CONTENT = 'export const pristine = 1;\n';
vi.mock('../registry/component-baselines.js', () => ({
    COMPONENT_BASELINES: [componentFileHash('export const pristine = 1;\n', 'ui', '@/components/lib')],
}));

const { collectStaleReport, rewriteMovedImport, COMPONENT_MOVES } = await import('./clean-reinstall.js');

describe('rewriteMovedImport', () => {
    it('re-points a moved import specifier, preserving the alias prefix', () => {
        const move = COMPONENT_MOVES.find(m => m.toComponent === 'page-renderer')!;
        const src = `import { PageRendererComponent } from '@/components/ui/page-builder/page-renderer.component';\n`;
        const out = rewriteMovedImport(src, move);
        expect(out.changed).toBe(true);
        expect(out.content).toContain(`from '@/components/ui/page-renderer'`);
    });

    it('leaves unrelated imports untouched', () => {
        const move = COMPONENT_MOVES.find(m => m.toComponent === 'page-renderer')!;
        const src = `import { ButtonComponent } from '@/components/ui/button';\n`;
        expect(rewriteMovedImport(src, move).changed).toBe(false);
    });
});

describe('collectStaleReport', () => {
    let dir: string;
    let ui: string;
    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clean-'));
        ui = path.join(dir, 'src/components/ui');
        await fs.ensureDir(ui);
    });
    afterEach(async () => {
        await fs.remove(dir);
    });

    const scan = (): ReturnType<typeof collectStaleReport> =>
        collectStaleReport(ui, dir, 'ui', '@/components/lib', '@/components/ui');

    it('prunes a pristine file the registry no longer ships and nothing imports', async () => {
        await fs.outputFile(path.join(ui, 'charts/old-chart.component.ts'), PRISTINE_CONTENT);
        const { entries } = await scan();
        expect(entries).toContainEqual({ file: 'charts/old-chart.component.ts', action: 'prune' });
    });

    it('keeps + warns a pristine stale file the consumer still imports', async () => {
        await fs.outputFile(path.join(ui, 'charts/old-chart.component.ts'), PRISTINE_CONTENT);
        await fs.outputFile(
            path.join(dir, 'src/app/app.component.ts'),
            `import { x } from '@/components/ui/charts/old-chart.component';\n`,
        );
        const { entries } = await scan();
        expect(entries).toContainEqual({ file: 'charts/old-chart.component.ts', action: 'keep-warn' });
    });

    it('does not flag a consumer-authored file (matches no baseline)', async () => {
        await fs.outputFile(path.join(ui, 'charts/my-custom.component.ts'), 'export const mine = 42;\n');
        const { entries } = await scan();
        expect(entries.find(e => e.file === 'charts/my-custom.component.ts')).toBeUndefined();
    });

    it('classifies a declared move as migrate even though it is imported', async () => {
        const move = COMPONENT_MOVES.find(m => m.toComponent === 'page-renderer')!;
        await fs.outputFile(path.join(ui, move.fromFile), 'export class PageRendererComponent {}\n');
        await fs.outputFile(
            path.join(dir, 'src/app/dash.component.ts'),
            `import { PageRendererComponent } from '@/components/ui/${move.fromImport}';\n`,
        );
        const { entries } = await scan();
        expect(entries.find(e => e.file === move.fromFile)?.action).toBe('migrate');
    });

    it('does not flag the new icon/icon.token path when only ./icon.token is imported from icon/', async () => {
        // A consumer-authored file at the OLD flat path that matches no baseline:
        // must not be pruned, and the new icon component's relative import must
        // not falsely mark it imported (precise resolution).
        await fs.outputFile(path.join(ui, 'icon.token.ts'), PRISTINE_CONTENT);
        await fs.outputFile(path.join(ui, 'icon/icon.component.ts'), `import { T } from './icon.token';\n`);
        const { entries } = await scan();
        // The flat icon.token.ts is pristine + NOT imported (icon/ imports icon/icon.token) → prune.
        expect(entries).toContainEqual({ file: 'icon.token.ts', action: 'prune' });
    });
});
