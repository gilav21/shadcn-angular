import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    ElementRef,
    inject,
    AfterViewInit,
    DestroyRef,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import { ChartClickEvent, ChartDirection } from '../../lib/chart.types';
import {
    getChartColor,
    formatChartValue,
    getChartSummary,
} from '../../lib/chart.utils';
import { linearScale, niceDomain } from '../../lib/chart-scale';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';
import { HistogramBin } from './histogram.types';
import { computeBins } from './histogram.utils';

/** A laid-out histogram bar: its bin plus the SVG rect it occupies. */
export interface HistogramBar {
    index: number;
    bin: HistogramBin;
    count: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const PAD_EDGE = 12;

@Component({
    selector: 'ui-histogram',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './histogram.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class HistogramComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    /**
     * The raw sample — one number per observation, in any order. The component
     * bins them itself, so pass the observations, not pre-aggregated counts.
     * Non-finite entries (`NaN`, `±Infinity`) are dropped rather than rendered,
     * and an empty (or entirely non-finite) sample renders the empty state.
     */
    readonly values = input.required<number[]>();
    /**
     * How many equal-width bins to spread across the value domain. Left
     * undefined — the default — Sturges' rule picks the count from the sample
     * size. Values below 1 or non-finite fall back to the same rule.
     */
    readonly binCount = input<number | undefined>(undefined);
    /**
     * Explicit bin boundaries, taking precedence over {@link binCount}: `n`
     * ascending edges give `n - 1` bins, and samples outside the outermost
     * edges are excluded from every count. Unsorted input is sorted rather
     * than rejected. Ignored unless it holds two or more distinct finite edges.
     */
    readonly binEdges = input<number[] | undefined>(undefined);
    /**
     * Fallback width of the SVG user-space coordinate system, in px, used until
     * the host has been measured — from then on the `viewBox` tracks the host's
     * real width. The measurement needs a block-level box, which is why the
     * host is `class: 'block'` and the container `w-full`.
     */
    readonly width = input(500);
    /** Height of the SVG in px, applied literally. The bottom 28px are reserved for the value-axis labels. */
    readonly height = input(300);
    /** Draw the dashed horizontal gridline behind each count tick. The tick *labels* are drawn either way. */
    readonly showGrid = input(true);
    /** Print each bar's count above it. Turn it off for dense binnings where the labels collide; the counts stay reachable via the tooltip and the aria-label. */
    readonly showValues = input(true);
    /** Show the shared tooltip for the hovered/focused bar. Hover still emits {@link binHover} when disabled. */
    readonly showTooltip = input(true);
    /** Corner rounding of each bar rect, in px (SVG `rx`). Use `0` for square corners. */
    readonly barRadius = input(2);
    /**
     * Gap between adjacent bars, in px of user space, taken out of the bar
     * rather than added between them — so the bars keep covering their bins
     * exactly and only look separated. Bars are never thinner than 1px.
     */
    readonly barGap = input(2);
    /** Overrides the palette colour used for every bar. Histograms are a single series, so there is one colour, not one per bar. */
    readonly color = input<string | undefined>(undefined);
    /** Suffix appended to the bin bounds in the tooltip title and aria-labels (e.g. `'ms'`, `'%'`). Written verbatim with no separating space. */
    readonly unit = input('');
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the container's accessible summary ("<title>. Histogram with N data points."). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction. `'auto'` (default) resolves from the host element's
     * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
     * reverses the value axis (the lowest bin on the right) and moves the count
     * tick labels to the opposite edge. See {@link isRtl}.
     */
    readonly dir = input<ChartDirection>('auto');

    /** Emitted when a bar is clicked, or activated with Enter/Space while focused. `point` is the bin, `index` its position in {@link bins}. */
    readonly binClick = output<ChartClickEvent<HistogramBin>>();
    /** Emitted with the bar's bin on hover/focus and with `null` on mouse-leave/blur, so consumers can mirror the highlight. */
    readonly binHover = output<ChartClickEvent<HistogramBin> | null>();

    private readonly _hover = signal<number | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    private readonly _domRtl = signal(false);

    readonly hoveredIndex = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-full', this.class()));
    readonly svgWidth = computed(() => this._measuredWidth() ?? this.width());
    readonly viewBox = computed(() => `0 0 ${this.svgWidth()} ${this.height()}`);

    readonly isRtl = computed(() => {
        const d = this.dir();
        if (d === 'rtl') return true;
        if (d === 'ltr') return false;
        return this._domRtl();
    });

    /**
     * The binned sample. Depends only on {@link values}, {@link binCount} and
     * {@link binEdges}, so a resize re-runs the layout below without ever
     * re-counting the sample.
     */
    readonly bins = computed((): HistogramBin[] =>
        computeBins(this.values(), {
            binCount: this.binCount(),
            binEdges: this.binEdges(),
        }),
    );

    /** True when no finite sample survived binning, which is what the empty state renders on. */
    readonly isEmpty = computed(() => this.bins().length === 0);

    readonly ariaLabel = computed(() =>
        getChartSummary('Histogram', this.bins().length, this.title()),
    );

    protected readonly area = computed(() => {
        const rtl = this.isRtl();
        return {
            left: rtl ? PAD_EDGE : PAD_AXIS,
            right: this.svgWidth() - (rtl ? PAD_AXIS : PAD_EDGE),
            top: PAD_TOP,
            bottom: this.height() - PAD_BOTTOM,
        };
    });

    private readonly countDomain = computed((): [number, number] => {
        const max = Math.max(0, ...this.bins().map(b => b.count));
        return max > 0 ? niceDomain(0, max, 5) : [0, 1];
    });

    private readonly xScale = computed(() => {
        const a = this.area();
        const bins = this.bins();
        const lo = bins[0]?.start ?? 0;
        const hi = bins.at(-1)?.end ?? 1;
        const range: [number, number] = this.isRtl() ? [a.right, a.left] : [a.left, a.right];
        return linearScale([lo, hi], range);
    });

    private readonly yScale = computed(() => {
        const a = this.area();
        return linearScale(this.countDomain(), [a.bottom, a.top]);
    });

    /** Count-axis ticks. Fractional ticks are dropped — a count of 2.5 has no meaning. */
    readonly countTicks = computed(() => {
        const ticks = this.yScale().ticks(5).filter(t => Number.isInteger(t));
        return ticks.length > 0 ? ticks : [0];
    });

    readonly gridLines = computed(() =>
        this.countTicks().map(value => ({ value, y: this.yScale().scale(value) })),
    );

    /** Value-axis ticks: every bin boundary, so the labels always line up with a bar edge. */
    readonly edgeTicks = computed(() => {
        const bins = this.bins();
        if (bins.length === 0) return [];
        const xs = this.xScale();
        const edges = [bins[0].start, ...bins.map(b => b.end)];
        return edges.map(value => ({ value, x: xs.scale(value) }));
    });

    readonly bars = computed((): HistogramBar[] => {
        const xs = this.xScale();
        const ys = this.yScale();
        const bottom = this.area().bottom;
        const gap = this.barGap();
        const color = getChartColor(0, this.color());

        return this.bins().map((bin, index) => {
            const startX = xs.scale(bin.start);
            const endX = xs.scale(bin.end);
            const slot = Math.abs(endX - startX);
            const barWidth = Math.max(1, slot - gap);
            const y = ys.scale(bin.count);
            return {
                index,
                bin,
                count: bin.count,
                x: Math.min(startX, endX) + (slot - barWidth) / 2,
                y,
                width: barWidth,
                height: Math.max(0, bottom - y),
                color,
            };
        });
    });

    private readonly hoveredBin = computed(() => {
        const i = this._hover();
        return i === null ? null : this.bins()[i] ?? null;
    });

    readonly tooltipTitle = computed(() => {
        const bin = this.hoveredBin();
        return bin ? this.formatRange(bin) : undefined;
    });

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const bin = this.hoveredBin();
        if (!bin) return [];
        return [
            {
                label: 'Count',
                value: formatChartValue(bin.count, { decimals: 0 }),
                color: getChartColor(0, this.color()),
            },
        ];
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Marks the bar as active — dimming its siblings, parking the tooltip just
     * above it and emitting {@link binHover}. Bound to `mouseenter`, `focus`
     * and `touchstart`, so keyboard and touch users get the same highlight —
     * the tooltip is the only place the bin range and count appear.
     */
    onBarHover(bar: HistogramBar): void {
        this._hover.set(bar.index);
        this._tooltipPos.set({ x: bar.x + bar.width / 2 + 8, y: Math.max(8, bar.y - 8) });
        this.binHover.emit({ point: bar.bin, index: bar.index });
    }

    /** Clears the active bar (hiding the tooltip) and emits `null` on {@link binHover}. Bound to `mouseleave` and `blur`. */
    onBarLeave(): void {
        this._hover.set(null);
        this.binHover.emit(null);
    }

    /**
     * Emits {@link binClick} for the activated bar. `event` is forwarded only
     * when it is a real `MouseEvent`; keyboard activation (Enter/Space) leaves
     * `event` undefined on the payload.
     */
    onBarClick(event: Event, bar: HistogramBar): void {
        this.binClick.emit({
            point: bar.bin,
            index: bar.index,
            event: event instanceof MouseEvent ? event : undefined,
        });
    }

    /** Accessible name for a bar, phrased as `"<start> – <end>: <count>"` so screen readers announce the interval before its frequency. */
    getBarAriaLabel(bar: HistogramBar): string {
        return `${this.formatRange(bar.bin)}: ${bar.count}`;
    }

    /** Formats a bin bound or an axis tick for display, keeping up to two decimals and appending {@link unit}. */
    formatValue(value: number): string {
        return formatChartValue(value, { decimals: 2 }) + this.unit();
    }

    private formatRange(bin: HistogramBin): string {
        return `${this.formatValue(bin.start)} – ${this.formatValue(bin.end)}`;
    }
}
