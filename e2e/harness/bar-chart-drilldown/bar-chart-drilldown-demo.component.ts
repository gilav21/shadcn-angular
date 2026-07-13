import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BarChartDrilldownComponent } from '@/components/ui/bar-chart-drilldown';
import type { DrilldownDataPoint, DrilldownSeries } from '@/components/lib/chart.types';

@Component({
    selector: 'app-bar-chart-drilldown-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BarChartDrilldownComponent],
    template: `
        <main class="w-[600px] p-8">
            <ui-bar-chart-drilldown
                data-testid="root"
                class="block"
                [data]="data"
                [drilldownSeries]="drilldown"
                title="Regions"
            />
        </main>
    `,
})
export class BarChartDrilldownDemoComponent {
    protected readonly data: DrilldownDataPoint[] = [
        { name: 'EMEA', value: 90, drilldown: 'emea' },
        { name: 'APAC', value: 60, drilldown: 'apac' },
        { name: 'LATAM', value: 30 },
    ];

    protected readonly drilldown: DrilldownSeries[] = [
        { id: 'emea', name: 'EMEA countries', data: [{ name: 'DE', value: 50 }, { name: 'FR', value: 40 }] },
        { id: 'apac', name: 'APAC countries', data: [{ name: 'JP', value: 60 }] },
    ];
}
