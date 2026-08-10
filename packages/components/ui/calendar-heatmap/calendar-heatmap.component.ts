import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
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
    /**
     * One entry per day that has data. `date` must be a `YYYY-MM-DD` string —
     * it is split on `-` and read as **UTC**, so no timezone shifting occurs and
     * any other format (ISO datetime, `MM/DD/YYYY`, `Date`) will place the cell
     * wrong or not at all. Grid position is derived, not given: the row is the
     * UTC weekday (Sunday on top) and the column is the whole-week offset from
     * the Sunday on or before the earliest date in the array, so order within
     * the array is irrelevant and days you omit stay blank rather than being
     * filled in. `value` drives the colour ramp across the array's own min/max
     * (see {@link valueDomain}).
     */
    readonly data = input.required<CalendarDay[]>();
    /**
     * Edge of each square day cell, in px of SVG user space; cells are laid out
     * with a fixed 3px gap. This is a design size, not a responsive one — the
     * grid's intrinsic width grows with the number of weeks ({@link usedWidth})
     * and the whole SVG is then scaled down by `max-w-full` if the container is
     * narrower, so raising it makes a long range overflow-and-shrink sooner.
     */
    readonly cellSize = input(13);
    /**
     * Colour of the lowest value in {@link valueDomain}. Must be an
     * `hsl(h, s%, l%)` string — {@link sequentialColorScale} parses and
     * interpolates the H/S/L channels, so hex/rgb/`var(--…)` values will not
     * interpolate.
     */
    readonly fromColor = input('hsl(214, 95%, 92%)');
    /** Colour of the highest value in {@link valueDomain}; same `hsl(...)` requirement as {@link fromColor}. */
    readonly toColor = input('hsl(221, 83%, 38%)');
    /**
     * Intended fill for days with no data. Currently inert: only the days
     * present in {@link data} are drawn at all, so there is no empty cell to
     * paint — a gap shows the page background. Supply a zero-valued entry for
     * a day you want rendered.
     */
    readonly emptyColor = input('hsl(220, 13%, 91%)');
    /** Show the Less→More strip of five swatches under the grid, sampled at even steps across {@link valueDomain}. */
    readonly showLegend = input(true);
    /** Render the floating tooltip for the hovered/focused day. Hover still emits {@link dayHover} when disabled. */
    readonly showTooltip = input(true);
    /** Extra classes merged onto the container, which already carries `relative w-fit max-w-full mr-auto`. */
    readonly class = input('');
    /** Human-readable chart name; used only to prefix the group's accessible summary ({@link ariaLabel}). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Accepted for API parity with the cartesian charts, but the calendar does
     * not read it: weeks always run in the writing direction inherited from the
     * DOM. Wrap the host in `dir="rtl"` to flip it.
     */
    readonly dir = input<ChartDirection>('auto');

    /** Emits the day on hover/focus and `null` on mouse-leave/blur, so a consumer can mirror the highlight elsewhere. */
    readonly dayHover = output<CalendarDay | null>();

    private readonly _hover = signal<CalendarDay | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });

    readonly hovered = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-fit max-w-full mr-auto', this.class()));

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

    /**
     * Ramp colour for a value, interpolated between {@link fromColor} and
     * {@link toColor} across {@link valueDomain}; values outside the domain
     * clamp to the endpoints. Shared by the day fills, the legend swatches and
     * the tooltip dot so all three stay on one scale.
     */
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

    /** Intrinsic width of the drawn calendar (cells are fixed-size, not stretched). */
    readonly usedWidth = computed(() => LEFT_PAD + this.weekCount() * (this.cellSize() + GAP));

    readonly svgHeight = computed(() => TOP_PAD + 7 * (this.cellSize() + GAP));
    readonly viewBox = computed(() => `0 0 ${this.usedWidth()} ${this.svgHeight()}`);

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

    /**
     * Sets the active day and emits {@link dayHover}. `x`/`y` are the tooltip
     * anchor in **SVG user-space** units (the same coordinate system as
     * {@link viewBox}), not client pixels. Pass `null` to clear the highlight —
     * the position arguments are then irrelevant.
     */
    setHover(day: CalendarDay | null, x = 0, y = 0): void {
        this._hover.set(day);
        this._tooltipPos.set({ x, y });
        this.dayHover.emit(day);
    }

    /**
     * Highlights a day, anchoring the tooltip just past its trailing edge and
     * above it (kept at least 8 units inside the top edge). Bound to both
     * `mouseenter` and `focus` on the day rects, so keyboard tabbing gets the
     * same tooltip.
     */
    onCellEnter(placed: PlacedDay): void {
        this.setHover(placed.day, placed.x + placed.size, Math.max(8, placed.y - 8));
    }

    /** Clears the highlight and emits `null` on {@link dayHover}. Bound to `mouseleave` and `blur`. */
    onLeave(): void {
        this.setHover(null);
    }
}
