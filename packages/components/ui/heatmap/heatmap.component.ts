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

    /**
     * Flat list of `{ row, col, value }` cells — not a 2-D array. The axes are
     * derived from the data itself: {@link rows} and {@link cols} are the
     * distinct `row`/`col` strings in **first-appearance order**, never sorted,
     * so the array order is what controls the grid layout. A `(row, col)` pair
     * that is absent simply leaves a blank gap — cells are not back-filled.
     * `value` is mapped onto the {@link fromColor}→{@link toColor} ramp across
     * the data's own min/max (see {@link valueDomain}), so the colours are
     * relative to this chart, not to any absolute scale.
     */
    readonly data = input.required<HeatmapCell[]>();
    /**
     * Fallback width budget, in px, that {@link cellSize} is fitted into — used
     * only until the host element has actually been measured by
     * {@link observeChartWidth}, after which the measured width wins and the
     * grid re-fits on every resize. Measurement requires a block-level host
     * (the component sets `class: 'block'`); dropping it into an inline-block
     * parent yields a collapsed measurement and the grid falls back to this.
     */
    readonly width = input(480);
    /**
     * Upper bound on a cell's square edge, in px. Cells never stretch past it,
     * so a small grid in a wide container stays compact and start-aligned
     * instead of filling the box. Pair with {@link minCellSize}.
     */
    readonly maxCellSize = input(52);
    /**
     * Lower bound on a cell's square edge, in px. Once the fit hits this floor
     * the grid stops shrinking in user space and the whole SVG is scaled down
     * instead by its `max-w-full`, so a wide grid stays readable-ish rather
     * than collapsing to slivers.
     */
    readonly minCellSize = input(18);
    /**
     * Colour of the lowest value in {@link valueDomain}. Must be an
     * `hsl(h, s%, l%)` string — {@link sequentialColorScale} parses and
     * interpolates the H/S/L channels, so hex/rgb/`var(--…)` values will not
     * interpolate.
     */
    readonly fromColor = input('hsl(214, 95%, 93%)');
    /** Colour of the highest value in {@link valueDomain}; same `hsl(...)` requirement as {@link fromColor}. */
    readonly toColor = input('hsl(221, 83%, 40%)');
    /**
     * Print each cell's raw `value` in the middle of the cell. Unlike the
     * tooltip this is not run through `formatChartValue`, so long or
     * high-precision numbers will overflow small cells — round them yourself.
     */
    readonly showValues = input(false);
    /** Show the Low→High strip of five swatches under the grid, sampled at even steps across {@link valueDomain}. */
    readonly showLegend = input(true);
    /** Render the floating tooltip for the hovered/focused cell. Hover still emits {@link cellHover} when disabled. */
    readonly showTooltip = input(true);
    /** Extra classes merged onto the container, which already carries `relative w-fit max-w-full mr-auto`. */
    readonly class = input('');
    /** Human-readable chart name; used only to prefix the group's accessible summary ({@link ariaLabel}). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Accepted for API parity with the cartesian charts, but the grid does not
     * read it: row/column order comes from {@link data} and the labels follow
     * the ambient DOM direction. Wrap the host in `dir="rtl"` to flip it.
     */
    readonly dir = input<ChartDirection>('auto');

    /** Emits the cell on hover/focus and `null` on mouse-leave/blur, so a consumer can mirror the highlight elsewhere. */
    readonly cellHover = output<HeatmapCell | null>();

    private readonly _hover = signal<HeatmapCell | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });

    readonly hovered = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-fit max-w-full mr-auto', this.class()));
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

    /**
     * Ramp colour for a value, interpolated between {@link fromColor} and
     * {@link toColor} across {@link valueDomain}; values outside the domain
     * clamp to the endpoints. Shared by the cell fills, the legend swatches and
     * the tooltip dot so all three stay on one scale.
     */
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

    /**
     * Sets the active cell and emits {@link cellHover}. `x`/`y` are the tooltip
     * anchor in **SVG user-space** units (the same coordinate system as
     * {@link viewBox}), not client pixels. Pass `null` to clear the highlight —
     * the position arguments are then irrelevant.
     */
    setHover(cell: HeatmapCell | null, x = 0, y = 0): void {
        this._hover.set(cell);
        this._tooltipPos.set({ x, y });
        this.cellHover.emit(cell);
    }

    /**
     * Highlights a cell, anchoring the tooltip above its top-centre (kept at
     * least 8 units inside the top edge). Bound to both `mouseenter` and
     * `focus` on the cell rects, so keyboard tabbing gets the same tooltip.
     */
    onCellEnter(placed: PlacedCell): void {
        this.setHover(placed.cell, placed.x + placed.w / 2, Math.max(8, placed.y - 8));
    }

    /** Clears the highlight and emits `null` on {@link cellHover}. Bound to `mouseleave` and `blur`. */
    onLeave(): void {
        this.setHover(null);
    }
}
