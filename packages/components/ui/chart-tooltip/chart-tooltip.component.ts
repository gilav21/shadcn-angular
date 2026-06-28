import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

export interface ChartTooltipRow {
    label: string;
    value: string;
    color?: string;
}

/**
 * Shared positioned tooltip for charts. Reproduces the popover styling the
 * charts previously duplicated inline, and adds viewport-overflow protection.
 */
@Component({
    selector: 'ui-chart-tooltip',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './chart-tooltip.component.html',
    host: {
        class: 'contents',
    },
})
export class ChartTooltipComponent {
    readonly visible = input(false);
    readonly x = input(0);
    readonly y = input(0);
    readonly title = input<string | undefined>(undefined);
    readonly rows = input<ChartTooltipRow[]>([]);
    readonly class = input('');

    readonly classes = computed(() =>
        cn(
            'pointer-events-none absolute z-50 max-w-[calc(100vw-2rem)] rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg',
            this.class(),
        ),
    );
}
