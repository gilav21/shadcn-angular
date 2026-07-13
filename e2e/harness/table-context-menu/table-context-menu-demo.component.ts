import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
    ContextMenuComponent,
    type ContextMenuItem,
} from '@/components/ui/context-menu';
import {
    TableContextMenuDirective,
    type TableRowContextMenuEvent,
} from '@/components/ui/table-context-menu.directive';

interface Row { readonly id: number; readonly name: string; }

/**
 * Harness for the `table-context-menu` directive. The directive reads the row
 * index from `data-row-index` (or `data-index`) and JSON-parses the row payload
 * out of the `rowDataAttribute` (default `data-row`).
 */
@Component({
    selector: 'app-table-context-menu-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ContextMenuComponent, TableContextMenuDirective],
    template: `
        <main class="p-8">
            <ui-context-menu #menu [items]="items" />

            <table
                data-testid="root"
                [uiTableContextMenu]="menu"
                (rowContextMenu)="onRow($event)"
            >
                <tbody>
                    @for (row of rows; track row.id; let i = $index) {
                        <tr
                            [attr.data-row-index]="i"
                            [attr.data-row]="serialize(row)"
                            [attr.data-name]="row.name"
                        >
                            <td class="border p-2">{{ row.name }}</td>
                        </tr>
                    }
                </tbody>
            </table>
            <p data-testid="row">{{ picked() }}</p>
        </main>
    `,
})
export class TableContextMenuDemoComponent {
    readonly menu = viewChild.required<ContextMenuComponent>('menu');
    readonly picked = signal('');

    readonly rows: Row[] = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
    ];

    readonly items: ContextMenuItem[] = [{ label: 'Rename' }, { label: 'Delete' }];

    serialize(row: Row): string {
        return JSON.stringify(row);
    }

    // The directive's `T` is not inferable from the host `<table>`, so the
    // emitted event lands as `TableRowContextMenuEvent<unknown>` in the template.
    onRow(event: TableRowContextMenuEvent<unknown>): void {
        const row = event.row as Row;
        this.picked.set(`${event.index}:${row.name}`);
    }
}
