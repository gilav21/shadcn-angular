import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
    DataTableComponent,
    DataTableContextMenuDirective,
    DataTableExportDirective,
    DataTablePivotDirective,
    type ColumnDef,
    type RowActionContext,
} from '@gilav21/shadcn-angular-data-table';

interface Row {
    id: number;
    name: string;
    team: string;
    score: number;
}

/**
 * The union of the three data-table addon harnesses, driven from the COMPILED
 * npm package: one table carrying `uiDtContextMenu`, `uiDtExport` and
 * `uiDtPivot` together. Types come from the package's single entry point
 * (`ColumnDef`, `RowActionContext`), which is UC-3.
 *
 * `ContextMenuItem` is deliberately NOT imported: it belongs to the standalone
 * `context-menu` component, a transitive dependency the package compiles in but
 * does not re-export (re-exporting it would collide with a consumer's own
 * CLI-copied context-menu). The row-actions callback is typed structurally
 * instead — which is exactly what a real consumer of this package has to do.
 */
@Component({
    selector: 'app-pkg-data-table-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DataTableComponent,
        DataTableContextMenuDirective,
        DataTableExportDirective,
        DataTablePivotDirective,
    ],
    template: `
        <main class="p-8 space-y-4">
            <div class="flex gap-2">
                <button type="button" data-testid="export-csv" (click)="exp.exportToCsv('rows')">
                    Export CSV
                </button>
                <button type="button" data-testid="run-pivot" (click)="runPivot(pv)">Pivot</button>
                <span data-testid="pivot-total">{{ total() }}</span>
                <span data-testid="last-action">{{ lastAction() }}</span>
            </div>

            <ui-data-table
                uiDtContextMenu
                uiDtExport #exp="uiDtExport"
                uiDtPivot  #pv="uiDtPivot"
                data-testid="table"
                [data]="rows()"
                [columns]="columns"
                [rowActions]="rowActions"
                [showToolbar]="false"
                [showColumnVisibilityToggle]="false"
                [showPagination]="false"
            />
        </main>
    `,
})
export class PkgDataTableDemoComponent {
    protected readonly rows = signal<Row[]>([
        { id: 1, name: 'Alice',   team: 'A', score: 50 },
        { id: 2, name: 'Bob',     team: 'B', score: 40 },
        { id: 3, name: 'Charlie', team: 'A', score: 70 },
    ]);

    protected readonly columns: ColumnDef<Row>[] = [
        { accessorKey: 'id',    header: 'ID',    enableSorting: true },
        { accessorKey: 'name',  header: 'Name',  enableSorting: true },
        { accessorKey: 'team',  header: 'Team' },
        { accessorKey: 'score', header: 'Score', enableSorting: true },
    ];

    protected readonly lastAction = signal('');
    protected readonly total = signal<number | null>(null);

    protected readonly rowActions = (context: RowActionContext<Row>) => [
        { label: 'Edit row', icon: 'pencil', click: () => this.lastAction.set(`edit:${context.row.name}`) },
        { label: 'Delete row', icon: 'trash', click: () => this.lastAction.set(`delete:${context.row.name}`) },
    ];

    /** Alice (50) + Charlie (70) = 120 — the number the spec asserts. */
    protected runPivot(pv: DataTablePivotDirective): void {
        const result = pv.getPivot({
            rows: ['team'],
            column: 'name',
            value: 'score',
            aggregate: 'sum',
            showRowTotals: true,
        });
        const teamA = result.rows.find((r) => r['team'] === 'A');
        this.total.set(teamA ? Number(teamA['__total__']) : null);
    }
}
