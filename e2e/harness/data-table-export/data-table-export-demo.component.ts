import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DataTableComponent, type ColumnDef } from '@/components/ui/data-table';
import { DataTableExportDirective } from '@/components/ui/data-table/addons/export';

interface Row {
    id: number;
    name: string;
    score: number;
}

/**
 * Exercises the `data-table/export` addon installed onto a lean data-table base
 * and wired with the `uiDtExport` attribute — the exact shape the CLI's `apply`
 * / MCP `apply_addon` produce. The base ships no export code and no `xlsx`
 * dependency; the addon reads rows/columns through the host and downloads the
 * file itself. A template reference (`#exp="uiDtExport"`) exposes the methods.
 */
@Component({
    selector: 'app-data-table-export-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DataTableComponent, DataTableExportDirective],
    template: `
        <main class="p-8">
            <button type="button" data-testid="export-csv" (click)="exp.exportToCsv('rows')">
                Export CSV
            </button>
            <ui-data-table
                uiDtExport
                #exp="uiDtExport"
                data-testid="table"
                [data]="rows()"
                [columns]="columns"
                [showToolbar]="false"
                [showColumnVisibilityToggle]="false"
                [showPagination]="false"
            />
        </main>
    `,
})
export class DataTableExportDemoComponent {
    protected readonly rows = signal<Row[]>([
        { id: 1, name: 'Charlie', score: 30 },
        { id: 2, name: 'Alice', score: 20 },
        { id: 3, name: 'Bob', score: 10 },
    ]);

    protected readonly columns: ColumnDef<Row>[] = [
        { accessorKey: 'id', header: 'ID' },
        { accessorKey: 'name', header: 'Name' },
        { accessorKey: 'score', header: 'Score' },
    ];
}
