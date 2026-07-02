import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BubbleChartComponent } from '@/components/ui/bubble-chart';
import { XYZSeries } from '@/components/lib/chart.types';

@Component({
    selector: 'app-bubble-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BubbleChartComponent],
    template: `
        <main class="p-8">
            <ui-bubble-chart
                data-testid="root"
                [series]="series"
                [width]="560"
                [height]="360"
                title="Demo bubble chart"
            />
        </main>
    `,
})
export class BubbleChartDemoComponent {
    readonly series: XYZSeries[] = [
        { name: 'Markets', points: [
            { x: 1, y: 2, z: 5 }, { x: 3, y: 5, z: 50 }, { x: 5, y: 1, z: 20 }, { x: 4, y: 7, z: 35 },
        ] },
    ];
}
