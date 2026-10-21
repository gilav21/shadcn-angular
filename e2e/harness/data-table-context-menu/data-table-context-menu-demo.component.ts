import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DataTableComponent, type ColumnDef, type RowActionContext } from '@/components/ui/data-table';
import {
    DataTableContextMenuDirective,
    type DataTableHeaderContextMenuEvent,
    type DataTableRowContextMenuEvent,
} from '@/components/ui/data-table/addons/context-menu';
import { ContextMenuComponent, type ContextMenuItem } from '@/components/ui/context-menu';

interface Row {
    id: number;
    name: string;
    score: number;
}

interface CustomRow {
    id: number;
    label: string;
}

/**
 * Exercises the `data-table/context-menu` addon installed onto a lean
 * data-table base and wired with the `uiDtContextMenu` attribute — the exact
 * shape the CLI's `apply` / MCP `apply_addon` produce. The base ships no
 * context-menu code; the addon contributes the ⋮ row button via the host slot
 * registry and renders the menu on right-click / button activation.
 *
 * The second table binds its own menu (`[contextMenu]`, the addon's custom mode)
 * together with `rowActions`, so it also covers a menu bound next to the ⋮ buttons.
 */
@Component({
    selector: 'app-data-table-context-menu-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DataTableComponent, ContextMenuComponent, DataTableContextMenuDirective],
    template: `
        <main class="p-8">
            <ui-data-table
                uiDtContextMenu
                data-testid="table"
                [data]="rows()"
                [columns]="columns"
                [rowActions]="rowActions"
                [showToolbar]="false"
                [showColumnVisibilityToggle]="false"
                [showPagination]="false"
            />

            <ui-context-menu #menu [items]="customItems" />
            <ui-data-table
                uiDtContextMenu
                data-testid="custom-table"
                [data]="customRows"
                [columns]="customColumns"
                [contextMenu]="menu"
                [contextMenuRowsOnly]="false"
                [rowActions]="customRowActions"
                [showToolbar]="false"
                [showColumnVisibilityToggle]="false"
                [showPagination]="false"
                (rowContextMenu)="onCustomRow($event)"
                (headerContextMenu)="onCustomHeader($event)"
            />
            <p data-testid="custom-row">{{ customRow() }}</p>
            <p data-testid="custom-header">{{ customHeader() }}</p>
        </main>
    `,
})
export class DataTableContextMenuDemoComponent {
    protected readonly rows = signal<Row[]>([
        { id: 1, name: 'Charlie', score: 30 },
        { id: 2, name: 'Alice',   score: 20 },
        { id: 3, name: 'Bob',     score: 10 },
    ]);

    protected readonly columns: ColumnDef<Row>[] = [
        { accessorKey: 'id',    header: 'ID',    enableSorting: true },
        { accessorKey: 'name',  header: 'Name',  enableSorting: true },
        { accessorKey: 'score', header: 'Score', enableSorting: true },
    ];

    protected readonly rowActions = (context: RowActionContext<Row>): ContextMenuItem[] => [
        { label: 'Edit row', icon: 'pencil', click: () => this.lastAction.set(`edit:${context.row.name}`) },
        { label: 'Delete row', icon: 'trash', click: () => this.lastAction.set(`delete:${context.row.name}`) },
    ];

    protected readonly lastAction = signal('');

    protected readonly customRows: CustomRow[] = [
        { id: 1, label: 'Alpha' },
        { id: 2, label: 'Beta' },
    ];

    protected readonly customColumns: ColumnDef<CustomRow>[] = [
        { accessorKey: 'id', header: 'Key' },
        { accessorKey: 'label', header: 'Label' },
    ];

    protected readonly customItems: ContextMenuItem[] = [{ label: 'Rename' }, { label: 'Archive' }];

    protected readonly customRowActions = (): ContextMenuItem[] => [{ label: 'Pin row' }];

    protected readonly customRow = signal('');
    protected readonly customHeader = signal('');

    protected onCustomRow(event: DataTableRowContextMenuEvent<unknown>): void {
        this.customRow.set((event.row as CustomRow).label);
    }

    protected onCustomHeader(event: DataTableHeaderContextMenuEvent): void {
        this.customHeader.set(event.column.name);
    }
}
