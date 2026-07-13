import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PieChartDrilldownComponent } from '@/components/ui/pie-chart-drilldown';
import type { DrilldownDataPoint, DrilldownSeries } from '@/components/lib/chart.types';

@Component({
    selector: 'app-pie-chart-drilldown-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PieChartDrilldownComponent],
    template: `
        <main class="w-[600px] p-8">
            <ui-pie-chart-drilldown
                data-testid="root"
                class="block"
                [data]="data"
                [drilldownSeries]="drilldown"
                title="Browsers"
            />
        </main>
    `,
})
export class PieChartDrilldownDemoComponent {
    protected readonly data: DrilldownDataPoint[] = [
        { name: 'Chrome', value: 60, drilldown: 'chrome' },
        { name: 'Safari', value: 25, drilldown: 'safari' },
        { name: 'Edge', value: 15 },
    ];

    protected readonly drilldown: DrilldownSeries[] = [
        {
            id: 'chrome',
            name: 'Chrome versions',
            data: [
                { name: 'v120', value: 40 },
                { name: 'v119', value: 20 },
            ],
        },
        {
            id: 'safari',
            name: 'Safari versions',
            data: [{ name: 'v17', value: 25 }],
        },
    ];
}
