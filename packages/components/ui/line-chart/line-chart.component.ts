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
    ChartSeries,
    ChartClickEvent,
    ChartDirection,
} from '../../lib/chart.types';
import {
    getChartColor,
    formatChartValue,
    getChartSummary,
} from '../../lib/chart.utils';
import { linearScale, niceDomain } from '../../lib/chart-scale';
import { linePath, CurveType } from '../../lib/chart-path';
import { nearestPointX, pointerToSvg } from '../../lib/chart-interaction';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';
import { ChartLegendComponent, ChartLegendItem } from '../chart-legend';

interface LinePoint {
    x: number;
    y: number;
    value: number;
    name: string;
}

interface SeriesPath {
    key: string;
    name: string;
    color: string;
    path: string;
    points: LinePoint[];
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const PAD_EDGE = 12;

@Component({
    selector: 'ui-line-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './line-chart.component.html',
    imports: [ChartTooltipComponent, ChartLegendComponent],
    host: {
        class: 'block',
    },
})
export class LineChartComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);
    private readonly _svg = viewChild<ElementRef<SVGSVGElement>>('chartSvg');

    /**
     * One poly-line per series. Points are matched across series **by position**,
     * not by name: the x axis categories are taken from the *first* series'
     * `data[].name`, so every series should carry the same number of points in
     * the same order. Each entry's `color` overrides the palette colour picked
     * from the series index; `id` (falling back to `name`) is the key used by
     * the legend and {@link toggleSeries}, so give series unique names when they
     * have no `id`. The y domain is nice-rounded over the *visible* series and
     * always includes 0, so hiding a series via the legend rescales the axis.
     */
    readonly series = input.required<ChartSeries[]>();
    /**
     * Fallback width of the SVG user-space coordinate system, in px, used until
     * the host has been measured — from then on the `viewBox` tracks the host's
     * real width, so user space maps 1:1 to CSS px and the line never stretches.
     * The measurement needs a block-level box: an inline-block container
     * collapses the `width:100%` SVG, which is why the host is `class: 'block'`
     * and the container `w-full`.
     */
    readonly width = input(500);
    /**
     * Height of the SVG in px, applied literally (not scaled). It is also the
     * y-axis extent: {@link series} values are mapped between `height - 28` and
     * `12` in user space, leaving the bottom band for the category labels.
     */
    readonly height = input(300);
    /**
     * Interpolation between points. `'linear'` (default) joins them with
     * straight segments, `'monotone'` fits an overshoot-free cubic spline
     * (degrading to linear for a two-point series), and `'step'` holds each
     * value until the next x. Purely visual — hit-testing and
     * {@link showPoints} markers stay on the raw points.
     */
    readonly curve = input<CurveType>('linear');
    /**
     * Draw a circle marker on every data point. The markers are also the only
     * focusable, clickable elements in the SVG, so turning this off removes
     * keyboard access to the series and stops {@link pointClick} from firing —
     * hover/crosshair/tooltip keep working, as they hit-test the whole plot.
     */
    readonly showPoints = input(true);
    /** Draw the dashed horizontal gridline behind each y tick. The tick *labels* are drawn either way. */
    readonly showGrid = input(true);
    /** Show the shared tooltip listing every visible series at the hovered category. Hover still emits {@link pointHover} when disabled. */
    readonly showTooltip = input(true);
    /** Render the legend below the chart. It is interactive: clicking an entry calls {@link toggleSeries}, so hiding it also removes the only built-in way to unhide a series. */
    readonly showLegend = input(true);
    /** Draw the vertical line marking the hovered category, spanning the plot area. */
    readonly showCrosshair = input(true);
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the container's accessible summary ("<title>. Line chart with N data points."). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction. `'auto'` (default) resolves from the host element's
     * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
     * reverses the x range (first category on the right) and moves the y tick
     * labels to the opposite edge. See {@link isRtl}.
     */
    readonly dir = input<ChartDirection>('auto');

    /** Emitted when a point marker is clicked or activated with Enter. Requires {@link showPoints}; the payload's `event` is always undefined. */
    readonly pointClick = output<ChartClickEvent>();
    /** Emitted with the nearest category's point from the first *visible* series on pointer move, and with `null` on pointer-leave. `index` is the category index, so consumers can mirror the highlight across their own series. */
    readonly pointHover = output<ChartClickEvent | null>();

    private readonly _hidden = signal<string[]>([]);
    private readonly _hover = signal<number | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    private readonly _domRtl = signal(false);

    readonly hiddenSeries = this._hidden.asReadonly();
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

    readonly ariaLabel = computed(() =>
        getChartSummary('Line chart', this.categories().length, this.title()),
    );

    readonly categories = computed(() => this.series()[0]?.data.map(d => d.name) ?? []);

    private seriesKey(s: ChartSeries): string {
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

    private readonly yDomain = computed<[number, number]>(() => {
        const values = this.visibleSeries().flatMap(({ s }) => s.data.map(d => d.value));
        if (values.length === 0) return [0, 1];
        const max = Math.max(...values);
        const min = Math.min(0, ...values);
        return niceDomain(min, max, 5);
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
        const n = this.categories().length;
        const range: [number, number] = this.isRtl() ? [a.right, a.left] : [a.left, a.right];
        return linearScale([0, Math.max(1, n - 1)], range);
    });

    private readonly yScale = computed(() => {
        const a = this.area();
        return linearScale(this.yDomain(), [a.bottom, a.top]);
    });

    readonly yTicks = computed(() => this.yScale().ticks(5));

    readonly gridLines = computed(() =>
        this.yTicks().map(tick => ({ value: tick, y: this.yScale().scale(tick) })),
    );

    readonly categoryTicks = computed(() => {
        const xs = this.xScale();
        return this.categories().map((name, i) => ({ name, x: xs.scale(i) }));
    });

    readonly seriesPaths = computed((): SeriesPath[] => {
        const xs = this.xScale();
        const ys = this.yScale();
        return this.visibleSeries().map(({ s, i }) => {
            const points = s.data.map((d, idx) => ({
                x: xs.scale(idx),
                y: ys.scale(d.value),
                value: d.value,
                name: d.name,
            }));
            return {
                key: this.seriesKey(s),
                name: s.name,
                color: getChartColor(i, s.color),
                path: linePath(points.map(p => ({ x: p.x, y: p.y })), this.curve()),
                points,
            };
        });
    });

    readonly crosshairX = computed(() => {
        const i = this._hover();
        return i === null ? null : this.xScale().scale(i);
    });

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const i = this._hover();
        if (i === null) return [];
        return this.visibleSeries().map(({ s, i: si }) => ({
            label: s.name,
            value: formatChartValue(s.data[i]?.value ?? 0),
            color: getChartColor(si, s.color),
        }));
    });

    readonly hoverTitle = computed(() => {
        const i = this._hover();
        return i === null ? undefined : this.categories()[i];
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Toggles a series between hidden and shown, keyed by its `id ?? name`.
     * Bound to the legend's item clicks. Hiding a series drops it from the y
     * domain, the tooltip rows and the rendered paths, so the axis rescales to
     * what is left.
     */
    toggleSeries(key: string): void {
        const hidden = this._hidden();
        this._hidden.set(
            hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key],
        );
    }

    /**
     * Sets the active *category* index — which drives the crosshair, the marker
     * enlargement and the tooltip rows — and emits {@link pointHover} with that
     * category's point from the first visible series (or `null` to clear).
     * Exposed so a host can sync the highlight with another chart; pass an index
     * into {@link categories}, not into a series' points.
     */
    setHover(index: number | null): void {
        this._hover.set(index);
        if (index === null) {
            this.pointHover.emit(null);
            return;
        }
        const first = this.visibleSeries()[0];
        if (first) {
            this.pointHover.emit({ point: first.s.data[index], index });
        }
    }

    /**
     * Maps a mouse or touch position into SVG user space, snaps it to the
     * nearest category tick on x, parks the tooltip just past that tick, and
     * calls {@link setHover}. Bound to `mousemove`, `touchstart` and `touchmove`
     * so touch devices get the same crosshair and tooltip as a mouse (the SVG
     * sets `touch-action: none` to keep the gesture from scrolling the page).
     */
    onPointerMove(evt: MouseEvent | TouchEvent): void {
        const svg = this._svg()?.nativeElement;
        if (!svg) return;
        const local = pointerToSvg(evt, svg);
        const ticks = this.categoryTicks();
        const nearest = nearestPointX(local.x, ticks.map((t, i) => ({ x: t.x, datum: i })));
        if (!nearest) return;
        this._tooltipPos.set({ x: nearest.point.x + 12, y: Math.max(8, local.y - 8) });
        this.setHover(nearest.index);
    }

    /** Clears the hover — hiding the crosshair and tooltip and emitting `null` on {@link pointHover}. Bound to `mouseleave`; touch has no matching event, so the last touched category stays highlighted. */
    onPointerLeave(): void {
        this.setHover(null);
    }

    /**
     * Emits {@link pointClick} for an activated marker. `seriesIndex` is the
     * position in the *rendered* (visible) series list and is resolved against
     * {@link series} by that position, so it only agrees with the source array
     * while no series is hidden; `pointIndex` is the category index. Nothing is
     * emitted if the lookup finds no point.
     */
    onPointClick(seriesIndex: number, pointIndex: number): void {
        const data = this.series()[seriesIndex]?.data[pointIndex];
        if (data) this.pointClick.emit({ point: data, index: pointIndex });
    }
}
