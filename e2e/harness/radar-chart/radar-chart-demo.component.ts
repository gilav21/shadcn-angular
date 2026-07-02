import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RadarChartComponent } from '@/components/ui/radar-chart';
import { ChartSeries } from '@/components/lib/chart.types';

@Component({
    selector: 'app-radar-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RadarChartComponent],
    template: `
        <main class="p-8">
            <ui-radar-chart data-testid="root" [series]="series" [size]="360" [levels]="4" />
        </main>
    `,
})
export class RadarChartDemoComponent {
    readonly series: ChartSeries[] = [
        { name: 'Product A', data: [
            { name: 'Speed', value: 8 }, { name: 'Power', value: 6 },
            { name: 'Range', value: 9 }, { name: 'Comfort', value: 5 },
        ] },
        { name: 'Product B', data: [
            { name: 'Speed', value: 5 }, { name: 'Power', value: 9 },
            { name: 'Range', value: 4 }, { name: 'Comfort', value: 8 },
        ] },
    ];
}
