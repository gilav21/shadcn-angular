import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ScatterChartComponent } from '@/components/ui/scatter-chart';
import { XYSeries } from '@/components/lib/chart.types';

@Component({
    selector: 'app-scatter-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ScatterChartComponent],
    template: `
        <main class="p-8">
            <ui-scatter-chart
                data-testid="root"
                [series]="series"
                [width]="540"
                [height]="320"
                title="Demo scatter chart"
            />
        </main>
    `,
})
export class ScatterChartDemoComponent {
    readonly series: XYSeries[] = [
        { name: 'Group A', points: [{ x: 1, y: 2 }, { x: 3, y: 5 }, { x: 5, y: 1 }] },
        { name: 'Group B', points: [{ x: 2, y: 8 }, { x: 4, y: 6 }] },
    ];
}
