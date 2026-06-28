import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FunnelChartComponent } from '@/components/ui/funnel-chart';
import { ChartDataPoint } from '@/components/lib/chart.types';

@Component({
    selector: 'app-funnel-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FunnelChartComponent],
    template: `
        <main class="p-8">
            <ui-funnel-chart data-testid="root" [data]="data" [width]="440" [height]="320" title="Demo funnel" />
        </main>
    `,
})
export class FunnelChartDemoComponent {
    readonly data: ChartDataPoint[] = [
        { name: 'Visits', value: 1000 }, { name: 'Signups', value: 600 },
        { name: 'Trials', value: 300 }, { name: 'Paid', value: 120 },
    ];
}
