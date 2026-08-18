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

    /** The measure — the primary quantity drawn as the central bar. It also participates in the auto-scale, so a value beyond every range simply extends the axis. */
    readonly value = input.required<number>();
    /** Goal marker drawn as a vertical tick across the bar. Omit it for a bar with no target line; when set it is also announced in the accessible label. */
    readonly target = input<number | undefined>(undefined);
    /**
     * Qualitative band boundaries (e.g. `[40, 70, 100]` for poor/ok/good), given
     * as upper bounds. Bands are drawn from {@link min} up through each bound in
     * ascending order — the list is sorted internally — with progressively
     * stronger shading.
     */
    readonly ranges = input<number[]>([]);
    /** Start of the axis. The upper bound is not an input: it is derived from the largest of {@link value}, {@link target} and {@link ranges}. */
    readonly min = input(0);
    /** Fallback width in pixels, used only until the container has been measured — the chart normally stretches to its container's width via a resize observer. */
    readonly width = input(360);
    /** Height of the SVG in pixels. The measure bar takes a third of it, centred, with the range bands behind at full height. Fixed, not responsive. */
    readonly height = input(40);
    /** Colour of the measure bar. Defaults to the theme's primary colour; the range bands are always neutral shading and ignore this. */
    readonly color = input('');
    /** Name of the metric, shown beside the chart and folded into the accessible label. */
    readonly label = input('');
    /** Unit suffix appended to the displayed value and to the accessible label. Cosmetic only — it does not affect the scale. */
    readonly unit = input('');
    /** Extra classes merged onto the `block w-full` host. Keep it full-width, since that is what the resize observer measures to size the SVG. */
    readonly class = input('');
    /** Chart title, prefixed to the accessible label. Supply it when the chart has no visible heading beside it. */
    readonly title = input<string | undefined>(undefined);
    /** Text direction for the labels: `'auto'` inherits from the document. The bar itself always grows left-to-right and does not mirror in RTL. */
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
