import fs from 'node:fs';
import path from 'node:path';
import type { CliSpec } from './_types.js';
import { npmInstall, buildClean } from './_build.js';

/**
 * B7 regression — a layout refactor that relocated page-builder's types to
 * `lib/` and extracted sub-components must not leave a project on the old layout
 * with stale orphans. A stale `page-builder/page-builder.types.ts` (an OLDER,
 * structurally-incompatible PageData — required fields + `any` vs the new
 * optional + `unknown`) clashes with the relocated `lib` copy: assigning the new
 * PageData to the old one fails TS2345, and the build breaks. Reinstall must
 * overwrite the stale duplicate with the backward-compat shim (so the legacy
 * deep import path resolves to the SAME relocated types) and prune the dead
 * old-layout files.
 */
const STALE_TYPES = `// Stale pre-relocation copy — incompatible shape (required fields, any).
import { Type } from '@angular/core';
export type InputType = 'string' | 'number' | 'boolean' | 'select' | 'json' | 'color';
export type PageBuilderViewMode = 'edit' | 'preview';
export interface InputDefinition { name: string; type: InputType; label?: string; options?: string[]; defaultValue?: any; }
export interface PageGridConfig { cols: number; rowHeight: string; columnWidth: string; gap: string; showBorders: boolean; borderRadius: string; itemPadding: string; squareCells: boolean; }
export interface PageItemData { id: string; x: number; y: number; cols: number; rows: number; componentId: string; inputs?: Record<string, any>; bindings?: Record<string, string>; }
export interface PageData { grid: PageGridConfig; items: PageItemData[]; timestamp?: string; }
export interface ComponentMeta { id: string; name: string; description?: string; category: string; component: Type<any>; icon?: string; defaultInputs?: Record<string, any>; inputs?: InputDefinition[]; defaultCols?: number; defaultRows?: number; }
`;

// Imports PageData from the legacy deep path and round-trips it through the
// page-builder's (save) output (typed by the relocated lib copy). With the
// stale duplicate, new lib PageData -> old PageData fails TS2345; with the shim
// restored, the deep path IS the lib type, so it compiles.
const CONSUMER = `import { Component } from '@angular/core';
import { PageBuilderComponent } from '@/components/ui/page-builder';
import type { PageData } from '@/components/ui/page-builder/page-builder.types';

@Component({
  selector: 'app-pb-consumer',
  standalone: true,
  imports: [PageBuilderComponent],
  template: \`<ui-page-builder [data]="data" (save)="onSave($event)" />\`,
})
export class PbConsumerComponent {
  data: PageData = {
    grid: { cols: 12, rowHeight: '40px', columnWidth: '1fr', gap: '8px', showBorders: true, borderRadius: '4px', itemPadding: '4px', squareCells: false },
    items: [],
  };
  onSave(d: PageData) { this.data = d; }
}
`;

const ROUTES = `import { Routes } from '@angular/router';
import { PbConsumerComponent } from './test-pages/pb-consumer.component';

export const routes: Routes = [{ path: '', component: PbConsumerComponent }];
`;

const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'page-builder', '--yes']);

    const pbDir = path.join(fixtureApp, 'src/components/ui/page-builder');
    // Simulate the pre-refactor layout: a stale, incompatible types duplicate
    // plus a dead orphan sub-component the new layout moved into sub/.
    fs.writeFileSync(path.join(pbDir, 'page-builder.types.ts'), STALE_TYPES);
    const orphan = path.join(pbDir, 'property-editor.component.ts');
    fs.writeFileSync(orphan, 'export const STALE = 1;\n');

    const pagesDir = path.join(fixtureApp, 'src/app/test-pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'pb-consumer.component.ts'), CONSUMER);
    fs.writeFileSync(path.join(fixtureApp, 'src/app/app.routes.ts'), ROUTES);

    // Reinstall: restores the page-builder.types shim (deep path -> lib types)
    // and prunes the obsolete property-editor.component.ts.
    await runCli(['add', 'page-builder', '--overwrite', '--yes']);

    if (fs.existsSync(orphan)) {
        throw new Error('B7: obsolete page-builder/property-editor.component.ts was not pruned on reinstall');
    }

    await npmInstall(fixtureApp);
    // Green build proves the stale PageData clash is gone (shim restored).
    await buildClean(fixtureApp);
};

export default spec;
