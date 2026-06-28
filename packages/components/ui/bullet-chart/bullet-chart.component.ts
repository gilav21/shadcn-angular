import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    ElementRef,
    DestroyRef,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import { ChartDirection } from '../../lib/chart.types';
import { formatChartValue } from '../../lib/chart.utils';
import { linearScale } from '../../lib/chart-scale';

interface RangeBand {
    x: number;
    width: number;
    opacity: number;
}

const PAD = 4;

@Component({
    selector: 'ui-bullet-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './bullet-chart.component.html',
    host: {
        class: 'block',
    },
})
export class BulletChartComponent {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    readonly value = input.required<number>();
    readonly target = input<number | undefined>(undefined);
    readonly ranges = input<number[]>([]);
    readonly min = input(0);
    readonly width = input(360);
    readonly height = input(40);
    readonly color = input('');
    readonly label = input('');
    readonly unit = input('');
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

    readonly classes = computed(() => cn('block w-full', this.class()));
    readonly svgWidth = computed(() => this._measuredWidth() ?? this.width());
    readonly viewBox = computed(() => `0 0 ${this.svgWidth()} ${this.height()}`);

    readonly maxValue = computed(() =>
        Math.max(this.value(), this.target() ?? 0, ...this.ranges(), this.min() + 1),
    );

    readonly trackWidth = computed(() => Math.max(0, this.svgWidth() - PAD * 2));

    private readonly scale = computed(() =>
        linearScale([this.min(), this.maxValue()], [0, this.trackWidth()]),
    );

    readonly measureHeight = computed(() => this.height() / 3);
    readonly barY = computed(() => this.height() / 2 - this.measureHeight() / 2);

    readonly rangeBands = computed((): RangeBand[] => {
        const sorted = [...this.ranges()].sort((a, b) => a - b);
        const s = this.scale();
        let prev = this.min();
        return sorted.map((r, i) => {
            const x = s.scale(prev);
            const width = Math.max(0, s.scale(r) - x);
            prev = r;
            return { x, width, opacity: 0.12 + (i / Math.max(1, sorted.length)) * 0.2 };
        });
    });

    readonly measureWidth = computed(() =>
        Math.min(this.trackWidth(), Math.max(0, this.scale().scale(this.value()))),
    );

    readonly measureColor = computed(() => this.color() || 'hsl(var(--primary))');

    readonly targetX = computed(() => {
        const t = this.target();
        return t === undefined ? null : this.scale().scale(t);
    });

    readonly displayValue = computed(() => `${formatChartValue(this.value())}${this.unit()}`);

    readonly ariaLabel = computed(() => {
        const base = this.title() ? `${this.title()}. ` : '';
        const lbl = this.label() ? `${this.label()}: ` : '';
        const t = this.target();
        const targetText = t === undefined ? '' : ` (target ${formatChartValue(t)}${this.unit()})`;
        return `${base}Bullet chart. ${lbl}${this.displayValue()}${targetText}.`;
    });
}
