import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LineChartComponent } from '@/components/ui/line-chart';
import { ChartSeries } from '@/components/lib/chart.types';

/**
 * Harness for the `line-chart` component — installed into a pristine consumer
 * app and driven by Playwright in `line-chart.spec.ts`.
 */
@Component({
    selector: 'app-line-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LineChartComponent],
    template: `
        <main class="p-8">
            <ui-line-chart
                data-testid="root"
                [series]="series"
                [width]="560"
                [height]="300"
                curve="monotone"
                title="Demo line chart"
            />
        </main>
    `,
})
export class LineChartDemoComponent {
    readonly series: ChartSeries[] = [
        { name: 'Revenue', data: [
            { name: 'Jan', value: 120 }, { name: 'Feb', value: 180 },
            { name: 'Mar', value: 150 }, { name: 'Apr', value: 220 },
        ] },
        { name: 'Cost', data: [
            { name: 'Jan', value: 90 }, { name: 'Feb', value: 110 },
            { name: 'Mar', value: 100 }, { name: 'Apr', value: 140 },
        ] },
    ];
}
