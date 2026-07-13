import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ColumnRangeChartComponent } from '@/components/ui/column-range-chart';
import type { RangeDataPoint } from '@/components/lib/chart.types';

@Component({
    selector: 'app-column-range-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ColumnRangeChartComponent],
    template: `
        <main class="w-[600px] p-8">
            <ui-column-range-chart
                data-testid="root"
                class="block"
                [data]="data"
                title="Temperature range"
            />
        </main>
    `,
})
export class ColumnRangeChartDemoComponent {
    protected readonly data: RangeDataPoint[] = [
        { name: 'Jan', low: -5, high: 4 },
        { name: 'Feb', low: -3, high: 7 },
        { name: 'Mar', low: 1, high: 12 },
    ];
}
