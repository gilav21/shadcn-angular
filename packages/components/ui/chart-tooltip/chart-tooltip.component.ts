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
    /** Shows or hides the tooltip. Hidden means not rendered at all, so there is no stale content left behind between hovers. */
    readonly visible = input(false);
    /** Horizontal offset in pixels from the positioned ancestor's origin — normally the chart's own `relative` wrapper, not the page. Combine with {@link flipX} near the right edge. */
    readonly x = input(0);
    /** Vertical offset in pixels from the positioned ancestor's origin. Combine with {@link flipY} near the bottom edge. */
    readonly y = input(0);
    /** Optional heading above the rows — typically the hovered category or x-axis value. Omit it for a rows-only tooltip. */
    readonly title = input<string | undefined>(undefined);
    /**
     * Series entries listed under the title. Each row's optional `color` renders
     * a swatch matching the series; rows without one show label and value only.
     * `value` is taken as already formatted — no number formatting happens here.
     */
    readonly rows = input<ChartTooltipRow[]>([]);
    /** Flip left of the anchor when the anchor is near the right edge. */
    readonly flipX = input(false);
    /** Flip above the anchor when the anchor is near the bottom edge. */
    readonly flipY = input(false);
    /** Extra classes merged onto the tooltip surface. Keep `max-w-[calc(100vw-2rem)]` in place — it is what stops the tooltip overflowing the viewport on narrow screens. */
    readonly class = input('');

    readonly classes = computed(() =>
        cn(
            'pointer-events-none absolute z-50 max-w-[calc(100vw-2rem)] rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg',
            this.flipX() ? '-translate-x-full' : '',
            this.flipY() ? '-translate-y-full' : '',
            this.class(),
        ),
    );
}
