import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import {
  ChartDataPoint,
  ChartClickEvent,
  LegendPosition,
  PieSlice,
} from '../../lib/chart.types';
import {
  getChartColor,
  describeArc,
  getSliceCentroid,
  sumValues,
  formatChartValue,
  formatPercentage,
  getChartSummary,
  getPointAriaLabel,
} from '../../lib/chart.utils';

@Component({
  selector: 'ui-pie-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pie-chart.component.html',
  host: {
    class: 'block',
  },
})
export class PieChartComponent {
  /**
   * One slice per entry, laid out clockwise in array order starting at 12
   * o'clock. `name` labels the slice in the legend and tooltip, `value` is a
   * share of the total (each slice's angle is `value / sum(values)`, so the
   * values are weights, not angles), and the optional `color` overrides the
   * palette colour otherwise picked from the entry's index. Values are assumed
   * non-negative; a total of `0` renders no slices at all.
   */
  data = input.required<ChartDataPoint[]>();
  /**
   * Design width *and* height of the square SVG coordinate system, in px, and
   * the `max-width` of the rendered SVG — the SVG itself is `width="100%"`
   * with a `1 / 1` aspect ratio, so it shrinks inside narrow containers but
   * never grows past this. The disc radius is `size / 2 - 10`, the 10px
   * leaving room for the hover pop-out. Note the container is `inline-flex`,
   * which is why the SVG carries an explicit `max-width` — drop the size cap
   * and an inline-level parent would collapse the `width:100%` SVG to the
   * 300px browser default. See {@link outerRadius}.
   */
  size = input(300);
  /**
   * Donut hole, as a fraction of {@link outerRadius} between 0 and 1. `0`
   * (default) draws a solid pie; `0.6` a fairly thin ring. Resolved to px by
   * {@link innerRadiusPixels}.
   */
  innerRadius = input(0);
  /**
   * Print each slice's percentage at its centroid. Slices below 5% are skipped
   * regardless, since the text would not fit inside the wedge — use the legend
   * or {@link showTooltip} to surface those.
   */
  showLabels = input(true);
  /** Render the colour/name/value legend beside the disc. Legend rows are buttons that hover and click the matching slice. */
  showLegend = input(true);
  /**
   * Which side the legend sits on, and hence the container's flex direction.
   * `'left'`/`'right'` stack the legend below the disc on mobile and beside it
   * from the `sm` breakpoint up; `'top'`/`'bottom'` always stack. `'none'`
   * suppresses the legend just like `showLegend: false`.
   */
  legendPosition = input<LegendPosition>('right');
  /**
   * Show the floating tooltip (name, value, percentage) for the hovered or
   * focused slice. Hover still emits {@link sliceHover} when disabled. The
   * tooltip is placed from {@link tooltipPosition}.
   */
  showTooltip = input(true);
  /**
   * Reserved flag for slice transitions. The hover grow/shadow transition is
   * declared unconditionally in the template's CSS, so toggling this currently
   * changes nothing on screen.
   */
  animated = input(true);
  /** Extra classes merged onto the chart container, which already carries `relative inline-flex gap-4 items-center max-w-full` plus the {@link legendPosition} direction classes. */
  class = input('');
  /** Human-readable chart name, used only to prefix the SVG's accessible summary. */
  title = input<string | undefined>(undefined);

  /** Emitted when a slice is clicked — on the wedge itself, via Enter/Space while it is focused, or on its legend row. */
  sliceClick = output<ChartClickEvent>();
  /** Emitted with the slice on hover/focus and with `null` on mouse-leave/blur, so consumers can mirror the highlight. */
  sliceHover = output<ChartClickEvent | null>();

  hoveredIndex = signal<number | null>(null);
  tooltipPosition = signal({ x: 0, y: 0 });

  center = computed(() => this.size() / 2);
  viewBox = computed(() => `0 0 ${this.size()} ${this.size()}`);
  total = computed(() => sumValues(this.data()));

  outerRadius = computed(() => this.size() / 2 - 10);
  innerRadiusPixels = computed(() => this.outerRadius() * this.innerRadius());

  slices = computed((): PieSlice[] => {
    const data = this.data();
    const total = this.total();
    if (total === 0 || data.length === 0) return [];

    const outerR = this.outerRadius();
    const innerR = this.innerRadiusPixels();
    let currentAngle = -Math.PI / 2;

    return data.map((point, index) => {
      const percentage = (point.value / total) * 100;
      const sliceAngle = (point.value / total) * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;

      const path = describeArc(0, 0, outerR, innerR, startAngle, endAngle);
      const centroid = getSliceCentroid(0, 0, outerR, startAngle, endAngle);
      const labelPos = getSliceCentroid(0, 0, outerR * 1.15, startAngle, endAngle);

      currentAngle = endAngle;

      return {
        index,
        data: point,
        startAngle,
        endAngle,
        percentage,
        color: getChartColor(index, point.color),
        path,
        labelPosition: labelPos,
        centroid,
      };
    });
  });

  hoveredSlice = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return null;
    return this.slices().find(s => s.index === idx) ?? null;
  });

  chartAriaLabel = computed(() =>
    getChartSummary('Pie chart', this.data().length, this.title())
  );

  containerClasses = computed(() => {
    const pos = this.legendPosition();
    const isHorizontalLegend = pos === 'left' || pos === 'right';
    const flexDirection = isHorizontalLegend ? 'flex-col sm:flex-row' : 'flex-col';
    const rowReverse = pos === 'left' ? 'sm:flex-row-reverse' : '';
    const colReverse = pos === 'top' ? 'flex-col-reverse' : '';

    return cn(
      'relative inline-flex gap-4 items-center max-w-full',
      flexDirection,
      rowReverse,
      colReverse,
      this.class()
    );
  });

  legendClasses = computed(() => {
    const pos = this.legendPosition();
    const isVertical = pos === 'left' || pos === 'right';

    return cn(
      'flex gap-2',
      isVertical
        ? 'flex-row flex-wrap justify-center sm:flex-col sm:flex-nowrap sm:justify-start'
        : 'flex-row flex-wrap justify-center'
    );
  });

  /**
   * Marks the slice as active — popping it out, dimming its siblings and the
   * other legend rows, and emitting {@link sliceHover}. Bound to `mouseenter`
   * and `focus` on the wedge, and to `mouseenter` on the legend row, so
   * keyboard and legend users get the same highlight.
   */
  onSliceHover(slice: PieSlice): void {
    this.hoveredIndex.set(slice.index);
    this.sliceHover.emit({ point: slice.data, index: slice.index });
  }

  /** Clears the active slice (hiding the tooltip) and emits `null` on {@link sliceHover}. Bound to `mouseleave` and `blur`. */
  onSliceLeave(): void {
    this.hoveredIndex.set(null);
    this.sliceHover.emit(null);
  }

  /**
   * Emits {@link sliceClick} for the activated slice. `event` is forwarded
   * only when it is a real `MouseEvent`; keyboard activation (Enter/Space)
   * leaves `event` undefined on the payload.
   */
  onSliceClick(event: Event, slice: PieSlice): void {
    this.sliceClick.emit({
      point: slice.data,
      index: slice.index,
      event: event instanceof MouseEvent ? event : undefined,
    });
  }

  /** Accessible name for a slice's focusable group — name, value, percentage and the series total — so a screen reader can walk the wedges without seeing the legend. */
  getSliceAriaLabel(slice: PieSlice): string {
    return getPointAriaLabel(
      slice.data.name,
      slice.data.value,
      slice.percentage,
      this.total()
    );
  }

  /** Formats a raw value for the legend and tooltip: grouped `en-US` digits with at most one decimal, and no compact `1.2K` abbreviation — unlike the axis labels of the cartesian charts. */
  formatValue(value: number): string {
    return formatChartValue(value);
  }

  /** Formats a slice's share as a percentage with one decimal (`12.5%`) for the in-slice label and the tooltip. */
  formatPercentage(value: number): string {
    return formatPercentage(value, 1);
  }

  /**
   * Whether a slice colour is too light for white label text, in which case
   * the in-slice percentage is drawn in `fill-foreground` instead. This is a
   * string heuristic, not a luminance calculation: it only matches colours
   * containing `yellow` or an HSL lightness of `50%)`, so a light custom
   * colour in another notation still gets white text.
   */
  isLightColor(color: string): boolean {
    return color.includes('yellow') || color.includes('50%)');
  }
}
