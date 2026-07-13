import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChipListComponent } from '@/components/ui/chip-list';

/**
 * Auto-generated harness for the `chip-list` component.
 * Extend the template and assertions in `chip-list.spec.ts` as needed.
 */
@Component({
    selector: 'app-chip-list-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ChipListComponent],
    template: `
        <main class="p-8">
            <ui-chip-list data-testid="root"></ui-chip-list>
        </main>
    `,
})
export class ChipListDemoComponent {}
