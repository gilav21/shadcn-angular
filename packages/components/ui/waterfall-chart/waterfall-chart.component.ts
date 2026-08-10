import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    viewChild,
    ElementRef,
    inject,
    AfterViewInit,
    DestroyRef,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import { WaterfallBar, ChartClickEvent, ChartDirection } from '../../lib/chart.types';
import { formatChartValue, getChartSummary } from '../../lib/chart.utils';
import { linearScale, niceDomain, bandScale } from '../../lib/chart-scale';
import { nearestPointX, pointerToSvg } from '../../lib/chart-interaction';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';

interface PlacedBar {
    name: string;
    value: number;
    fromLevel: number;
    toLevel: number;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;

@Component({
    selector: 'ui-waterfall-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './waterfall-chart.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class WaterfallChartComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);
    private readonly _svg = viewChild<ElementRef<SVGSVGElement>>('chartSvg');

    /**
     * The bridge, in left-to-right order — order is the story here, since each
     * bar is stacked on the running total left by the one before it. A bar with
     * `type` omitted or `'relative'` is a delta: it spans from the running
     * total to `running + value`, so a negative `value` draws downward. A bar
     * with `type: 'total'` is a checkpoint: it is drawn from the zero baseline
     * up to `value` and *resets* the running total to that value, so its `value`
     * must be the subtotal you want (it is not computed for you — an
     * inconsistent number silently breaks the bridge). `name` labels the
     * category axis and is the band key, so names must be unique; the optional
     * `color` overrides {@link positiveColor} / {@link negativeColor} /
     * {@link totalColor} for that bar alone.
     */
    readonly data = input.required<WaterfallBar[]>();
    /**
     * Design width of the SVG user-space coordinate system, in px, and the
     * fallback until the host has been measured. The SVG renders at
     * `width="100%"` and the viewBox follows the measured width, so bands
     * re-flow rather than scale. The host must be a block-level box — an
     * inline-block parent collapses a `width:100%` SVG to the 300px default,
     * which is why the container carries `w-full` and the host `class: 'block'`.
     */
    readonly width = input(520);
    /**
     * Rendered height in px — unlike {@link width} this is set on the SVG
     * directly and never measured, so the chart gets shorter only if you change
     * it. 12px is reserved at the top and 28px at the bottom for the category
     * labels, leaving the rest for the value scale.
     */
    readonly height = input(320);
    /** Draw the dashed step lines linking each bar's closing level to the next bar's start, which is what reads as a "bridge". */
    readonly showConnectors = input(true);
    /** Print each bar's raw `value` above the bar. Off by default because the same number (plus the running total) is in the tooltip — see {@link showTooltip}. */
    readonly showValues = input(false);
    /** Render the hover tooltip showing the bar's change and its cumulative total. Pointer tracking still runs when off, so {@link hovered} keeps driving the dimming of the other bars. */
    readonly showTooltip = input(true);
    /** Fill for `'relative'` bars with a `value` of zero or more. Any CSS colour; a bar's own `color` wins. */
    readonly positiveColor = input('hsl(142, 71%, 45%)');
    /** Fill for `'relative'` bars with a negative `value`. Any CSS colour; a bar's own `color` wins. */
    readonly negativeColor = input('hsl(0, 84%, 60%)');
    /** Fill for `type: 'total'` bars, deliberately distinct from {@link positiveColor}/{@link negativeColor} so checkpoints read as a different kind of bar. */
    readonly totalColor = input('hsl(221, 83%, 53%)');
    /** Corner rounding of each bar rect, in px (SVG `rx`). Kept small by default so thin single-unit deltas stay legible; use `0` for square corners. */
    readonly barRadius = input(2);
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the accessible summary on the container. */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction. `'auto'` (default) resolves once from the host
     * element's inherited DOM direction after view init; `'ltr'`/`'rtl'` force
     * it. RTL reverses the band range so the first bar sits at the right edge —
     * the value axis, its tick labels and the connectors are unaffected. See
     * {@link isRtl}.
     */
    readonly dir = input<ChartDirection>('auto');

    /**
     * Emitted when a bar is clicked or activated with Enter while focused. The
     * payload's `point` carries the bar's `name` and its own `value` (the
     * delta, not the cumulative level) plus the {@link data} index; no
     * `MouseEvent` is forwarded.
     */
    readonly barClick = output<ChartClickEvent>();

    private readonly _hover = signal<number | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    private readonly _domRtl = signal(false);
    readonly hovered = this._hover.asReadonly();
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

    readonly ariaLabel = computed(() =>
        getChartSummary('Waterfall chart', this.data().length, this.title()),
    );

    private readonly levels = computed(() => {
        let running = 0;
        return this.data().map(bar => {
            if (bar.type === 'total') {
                running = bar.value;
                return { from: 0, to: bar.value };
            }
            const from = running;
            running += bar.value;
            return { from, to: running };
        });
    });

    private colorFor(bar: WaterfallBar): string {
        if (bar.color) return bar.color;
        if (bar.type === 'total') return this.totalColor();
        return bar.value >= 0 ? this.positiveColor() : this.negativeColor();
    }

    private readonly area = computed(() => ({
        left: PAD_AXIS,
        right: this.svgWidth() - 12,
        top: PAD_TOP,
        bottom: this.height() - PAD_BOTTOM,
    }));

    private readonly yScale = computed(() => {
        const a = this.area();
        const levels = this.levels();
        const all = levels.flatMap(l => [l.from, l.to]).concat(0);
        const min = Math.min(...all);
        const max = Math.max(...all);
        return linearScale(niceDomain(min, max, 5), [a.bottom, a.top]);
    });

    private readonly band = computed(() => {
        const a = this.area();
        const range: [number, number] = this.isRtl() ? [a.right, a.left] : [a.left, a.right];
        return bandScale(this.data().map(d => d.name), range, 0.3, 0.15);
    });

    readonly yTicks = computed(() => {
        const ys = this.yScale();
        return ys.ticks(5).map(v => ({ value: v, y: ys.scale(v) }));
    });

    readonly bars = computed((): PlacedBar[] => {
        const ys = this.yScale();
        const band = this.band();
        const levels = this.levels();
        return this.data().map((bar, i) => {
            const { from, to } = levels[i];
            const yFrom = ys.scale(from);
            const yTo = ys.scale(to);
            const x = band.position(bar.name) ?? 0;
            return {
                name: bar.name,
                value: bar.value,
                fromLevel: from,
                toLevel: to,
                color: this.colorFor(bar),
                x,
                y: Math.min(yFrom, yTo),
                width: band.bandwidth,
                height: Math.max(1, Math.abs(yFrom - yTo)),
                centerX: x + band.bandwidth / 2,
            };
        });
    });

    readonly connectors = computed(() => {
        const bars = this.bars();
        const ys = this.yScale();
        const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
        for (let i = 0; i < bars.length - 1; i++) {
            const y = ys.scale(this.levels()[i].to);
            lines.push({ x1: bars[i].x + bars[i].width, y1: y, x2: bars[i + 1].x, y2: y });
        }
        return lines;
    });

    readonly categoryCenters = computed(() => this.bars().map(b => ({ x: b.centerX })));

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const i = this._hover();
        if (i === null) return [];
        const bar = this.bars()[i];
        if (!bar) return [];
        return [
            { label: 'Change', value: formatChartValue(bar.value), color: bar.color },
            { label: 'Total', value: formatChartValue(bar.toLevel) },
        ];
    });

    readonly hoverTitle = computed(() => {
        const i = this._hover();
        return i === null ? undefined : this.data()[i]?.name;
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Sets the active bar by {@link data} index, or clears it with `null`. The
     * active bar keeps full opacity while the others drop to 0.6, and it feeds
     * the tooltip's rows and title. Exposed so a surrounding legend or table
     * can drive the same highlight; the tooltip position is left untouched, so
     * a programmatic call reuses wherever the pointer last put it.
     */
    setHover(index: number | null): void {
        this._hover.set(index);
    }

    /**
     * Tracks the pointer across the whole SVG — not just over the bars — and
     * snaps to the bar whose band centre is nearest horizontally, so thin or
     * zero-height bars are still reachable. Bound to `mousemove` as well as
     * `touchstart`/`touchmove` (the SVG sets `touch-action: none`) so dragging a
     * finger scrubs the categories instead of scrolling the page. Positions the
     * tooltip beside that centre, never closer than 8px to the top edge.
     */
    onPointerMove(evt: MouseEvent | TouchEvent): void {
        const svg = this._svg()?.nativeElement;
        if (!svg) return;
        const local = pointerToSvg(evt, svg);
        const centers = this.categoryCenters();
        const nearest = nearestPointX(local.x, centers.map((c, i) => ({ x: c.x, datum: i })));
        if (!nearest) return;
        this._tooltipPos.set({ x: nearest.point.x + 12, y: Math.max(8, local.y - 8) });
        this.setHover(nearest.index);
    }

    /**
     * Clears the highlight and hides the tooltip when the pointer leaves the
     * SVG. Bound to `mouseleave` only — touch has no matching event here, so
     * the last touched bar stays highlighted until the next touch.
     */
    onPointerLeave(): void {
        this.setHover(null);
    }

    /** Emits {@link barClick} for the bar at this {@link data} index; a no-op if the index no longer resolves. Bound to both `click` and `keydown.enter` on the bar rect. */
    onBarClick(index: number): void {
        const d = this.data()[index];
        if (d) this.barClick.emit({ point: { name: d.name, value: d.value }, index });
    }
}
