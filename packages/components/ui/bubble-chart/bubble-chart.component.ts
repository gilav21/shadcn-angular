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
    XYZSeries,
    XYZDataPoint,
    ChartClickEvent,
    ChartDirection,
} from '../../lib/chart.types';
import {
    getChartColor,
    formatChartValue,
    getChartSummary,
} from '../../lib/chart.utils';
import { linearScale, niceDomain, sizeScale } from '../../lib/chart-scale';
import { nearestPoint2D, pointerToSvg } from '../../lib/chart-interaction';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';
import { ChartLegendComponent, ChartLegendItem } from '../chart-legend';

interface Bubble {
    cx: number;
    cy: number;
    r: number;
    color: string;
    seriesIndex: number;
    pointIndex: number;
    datum: XYZDataPoint;
    seriesName: string;
}

const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const PAD_EDGE = 16;

@Component({
    selector: 'ui-bubble-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './bubble-chart.component.html',
    imports: [ChartTooltipComponent, ChartLegendComponent],
    host: {
        class: 'block',
    },
})
export class BubbleChartComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);
    private readonly _svg = viewChild<ElementRef<SVGSVGElement>>('chartSvg');

    /**
     * One cloud of bubbles per series. Every `points` entry needs numeric `x`
     * and `y` (continuous position) plus `z`, the magnitude mapped to the
     * bubble radius between {@link minRadius} and {@link maxRadius}. All three
     * domains are derived from the *visible* points, so hiding a series through
     * the legend rescales the axes **and** re-sizes every remaining bubble.
     * `color` overrides the palette colour otherwise derived from the series
     * index, and `id` (falling back to `name`) is the legend toggle key.
     */
    readonly series = input.required<XYZSeries[]>();
    /**
     * Design width of the SVG user-space coordinate system, in px, used as the
     * `viewBox` width until the host has been measured. The rendered `<svg>` is
     * `width="100%"`, so the chart tracks its container and this value only
     * fixes the initial/fallback coordinate space. The container must be a
     * block-level box — an inline-block parent collapses a `width:100%` SVG,
     * which is why the host is `block` and the container carries `w-full`.
     */
    readonly width = input(540);
    /**
     * Height in px, applied verbatim to the SVG's `height` attribute and its
     * `viewBox`, so — unlike {@link width} — it is never measured or scaled.
     * The plot area is this minus 16px of top and 28px of bottom padding.
     */
    readonly height = input(340);
    /** Radius in px given to the smallest `z` in the data. Raise it so low-magnitude bubbles stay clickable. */
    readonly minRadius = input(6);
    /**
     * Radius in px given to the largest `z`. Radii interpolate by the square
     * root of the normalized `z`, so bubble *area* — not diameter — is
     * proportional to magnitude, which is what readers judge. Bubbles are not
     * de-overlapped, so a wide {@link minRadius}–`maxRadius` span on clustered
     * points will occlude; the plot area does not grow to accommodate it.
     */
    readonly maxRadius = input(28);
    /** Draw the dashed horizontal gridlines behind the bubbles, one per y tick. There are no vertical gridlines. */
    readonly showGrid = input(true);
    /** Show the floating tooltip (series name plus the point's x, y and z) for the bubble nearest the pointer. */
    readonly showTooltip = input(true);
    /** Render the legend under the chart. It is interactive: clicking an entry calls {@link toggleSeries}, which rescales the axes and the radius scale. */
    readonly showLegend = input(true);
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
     * Emitted when a bubble is clicked or activated with Enter while focused.
     * `index` is the point's position **within its own series**, not a flat
     * index across the chart, and the payload carries no series identifier —
     * track the series yourself if you need it. The originating event is not
     * forwarded.
     */
    readonly pointClick = output<ChartClickEvent<XYZDataPoint>>();

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
        getChartSummary('Bubble chart', this.series().length, this.title()),
    );

    private seriesKey(s: XYZSeries): string {
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

    private readonly allPoints = computed(() =>
        this.visibleSeries().flatMap(({ s }) => s.points),
    );

    private readonly xDomain = computed<[number, number]>(() => {
        const xs = this.allPoints().map(p => p.x);
        if (xs.length === 0) return [0, 1];
        return niceDomain(Math.min(...xs), Math.max(...xs), 5);
    });

    private readonly yDomain = computed<[number, number]>(() => {
        const ys = this.allPoints().map(p => p.y);
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

    private readonly radiusScale = computed(() => {
        const zs = this.allPoints().map(p => p.z);
        const min = zs.length ? Math.min(...zs) : 0;
        const max = zs.length ? Math.max(...zs) : 1;
        return sizeScale([min, max], [this.minRadius(), this.maxRadius()]);
    });

    readonly yTicks = computed(() => {
        const ys = this.yScale();
        return ys.ticks(5).map(v => ({ value: v, y: ys.scale(v) }));
    });

    readonly bubbles = computed((): Bubble[] => {
        const xs = this.xScale();
        const ys = this.yScale();
        const rs = this.radiusScale();
        return this.visibleSeries().flatMap(({ s, i }) =>
            s.points.map((p, pi) => ({
                cx: xs.scale(p.x),
                cy: ys.scale(p.y),
                r: rs.radius(p.z),
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
        return [
            { label: 'x', value: formatChartValue(p.x), color: getChartColor(h.s, s.color) },
            { label: 'y', value: formatChartValue(p.y) },
            { label: 'z', value: formatChartValue(p.z) },
        ];
    });

    readonly hoverTitle = computed(() => {
        const h = this.hovered();
        if (!h) return undefined;
        return this.series()[h.s]?.name;
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Shows or hides one series, keyed by its `id` (or `name` when no `id` is
     * set). Hidden series drop out of the x, y **and** `z` domains, so the
     * remaining bubbles both re-spread and re-size. Bound to the legend's
     * toggle output.
     */
    toggleSeries(key: string): void {
        const hidden = this._hidden();
        this._hidden.set(
            hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key],
        );
    }

    /**
     * Highlights a bubble programmatically — raising its fill opacity and
     * filling the tooltip — or clears the highlight when `seriesIndex` is
     * `null`. Indices address {@link series} as supplied, including hidden
     * series (whose bubbles are not drawn, so the highlight would be
     * invisible). Does not move the tooltip: its position is only updated by
     * {@link onPointerMove}.
     */
    setHover(seriesIndex: number | null, pointIndex = 0): void {
        this.hovered.set(seriesIndex === null ? null : { s: seriesIndex, p: pointIndex });
    }

    /**
     * Tracks the pointer over the whole SVG and highlights the bubble whose
     * *centre* is euclidean-nearest, placing the tooltip clear of its right
     * edge. Matching is on centres only and has no proximity threshold, so a
     * pointer inside a large bubble can still select a smaller neighbour whose
     * centre is closer. Bound to `mousemove`, `touchstart` and `touchmove` so
     * touch devices get the same read-out as mouse users.
     */
    onPointerMove(evt: MouseEvent | TouchEvent): void {
        const svg = this._svg()?.nativeElement;
        if (!svg) return;
        const local = pointerToSvg(evt, svg);
        const bubbles = this.bubbles();
        const nearest = nearestPoint2D(
            { x: local.x, y: local.y },
            bubbles.map(b => ({ x: b.cx, y: b.cy, datum: b })),
        );
        if (!nearest) return;
        const b = nearest.point.datum;
        this._tooltipPos.set({ x: b.cx + b.r, y: Math.max(8, b.cy - 8) });
        this.hovered.set({ s: b.seriesIndex, p: b.pointIndex });
    }

    /** Clears the highlight and hides the tooltip when the pointer leaves the SVG. Bound to `mouseleave`. */
    onPointerLeave(): void {
        this.hovered.set(null);
    }

    /**
     * Emits {@link pointClick} for the addressed point, silently doing nothing
     * if the indices don't resolve. Bound to each bubble's `click` and
     * `keydown.enter` so keyboard users can activate a focused bubble.
     */
    onPointClick(seriesIndex: number, pointIndex: number): void {
        const point = this.series()[seriesIndex]?.points[pointIndex];
        if (point) this.pointClick.emit({ point, index: pointIndex });
    }
}
