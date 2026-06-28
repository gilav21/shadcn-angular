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

    readonly series = input.required<ChartSeries[]>();
    readonly width = input(500);
    readonly height = input(300);
    readonly curve = input<CurveType>('linear');
    readonly showPoints = input(true);
    readonly showGrid = input(true);
    readonly showTooltip = input(true);
    readonly showLegend = input(true);
    readonly showCrosshair = input(true);
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

    readonly pointClick = output<ChartClickEvent>();
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

    toggleSeries(key: string): void {
        const hidden = this._hidden();
        this._hidden.set(
            hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key],
        );
    }

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

    onPointerLeave(): void {
        this.setHover(null);
    }

    onPointClick(seriesIndex: number, pointIndex: number): void {
        const data = this.series()[seriesIndex]?.data[pointIndex];
        if (data) this.pointClick.emit({ point: data, index: pointIndex });
    }
}
