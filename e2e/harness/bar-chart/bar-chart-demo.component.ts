import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BarChartComponent } from '@/components/ui/bar-chart';
import type { ChartDataPoint } from '@/components/lib/chart.types';

@Component({
    selector: 'app-bar-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BarChartComponent],
    template: `
        <main class="p-8 w-[600px]">
            <ui-bar-chart data-testid="chart" [data]="data" title="Sales by month" />
        </main>
    `,
})
export class BarChartDemoComponent {
    protected readonly data: ChartDataPoint[] = [
        { name: 'Jan', value: 30 },
        { name: 'Feb', value: 50 },
        { name: 'Mar', value: 40 },
        { name: 'Apr', value: 70 },
    ];
}
