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
import { HeatmapCell, ChartDirection } from '../../lib/chart.types';
import { formatChartValue } from '../../lib/chart.utils';
import { sequentialColorScale } from '../../lib/chart-scale';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';

interface PlacedCell {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    cell: HeatmapCell;
}

const ROW_LABEL_W = 48;
const COL_LABEL_H = 22;
const GAP = 2;

@Component({
    selector: 'ui-heatmap',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './heatmap.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class HeatmapComponent {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    readonly data = input.required<HeatmapCell[]>();
    readonly width = input(480);
    readonly maxCellSize = input(52);
    readonly minCellSize = input(18);
    readonly fromColor = input('hsl(214, 95%, 93%)');
    readonly toColor = input('hsl(221, 83%, 40%)');
    readonly showValues = input(false);
    readonly showLegend = input(true);
    readonly showTooltip = input(true);
    readonly class = input('');
    readonly title = input<string | undefined>(undefined);
    readonly dir = input<ChartDirection>('auto');

    readonly cellHover = output<HeatmapCell | null>();

    private readonly _hover = signal<HeatmapCell | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });

    readonly hovered = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-full', this.class()));
    readonly svgWidth = computed(() => this._measuredWidth() ?? this.width());

    private uniqueInOrder(pick: (c: HeatmapCell) => string): string[] {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const c of this.data()) {
            const key = pick(c);
            if (!seen.has(key)) {
                seen.add(key);
                out.push(key);
            }
        }
        return out;
    }

    readonly rows = computed(() => this.uniqueInOrder(c => c.row));
    readonly cols = computed(() => this.uniqueInOrder(c => c.col));

    readonly valueDomain = computed<[number, number]>(() => {
        const values = this.data().map(c => c.value);
        if (values.length === 0) return [0, 1];
        return [Math.min(...values), Math.max(...values)];
    });

    private readonly colorScale = computed(() =>
        sequentialColorScale(this.valueDomain(), [this.fromColor(), this.toColor()]),
    );

    colorFor(value: number): string {
        return this.colorScale()(value);
    }

    /** Square cell size: fills the available width up to maxCellSize, shrinks to minCellSize. */
    readonly cellSize = computed(() => {
        const cols = this.cols().length;
        if (cols === 0) return this.maxCellSize();
        const ideal = (this.svgWidth() - ROW_LABEL_W - GAP * cols) / cols;
        return Math.max(this.minCellSize(), Math.min(this.maxCellSize(), ideal));
    });

    /** Intrinsic width of the drawn grid (cells are square, not stretched). */
    readonly usedWidth = computed(() =>
        ROW_LABEL_W + this.cols().length * (this.cellSize() + GAP),
    );

    readonly svgHeight = computed(() => COL_LABEL_H + this.rows().length * (this.cellSize() + GAP));
    readonly viewBox = computed(() => `0 0 ${this.usedWidth()} ${this.svgHeight()}`);

    readonly colLabels = computed(() => {
        const size = this.cellSize();
        return this.cols().map((col, ci) => ({
            col,
            x: ROW_LABEL_W + ci * (size + GAP) + size / 2,
        }));
    });

    readonly rowLabels = computed(() => {
        const size = this.cellSize();
        return this.rows().map((row, ri) => ({
            row,
            y: COL_LABEL_H + ri * (size + GAP) + size / 2,
        }));
    });

    readonly placedCells = computed((): PlacedCell[] => {
        const size = this.cellSize();
        const rowIndex = new Map(this.rows().map((r, i) => [r, i]));
        const colIndex = new Map(this.cols().map((c, i) => [c, i]));
        return this.data().map(cell => ({
            x: ROW_LABEL_W + (colIndex.get(cell.col) ?? 0) * (size + GAP),
            y: COL_LABEL_H + (rowIndex.get(cell.row) ?? 0) * (size + GAP),
            w: size,
            h: size,
            color: this.colorFor(cell.value),
            cell,
        }));
    });

    readonly legendStops = computed(() => {
        const [min, max] = this.valueDomain();
        const steps = 5;
        return Array.from({ length: steps }, (_, i) => {
            const value = min + ((max - min) * i) / (steps - 1);
            return { value, color: this.colorFor(value) };
        });
    });

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const c = this._hover();
        if (!c) return [];
        return [{ label: c.col, value: formatChartValue(c.value), color: this.colorFor(c.value) }];
    });

    readonly hoverTitle = computed(() => {
        const c = this._hover();
        return c ? `${c.row} · ${c.col}` : undefined;
    });

    readonly ariaLabel = computed(() => {
        const base = this.title() ? `${this.title()}. ` : '';
        return `${base}Heatmap with ${this.rows().length} rows and ${this.cols().length} columns.`;
    });

    setHover(cell: HeatmapCell | null, x = 0, y = 0): void {
        this._hover.set(cell);
        this._tooltipPos.set({ x, y });
        this.cellHover.emit(cell);
    }

    onCellEnter(placed: PlacedCell): void {
        this.setHover(placed.cell, placed.x + placed.w / 2, Math.max(8, placed.y - 8));
    }

    onLeave(): void {
        this.setHover(null);
    }
}
