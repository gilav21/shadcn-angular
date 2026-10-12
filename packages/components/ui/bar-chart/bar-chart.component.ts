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
import { cn, isRtl } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import {
  ChartDataPoint,
  ChartClickEvent,
  ChartOrientation,
  BarRect,
  ChartDirection,
} from '../../lib/chart.types';
import {
  getChartColor,
  formatChartValue,
  getChartSummary,
  getPointAriaLabel,
} from '../../lib/chart.utils';
import { linearScale, zeroBasedDomain } from '../../lib/chart-scale';

/** Room, in px, a horizontal bar's value label needs between the bar end and the plot edge. */
const LABEL_ROOM = 48;

@Component({
  selector: 'ui-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-chart.component.html',
  host: {
    class: 'block',
  },
})
export class BarChartComponent implements AfterViewInit {
  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

  /**
   * One bar per entry, drawn in array order (left-to-right, or right-to-left
   * when {@link isRtl} resolves true). `name` is the category label under the
   * axis, `value` the bar length, and the optional `color` overrides the
   * palette colour that would otherwise be picked from the entry's index.
   * Bars grow from a zero baseline: a positive value rises (or extends toward
   * the end edge), a negative one falls (or extends toward the start edge,
   * mirrored in RTL), and the axis covers both signs. An all-zero dataset draws
   * zero-length bars on the baseline. Entries sharing a `name` are separate
   * bars, one per array position.
   */
  data = input.required<ChartDataPoint[]>();
  /**
   * `'vertical'` (default) grows bars upward from the category axis;
   * `'horizontal'` grows them sideways with categories stacked down the side.
   * Also switches the aria description between "Column chart" and "Bar chart".
   */
  orientation = input<ChartOrientation>('vertical');
  /**
   * Design width of the SVG user-space coordinate system, in px, and the
   * fallback until the host element has been measured. The rendered SVG is
   * `width="100%"` with this as its `max-width`, so the chart scales down
   * inside narrow containers but never past this width. Note the host must be
   * a block-level box — an inline-block parent collapses a `width:100%` SVG,
   * which is why the container carries `w-full` and the host `class: 'block'`.
   */
  width = input(500);
  /**
   * Design height of the SVG coordinate system, in px. Combined with the
   * measured width it fixes the `aspect-ratio`, so the chart keeps its
   * proportions while scaling — height is never measured from the DOM.
   */
  height = input(300);
  /** Draw the dashed value-axis gridlines behind the bars, one per {@link axisTicks} entry. */
  showGrid = input(true);
  /** Print each bar's formatted value (see {@link formatValue}) at the end of the bar. */
  showValues = input(true);
  /** Show the floating tooltip for the hovered/focused bar. Hover still emits {@link barHover} when disabled. */
  showTooltip = input(true);
  /** Corner rounding of each bar rect, in px (SVG `rx`). Use `0` for square corners. */
  barRadius = input(4);
  /**
   * Gap between adjacent bars, in px of user space. Bar thickness is whatever
   * is left of the plot area after the gaps, so raising this on a dense series
   * shrinks the bars rather than widening the chart.
   */
  barGap = input(8);
  /** Caption centred under the chart. Setting it also reserves extra bottom padding for the text. */
  xAxisLabel = input('');
  /** Caption rotated along the value axis; flips to the right-hand edge in RTL. */
  yAxisLabel = input('');
  /** Extra classes merged onto the chart container, which already carries `relative block w-full`. */
  class = input('');
  /** Human-readable chart name, used only to prefix the SVG's accessible summary. */
  title = input<string | undefined>(undefined);
  /**
   * Layout direction. `'auto'` (default) resolves from the host element's
   * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
   * mirrors the bar order, swaps the axis padding, and moves the tick labels
   * to the opposite edge. See {@link isRtl}.
   */
  dir = input<ChartDirection>('auto');

  /** Emitted when a bar is clicked, or activated with Enter/Space while focused. */
  barClick = output<ChartClickEvent>();
  /** Emitted with the bar on hover/focus and with `null` on mouse-leave/blur, so consumers can mirror the highlight. */
  barHover = output<ChartClickEvent | null>();

  hoveredIndex = signal<number | null>(null);
  tooltipPosition = signal({ x: 0, y: 0 });

  private readonly _domRtl = signal(false);


  isVertical = computed(() => this.orientation() === 'vertical');

  isRtl = computed(() => {
    const d = this.dir();
    if (d === 'rtl') return true;
    if (d === 'ltr') return false;
    return this._domRtl();
  });

  constructor() {
  }

  ngAfterViewInit(): void {
    this._checkDirection();

    setTimeout(() => this._checkDirection(), 0);
  }

  private _checkDirection(): void {
    this._domRtl.set(isRtl(this.el.nativeElement));
  }

  svgWidth = computed(() => this._measuredWidth() ?? this.width());
  svgHeight = computed(() => this.height());

  padding = computed(() => ({
    top: 20,
    right: this.isRtl() ? 80 : 20,
    bottom: this.xAxisLabel() ? 50 : 35,
    left: this.isRtl() ? 20 : 80,
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

  /**
   * The value-axis domain: the nice bounds of the data and zero, so bars of
   * either sign and an all-zero dataset all fit. Both ends are axis ticks.
   */
  readonly valueDomain = computed(() => zeroBasedDomain(this.data().map(d => d.value), 5));

  dataRange = computed(() => {
    const [min, max] = this.valueDomain();
    return { min, max };
  });

  private readonly valueScale = computed(() => {
    const area = this.chartArea();
    let range: [number, number] = [area.left, area.right];
    if (this.isVertical()) range = [area.bottom, area.top];
    else if (this.isRtl()) range = [area.right, area.left];
    return linearScale(this.valueDomain(), range);
  });

  axisTicks = computed(() => this.valueScale().ticks(5));

  bars = computed((): BarRect[] => {
    const data = this.data();
    if (data.length === 0) return [];

    const area = this.chartArea();
    const gap = this.barGap();
    const isVert = this.isVertical();
    const barSize = this.computeBarSize(isVert, area, gap, data.length);
    const scale = this.valueScale();
    const zero = scale.scale(0);

    return data.map((point, index) => {
      const end = scale.scale(point.value);
      const start = Math.min(zero, end);
      const length = Math.abs(end - zero);
      const color = getChartColor(index, point.color);
      const pos = this.computeBarPosition(isVert, area, gap, barSize, { start, length, value: point.value }, index);

      return {
        index,
        data: point,
        x: pos.x,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        color,
        value: point.value,
        labelPosition: { x: pos.labelX, y: pos.labelY },
        labelAnchor: pos.labelAnchor,
      };
    });
  });

  private computeBarSize(
    isVert: boolean,
    area: { width: number; height: number },
    gap: number,
    count: number
  ): number {
    const availableSpace = isVert ? area.width : area.height;
    return (availableSpace - (count - 1) * gap) / count;
  }

  /** Whether a bar's free end (the one away from the zero baseline) faces right: positive in LTR, negative in RTL. */
  private growsRight(value: number): boolean {
    return (value >= 0) !== this.isRtl();
  }

  private computeBarPosition(
    isVert: boolean,
    area: { left: number; right: number; top: number; bottom: number },
    gap: number,
    barSize: number,
    span: { start: number; length: number; value: number },
    index: number
  ): { x: number; y: number; width: number; height: number; labelX: number; labelY: number; labelAnchor: BarRect['labelAnchor'] } {
    const offset = index * (barSize + gap);
    if (isVert) {
      const x = this.isRtl() ? area.right - offset - barSize : area.left + offset;
      return {
        x, y: span.start, width: barSize, height: span.length,
        labelX: x + barSize / 2, labelY: this.verticalLabelY(area, span), labelAnchor: 'middle',
      };
    }
    const y = area.top + offset;
    const label = this.horizontalLabel(area, span);
    return { x: span.start, y, width: span.length, height: barSize, labelX: label.x, labelY: y + barSize / 2, labelAnchor: label.anchor };
  }

  /**
   * Baseline of a column's value label: above a positive column, below a
   * negative one. A negative column that reaches the axis labels at the bottom
   * of the plot has no room under it, so its label moves inside the bar end.
   */
  private verticalLabelY(area: { bottom: number }, span: { start: number; length: number; value: number }): number {
    if (span.value >= 0) return span.start - 6;
    const below = span.start + span.length + 14;
    return below <= area.bottom + 2 ? below : span.start + span.length - 6;
  }

  /**
   * Position and anchor of a horizontal bar's value label: just past its free
   * end, or inside the bar when less than {@link LABEL_ROOM} px remain between
   * that end and the plot edge and the bar is long enough to hold it (a bar
   * reaching the edge would otherwise print over the category labels or
   * outside the chart).
   */
  private horizontalLabel(
    area: { left: number; right: number },
    span: { start: number; length: number; value: number },
  ): { x: number; anchor: 'start' | 'end' } {
    const growsRight = this.growsRight(span.value);
    const freeEnd = growsRight ? span.start + span.length : span.start;
    const room = growsRight ? area.right - freeEnd : freeEnd - area.left;
    // A bar shorter than the label cannot hold it, so a short bar always labels outside.
    const outside = room >= LABEL_ROOM || span.length < LABEL_ROOM;
    const x = growsRight === outside ? freeEnd + 6 : freeEnd - 6;
    return { x, anchor: growsRight === outside ? 'start' : 'end' };
  }

  hoveredBar = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return null;
    return this.bars().find(b => b.index === idx) ?? null;
  });

  chartAriaLabel = computed(() => {
    const type = this.isVertical() ? 'Column chart' : 'Bar chart';
    return getChartSummary(type, this.data().length, this.title());
  });

  containerClasses = computed(() => cn('relative block w-full', this.class()));

  /**
   * Maps a value-axis tick to its SVG coordinate along the value axis — a `y`
   * for vertical charts, an `x` for horizontal ones (mirrored in RTL). Used by
   * the template to place gridlines and tick labels on the same scale as the
   * bars.
   */
  getTickPosition(tick: number): number {
    return this.valueScale().scale(tick);
  }

  /**
   * Marks the bar as active — dimming its siblings, positioning the tooltip
   * and emitting {@link barHover}. Bound to both `mouseenter` and `focus` so
   * keyboard users get the same highlight.
   */
  onBarHover(bar: BarRect): void {
    this.hoveredIndex.set(bar.index);
    this.barHover.emit({ point: bar.data, index: bar.index });
  }

  /** Clears the active bar (hiding the tooltip) and emits `null` on {@link barHover}. Bound to `mouseleave` and `blur`. */
  onBarLeave(): void {
    this.hoveredIndex.set(null);
    this.barHover.emit(null);
  }

  /**
   * Emits {@link barClick} for the activated bar. `event` is forwarded only
   * when it is a real `MouseEvent`; keyboard activation (Enter/Space) leaves
   * `event` undefined on the payload.
   */
  onBarClick(event: Event, bar: BarRect): void {
    this.barClick.emit({
      point: bar.data,
      index: bar.index,
      event: event instanceof MouseEvent ? event : undefined,
    });
  }

  /** Accessible name for a bar's focusable group, combining its category name and value, so screen readers can walk the series. */
  getBarAriaLabel(bar: BarRect): string {
    return getPointAriaLabel(bar.data.name, bar.value);
  }

  /** Formats a bar's value for the in-chart label and tooltip using compact notation (`1.2K`, `3.4M`), keeping decimals. */
  formatValue(value: number): string {
    return formatChartValue(value, { compact: true });
  }

  /** Like {@link formatValue} but drops decimals, keeping the value-axis tick labels short enough for the fixed axis gutter. */
  formatAxisValue(value: number): string {
    return formatChartValue(value, { compact: true, decimals: Number.isInteger(value) ? 0 : 6 });
  }
}
