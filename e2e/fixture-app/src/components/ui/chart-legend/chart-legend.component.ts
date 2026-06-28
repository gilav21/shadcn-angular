import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
} from '@angular/core';
import { cn } from '@/components/lib/utils';
import { LegendPosition } from '@/components/lib/chart.types';

export interface ChartLegendItem {
    key: string;
    label: string;
    color: string;
}

/**
 * Shared chart legend. Presentational: the host chart owns the set of hidden
 * series keys and updates it in response to `toggle`. Supports keyboard and
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
    readonly items = input<ChartLegendItem[]>([]);
    readonly hidden = input<string[]>([]);
    readonly position = input<LegendPosition>('bottom');
    readonly interactive = input(true);
    readonly class = input('');

    readonly toggle = output<string>();

    readonly classes = computed(() =>
        cn(
            'flex flex-wrap items-center gap-x-4 gap-y-1 text-sm',
            this.position() === 'left' || this.position() === 'right' ? 'flex-col items-start' : '',
            this.class(),
        ),
    );

    isHidden(key: string): boolean {
        return this.hidden().includes(key);
    }

    onActivate(key: string): void {
        if (this.interactive()) {
            this.toggle.emit(key);
        }
    }

    onKeydown(event: KeyboardEvent, key: string): void {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.onActivate(key);
        }
    }
}
