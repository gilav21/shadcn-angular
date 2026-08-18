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
import {
    XYSeries,
    XYDataPoint,
    ChartClickEvent,
    ChartDirection,
} from '../../lib/chart.types';
import {
    getChartColor,
    formatChartValue,
    getChartSummary,
} from '../../lib/chart.utils';
import { linearScale, niceDomain } from '../../lib/chart-scale';
import { nearestPoint2D, pointerToSvg } from '../../lib/chart-interaction';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';
import { ChartLegendComponent, ChartLegendItem } from '../chart-legend';

interface PlottedPoint {
    cx: number;
    cy: number;
    r: number;
    color: string;
    seriesIndex: number;
    pointIndex: number;
    datum: XYDataPoint;
    seriesName: string;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const PAD_EDGE = 14;

@Component({
    selector: 'ui-scatter-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './scatter-chart.component.html',
    imports: [ChartTooltipComponent, ChartLegendComponent],
    host: {
        class: 'block',
    },
})
export class ScatterChartComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);
    private readonly _svg = viewChild<ElementRef<SVGSVGElement>>('chartSvg');

    /**
     * One cloud of points per series. Every `points` entry needs numeric `x`
     * and `y` in continuous data space — unlike the categorical charts there is
     * no name-keyed axis, and point order is irrelevant since nothing is
     * connected. Both axes auto-scale to nice bounds covering all *visible*
     * points, so hiding a series through the legend rescales the chart. `color`
     * overrides the palette colour otherwise derived from the series index, and
     * `id` (falling back to `name`) is the key used for legend toggling — give
     * two series the same name and they toggle together.
     */
    readonly series = input.required<XYSeries[]>();
    /**
     * Design width of the SVG user-space coordinate system, in px, used as the
     * `viewBox` width until the host has been measured. The rendered `<svg>` is
     * `width="100%"`, so the chart tracks its container and this value only
     * fixes the initial/fallback coordinate space. The container must be a
     * block-level box — an inline-block parent collapses a `width:100%` SVG,
     * which is why the host is `block` and the container carries `w-full`.
     */
    readonly width = input(520);
    /**
     * Height in px, applied verbatim to the SVG's `height` attribute and its
     * `viewBox`, so — unlike {@link width} — it is never measured or scaled.
     * The plot area is this minus 12px of top and 28px of bottom padding for
     * the x tick labels.
     */
    readonly height = input(320);
    /** Radius of each point circle, in px of user space. The hovered/focused point is drawn 2px larger. */
    readonly pointRadius = input(5);
    /** Draw the dashed horizontal gridlines behind the points, one per y tick. There are no vertical gridlines. */
    readonly showGrid = input(true);
    /** Show the floating tooltip for the point nearest the pointer. Disabling it keeps the hover highlight and {@link setHover} behaviour. */
    readonly showTooltip = input(true);
    /** Render the legend under the chart. It is interactive: clicking an entry calls {@link toggleSeries}, which also rescales both axes. */
    readonly showLegend = input(true);
    /** Reserved x-axis caption. The current template renders no axis titles, so setting this has no visual effect. */
    readonly xAxisLabel = input('');
    /** Reserved y-axis caption. The current template renders no axis titles, so setting this has no visual effect. */
    readonly yAxisLabel = input('');
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the container's accessible summary. */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction. `'auto'` (default) resolves from the host element's
     * inherited DOM direction once, after view init; `'ltr'`/`'rtl'` force it.
     * RTL reverses the x scale's pixel range and moves the y tick labels to the
     * right-hand edge. See {@link isRtl}.
     */
    readonly dir = input<ChartDirection>('auto');

    /**
     * Emitted when a point is clicked or activated with Enter while focused.
     * `index` is the point's position **within its own series**, not a flat
     * index across the chart, and the payload carries no series identifier —
     * track the series yourself if you need it. The originating event is not
     * forwarded.
     */
    readonly pointClick = output<ChartClickEvent<XYDataPoint>>();

    protected readonly hovered = signal<{ s: number; p: number } | null>(null);
    private readonly _hidden = signal<string[]>([]);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    private readonly _domRtl = signal(false);

    readonly hiddenSeries = this._hidden.asReadonly();
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
        getChartSummary('Scatter chart', this.series().length, this.title()),
    );

    private seriesKey(s: XYSeries): string {
        return s.id ?? s.name;
    }

    readonly legendItems = computed((): ChartLegendItem[] =>
        this.series().map((s, i) => ({
            key: this.seriesKey(s),
            label: s.name,
            color: getChartColor(i, s.color),
        })),
    );

    private readonly visibleSeries = computed(() =>
        this.series()
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => !this._hidden().includes(this.seriesKey(s))),
    );

    private readonly allVisiblePoints = computed(() =>
        this.visibleSeries().flatMap(({ s }) => s.points),
    );

    readonly xDomain = computed<[number, number]>(() => {
        const xs = this.allVisiblePoints().map(p => p.x);
        if (xs.length === 0) return [0, 1];
        return niceDomain(Math.min(...xs), Math.max(...xs), 5);
    });

    readonly yDomain = computed<[number, number]>(() => {
        const ys = this.allVisiblePoints().map(p => p.y);
        if (ys.length === 0) return [0, 1];
        return niceDomain(Math.min(...ys), Math.max(...ys), 5);
    });

    protected readonly area = computed(() => {
        const rtl = this.isRtl();
        return {
            left: rtl ? PAD_EDGE : PAD_AXIS,
            right: this.svgWidth() - (rtl ? PAD_AXIS : PAD_EDGE),
            top: PAD_TOP,
            bottom: this.height() - PAD_BOTTOM,
        };
    });

    private readonly xScale = computed(() => {
        const a = this.area();
        const range: [number, number] = this.isRtl() ? [a.right, a.left] : [a.left, a.right];
        return linearScale(this.xDomain(), range);
    });

    private readonly yScale = computed(() => {
        const a = this.area();
        return linearScale(this.yDomain(), [a.bottom, a.top]);
    });

    readonly xTicks = computed(() => {
        const xs = this.xScale();
        return xs.ticks(5).map(v => ({ value: v, x: xs.scale(v) }));
    });

    readonly yTicks = computed(() => {
        const ys = this.yScale();
        return ys.ticks(5).map(v => ({ value: v, y: ys.scale(v) }));
    });

    readonly plottedPoints = computed((): PlottedPoint[] => {
        const xs = this.xScale();
        const ys = this.yScale();
        return this.visibleSeries().flatMap(({ s, i }) =>
            s.points.map((p, pi) => ({
                cx: xs.scale(p.x),
                cy: ys.scale(p.y),
                r: this.pointRadius(),
                color: getChartColor(i, s.color),
                seriesIndex: i,
                pointIndex: pi,
                datum: p,
                seriesName: s.name,
            })),
        );
    });

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const h = this.hovered();
        if (!h) return [];
        const s = this.series()[h.s];
        const p = s?.points[h.p];
        if (!s || !p) return [];
        return [{
            label: s.name,
            value: `(${formatChartValue(p.x)}, ${formatChartValue(p.y)})`,
            color: getChartColor(h.s, s.color),
        }];
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Shows or hides one series, keyed by its `id` (or `name` when no `id` is
     * set). Hidden series drop out of {@link xDomain} and {@link yDomain}, so
     * the remaining points re-spread over the full plot area. Bound to the
     * legend's toggle output.
     */
    toggleSeries(key: string): void {
        const hidden = this._hidden();
        this._hidden.set(
            hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key],
        );
    }

    /**
     * Highlights a point programmatically — enlarging it and filling the
     * tooltip — or clears the highlight when `seriesIndex` is `null`. Indices
     * address {@link series} as supplied, including hidden series (whose points
     * are not drawn, so the highlight would be invisible). Does not move the
     * tooltip: its position is only updated by {@link onPointerMove}.
     */
    setHover(seriesIndex: number | null, pointIndex = 0): void {
        this.hovered.set(seriesIndex === null ? null : { s: seriesIndex, p: pointIndex });
    }

    /**
     * Tracks the pointer over the whole SVG and highlights the euclidean-
     * nearest visible point, placing the tooltip just above and after it. There
     * is no proximity threshold, so some point is always selected while the
     * pointer is inside the plot. Bound to `mousemove`, `touchstart` and
     * `touchmove` so touch devices get the same read-out as mouse users.
     */
    onPointerMove(evt: MouseEvent | TouchEvent): void {
        const svg = this._svg()?.nativeElement;
        if (!svg) return;
        const local = pointerToSvg(evt, svg);
        const pts = this.plottedPoints();
        const nearest = nearestPoint2D(
            { x: local.x, y: local.y },
            pts.map(p => ({ x: p.cx, y: p.cy, datum: p })),
        );
        if (!nearest) return;
        const point = nearest.point.datum;
        this._tooltipPos.set({ x: point.cx + 10, y: Math.max(8, point.cy - 8) });
        this.hovered.set({ s: point.seriesIndex, p: point.pointIndex });
    }

    /** Clears the highlight and hides the tooltip when the pointer leaves the SVG. Bound to `mouseleave`. */
    onPointerLeave(): void {
        this.hovered.set(null);
    }

    /**
     * Emits {@link pointClick} for the addressed point, silently doing nothing
     * if the indices don't resolve. Bound to each circle's `click` and
     * `keydown.enter` so keyboard users can activate a focused point.
     */
    onPointClick(seriesIndex: number, pointIndex: number): void {
        const point = this.series()[seriesIndex]?.points[pointIndex];
        if (point) this.pointClick.emit({ point, index: pointIndex });
    }
}
