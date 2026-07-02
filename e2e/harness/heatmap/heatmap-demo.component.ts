import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeatmapComponent } from '@/components/ui/heatmap';
import { HeatmapCell } from '@/components/lib/chart.types';

@Component({
    selector: 'app-heatmap-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [HeatmapComponent],
    template: `
        <main class="p-8">
            <ui-heatmap data-testid="root" [data]="data" [width]="460" title="Demo heatmap" />
        </main>
    `,
})
export class HeatmapDemoComponent {
    readonly data: HeatmapCell[] = [
        { row: 'Mon', col: 'AM', value: 1 }, { row: 'Mon', col: 'PM', value: 5 },
        { row: 'Tue', col: 'AM', value: 9 }, { row: 'Tue', col: 'PM', value: 3 },
        { row: 'Wed', col: 'AM', value: 6 }, { row: 'Wed', col: 'PM', value: 8 },
    ];
}
