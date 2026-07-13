import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BarRaceChartComponent } from '@/components/ui/bar-race-chart';
import type { ChartDataPoint } from '@/components/lib/chart.types';

@Component({
    selector: 'app-bar-race-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BarRaceChartComponent],
    template: `
        <main class="w-[600px] p-8">
            <ui-bar-race-chart
                data-testid="root"
                class="block"
                [frames]="frames"
                [frameLabels]="frameLabels"
                title="Race"
            />
        </main>
    `,
})
export class BarRaceChartDemoComponent {
    protected readonly frameLabels = ['2021', '2022'];

    protected readonly frames: ChartDataPoint[][] = [
        [
            { name: 'Alpha', value: 10 },
            { name: 'Beta', value: 20 },
        ],
        [
            { name: 'Alpha', value: 40 },
            { name: 'Beta', value: 25 },
        ],
    ];
}
