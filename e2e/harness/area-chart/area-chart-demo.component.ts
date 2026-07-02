import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AreaChartComponent } from '@/components/ui/area-chart';
import { ChartSeries } from '@/components/lib/chart.types';

/**
 * Harness for the `area-chart` component — installed into a pristine consumer
 * app and driven by Playwright in `area-chart.spec.ts`.
 */
@Component({
    selector: 'app-area-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AreaChartComponent],
    template: `
        <main class="p-8">
            <ui-area-chart
                data-testid="root"
                [series]="series"
                [width]="560"
                [height]="300"
                curve="monotone"
                [stacked]="true"
                title="Demo area chart"
            />
        </main>
    `,
})
export class AreaChartDemoComponent {
    readonly series: ChartSeries[] = [
        { name: 'Desktop', data: [
            { name: 'Jan', value: 120 }, { name: 'Feb', value: 180 },
            { name: 'Mar', value: 150 }, { name: 'Apr', value: 220 },
        ] },
        { name: 'Mobile', data: [
            { name: 'Jan', value: 80 }, { name: 'Feb', value: 100 },
            { name: 'Mar', value: 130 }, { name: 'Apr', value: 160 },
        ] },
    ];
}
