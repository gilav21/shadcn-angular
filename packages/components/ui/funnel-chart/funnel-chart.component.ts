import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    DestroyRef,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import { ChartDataPoint, ChartClickEvent, ChartDirection } from '../../lib/chart.types';
import { getChartColor, formatChartValue, formatPercentage, getChartSummary } from '../../lib/chart.utils';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';

type PercentageMode = 'first' | 'previous';

interface FunnelStage {
    index: number;
    name: string;
    value: number;
    percent: number;
    color: string;
    points: string;
    topWidth: number;
    centerX: number;
    midY: number;
}

const PAD = 8;

@Component({
    selector: 'ui-funnel-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './funnel-chart.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class FunnelChartComponent {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    readonly data = input.required<ChartDataPoint[]>();
    readonly width = input(440);
    readonly height = input(300);
    readonly percentageMode = input<PercentageMode>('first');
    readonly gap = input(2);
    readonly showValues = input(true);
    readonly showTooltip = input(true);
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

    readonly stageClick = output<ChartClickEvent>();

    private readonly _hover = signal<number | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    readonly hovered = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-full', this.class()));
    readonly svgWidth = computed(() => this._measuredWidth() ?? this.width());
    readonly viewBox = computed(() => `0 0 ${this.svgWidth()} ${this.height()}`);

    readonly ariaLabel = computed(() =>
        getChartSummary('Funnel chart', this.data().length, this.title()),
    );

    private readonly maxValue = computed(() => {
        const values = this.data().map(d => d.value);
        return values.length ? Math.max(...values) : 1;
    });

    private percentFor(index: number): number {
        const data = this.data();
        if (index === 0) return 100;
        const ref = this.percentageMode() === 'first' ? data[0].value : data[index - 1].value;
        return ref === 0 ? 0 : (data[index].value / ref) * 100;
    }

    readonly stages = computed((): FunnelStage[] => {
        const data = this.data();
        const n = data.length;
        if (n === 0) return [];
        const max = this.maxValue();
        const innerW = this.svgWidth() - PAD * 2;
        const centerX = this.svgWidth() / 2;
        const gap = this.gap();
        const stageH = (this.height() - PAD * 2 - gap * (n - 1)) / n;

        return data.map((d, i) => {
            const topWidth = (d.value / max) * innerW;
            const nextValue = i < n - 1 ? data[i + 1].value : d.value;
            const bottomWidth = (nextValue / max) * innerW;
            const yTop = PAD + i * (stageH + gap);
            const yBottom = yTop + stageH;
            const points = [
                `${centerX - topWidth / 2},${yTop}`,
                `${centerX + topWidth / 2},${yTop}`,
                `${centerX + bottomWidth / 2},${yBottom}`,
                `${centerX - bottomWidth / 2},${yBottom}`,
            ].join(' ');
            return {
                index: i,
                name: d.name,
                value: d.value,
                percent: this.percentFor(i),
                color: getChartColor(i, d.color),
                points,
                topWidth,
                centerX,
                midY: yTop + stageH / 2,
            };
        });
    });

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const i = this._hover();
        if (i === null) return [];
        const d = this.data()[i];
        if (!d) return [];
        return [
            { label: 'Value', value: formatChartValue(d.value), color: getChartColor(i, d.color) },
            { label: 'Share', value: formatPercentage(this.percentFor(i)) },
        ];
    });

    readonly hoverTitle = computed(() => {
        const i = this._hover();
        return i === null ? undefined : this.data()[i]?.name;
    });

    formatPercent(value: number): string {
        return formatPercentage(value);
    }

    setHover(index: number | null, x = 0, y = 0): void {
        this._hover.set(index);
        this._tooltipPos.set({ x, y });
    }

    onStageEnter(stage: FunnelStage): void {
        this.setHover(stage.index, stage.centerX, Math.max(8, stage.midY - 8));
    }

    onLeave(): void {
        this.setHover(null);
    }

    onStageClick(index: number): void {
        const d = this.data()[index];
        if (d) this.stageClick.emit({ point: d, index });
    }
}
