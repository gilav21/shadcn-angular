import fs from 'node:fs';
import path from 'node:path';
import type { CliSpec } from './_types.js';
import { npmInstall, buildClean } from './_build.js';

/**
 * Clean-reinstall (cure): a project carrying pristine stale files from past
 * layout refactors — a chart at its old flat path, a component extracted into
 * its own component — must be cleaned by `doctor --fix`, while a file the user
 * authored is never touched. The customer changed exactly one file (file-viewer)
 * yet the upgrade left ~16 stale files behind; this proves the sweep removes
 * them and migrates a moved component without breaking the consumer's build.
 */
const CONSUMER = `import { Component } from '@angular/core';
import { PageRendererComponent } from '@/components/ui/page-builder/page-renderer.component';
import type { PageData } from '@/components/ui/page-builder';

@Component({
  selector: 'app-dash',
  standalone: true,
  imports: [PageRendererComponent],
  template: \`<ui-page-renderer [data]="data" [components]="[]" />\`,
})
export class DashComponent {
  readonly data: PageData = {
    grid: { cols: 12, rowHeight: '40px', columnWidth: '1fr', gap: '8px', borderRadius: '4px', itemPadding: '4px' },
    items: [],
  };
}
`;

const ROUTES = `import { Routes } from '@angular/router';
import { DashComponent } from './test-pages/dash.component';
export const routes: Routes = [{ path: '', component: DashComponent }];
`;

const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'bar-chart', 'page-builder', 'page-renderer', '--yes']);

    const uiDir = path.join(fixtureApp, 'src/components/ui');

    // (a) A pristine stale file at a superseded path: copy the shipped bar-chart
    // source to the OLD flat `charts/` path. It matches a baseline and nothing
    // imports it → must be pruned.
    const barChart = fs.readFileSync(path.join(uiDir, 'bar-chart/bar-chart.component.ts'), 'utf-8');
    const stalePrune = path.join(uiDir, 'charts/bar-chart.component.ts');
    fs.mkdirSync(path.dirname(stalePrune), { recursive: true });
    fs.writeFileSync(stalePrune, barChart);

    // (b) A consumer-authored file the user owns: must NEVER be deleted.
    const userFile = path.join(uiDir, 'charts/my-tile.component.ts');
    fs.writeFileSync(userFile, 'export const myTile = 1;\n');

    // (c) The moved component: an old in-folder page-renderer the consumer still
    // uses. doctor must install the `page-renderer` component, re-point the
    // import, and remove the old file.
    const movedOld = path.join(uiDir, 'page-builder/page-renderer.component.ts');
    fs.writeFileSync(movedOld, fs.readFileSync(path.join(uiDir, 'page-renderer/page-renderer.component.ts'), 'utf-8'));
    fs.rmSync(path.join(uiDir, 'page-renderer'), { recursive: true, force: true }); // simulate "not yet installed"

    const pagesDir = path.join(fixtureApp, 'src/app/test-pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'dash.component.ts'), CONSUMER);
    fs.writeFileSync(path.join(fixtureApp, 'src/app/app.routes.ts'), ROUTES);

    await runCli(['doctor', '--fix']);

    if (fs.existsSync(stalePrune)) throw new Error('stale charts/bar-chart.component.ts was not pruned');
    if (!fs.existsSync(userFile)) throw new Error('user-authored charts/my-tile.component.ts was wrongly deleted');
    if (fs.existsSync(movedOld)) throw new Error('moved page-builder/page-renderer.component.ts was not removed');
    if (!fs.existsSync(path.join(uiDir, 'page-renderer/page-renderer.component.ts'))) {
        throw new Error('page-renderer component was not installed during migration');
    }
    const consumer = fs.readFileSync(path.join(pagesDir, 'dash.component.ts'), 'utf-8');
    if (!consumer.includes(`from '@/components/ui/page-renderer'`)) {
        throw new Error('consumer import was not re-pointed to the new page-renderer location');
    }

    await npmInstall(fixtureApp);
    await buildClean(fixtureApp);
};

export default spec;
