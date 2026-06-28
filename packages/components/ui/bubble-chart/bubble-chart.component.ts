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

    readonly series = input.required<XYZSeries[]>();
    readonly width = input(540);
    readonly height = input(340);
    readonly minRadius = input(6);
    readonly maxRadius = input(28);
    readonly showGrid = input(true);
    readonly showTooltip = input(true);
    readonly showLegend = input(true);
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

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

    onPointerLeave(): void {
        this.hovered.set(null);
    }

    onPointClick(seriesIndex: number, pointIndex: number): void {
        const point = this.series()[seriesIndex]?.points[pointIndex];
        if (point) this.pointClick.emit({ point, index: pointIndex });
    }
}
