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
import { ChartClickEvent, ChartDirection, ChartOrientation } from '../../lib/chart.types';
import {
    getChartColor,
    formatChartValue,
    getChartSummary,
} from '../../lib/chart.utils';
import { bandScale, linearScale, niceDomain } from '../../lib/chart-scale';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';
import { BoxplotGroup, BoxplotStats } from './boxplot.types';
import { resolveGroupStats } from './boxplot.utils';

/** A straight SVG segment, in user-space coordinates. */
export interface BoxplotLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/** One rendered outlier: its value and where the dot sits. */
export interface BoxplotOutlierPoint {
    value: number;
    cx: number;
    cy: number;
}

/** A laid-out box: its group and summary plus every mark the template draws. */
export interface BoxplotBox {
    index: number;
    group: BoxplotGroup;
    stats: BoxplotStats;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    medianLine: BoxplotLine;
    whiskerLine: BoxplotLine;
    minCap: BoxplotLine;
    maxCap: BoxplotLine;
    labelX: number;
    labelY: number;
    labelAnchor: 'middle' | 'start' | 'end';
    outliers: BoxplotOutlierPoint[];
}

interface ValueTick {
    value: number;
    line: BoxplotLine;
    labelX: number;
    labelY: number;
    anchor: 'start' | 'end' | 'middle';
}

interface ResolvedGroup {
    group: BoxplotGroup;
    stats: BoxplotStats;
    sourceIndex: number;
}

const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PAD_AXIS = 48;
const PAD_EDGE = 16;
const BAND_PADDING_INNER = 0.4;
const BAND_PADDING_OUTER = 0.2;
const CAP_FRACTION = 0.5;
const MIN_EXTENT = 1;

@Component({
    selector: 'ui-boxplot',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './boxplot.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class BoxplotComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    /**
     * One box per entry, drawn in array order. Each group supplies **either** a
     * raw `values` sample — summarised here — **or** a pre-computed `stats`,
     * which wins when both are present; the two paths lay out identically.
     * Groups carrying neither (or an empty `values`) are skipped rather than
     * drawn as a degenerate box, so a chart whose groups are all unusable falls
     * back to the empty state.
     */
    readonly groups = input.required<BoxplotGroup[]>();
    /**
     * `'vertical'` (default) runs the category axis across the width and the
     * value axis up the height; `'horizontal'` transposes both, which reads
     * better for long category labels.
     */
    readonly orientation = input<ChartOrientation>('vertical');
    /**
     * Fallback width of the SVG user-space coordinate system, in px, used until
     * the host has been measured — from then on the `viewBox` tracks the host's
     * real width. The measurement needs a block-level box, which is why the
     * host is `class: 'block'` and the container `w-full`.
     */
    readonly width = input(500);
    /** Height of the SVG in px, applied literally. */
    readonly height = input(300);
    /** Draw the dashed gridline behind each value tick. The tick *labels* are drawn either way. */
    readonly showGrid = input(true);
    /** Draw the samples beyond the 1.5×IQR fences as individual focusable points. The whiskers are unaffected — they always stop at the fence. */
    readonly showOutliers = input(true);
    /** Show the shared tooltip listing the five-number summary. Hover still emits {@link groupHover} when disabled. */
    readonly showTooltip = input(true);
    /** Corner rounding of each box rect, in px (SVG `rx`). Use `0` for square corners. */
    readonly boxRadius = input(2);
    /** Suffix appended to every rendered number — tooltip, tick labels and aria-labels alike (e.g. `'ms'`, `'°C'`). Written verbatim with no separating space. */
    readonly unit = input('');
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the container's accessible summary ("<title>. Box plot with N data points."). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction. `'auto'` (default) resolves from the host element's
     * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
     * mirrors the *category* axis — the first group on the right in vertical
     * orientation, the value axis right-to-left in horizontal. See {@link isRtl}.
     */
    readonly dir = input<ChartDirection>('auto');

    /** Emitted when a box is clicked, or activated with Enter/Space while focused. `point` is the original {@link BoxplotGroup}. */
    readonly groupClick = output<ChartClickEvent<BoxplotGroup>>();
    /** Emitted with the group on hover/focus and with `null` on mouse-leave/blur, so consumers can mirror the highlight. */
    readonly groupHover = output<ChartClickEvent<BoxplotGroup> | null>();

    private readonly _hover = signal<number | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    private readonly _domRtl = signal(false);

    readonly hoveredIndex = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-full', this.class()));
    readonly svgWidth = computed(() => this._measuredWidth() ?? this.width());
    readonly viewBox = computed(() => `0 0 ${this.svgWidth()} ${this.height()}`);
    readonly isVertical = computed(() => this.orientation() === 'vertical');

    readonly isRtl = computed(() => {
        const d = this.dir();
        if (d === 'rtl') return true;
        if (d === 'ltr') return false;
        return this._domRtl();
    });

    /**
     * The groups that produced a usable summary, in source order. Depends only
     * on {@link groups}, so a resize re-runs the layout below without ever
     * re-computing a quartile.
     */
    private readonly resolved = computed((): ResolvedGroup[] =>
        this.groups()
            .map((group, sourceIndex) => ({ group, stats: resolveGroupStats(group), sourceIndex }))
            .filter((r): r is ResolvedGroup => r.stats !== null),
    );

    /** True when no group produced a usable summary, which is what the empty state renders on. */
    readonly isEmpty = computed(() => this.resolved().length === 0);

    readonly ariaLabel = computed(() =>
        getChartSummary('Box plot', this.resolved().length, this.title()),
    );

    protected readonly area = computed(() => {
        const rtl = this.isRtl();
        const vertical = this.isVertical();
        const axisLeft = vertical ? PAD_AXIS : PAD_AXIS + 24;
        return {
            left: rtl ? PAD_EDGE : axisLeft,
            right: this.svgWidth() - (rtl ? axisLeft : PAD_EDGE),
            top: PAD_TOP,
            bottom: this.height() - PAD_BOTTOM,
        };
    });

    private readonly valueDomain = computed((): [number, number] => {
        const all = this.resolved().flatMap(({ stats }) => [
            stats.min,
            stats.max,
            stats.q1,
            stats.q3,
            ...stats.outliers,
        ]);
        if (all.length === 0) return [0, 1];
        return niceDomain(Math.min(...all), Math.max(...all), 5);
    });

    private readonly valueScale = computed(() => {
        const a = this.area();
        if (this.isVertical()) return linearScale(this.valueDomain(), [a.bottom, a.top]);
        const range: [number, number] = this.isRtl() ? [a.right, a.left] : [a.left, a.right];
        return linearScale(this.valueDomain(), range);
    });

    private readonly categoryScale = computed(() => {
        const a = this.area();
        const keys = this.resolved().map((_, i) => String(i));
        const vertical = this.isVertical();
        const ordered = vertical && this.isRtl() ? [...keys].reverse() : keys;
        const range: [number, number] = vertical ? [a.left, a.right] : [a.top, a.bottom];
        return bandScale(ordered, range, BAND_PADDING_INNER, BAND_PADDING_OUTER);
    });

    /** Thickness of one box across the category axis — its width when vertical, its height when horizontal. */
    readonly bandwidth = computed(() => Math.abs(this.categoryScale().bandwidth));

    readonly valueTicks = computed((): ValueTick[] => {
        const scale = this.valueScale();
        const a = this.area();
        const rtl = this.isRtl();
        return scale.ticks(5).map(value => this.buildTick(value, scale.scale(value), a, rtl));
    });

    readonly boxes = computed((): BoxplotBox[] => {
        const cs = this.categoryScale();
        const band = this.bandwidth();
        const layout = this.isVertical()
            ? (r: ResolvedGroup, i: number, start: number) => this.layoutVertical(r, i, start, band)
            : (r: ResolvedGroup, i: number, start: number) => this.layoutHorizontal(r, i, start, band);

        return this.resolved().map((r, i) => layout(r, i, cs.position(String(i)) ?? 0));
    });

    private readonly hoveredBox = computed(() => {
        const i = this._hover();
        return i === null ? null : this.boxes()[i] ?? null;
    });

    readonly tooltipTitle = computed(() => this.hoveredBox()?.group.label);

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const box = this.hoveredBox();
        if (!box) return [];
        const s = box.stats;
        return [
            { label: 'Max', value: this.formatValue(s.max), color: box.color },
            { label: 'Q3', value: this.formatValue(s.q3) },
            { label: 'Median', value: this.formatValue(s.median) },
            { label: 'Q1', value: this.formatValue(s.q1) },
            { label: 'Min', value: this.formatValue(s.min) },
        ];
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Marks the box as active — dimming its siblings, parking the tooltip beside
     * it and emitting {@link groupHover}. Bound to both `mouseenter` and `focus`
     * so keyboard users get the same highlight.
     */
    onBoxHover(box: BoxplotBox): void {
        this._hover.set(box.index);
        this._tooltipPos.set({
            x: box.x + box.width / 2 + 8,
            y: Math.max(8, box.y - 8),
        });
        this.groupHover.emit({ point: box.group, index: box.index });
    }

    /** Clears the active box (hiding the tooltip) and emits `null` on {@link groupHover}. Bound to `mouseleave` and `blur`. */
    onBoxLeave(): void {
        this._hover.set(null);
        this.groupHover.emit(null);
    }

    /**
     * Emits {@link groupClick} for the activated box. `event` is forwarded only
     * when it is a real `MouseEvent`; keyboard activation (Enter/Space) leaves
     * `event` undefined on the payload.
     */
    onBoxClick(event: Event, box: BoxplotBox): void {
        this.groupClick.emit({
            point: box.group,
            index: box.index,
            event: event instanceof MouseEvent ? event : undefined,
        });
    }

    /** Accessible name for a box, reading out the whole five-number summary so a screen-reader user gets what the shape conveys visually. */
    getBoxAriaLabel(box: BoxplotBox): string {
        const s = box.stats;
        return (
            `${box.group.label}: median ${this.formatValue(s.median)}, ` +
            `Q1 ${this.formatValue(s.q1)}, Q3 ${this.formatValue(s.q3)}, ` +
            `min ${this.formatValue(s.min)}, max ${this.formatValue(s.max)}`
        );
    }

    /** Accessible name for an outlier dot, naming its group so the point is not announced bare. */
    getOutlierAriaLabel(box: BoxplotBox, point: BoxplotOutlierPoint): string {
        return `${box.group.label}: outlier ${this.formatValue(point.value)}`;
    }

    /** Formats a summary value or an axis tick, keeping up to two decimals and appending {@link unit}. */
    formatValue(value: number): string {
        return formatChartValue(value, { decimals: 2 }) + this.unit();
    }

    private buildTick(
        value: number,
        at: number,
        a: { left: number; right: number; top: number; bottom: number },
        rtl: boolean,
    ): ValueTick {
        if (this.isVertical()) {
            return {
                value,
                line: { x1: a.left, x2: a.right, y1: at, y2: at },
                labelX: rtl ? a.right + 8 : a.left - 8,
                labelY: at + 3,
                anchor: rtl ? 'start' : 'end',
            };
        }
        return {
            value,
            line: { x1: at, x2: at, y1: a.top, y2: a.bottom },
            labelX: at,
            labelY: a.bottom + 14,
            anchor: 'middle',
        };
    }

    private layoutVertical(
        { group, stats, sourceIndex }: ResolvedGroup,
        index: number,
        bandStart: number,
        band: number,
    ): BoxplotBox {
        const vs = this.valueScale();
        const vQ1 = vs.scale(stats.q1);
        const vQ3 = vs.scale(stats.q3);
        const vMedian = vs.scale(stats.median);
        const vMin = vs.scale(stats.min);
        const vMax = vs.scale(stats.max);
        const centre = bandStart + band / 2;
        const capHalf = (band * CAP_FRACTION) / 2;

        return {
            index,
            group,
            stats,
            color: getChartColor(sourceIndex, group.color),
            x: bandStart,
            y: Math.min(vQ1, vQ3),
            width: band,
            height: Math.max(MIN_EXTENT, Math.abs(vQ1 - vQ3)),
            medianLine: { x1: bandStart, x2: bandStart + band, y1: vMedian, y2: vMedian },
            whiskerLine: { x1: centre, x2: centre, y1: Math.min(vMin, vMax), y2: Math.max(vMin, vMax) },
            minCap: { x1: centre - capHalf, x2: centre + capHalf, y1: vMin, y2: vMin },
            maxCap: { x1: centre - capHalf, x2: centre + capHalf, y1: vMax, y2: vMax },
            labelX: centre,
            labelY: this.height() - 10,
            labelAnchor: 'middle',
            outliers: stats.outliers.map(value => ({ value, cx: centre, cy: vs.scale(value) })),
        };
    }

    private layoutHorizontal(
        { group, stats, sourceIndex }: ResolvedGroup,
        index: number,
        bandStart: number,
        band: number,
    ): BoxplotBox {
        const vs = this.valueScale();
        const vQ1 = vs.scale(stats.q1);
        const vQ3 = vs.scale(stats.q3);
        const vMedian = vs.scale(stats.median);
        const vMin = vs.scale(stats.min);
        const vMax = vs.scale(stats.max);
        const centre = bandStart + band / 2;
        const capHalf = (band * CAP_FRACTION) / 2;
        const a = this.area();

        return {
            index,
            group,
            stats,
            color: getChartColor(sourceIndex, group.color),
            x: Math.min(vQ1, vQ3),
            y: bandStart,
            width: Math.max(MIN_EXTENT, Math.abs(vQ3 - vQ1)),
            height: band,
            medianLine: { x1: vMedian, x2: vMedian, y1: bandStart, y2: bandStart + band },
            whiskerLine: { x1: Math.min(vMin, vMax), x2: Math.max(vMin, vMax), y1: centre, y2: centre },
            minCap: { x1: vMin, x2: vMin, y1: centre - capHalf, y2: centre + capHalf },
            maxCap: { x1: vMax, x2: vMax, y1: centre - capHalf, y2: centre + capHalf },
            labelX: this.isRtl() ? a.right + 8 : a.left - 8,
            labelY: centre + 3,
            labelAnchor: this.isRtl() ? 'start' : 'end',
            outliers: stats.outliers.map(value => ({ value, cx: vs.scale(value), cy: centre })),
        };
    }
}
