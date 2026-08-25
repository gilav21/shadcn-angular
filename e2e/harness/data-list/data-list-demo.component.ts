import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DataListComponent, DataListItemComponent } from '@/components/ui/data-list';

/**
 * Harness for the `data-list` component, exercising BOTH modes in one list —
 * generated `items` rows plus a projected `ui-data-list-item`.
 */
@Component({
    selector: 'app-data-list-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DataListComponent, DataListItemComponent],
    template: `
        <main class="p-8">
            <ui-data-list data-testid="root" orientation="horizontal" [items]="items">
                <ui-data-list-item data-testid="data-list-item" label="Owner">
                    <span data-testid="owner-value">Ada Lovelace</span>
                </ui-data-list-item>
            </ui-data-list>
        </main>
    `,
})
export class DataListDemoComponent {
    readonly items = [
        { label: 'Status', value: 'Active' },
        { label: 'Plan', value: 'Enterprise' },
    ];
}
