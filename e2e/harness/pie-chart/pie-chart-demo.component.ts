import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PieChartComponent } from '@/components/ui/pie-chart';
import type { ChartDataPoint } from '@/components/lib/chart.types';

@Component({
    selector: 'app-pie-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PieChartComponent],
    template: `
        <main class="p-8 w-[600px]">
            <ui-pie-chart data-testid="chart" [data]="data" title="Revenue split" />
        </main>
    `,
})
export class PieChartDemoComponent {
    protected readonly data: ChartDataPoint[] = [
        { name: 'Direct',  value: 40 },
        { name: 'Search',  value: 30 },
        { name: 'Social',  value: 20 },
        { name: 'Referral', value: 10 },
    ];
}
