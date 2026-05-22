import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DataTableComponent, type ColumnDef } from '@/components/ui/data-table';

interface Row {
    id: number;
    name: string;
    score: number;
}

@Component({
    selector: 'app-data-table-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DataTableComponent],
    template: `
        <main class="p-8">
            <ui-data-table
                data-testid="table"
                [data]="rows()"
                [columns]="columns"
                [showToolbar]="false"
                [showColumnVisibilityToggle]="false"
                [showPagination]="false"
            />
            <p data-testid="first-name">{{ rows()[0].name }}</p>
        </main>
    `,
})
export class DataTableDemoComponent {
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
}
