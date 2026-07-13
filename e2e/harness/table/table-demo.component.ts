import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    TableComponent,
    TableHeaderComponent,
    TableBodyComponent,
    TableFooterComponent,
    TableRowComponent,
    TableHeadComponent,
    TableCellComponent,
    TableCaptionComponent,
} from '@/components/ui/table';

/**
 * Auto-generated harness for the `table` component.
 * Extend the template and assertions in `table.spec.ts` as needed.
 */
@Component({
    selector: 'app-table-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TableComponent, TableHeaderComponent, TableBodyComponent, TableFooterComponent, TableRowComponent, TableHeadComponent, TableCellComponent, TableCaptionComponent],
    template: `
        <main class="p-8">
            <ui-table data-testid="root">
                <ui-table-header data-testid="table-header"></ui-table-header>
                <ui-table-body data-testid="table-body"></ui-table-body>
                <ui-table-footer data-testid="table-footer"></ui-table-footer>
                <ui-table-row data-testid="table-row"></ui-table-row>
                <ui-table-head data-testid="table-head"></ui-table-head>
                <ui-table-cell data-testid="table-cell"></ui-table-cell>
                <ui-table-caption data-testid="table-caption"></ui-table-caption>
            </ui-table>
        </main>
    `,
})
export class TableDemoComponent {}
