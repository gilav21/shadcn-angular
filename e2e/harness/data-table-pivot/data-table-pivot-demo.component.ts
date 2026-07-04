import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DataTableComponent, type ColumnDef } from '@/components/ui/data-table';
import { DataTablePivotDirective } from '@/components/ui/data-table/addons/pivot';

interface Sale {
    region: string;
    product: string;
    sales: number;
}

/**
 * Exercises the `data-table/pivot` addon installed onto a lean data-table base
 * and wired with the `uiDtPivot` attribute — the shape the CLI's `apply` /
 * MCP `apply_addon` produce. The base ships no pivot code; the addon exposes
 * `getPivot()` through the host DI contract.
 */
@Component({
    selector: 'app-data-table-pivot-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DataTableComponent, DataTablePivotDirective],
    template: `
        <main class="p-8">
            <button type="button" data-testid="run-pivot" (click)="runPivot(pv)">Pivot</button>
            <span data-testid="pivot-total">{{ total() }}</span>
            <ui-data-table
                uiDtPivot
                #pv="uiDtPivot"
                data-testid="table"
                [data]="rows()"
                [columns]="columns"
                [showToolbar]="false"
                [showPagination]="false"
            />
        </main>
    `,
})
export class DataTablePivotDemoComponent {
    protected readonly rows = signal<Sale[]>([
        { region: 'NA', product: 'A', sales: 100 },
        { region: 'NA', product: 'B', sales: 50 },
        { region: 'EU', product: 'A', sales: 80 },
        { region: 'NA', product: 'A', sales: 20 },
    ]);

    protected readonly columns: ColumnDef<Sale>[] = [
        { accessorKey: 'region', header: 'Region' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'sales', header: 'Sales' },
    ];

    protected readonly total = signal<number | null>(null);

    protected runPivot(pv: DataTablePivotDirective): void {
        const result = pv.getPivot({
            rows: ['region'],
            column: 'product',
            value: 'sales',
            aggregate: 'sum',
            showRowTotals: true,
        });
        const na = result.rows.find((r) => r['region'] === 'NA');
        this.total.set(na ? Number(na['__total__']) : null);
    }
}
