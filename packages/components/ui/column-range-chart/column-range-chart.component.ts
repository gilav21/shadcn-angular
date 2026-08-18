import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  ElementRef,
  AfterViewInit,
  DestroyRef,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import { RangeDataPoint, ChartClickEvent, ChartDirection } from '../../lib/chart.types';
import {
  getChartColor,
  formatChartValue,
  getChartSummary,
  calculateAxisTicks,
} from '../../lib/chart.utils';

interface RangeBar {
  index: number;
  data: RangeDataPoint;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  lowY: number;
  highY: number;
}

@Component({
  selector: 'ui-column-range-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './column-range-chart.component.html',
  host: {
    class: 'block',
  },
})
export class ColumnRangeChartComponent implements AfterViewInit {
  /**
   * Layout direction. `'auto'` (default) resolves from the host element's
   * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
   * mirrors the column order (first entry on the right) and swaps the axis
   * gutter to the right-hand side. See {@link isRtl}.
   */
  dir = input<ChartDirection>('auto');
  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

  private readonly _domRtl = signal(false);

  isRtl = computed(() => {
    const d = this.dir();
    if (d === 'rtl') return true;
    if (d === 'ltr') return false;
    return this._domRtl();
  });

  ngAfterViewInit(): void {
    this._checkDirection();
    setTimeout(() => this._checkDirection(), 0);
  }

  private _checkDirection(): void {
    this._domRtl.set(isRtl(this.el.nativeElement));
  }

  /**
   * One floating column per entry, drawn in array order (right-to-left when
   * {@link isRtl} resolves true). Each {@link RangeDataPoint} spans `low` to
   * `high` rather than starting at zero — temperature bands, min/max ranges,
   * confidence intervals — so the value axis is derived from both ends and need
   * not include 0 (see {@link dataRange}). `name` is the category label under
   * the axis and the optional `color` overrides the palette colour picked from
   * the entry's index. A `low` above its `high` inverts the bar's height; it is
   * clamped to 1px rather than flipped, so pass the ends the right way round.
   */
  data = input.required<RangeDataPoint[]>();
  /**
   * Design width of the SVG user-space coordinate system, in px, and the
   * fallback until the host element has been measured. The rendered SVG is
   * `width="100%"` with this as its `max-width`, so the chart scales down
   * inside narrow containers but never past this width. The host must be a
   * block-level box — an inline-block parent collapses a `width:100%` SVG,
   * which is why the container carries `w-full` and the host `class: 'block'`.
   */
  width = input(500);
  /**
   * Design height of the SVG coordinate system, in px. Combined with the
   * measured width it fixes the `aspect-ratio`, so the chart keeps its
   * proportions while scaling — height is never measured from the DOM.
   */
  height = input(300);
  /** Draw the dashed value-axis gridlines behind the columns, one per {@link axisTicks} entry. */
  showGrid = input(true);
  /**
   * Print the formatted `high` above each column and its `low` below (see
   * {@link formatValue}). Turn it off for dense series where the two labels
   * collide; the values stay reachable via the hover tooltip and the
   * aria-label.
   */
  showRangeLabels = input(true);
  /** Corner rounding of each column rect, in px (SVG `rx`). Use `0` for square corners. */
  barRadius = input(4);
  /**
   * Gap between adjacent columns, in px of user space. Column width is whatever
   * is left of the plot area after the gaps, so raising this on a dense series
   * narrows the columns rather than widening the chart.
   */
  barGap = input(12);
  /** Extra classes merged onto the chart container, which already carries `relative block w-full`. */
  class = input('');
  /** Human-readable chart name, used only to prefix the SVG's accessible summary (see {@link chartAriaLabel}). */
  title = input<string | undefined>(undefined);
  /**
   * Suffix appended to every rendered number — range labels, axis ticks,
   * tooltip and aria-labels alike (e.g. `'°C'`, `'%'`, `' mm'`). Written
   * verbatim with no separating space, so include one yourself if the unit
   * needs it. See {@link formatValue} and {@link formatAxisValue}.
   */
  unit = input('');

  /** Emitted when a column is clicked, or activated with Enter/Space while focused. The payload's `point` is the original {@link RangeDataPoint}, low and high included. */
  barClick = output<ChartClickEvent<RangeDataPoint>>();

  hoveredIndex = signal<number | null>(null);
  tooltipPosition = signal({ x: 0, y: 0 });

  svgWidth = computed(() => this._measuredWidth() ?? this.width());
  svgHeight = computed(() => this.height());

  padding = computed(() => ({
    top: 30,
    right: this.isRtl() ? 70 : 20,
    bottom: 35,
    left: this.isRtl() ? 20 : 70,
  }));

  chartArea = computed(() => {
    const p = this.padding();
    return {
      left: p.left,
      right: this.svgWidth() - p.right,
      top: p.top,
      bottom: this.svgHeight() - p.bottom,
      width: this.svgWidth() - p.left - p.right,
      height: this.svgHeight() - p.top - p.bottom,
    };
  });

  dataRange = computed(() => {
    const data = this.data();
    if (data.length === 0) return { min: 0, max: 100 };

    const lows = data.map(d => d.low);
    const highs = data.map(d => d.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.1;

    return { min: min - padding, max: max + padding };
  });

  axisTicks = computed(() => {
    const range = this.dataRange();
    return calculateAxisTicks(range.min, range.max, 5);
  });

  bars = computed((): RangeBar[] => {
    const data = this.data();
    if (data.length === 0) return [];

    const area = this.chartArea();
    const range = this.dataRange();
    const gap = this.barGap();
    const barCount = data.length;
    const totalGaps = (barCount - 1) * gap;
    const barWidth = (area.width - totalGaps) / barCount;

    const span = range.max - range.min;

    return data.map((point, index) => {
      const normalizedLow = span > 0 ? (point.low - range.min) / span : 0;
      const normalizedHigh = span > 0 ? (point.high - range.min) / span : 0;

      const lowY = area.bottom - normalizedLow * area.height;
      const highY = area.bottom - normalizedHigh * area.height;



      const x = this.isRtl()
        ? area.right - index * (barWidth + gap) - barWidth
        : area.left + index * (barWidth + gap);

      const y = highY;
      const height = lowY - highY;
      const color = getChartColor(index, point.color);

      return {
        index,
        data: point,
        x,
        y,
        width: barWidth,
        height: Math.max(1, height),
        color,
        lowY,
        highY,
      };
    });
  });

  hoveredBar = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return null;
    return this.bars().find(b => b.index === idx) ?? null;
  });

  chartAriaLabel = computed(() =>
    getChartSummary('Column range chart', this.data().length, this.title())
  );

  containerClasses = computed(() => cn('relative block w-full', this.class()));

  /**
   * Maps a value-axis tick to its SVG `y` coordinate on the same scale as the
   * columns, so the template can place gridlines and tick labels against them.
   * Unlike the bar chart this axis is always vertical — RTL moves the tick
   * labels to the opposite gutter but leaves these positions unchanged.
   */
  getTickPosition(tick: number): number {
    const range = this.dataRange();
    const area = this.chartArea();
    const span = range.max - range.min;
    const normalized = span > 0 ? (tick - range.min) / span : 0;
    return area.bottom - normalized * area.height;
  }

  /**
   * Marks the column as active — brightening it, dimming its siblings and
   * revealing the range tooltip. Bound to both `mouseenter` and `focus` so
   * keyboard users get the same highlight. The tooltip is placed at
   * {@link tooltipPosition}, which this does not update; there is no hover
   * output, so mirror the highlight from the {@link hoveredIndex} signal.
   */
  onBarHover(bar: RangeBar): void {
    this.hoveredIndex.set(bar.index);
  }

  /** Clears the active column, hiding the tooltip and restoring every column to full opacity. Bound to `mouseleave` and `blur`. */
  onBarLeave(): void {
    this.hoveredIndex.set(null);
  }

  /**
   * Emits {@link barClick} for the activated column. `event` is forwarded only
   * when it is a real `MouseEvent`; keyboard activation (Enter/Space) leaves
   * `event` undefined on the payload.
   */
  onBarClick(event: Event, bar: RangeBar): void {
    this.barClick.emit({
      point: bar.data,
      index: bar.index,
      event: event instanceof MouseEvent ? event : undefined,
    });
  }

  /**
   * Accessible name for a column's focusable group, phrased as
   * `"<name>: <low><unit> to <high><unit>"` so screen readers announce both
   * ends of the range. The numbers are raw, not passed through
   * {@link formatValue} — the unrounded value is read out.
   */
  getBarAriaLabel(bar: RangeBar): string {
    const unit = this.unit();
    return `${bar.data.name}: ${bar.data.low}${unit} to ${bar.data.high}${unit}`;
  }

  /** Formats a range end for the low/high labels and the tooltip: rounded to a whole number and suffixed with {@link unit}. Not compacted, so large values print in full. */
  formatValue(value: number): string {
    return formatChartValue(value, { decimals: 0 }) + this.unit();
  }

  /** Like {@link formatValue} but compacted (`1.2K`, `3.4M`), keeping the value-axis tick labels short enough for the fixed axis gutter. */
  formatAxisValue(value: number): string {
    return formatChartValue(value, { compact: true, decimals: 0 }) + this.unit();
  }
}
