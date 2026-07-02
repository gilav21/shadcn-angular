import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WaterfallChartComponent } from '@/components/ui/waterfall-chart';
import { WaterfallBar } from '@/components/lib/chart.types';

@Component({
    selector: 'app-waterfall-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [WaterfallChartComponent],
    template: `
        <main class="p-8">
            <ui-waterfall-chart data-testid="root" [data]="data" [width]="560" [height]="340"
                [showConnectors]="true" title="Demo waterfall" />
        </main>
    `,
})
export class WaterfallChartDemoComponent {
    readonly data: WaterfallBar[] = [
        { name: 'Start', value: 1200, type: 'total' },
        { name: 'Sales', value: 450 },
        { name: 'Returns', value: -180 },
        { name: 'Net', value: 1470, type: 'total' },
    ];
}
