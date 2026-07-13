import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { DataTableComponent, type ColumnDef } from '@/components/ui/data-table';
import {
    ContextMenuComponent,
    type ContextMenuItem,
} from '@/components/ui/context-menu';
import { DataTableContextMenuDirective } from '@/components/ui/data-table-context-menu.directive';
// `data-table-context-menu.directive.ts` re-uses `TableRowContextMenuEvent` for
// its `rowContextMenu` output but does not re-export it, so the type has to be
// imported from the directive that declares it.
import type { TableRowContextMenuEvent } from '@/components/ui/table-context-menu.directive';

interface Row { id: number; name: string; }

/**
 * Harness for the `data-table-context-menu` DIRECTIVE
 * (`selector: 'ui-data-table[uiDataTableContextMenu]'`). Distinct from the
 * `data-table/context-menu` ADDON, whose harness folder already owns the
 * `data-table-context-menu` label.
 */
@Component({
    selector: 'app-data-table-ctx-directive-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DataTableComponent, ContextMenuComponent, DataTableContextMenuDirective],
    template: `
        <main class="p-8">
            <ui-context-menu #menu [items]="items" />

            <ui-data-table
                data-testid="root"
                [data]="rows"
                [columns]="columns"
                [showToolbar]="false"
                [showPagination]="false"
                [uiDataTableContextMenu]="menu"
                (rowContextMenu)="onRow($event)"
            />
            <p data-testid="row">{{ row() }}</p>
        </main>
    `,
})
export class DataTableCtxDirectiveDemoComponent {
    readonly menu = viewChild.required<ContextMenuComponent>('menu');
    readonly row = signal('');

    readonly rows: Row[] = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
    ];

    readonly columns: ColumnDef<Row>[] = [
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'name', header: 'Name' },
    ];

    readonly items: ContextMenuItem[] = [{ label: 'Rename' }, { label: 'Delete' }];

    // The directive's `T` is not inferable from the host `<ui-data-table>`, so
    // the event lands as `TableRowContextMenuEvent<unknown>` in the template.
    onRow(event: TableRowContextMenuEvent<unknown>): void {
        this.row.set((event.row as Row).name);
    }
}
