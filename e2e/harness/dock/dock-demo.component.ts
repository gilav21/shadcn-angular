import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    DockComponent,
    DockItemComponent,
    DockIconComponent,
    DockLabelComponent,
} from '@/components/ui/dock';

/**
 * Auto-generated harness for the `dock` component.
 * Extend the template and assertions in `dock.spec.ts` as needed.
 */
@Component({
    selector: 'app-dock-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DockComponent, DockItemComponent, DockIconComponent, DockLabelComponent],
    template: `
        <main class="p-8">
            <ui-dock data-testid="root">
                <ui-dock-item data-testid="dock-item"></ui-dock-item>
                <ui-dock-icon data-testid="dock-icon"></ui-dock-icon>
                <ui-dock-label data-testid="dock-label"></ui-dock-label>
            </ui-dock>
        </main>
    `,
})
export class DockDemoComponent {}
