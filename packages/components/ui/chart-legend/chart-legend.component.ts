import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { LegendPosition } from '../../lib/chart.types';

export interface ChartLegendItem {
    key: string;
    label: string;
    color: string;
}

/**
 * Shared chart legend. Presentational: the host chart owns the set of hidden
 * series keys and updates it in response to `itemToggle`. Supports keyboard and
 * touch activation (tap = click, no hover dependency).
 */
@Component({
    selector: 'ui-chart-legend',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './chart-legend.component.html',
    host: {
        class: 'contents',
    },
})
export class ChartLegendComponent {
    /** Series entries to list, in display order. Each `key` is the identifier echoed back by {@link itemToggle} and matched against {@link hidden}; `color` paints the swatch. */
    readonly items = input<ChartLegendItem[]>([]);
    /**
     * Keys of the currently hidden series, which render dimmed. The legend is
     * purely presentational — it never mutates this list, so the host chart must
     * update it in response to {@link itemToggle} or nothing visibly changes.
     */
    readonly hidden = input<string[]>([]);
    /** Where the legend sits relative to the plot. `'left'`/`'right'` stack the entries in a column; `'top'`/`'bottom'` lay them out in a wrapping row. */
    readonly position = input<LegendPosition>('bottom');
    /** Allows clicking, tapping or pressing Enter/Space on an entry to emit {@link itemToggle}. Set to `false` for a read-only key. */
    readonly interactive = input(true);
    /** Extra classes merged onto the legend container — e.g. `text-xs` to shrink it, or extra gap utilities for denser charts. */
    readonly class = input('');

    /** Emitted with the `key` of the activated entry when {@link interactive} is set. It signals intent only — the host decides whether to add or remove the key from {@link hidden}. */
    readonly itemToggle = output<string>();

    readonly classes = computed(() =>
        cn(
            'flex flex-wrap items-center gap-x-4 gap-y-1 text-sm',
            this.position() === 'left' || this.position() === 'right' ? 'flex-col items-start' : '',
            this.class(),
        ),
    );

    /** Whether a series key appears in {@link hidden}; drives the dimmed styling and the entry's `aria-pressed` state. */
    isHidden(key: string): boolean {
        return this.hidden().includes(key);
    }

    /** Click/tap handler for a legend entry — emits {@link itemToggle}, or does nothing when {@link interactive} is `false`. Uses click rather than hover, so it works identically on touch. */
    onActivate(key: string): void {
        if (this.interactive()) {
            this.itemToggle.emit(key);
        }
    }

    /** Keyboard activation on Enter or Space, matching native button behaviour. The default is prevented so Space does not scroll the page. */
    onKeydown(event: KeyboardEvent, key: string): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.onActivate(key);
        }
    }
}
