import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CalendarHeatmapComponent } from '@/components/ui/calendar-heatmap';
import { CalendarDay } from '@/components/lib/chart.types';

@Component({
    selector: 'app-calendar-heatmap-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CalendarHeatmapComponent],
    template: `
        <main class="p-8">
            <ui-calendar-heatmap data-testid="root" [data]="data" [cellSize]="14" title="Demo calendar" />
        </main>
    `,
})
export class CalendarHeatmapDemoComponent {
    readonly data: CalendarDay[] = [
        { date: '2026-01-01', value: 2 }, { date: '2026-01-02', value: 5 },
        { date: '2026-01-05', value: 9 }, { date: '2026-01-08', value: 1 },
        { date: '2026-01-12', value: 7 }, { date: '2026-01-20', value: 4 },
    ];
}
