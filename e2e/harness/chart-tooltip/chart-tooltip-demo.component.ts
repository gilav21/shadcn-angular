import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ChartTooltipComponent, type ChartTooltipRow } from '@/components/ui/chart-tooltip';

/** Harness for the `chart-tooltip` component (positioned, data-driven tooltip). */
@Component({
    selector: 'app-chart-tooltip-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ChartTooltipComponent],
    template: `
        <main class="relative h-64 w-[600px] p-8">
            <ui-chart-tooltip
                data-testid="root"
                [visible]="visible()"
                [x]="120"
                [y]="60"
                title="March"
                [rows]="rows"
            />
            <button type="button" data-testid="show" (click)="visible.set(true)">Show</button>
        </main>
    `,
})
export class ChartTooltipDemoComponent {
    readonly visible = signal(false);

    readonly rows: ChartTooltipRow[] = [
        { label: 'Revenue', value: '1,240', color: '#4ecdc4' },
        { label: 'Cost', value: '830', color: '#ff6b6b' },
    ];
}
