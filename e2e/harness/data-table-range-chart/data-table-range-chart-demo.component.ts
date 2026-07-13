import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
// NOTE: deep import on purpose. `data-table-range-chart/index.ts` exists in the
// source tree but is missing from the component's registry `files[]`, so a real
// consumer install ships no barrel and `@/components/ui/data-table-range-chart`
// does not resolve. Switch this back to the barrel once the registry is fixed.
import {
    DataTableRangeChartComponent,
    type RangeChartData,
} from '@/components/ui/data-table-range-chart/data-table-range-chart.component';

/** Harness for the `data-table-range-chart` dialog (charts a table range). */
@Component({
    selector: 'app-data-table-range-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DataTableRangeChartComponent],
    template: `
        <main class="p-8">
            <button type="button" data-testid="open" (click)="open.set(true)">Chart the range</button>
            <ui-data-table-range-chart
                data-testid="root"
                [payload]="data"
                [(open)]="open"
                title="Selection"
            />
        </main>
    `,
})
export class DataTableRangeChartDemoComponent {
    readonly open = signal(false);

    readonly data: RangeChartData = {
        categories: ['Q1', 'Q2', 'Q3'],
        series: [
            { name: 'Direct', values: [30, 40, 20] },
            { name: 'Partner', values: [10, 25, 35] },
        ],
    };
}
