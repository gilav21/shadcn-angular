import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GaugeChartComponent } from '@/components/ui/gauge-chart';
import { GaugeThreshold } from '@/components/lib/chart.types';

@Component({
    selector: 'app-gauge-chart-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [GaugeChartComponent],
    template: `
        <main class="p-8">
            <ui-gauge-chart
                data-testid="root"
                [value]="72"
                [min]="0"
                [max]="100"
                unit="%"
                label="CPU load"
                [thresholds]="thresholds"
            />
        </main>
    `,
})
export class GaugeChartDemoComponent {
    readonly thresholds: GaugeThreshold[] = [
        { value: 0, color: 'hsl(142, 71%, 45%)' },
        { value: 60, color: 'hsl(48, 96%, 53%)' },
        { value: 85, color: 'hsl(0, 84%, 60%)' },
    ];
}
