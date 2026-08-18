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
import { linearScale, niceDomain, bandScale } from '../../lib/chart-scale';
import { linePath } from '../../lib/chart-path';
import { nearestPointX, pointerToSvg } from '../../lib/chart-interaction';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';
import { ChartLegendComponent, ChartLegendItem } from '../chart-legend';

interface ComboBar {
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

interface ComboLine {
    key: string;
    name: string;
    color: string;
    path: string;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;

@Component({
    selector: 'ui-combo-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './combo-chart.component.html',
    imports: [ChartTooltipComponent, ChartLegendComponent],
    host: {
        class: 'block',
    },
})
export class ComboChartComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);
    private readonly _svg = viewChild<ElementRef<SVGSVGElement>>('chartSvg');

    /**
     * The bar half of the chart, read against the **primary** (left) axis,
     * which is anchored at 0 and auto-scaled to the largest value across all
     * bar series — so negative values fall outside the plot. The **first**
     * series is privileged: its `data[].name`s define the category axis
     * ({@link categories}) and its values feed {@link cumulativePercents}.
     * Further series are grouped side by side inside each category band and are
     * indexed positionally, so every series must list its values in the same
     * category order; a missing slot is drawn as 0.
     */
    readonly barSeries = input.required<ChartSeries[]>();
    /**
     * Overlaid lines read against the **secondary** axis, whose scale is
     * independent of the bars — that is the point of a combo chart, and the
     * reason a line can sit above a taller bar. Points are placed at the
     * category band centres by array position, so `data` must align with
     * {@link barSeries}[0]. Palette colours continue after the bar series so
     * lines never collide with bar colours. The secondary axis is drawn without
     * tick labels, so put its unit in {@link cumulativeLabel} or the series
     * name.
     */
    readonly lineSeries = input<ChartSeries[]>([]);
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
     * The plot area is this minus 12px of top and 28px of bottom padding for
     * the category labels.
     */
    readonly height = input(320);
    /**
     * Prepend a Pareto-style running-total line, computed from
     * {@link barSeries}[0] only and expressed as a percentage of that series'
     * total. Turning it on pins the secondary axis to a fixed 0–100 range,
     * which also rescales any {@link lineSeries} drawn alongside it.
     */
    readonly showCumulative = input(false);
    /** Name given to the {@link showCumulative} line in the legend and its tooltip row. Ignored while `showCumulative` is false. */
    readonly cumulativeLabel = input('Cumulative');
    /** Corner rounding of each bar rect, in px (SVG `rx`). Use `0` for square corners; keep it small since grouped bars are narrow. */
    readonly barRadius = input(2);
    /** Draw the dashed horizontal gridlines behind the plot, one per primary-axis tick. The secondary axis contributes none. */
    readonly showGrid = input(true);
    /**
     * Show the shared tooltip for the hovered category — one row per bar
     * series, per line series, and for the cumulative line when enabled.
     * Disabling it keeps the crosshair and the bar dimming.
     */
    readonly showTooltip = input(true);
    /** Render the legend (bar series, then lines) under the chart. Unlike the scatter/bubble charts this legend is non-interactive — series cannot be toggled off. */
    readonly showLegend = input(true);
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the container's accessible summary. */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction. `'auto'` (default) resolves from the host element's
     * inherited DOM direction once, after view init; `'ltr'`/`'rtl'` force it.
     * RTL reverses the category band order (and with it the bars, lines and
     * crosshair); the primary tick labels stay on the left. See {@link isRtl}.
     */
    readonly dir = input<ChartDirection>('auto');

    /**
     * Emitted when any bar is clicked. `index` is the category index and
     * `point` the matching {@link barSeries} datum — but the template wires
     * every rect to bar series 0, so with several bar series the payload
     * reports the first series' value for that category regardless of which
     * grouped bar was hit. Call {@link onBarClick} directly if you need the
     * exact series.
     */
    readonly barClick = output<ChartClickEvent>();

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

    readonly ariaLabel = computed(() =>
        getChartSummary('Combo chart', this.categories().length, this.title()),
    );

    readonly categories = computed(() => this.barSeries()[0]?.data.map(d => d.name) ?? []);

    readonly primaryMax = computed(() => {
        const values = this.barSeries().flatMap(s => s.data.map(d => d.value));
        return values.length ? Math.max(...values) : 1;
    });

    readonly secondaryMax = computed(() => {
        if (this.showCumulative()) return 100;
        const values = this.lineSeries().flatMap(s => s.data.map(d => d.value));
        return values.length ? Math.max(...values) : 100;
    });

    readonly cumulativePercents = computed(() => {
        const first = this.barSeries()[0];
        if (!first) return [];
        const total = first.data.reduce((sum, d) => sum + d.value, 0) || 1;
        let running = 0;
        return first.data.map(d => {
            running += d.value;
            return (running / total) * 100;
        });
    });

    protected readonly area = computed(() => {
        const rtl = this.isRtl();
        return {
            left: PAD_AXIS,
            right: this.svgWidth() - PAD_AXIS,
            top: PAD_TOP,
            bottom: this.height() - PAD_BOTTOM,
            rtl,
        };
    });

    private readonly band = computed(() => {
        const a = this.area();
        const range: [number, number] = a.rtl ? [a.right, a.left] : [a.left, a.right];
        return bandScale(this.categories(), range, 0.3, 0.15);
    });

    private readonly yPrimary = computed(() => {
        const a = this.area();
        return linearScale(niceDomain(0, this.primaryMax(), 5), [a.bottom, a.top]);
    });

    private readonly ySecondary = computed(() => {
        const a = this.area();
        return linearScale([0, this.secondaryMax()], [a.bottom, a.top]);
    });

    readonly primaryTicks = computed(() => {
        const ys = this.yPrimary();
        return ys.ticks(5).map(v => ({ value: v, y: ys.scale(v) }));
    });

    readonly categoryCenters = computed(() => {
        const band = this.band();
        return this.categories().map(name => ({
            name,
            x: (band.position(name) ?? 0) + band.bandwidth / 2,
        }));
    });

    readonly bars = computed((): ComboBar[] => {
        const band = this.band();
        const yp = this.yPrimary();
        const a = this.area();
        const series = this.barSeries();
        const subWidth = band.bandwidth / Math.max(1, series.length);
        const result: ComboBar[] = [];
        this.categories().forEach((name, ci) => {
            const base = band.position(name) ?? 0;
            series.forEach((s, si) => {
                const value = s.data[ci]?.value ?? 0;
                const y = yp.scale(value);
                result.push({
                    key: `${s.name}-${name}`,
                    x: base + si * subWidth,
                    y,
                    width: subWidth,
                    height: Math.max(0, a.bottom - y),
                    color: getChartColor(si, s.color),
                });
            });
        });
        return result;
    });

    readonly lines = computed((): ComboLine[] => {
        const centers = this.categoryCenters();
        const ys = this.ySecondary();
        const explicit = this.lineSeries().map((s, i): ComboLine => {
            const points = s.data.map((d, ci) => ({ x: centers[ci]?.x ?? 0, y: ys.scale(d.value) }));
            return {
                key: s.id ?? s.name,
                name: s.name,
                color: getChartColor(this.barSeries().length + i, s.color),
                path: linePath(points, 'linear'),
            };
        });
        if (!this.showCumulative()) return explicit;
        const cumPoints = this.cumulativePercents().map((p, ci) => ({ x: centers[ci]?.x ?? 0, y: ys.scale(p) }));
        return [
            {
                key: '__cumulative__',
                name: this.cumulativeLabel(),
                color: getChartColor(this.barSeries().length + explicit.length),
                path: linePath(cumPoints, 'linear'),
            },
            ...explicit,
        ];
    });

    readonly legendItems = computed((): ChartLegendItem[] => [
        ...this.barSeries().map((s, i) => ({ key: s.name, label: s.name, color: getChartColor(i, s.color) })),
        ...this.lines().map(l => ({ key: l.key, label: l.name, color: l.color })),
    ]);

    readonly crosshairX = computed(() => {
        const i = this._hover();
        return i === null ? null : this.categoryCenters()[i]?.x ?? null;
    });

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const i = this._hover();
        if (i === null) return [];
        const rows: ChartTooltipRow[] = this.barSeries().map((s, si) => ({
            label: s.name,
            value: formatChartValue(s.data[i]?.value ?? 0),
            color: getChartColor(si, s.color),
        }));
        this.lineSeries().forEach((s, li) => {
            rows.push({
                label: s.name,
                value: formatChartValue(s.data[i]?.value ?? 0),
                color: getChartColor(this.barSeries().length + li, s.color),
            });
        });
        if (this.showCumulative()) {
            rows.push({
                label: this.cumulativeLabel(),
                value: `${(this.cumulativePercents()[i] ?? 0).toFixed(0)}%`,
                color: getChartColor(this.barSeries().length + this.lineSeries().length),
            });
        }
        return rows;
    });

    readonly hoverTitle = computed(() => {
        const i = this._hover();
        return i === null ? undefined : this.categories()[i];
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Selects a whole **category** by index — not a single bar — moving the
     * crosshair to its band centre, dimming the bars of every other category
     * and filling the tooltip. Pass `null` to clear. Does not move the tooltip
     * box: its position is only updated by {@link onPointerMove}.
     */
    setHover(index: number | null): void {
        this._hover.set(index);
    }

    /**
     * Tracks the pointer across the SVG and snaps to the category whose band
     * centre is nearest on the **x axis alone**, so the crosshair follows even
     * when the pointer is above the bars or off the plot vertically. The
     * tooltip is offset to the right of that centre and follows the pointer's
     * y. Bound to `mousemove`, `touchstart` and `touchmove` so touch devices
     * get the same read-out as mouse users.
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

    /** Clears the hovered category, hiding the crosshair and tooltip, when the pointer leaves the SVG. Bound to `mouseleave`. */
    onPointerLeave(): void {
        this.setHover(null);
    }

    /**
     * Emits {@link barClick} for the datum at `barSeries()[seriesIndex]
     * .data[pointIndex]`, silently doing nothing if the indices don't resolve.
     * The template always passes `0` as `seriesIndex` — see {@link barClick} —
     * so call this yourself to report a specific bar series.
     */
    onBarClick(seriesIndex: number, pointIndex: number): void {
        const data = this.barSeries()[seriesIndex]?.data[pointIndex];
        if (data) this.barClick.emit({ point: data, index: pointIndex });
    }
}
