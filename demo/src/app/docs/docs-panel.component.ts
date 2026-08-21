import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DocsApiComponent } from './docs-api.component';
import { DocsInstallComponent } from './docs-install.component';
import type { ComponentDoc } from './component-docs.types';

/**
 * A component's full documentation: how to install and use it, then its
 * generated API reference. Both halves are separate components because the demo
 * pages show only the first by default and collapse the second.
 */
@Component({
    selector: 'app-docs-panel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DocsApiComponent, DocsInstallComponent],
    template: `
    <div class="space-y-4" data-slot="docs-panel" [attr.data-component]="doc().name">
      <app-docs-install [doc]="doc()" />
      <app-docs-api [tables]="doc().api" />
    </div>
  `,
})
export class DocsPanelComponent {
    /** The generated documentation to render. */
    readonly doc = input.required<ComponentDoc>();
}
