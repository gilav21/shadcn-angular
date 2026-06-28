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
import { CalendarDay, ChartDirection } from '../../lib/chart.types';
import { formatChartValue } from '../../lib/chart.utils';
import { sequentialColorScale } from '../../lib/chart-scale';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';

interface PlacedDay {
    x: number;
    y: number;
    size: number;
    color: string;
    day: CalendarDay;
}

const DAY_MS = 86_400_000;
const LEFT_PAD = 26;
const TOP_PAD = 16;
const GAP = 3;

function parseYmd(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
}

function weekdayOf(ms: number): number {
    return new Date(ms).getUTCDay();
}

@Component({
    selector: 'ui-calendar-heatmap',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './calendar-heatmap.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class CalendarHeatmapComponent {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    readonly data = input.required<CalendarDay[]>();
    readonly cellSize = input(13);
    readonly fromColor = input('hsl(214, 95%, 92%)');
    readonly toColor = input('hsl(221, 83%, 38%)');
    readonly emptyColor = input('hsl(220, 13%, 91%)');
    readonly showLegend = input(true);
    readonly showTooltip = input(true);
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

    readonly dayHover = output<CalendarDay | null>();

    private readonly _hover = signal<CalendarDay | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });

    readonly hovered = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-full', this.class()));

    private readonly originSunday = computed(() => {
        const times = this.data().map(d => parseYmd(d.date));
        if (times.length === 0) return 0;
        const first = Math.min(...times);
        return first - weekdayOf(first) * DAY_MS;
    });

    readonly valueDomain = computed<[number, number]>(() => {
        const values = this.data().map(d => d.value);
        if (values.length === 0) return [0, 1];
        return [Math.min(...values), Math.max(...values)];
    });

    private readonly colorScale = computed(() =>
        sequentialColorScale(this.valueDomain(), [this.fromColor(), this.toColor()]),
    );

    colorFor(value: number): string {
        return this.colorScale()(value);
    }

    readonly cells = computed((): PlacedDay[] => {
        const origin = this.originSunday();
        const step = this.cellSize() + GAP;
        return this.data().map(day => {
            const ms = parseYmd(day.date);
            const col = Math.floor((ms - origin) / (7 * DAY_MS));
            const row = weekdayOf(ms);
            return {
                x: LEFT_PAD + col * step,
                y: TOP_PAD + row * step,
                size: this.cellSize(),
                color: this.colorFor(day.value),
                day,
            };
        });
    });

    readonly weekCount = computed(() => {
        const xs = this.cells().map(c => c.x);
        return xs.length === 0 ? 0 : (Math.max(...xs) - LEFT_PAD) / (this.cellSize() + GAP) + 1;
    });

    readonly svgWidth = computed(() => {
        const measured = this._measuredWidth();
        const intrinsic = LEFT_PAD + this.weekCount() * (this.cellSize() + GAP);
        return measured ?? intrinsic;
    });

    readonly svgHeight = computed(() => TOP_PAD + 7 * (this.cellSize() + GAP));
    readonly viewBox = computed(() =>
        `0 0 ${LEFT_PAD + this.weekCount() * (this.cellSize() + GAP)} ${this.svgHeight()}`,
    );

    readonly weekdayLabels = computed(() => {
        const step = this.cellSize() + GAP;
        return [
            { label: 'Mon', y: TOP_PAD + 1 * step + this.cellSize() / 2 },
            { label: 'Wed', y: TOP_PAD + 3 * step + this.cellSize() / 2 },
            { label: 'Fri', y: TOP_PAD + 5 * step + this.cellSize() / 2 },
        ];
    });

    readonly legendStops = computed(() => {
        const [min, max] = this.valueDomain();
        return Array.from({ length: 5 }, (_, i) => this.colorFor(min + ((max - min) * i) / 4));
    });

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const d = this._hover();
        if (!d) return [];
        return [{ label: 'Count', value: formatChartValue(d.value), color: this.colorFor(d.value) }];
    });

    readonly hoverTitle = computed(() => this._hover()?.date);

    readonly ariaLabel = computed(() => {
        const base = this.title() ? `${this.title()}. ` : '';
        return `${base}Calendar heatmap with ${this.data().length} days.`;
    });

    setHover(day: CalendarDay | null, x = 0, y = 0): void {
        this._hover.set(day);
        this._tooltipPos.set({ x, y });
        this.dayHover.emit(day);
    }

    onCellEnter(placed: PlacedDay): void {
        this.setHover(placed.day, placed.x + placed.size, Math.max(8, placed.y - 8));
    }

    onLeave(): void {
        this.setHover(null);
    }
}
