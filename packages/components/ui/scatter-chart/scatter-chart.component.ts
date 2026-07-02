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

    readonly series = input.required<XYSeries[]>();
    readonly width = input(520);
    readonly height = input(320);
    readonly pointRadius = input(5);
    readonly showGrid = input(true);
    readonly showTooltip = input(true);
    readonly showLegend = input(true);
    readonly xAxisLabel = input('');
    readonly yAxisLabel = input('');
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

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

    toggleSeries(key: string): void {
        const hidden = this._hidden();
        this._hidden.set(
            hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key],
        );
    }

    setHover(seriesIndex: number | null, pointIndex = 0): void {
        this.hovered.set(seriesIndex === null ? null : { s: seriesIndex, p: pointIndex });
    }

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

    onPointerLeave(): void {
        this.hovered.set(null);
    }

    onPointClick(seriesIndex: number, pointIndex: number): void {
        const point = this.series()[seriesIndex]?.points[pointIndex];
        if (point) this.pointClick.emit({ point, index: pointIndex });
    }
}
