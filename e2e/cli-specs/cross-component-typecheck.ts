import fs from 'node:fs';
import path from 'node:path';
import type { CliSpec } from './_types.js';
import { npmInstall, buildClean } from './_build.js';

/**
 * B6a CI gate — typecheck a component against its real dependency closure as a
 * consumer install, not just inside the monorepo's single global program.
 *
 * `page-builder` consumes `bento-grid`'s exported `DashboardItem` type. The
 * monorepo `tsc` compiles both together, so a cross-component type break only
 * shows up there if the demo happens to exercise the affected path — otherwise
 * an incompatible pair can publish (report B6). Here we `add page-builder`,
 * which resolves + installs `bento-grid` (and the rest of the closure), force
 * both into the compile graph via a consumer that imports `PageBuilderComponent`
 * (whose source references `DashboardItem`), and build through the warning gate.
 * If page-builder ever stops typechecking against bento-grid, this fails.
 */
const CONSUMER = `import { Component } from '@angular/core';
import { PageBuilderComponent } from '@/components/ui/page-builder';
import { PageRendererComponent } from '@/components/ui/page-renderer';
import { DashboardItem } from '@/components/ui/bento-grid';
import type { PageData } from '@/components/ui/page-builder';

@Component({
  selector: 'app-page-builder-consumer',
  standalone: true,
  imports: [PageBuilderComponent, PageRendererComponent],
  // Importing these forces page-builder.component.ts AND page-renderer.component.ts
  // (both consume bento-grid's DashboardItem / showBorders input) to compile
  // against the installed bento-grid — the cross-component typecheck this gate
  // exists for. page-renderer feeds its grid.showBorders into bento-grid's
  // non-optional showBorders input, so a missing coercion (report B8) fails here.
  template: \`<ui-page-builder /><ui-page-renderer [data]="data" />\`,
})
export class PageBuilderConsumerComponent {
  readonly items: DashboardItem[] = [
    { id: '1', x: 0, y: 0, cols: 1, rows: 1, content: 'progress', inputs: { value: 40 } },
  ];
  readonly data: PageData = {
    grid: { cols: 12, rowHeight: '40px', columnWidth: '1fr', gap: '8px', borderRadius: '4px', itemPadding: '4px' },
    items: [],
  };
}
`;

const ROUTES = `import { Routes } from '@angular/router';
import { PageBuilderConsumerComponent } from './test-pages/page-builder-consumer.component';

export const routes: Routes = [
  { path: '', component: PageBuilderConsumerComponent },
];
`;

const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    // Resolves + installs bento-grid (+ closure) for both page-builder and the
    // extracted page-renderer, so each is typechecked against the same bento-grid.
    await runCli(['add', 'page-builder', 'page-renderer', '--yes']);

    const pagesDir = path.join(fixtureApp, 'src/app/test-pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'page-builder-consumer.component.ts'), CONSUMER);
    fs.writeFileSync(path.join(fixtureApp, 'src/app/app.routes.ts'), ROUTES);

    await npmInstall(fixtureApp);
    // A cross-component type break (e.g. bento-grid hardening DashboardItem.inputs
    // without updating page-builder) fails the build here with a non-zero exit.
    await buildClean(fixtureApp);
};

export default spec;
