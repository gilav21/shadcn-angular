import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    BentoGridComponent,
    BentoGridItemComponent,
} from '@/components/ui/bento-grid';

/**
 * Auto-generated harness for the `bento-grid` component.
 * Extend the template and assertions in `bento-grid.spec.ts` as needed.
 */
@Component({
    selector: 'app-bento-grid-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BentoGridComponent, BentoGridItemComponent],
    template: `
        <main class="p-8">
            <ui-bento-grid data-testid="root">
                <ui-bento-grid-item data-testid="bento-grid-item"></ui-bento-grid-item>
            </ui-bento-grid>
        </main>
    `,
})
export class BentoGridDemoComponent {}
