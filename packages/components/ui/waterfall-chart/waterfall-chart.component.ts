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

    readonly data = input.required<WaterfallBar[]>();
    readonly width = input(520);
    readonly height = input(320);
    readonly showConnectors = input(true);
    readonly showValues = input(false);
    readonly showTooltip = input(true);
    readonly positiveColor = input('hsl(142, 71%, 45%)');
    readonly negativeColor = input('hsl(0, 84%, 60%)');
    readonly totalColor = input('hsl(221, 83%, 53%)');
    readonly barRadius = input(2);
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

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

    setHover(index: number | null): void {
        this._hover.set(index);
    }

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

    onPointerLeave(): void {
        this.setHover(null);
    }

    onBarClick(index: number): void {
        const d = this.data()[index];
        if (d) this.barClick.emit({ point: { name: d.name, value: d.value }, index });
    }
}
