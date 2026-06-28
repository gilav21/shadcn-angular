import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComboChartComponent } from '@/components/ui/combo-chart';
import { ChartSeries } from '@/components/lib/chart.types';

/**
 * Harness for the `combo-chart` component — installed into a pristine consumer
 * app and driven by Playwright in `combo-chart.spec.ts`.
 */
@Component({
    selector: 'app-combo-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ComboChartComponent],
    template: `
        <main class="p-8">
            <ui-combo-chart
                data-testid="root"
                [barSeries]="barSeries"
                [showCumulative]="true"
                [width]="560"
                [height]="340"
                title="Demo Pareto chart"
            />
        </main>
    `,
})
export class ComboChartDemoComponent {
    readonly barSeries: ChartSeries[] = [
        { name: 'Defects', data: [
            { name: 'Scratches', value: 50 }, { name: 'Dents', value: 30 },
            { name: 'Cracks', value: 15 }, { name: 'Stains', value: 5 },
        ] },
    ];
}
