import fs from 'node:fs';
import path from 'node:path';
import type { CliSpec } from './_types.js';
import { npmInstall, buildClean } from './_build.js';

/**
 * B5 regression: a consumer template using the *deprecated* `[virtualItem]`
 * selector must still bind `VirtualItemDirective` and render rows.
 *
 * The selector was renamed `[virtualItem]` → `[uiVirtualItem]`. A bare rename
 * is the most dangerous class of break: the directive silently stops matching,
 * the list renders zero rows, and Angular emits only an NG8113 *warning* — so
 * `ng build` stays green while the feature is dead. The fix keeps the old
 * selector as a deprecated alias (`'[uiVirtualItem],[virtualItem]'`).
 *
 * This spec installs virtual-scroll, drops a consumer page that uses the old
 * `<ng-template virtualItem>`, and builds through the warning-as-failure gate
 * (`buildClean` fails on any `NG####`). If the alias is ever dropped, the
 * NG8113 the bare rename emits turns this spec red — exactly the signal the
 * fresh-install-only suite was blind to.
 */
const CONSUMER = `import { Component, signal } from '@angular/core';
import { VirtualScrollComponent, VirtualItemDirective } from '@/components/ui/virtual-scroll';

@Component({
  selector: 'app-virtual-item-consumer',
  standalone: true,
  imports: [VirtualScrollComponent, VirtualItemDirective],
  template: \`
    <div style="height: 300px;">
      <ui-virtual-scroll [items]="items()" [minItemHeight]="40">
        <ng-template virtualItem let-item>
          <div class="row" style="height: 40px;">{{ $any(item).name }}</div>
        </ng-template>
      </ui-virtual-scroll>
    </div>
  \`,
})
export class VirtualItemConsumerComponent {
  readonly items = signal(Array.from({ length: 50 }, (_, i) => ({ id: i, name: 'Item ' + i })));
}
`;

const ROUTES = `import { Routes } from '@angular/router';
import { VirtualItemConsumerComponent } from './test-pages/virtual-item-consumer.component';

export const routes: Routes = [
  { path: '', component: VirtualItemConsumerComponent },
];
`;

const spec: CliSpec = async ({ runCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'virtual-scroll', '--yes']);

    const pagesDir = path.join(fixtureApp, 'src/app/test-pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'virtual-item-consumer.component.ts'), CONSUMER);
    fs.writeFileSync(path.join(fixtureApp, 'src/app/app.routes.ts'), ROUTES);

    await npmInstall(fixtureApp);
    // buildClean throws on a non-zero exit OR any NG#### diagnostic (incl. the
    // NG8113 a dropped alias would emit). A clean build proves the deprecated
    // `[virtualItem]` selector still binds.
    await buildClean(fixtureApp);
};

export default spec;
