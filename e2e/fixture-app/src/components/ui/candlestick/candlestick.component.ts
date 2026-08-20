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
import { cn, isRtl } from '@/components/lib/utils';
import { observeChartWidth } from '@/components/lib/chart-responsive';
import { ChartClickEvent, ChartDirection } from '@/components/lib/chart.types';
import { formatChartValue, getChartSummary } from '@/components/lib/chart.utils';
import { bandScale, linearScale, niceDomain, niceTimeTicks, timeScale } from '@/components/lib/chart-scale';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';
import { CandlestickAxisMode, OhlcPoint } from './candlestick.types';
import { formatPeriod, isRising, normalizeOhlc, ohlcExtent, toTimestamp } from './candlestick.utils';

/** A laid-out candle: its period plus every mark the template draws. */
export interface Candle {
    index: number;
    point: OhlcPoint;
    label: string;
    rising: boolean;
    color: string;
    /** Left edge of the body. */
    x: number;
    /** Top of the body — the higher of open/close. */
    y: number;
    width: number;
    /** Body height, floored at 1px so a doji still renders as a line. */
    height: number;
    /** Horizontal centre, where the wick is drawn. */
    centre: number;
    wickTop: number;
    wickBottom: number;
}

interface AxisTick {
    key: string;
    label: string;
    x: number;
}

interface Slot {
    centre: number;
    width: number;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 52;
const PAD_EDGE = 12;
const BAND_PADDING_INNER = 0.3;
const BAND_PADDING_OUTER = 0.15;
const TIME_SLOT_SHARE = 0.6;
const MIN_CANDLE_WIDTH = 1;
const MAX_CANDLE_WIDTH = 28;
const MIN_BODY_HEIGHT = 1;
const MAX_ORDINAL_TICKS = 8;

@Component({
    selector: 'ui-candlestick',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './candlestick.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class CandlestickComponent implements AfterViewInit {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    /**
     * One candle per OHLC period, drawn in array order — the series is **not**
     * sorted, so pass it chronologically. Rows whose four prices are not all
     * finite are dropped rather than rendered. On the default `'ordinal'` axis
     * a period's `date` may be a plain label string; on `'time'` it must be a
     * `Date`, epoch-ms number or parseable date string, and unplaceable rows
     * are dropped.
     */
    readonly points = input.required<OhlcPoint[]>();
    /**
     * `'ordinal'` (default) gives every period present in the data an equal
     * band, so weekends and holidays leave no blank space — what finance users
     * expect. `'time'` places candles on a real time scale, which is correct
     * for genuinely continuous data and does show those gaps.
     */
    readonly axisMode = input<CandlestickAxisMode>('ordinal');
    /**
     * Fallback width of the SVG user-space coordinate system, in px, used until
     * the host has been measured — from then on the `viewBox` tracks the host's
     * real width. The measurement needs a block-level box, which is why the
     * host is `class: 'block'` and the container `w-full`.
     */
    readonly width = input(500);
    /** Height of the SVG in px, applied literally. */
    readonly height = input(300);
    /** Draw the dashed horizontal gridline behind each price tick. The tick *labels* are drawn either way. */
    readonly showGrid = input(true);
    /** Show the shared tooltip listing open/high/low/close. Hover still emits {@link candleHover} when disabled. */
    readonly showTooltip = input(true);
    /** Colour of a candle that closed at or above its open. Any CSS colour, so a theme token such as `var(--chart-2)` works. */
    readonly risingColor = input('hsl(142, 71%, 45%)');
    /** Colour of a candle that closed below its open. Any CSS colour, so a theme token such as `var(--destructive)` works. */
    readonly fallingColor = input('hsl(0, 84%, 60%)');
    /** Suffix appended to every rendered price — tooltip, tick labels and aria-labels alike (e.g. `'$'`, `' USD'`). Written verbatim with no separating space. */
    readonly unit = input('');
    /** BCP-47 locale used to format `Date`/epoch-ms period labels. Ignored for label-string periods, which are printed verbatim. */
    readonly locale = input('en-US');
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the container's accessible summary ("<title>. Candlestick chart with N data points."). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction. `'auto'` (default) resolves from the host element's
     * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
     * reverses the period axis (the newest candle on the left) and moves the
     * price tick labels to the opposite edge. See {@link isRtl}.
     */
    readonly dir = input<ChartDirection>('auto');

    /** Emitted when a candle is clicked, or activated with Enter/Space while focused. `point` is the original {@link OhlcPoint}. */
    readonly candleClick = output<ChartClickEvent<OhlcPoint>>();
    /** Emitted with the period on hover/focus and with `null` on mouse-leave/blur, so consumers can mirror the highlight. */
    readonly candleHover = output<ChartClickEvent<OhlcPoint> | null>();

    private readonly _hover = signal<number | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    private readonly _domRtl = signal(false);

    readonly hoveredIndex = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-full', this.class()));
    readonly svgWidth = computed(() => this._measuredWidth() ?? this.width());
    readonly viewBox = computed(() => `0 0 ${this.svgWidth()} ${this.height()}`);
    readonly isTimeAxis = computed(() => this.axisMode() === 'time');

    readonly isRtl = computed(() => {
        const d = this.dir();
        if (d === 'rtl') return true;
        if (d === 'ltr') return false;
        return this._domRtl();
    });

    /**
     * The periods that survive validation for the active axis mode. Depends only
     * on {@link points} and {@link axisMode}, so a resize re-runs the layout
     * below without re-validating the series.
     */
    private readonly usable = computed((): OhlcPoint[] => {
        const clean = normalizeOhlc(this.points());
        if (!this.isTimeAxis()) return clean;
        return clean.filter(p => Number.isFinite(toTimestamp(p.date)));
    });

    /** True when no period survived validation, which is what the empty state renders on. */
    readonly isEmpty = computed(() => this.usable().length === 0);

    readonly ariaLabel = computed(() =>
        getChartSummary('Candlestick chart', this.usable().length, this.title()),
    );

    protected readonly area = computed(() => {
        const rtl = this.isRtl();
        return {
            left: rtl ? PAD_EDGE : PAD_AXIS,
            right: this.svgWidth() - (rtl ? PAD_AXIS : PAD_EDGE),
            top: PAD_TOP,
            bottom: this.height() - PAD_BOTTOM,
        };
    });

    private readonly priceDomain = computed((): [number, number] => {
        const extent = ohlcExtent(this.usable());
        if (!extent) return [0, 1];
        return niceDomain(extent[0], extent[1], 5);
    });

    private readonly priceScale = computed(() => {
        const a = this.area();
        return linearScale(this.priceDomain(), [a.bottom, a.top]);
    });

    readonly priceTicks = computed(() => {
        const ps = this.priceScale();
        return ps.ticks(5).map(value => ({ value, y: ps.scale(value) }));
    });

    private readonly timestamps = computed(() => this.usable().map(p => toTimestamp(p.date)));

    private readonly timeScaleFn = computed(() => {
        const a = this.area();
        const ts = this.timestamps();
        const lo = Math.min(...ts);
        const hi = Math.max(...ts);
        const range: [number, number] = this.isRtl() ? [a.right, a.left] : [a.left, a.right];
        return timeScale([lo, hi === lo ? lo + 1 : hi], range);
    });

    private readonly slots = computed((): Slot[] =>
        this.isTimeAxis() ? this.timeSlots() : this.ordinalSlots(),
    );

    readonly candles = computed((): Candle[] => {
        const ps = this.priceScale();
        const slots = this.slots();
        const rising = this.risingColor();
        const falling = this.fallingColor();
        const loc = this.locale();

        return this.usable().map((point, index) => {
            const slot = slots[index] ?? { centre: 0, width: MIN_CANDLE_WIDTH };
            const up = isRising(point);
            const bodyA = ps.scale(point.open);
            const bodyB = ps.scale(point.close);
            const wickA = ps.scale(point.high);
            const wickB = ps.scale(point.low);
            const top = Math.min(bodyA, bodyB);

            return {
                index,
                point,
                label: formatPeriod(point.date, loc),
                rising: up,
                color: up ? rising : falling,
                x: slot.centre - slot.width / 2,
                y: top,
                width: slot.width,
                height: Math.max(MIN_BODY_HEIGHT, Math.abs(bodyB - bodyA)),
                centre: slot.centre,
                wickTop: Math.min(wickA, wickB),
                wickBottom: Math.max(wickA, wickB),
            };
        });
    });

    readonly axisTicks = computed((): AxisTick[] =>
        this.isTimeAxis() ? this.timeAxisTicks() : this.ordinalAxisTicks(),
    );

    private readonly hoveredCandle = computed(() => {
        const i = this._hover();
        return i === null ? null : this.candles()[i] ?? null;
    });

    readonly tooltipTitle = computed(() => this.hoveredCandle()?.label);

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const candle = this.hoveredCandle();
        if (!candle) return [];
        const p = candle.point;
        return [
            { label: 'Open', value: this.formatPrice(p.open), color: candle.color },
            { label: 'High', value: this.formatPrice(p.high) },
            { label: 'Low', value: this.formatPrice(p.low) },
            { label: 'Close', value: this.formatPrice(p.close) },
        ];
    });

    ngAfterViewInit(): void {
        this._domRtl.set(isRtl(this.el.nativeElement));
    }

    /**
     * Marks the candle as active — dimming its siblings, parking the tooltip
     * beside it and emitting {@link candleHover}. Bound to `mouseenter`, `focus`
     * and `touchstart`, so keyboard and touch users get the same highlight — the
     * tooltip is the only place the O/H/L/C values appear.
     */
    onCandleHover(candle: Candle): void {
        this._hover.set(candle.index);
        this._tooltipPos.set({ x: candle.centre + 8, y: Math.max(8, candle.wickTop - 8) });
        this.candleHover.emit({ point: candle.point, index: candle.index });
    }

    /** Clears the active candle (hiding the tooltip) and emits `null` on {@link candleHover}. Bound to `mouseleave` and `blur`. */
    onCandleLeave(): void {
        this._hover.set(null);
        this.candleHover.emit(null);
    }

    /**
     * Emits {@link candleClick} for the activated candle. `event` is forwarded
     * only when it is a real `MouseEvent`; keyboard activation (Enter/Space)
     * leaves `event` undefined on the payload.
     */
    onCandleClick(event: Event, candle: Candle): void {
        this.candleClick.emit({
            point: candle.point,
            index: candle.index,
            event: event instanceof MouseEvent ? event : undefined,
        });
    }

    /** Accessible name for a candle, reading out the period and all four prices so the shape's meaning survives without sight. */
    getCandleAriaLabel(candle: Candle): string {
        const p = candle.point;
        return (
            `${candle.label}: open ${this.formatPrice(p.open)}, high ${this.formatPrice(p.high)}, ` +
            `low ${this.formatPrice(p.low)}, close ${this.formatPrice(p.close)}`
        );
    }

    /** Formats a price for the tooltip, tick labels and aria-labels, keeping up to two decimals and appending {@link unit}. */
    formatPrice(value: number): string {
        return formatChartValue(value, { decimals: 2 }) + this.unit();
    }

    private ordinalSlots(): Slot[] {
        const a = this.area();
        const keys = this.usable().map((_, i) => String(i));
        const ordered = this.isRtl() ? [...keys].reverse() : keys;
        const scale = bandScale(ordered, [a.left, a.right], BAND_PADDING_INNER, BAND_PADDING_OUTER);
        const bandwidth = Math.abs(scale.bandwidth);
        return keys.map(key => ({
            centre: (scale.position(key) ?? a.left) + bandwidth / 2,
            width: Math.max(MIN_CANDLE_WIDTH, Math.min(MAX_CANDLE_WIDTH, bandwidth)),
        }));
    }

    private timeSlots(): Slot[] {
        const a = this.area();
        const scale = this.timeScaleFn();
        const count = Math.max(1, this.usable().length);
        const span = Math.abs(a.right - a.left);
        const width = Math.max(
            MIN_CANDLE_WIDTH,
            Math.min(MAX_CANDLE_WIDTH, (span / count) * TIME_SLOT_SHARE),
        );
        return this.timestamps().map(ts => ({ centre: scale.scale(ts), width }));
    }

    private ordinalAxisTicks(): AxisTick[] {
        const candles = this.candles();
        const stride = Math.max(1, Math.ceil(candles.length / MAX_ORDINAL_TICKS));
        return candles
            .filter((_, i) => i % stride === 0)
            .map(c => ({ key: String(c.index), label: c.label, x: c.centre }));
    }

    private timeAxisTicks(): AxisTick[] {
        const ts = this.timestamps();
        const scale = this.timeScaleFn();
        const loc = this.locale();
        return niceTimeTicks(Math.min(...ts), Math.max(...ts), 5).map(t => ({
            key: String(t),
            label: formatPeriod(t, loc),
            x: scale.scale(t),
        }));
    }
}
