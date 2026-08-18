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
  DrilldownDataPoint,
  DrilldownSeries,
  DrilldownEvent,
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
  selector: 'ui-pie-chart-drilldown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pie-chart-drilldown.component.html',
  host: {
    class: 'block',
  },
})
export class PieChartDrilldownComponent {
  /**
   * The top-level slices, laid out clockwise in array order from 12 o'clock.
   * Each `value` is a weight — the slice angle is `value / sum(values)` — and
   * the optional `color` overrides the palette colour picked from the index.
   * A point whose `drilldown` holds the `id` of an entry in
   * {@link drilldownSeries} becomes navigable: clicking it swaps the chart to
   * that series. A `drilldown` id with no matching series is inert, and gets
   * no chevron in the legend.
   */
  data = input.required<DrilldownDataPoint[]>();
  /**
   * The child levels, looked up by `id` from a parent point's `drilldown`.
   * Each series carries its own `name` (shown in the breadcrumb) and `data`,
   * which is re-normalised to 100% of *that* series' total once entered. Only
   * one level deep: child points are plain `ChartDataPoint`s, and drilling is
   * refused while already drilled in. See {@link currentData}.
   */
  drilldownSeries = input<DrilldownSeries[]>([]);
  /**
   * Design width *and* height of the square SVG coordinate system, in px, and
   * the `max-width` of the rendered SVG — the SVG is `width="100%"` with a
   * `1 / 1` aspect ratio, so it shrinks in narrow containers but never grows
   * past this. The disc radius is `size / 2 - 10`, the 10px leaving room for
   * the hover pop-out. The host is `block` but the inner container is
   * `inline-block`/`inline-flex`, which is why the SVG needs that explicit
   * cap — an inline-level parent would otherwise collapse a `width:100%` SVG
   * to the 300px browser default. See {@link outerRadius}.
   */
  size = input(300);
  /**
   * Donut hole, as a fraction of {@link outerRadius} between 0 and 1. `0`
   * (default) draws a solid pie; `0.6` a fairly thin ring. Applies to every
   * level. Resolved to px by {@link innerRadiusPixels}.
   */
  innerRadius = input(0);
  /**
   * Print each slice's percentage of the *current* level's total at its
   * centroid. Slices under 5% are skipped regardless, since the text would not
   * fit — use the legend or {@link showTooltip} for those.
   */
  showLabels = input(true);
  /** Render the legend beside the disc. Rows are buttons that hover and click the matching slice, so the legend also drives drilldown, and drillable rows get a chevron. */
  showLegend = input(true);
  /**
   * Which side the legend sits on, and hence the chart container's flex
   * direction. `'left'`/`'right'` stack the legend below the disc on mobile and
   * beside it from the `sm` breakpoint up; `'top'`/`'bottom'` always stack.
   * `'none'` suppresses the legend just like `showLegend: false`.
   */
  legendPosition = input<LegendPosition>('right');
  /**
   * Show the floating tooltip (name, value, percentage, plus a "Click to drill
   * down" hint on drillable slices) for the hovered or focused slice. Hover
   * still emits {@link sliceHover} when disabled. Placed from
   * {@link tooltipPosition}.
   */
  showTooltip = input(true);
  /**
   * Show the back button + current series name above the chart while drilled
   * in; it is absent at the top level either way. Turn it off only if you
   * render your own navigation — with no breadcrumb there is no in-component
   * way back, and the consumer must call {@link onDrillUp} itself.
   */
  showBreadcrumb = input(true);
  /** Label on the breadcrumb's back button. Change it to localise, or to name the parent level ("All regions"). */
  backButtonText = input('Back');
  /** Extra classes merged onto the outer container, which already carries `relative inline-block max-w-full`. The inner chart/legend flex row is not affected. */
  class = input('');
  /** Name of the top level. Used as the breadcrumb/aria label while not drilled in, where it falls back to `'Overview'`; while drilled in the current series' `name` replaces it. See {@link currentSeriesName}. */
  title = input<string | undefined>(undefined);

  /** Emitted after the chart has switched to a child series, with the target `seriesId` and the parent point that was clicked. Navigation is internal — this notifies, it does not have to be handled. */
  drilldown = output<DrilldownEvent>();
  /** Emitted after the chart returns to the top level via the breadcrumb back button or {@link onDrillUp}. */
  drillup = output<void>();
  /** Emitted for every slice activation, at either level, and before any drilldown navigation it triggers. */
  sliceClick = output<ChartClickEvent<DrilldownDataPoint>>();
  /** Emitted with the slice on hover/focus and with `null` on mouse-leave/blur, so consumers can mirror the highlight. */
  sliceHover = output<ChartClickEvent<DrilldownDataPoint> | null>();

  currentDrilldownId = signal<string | null>(null);
  hoveredIndex = signal<number | null>(null);
  tooltipPosition = signal({ x: 0, y: 0 });

  center = computed(() => this.size() / 2);
  viewBox = computed(() => `0 0 ${this.size()} ${this.size()}`);
  outerRadius = computed(() => this.size() / 2 - 10);
  innerRadiusPixels = computed(() => this.outerRadius() * this.innerRadius());

  isDrilledDown = computed(() => this.currentDrilldownId() !== null);

  currentData = computed(() => {
    const drilldownId = this.currentDrilldownId();
    if (drilldownId) {
      const series = this.drilldownSeries().find(s => s.id === drilldownId);
      return series?.data ?? [];
    }
    return this.data();
  });

  currentSeriesName = computed(() => {
    const drilldownId = this.currentDrilldownId();
    if (drilldownId) {
      return this.drilldownSeries().find(s => s.id === drilldownId)?.name ?? '';
    }
    return this.title() ?? 'Overview';
  });

  currentTotal = computed(() => sumValues(this.currentData()));

  currentSlices = computed((): PieSlice[] => {
    const data = this.currentData();
    const total = this.currentTotal();
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
    return this.currentSlices().find(s => s.index === idx) ?? null;
  });

  chartAriaLabel = computed(() =>
    getChartSummary('Pie chart with drilldown', this.currentData().length, this.currentSeriesName())
  );

  containerClasses = computed(() => cn('relative inline-block max-w-full', this.class()));

  chartContainerClasses = computed(() => {
    const pos = this.legendPosition();
    const isHorizontalLegend = pos === 'left' || pos === 'right';
    const flexDir = isHorizontalLegend ? 'flex-col sm:flex-row' : 'flex-col';
    let reverse = '';
    if (pos === 'left') {
      reverse = 'sm:flex-row-reverse';
    } else if (pos === 'top') {
      reverse = 'flex-col-reverse';
    }

    return cn('relative inline-flex gap-4 items-center max-w-full', flexDir, reverse);
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
   * Whether the slice's point names a `drilldown` id that actually resolves to
   * an entry in {@link drilldownSeries}. Drives the legend chevron, the
   * tooltip hint and the aria label's "Press Enter to drill down"; a dangling
   * id reports `false` so nothing promises navigation that will not happen.
   */
  hasDrilldown(slice: PieSlice): boolean {
    const point = slice.data as DrilldownDataPoint;
    return !!point.drilldown && this.drilldownSeries().some(s => s.id === point.drilldown);
  }

  /**
   * Marks the slice as active — popping it out, dimming its siblings and the
   * other legend rows, and emitting {@link sliceHover}. Bound to `mouseenter`
   * and `focus` on the wedge and to `mouseenter` on the legend row, so
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
   * Always emits {@link sliceClick} — `event` is forwarded only when it is a
   * real `MouseEvent`, so keyboard activation (Enter/Space) leaves it
   * undefined. Then, only from the top level and only when the point's
   * `drilldown` id resolves in {@link drilldownSeries}, swaps the chart to
   * that series, drops the hover highlight and emits {@link drilldown}.
   */
  onSliceClick(event: Event, slice: PieSlice): void {
    const point = slice.data as DrilldownDataPoint;

    this.sliceClick.emit({
      point,
      index: slice.index,
      event: event instanceof MouseEvent ? event : undefined,
    });

    if (point.drilldown && !this.isDrilledDown()) {
      const series = this.drilldownSeries().find(s => s.id === point.drilldown);
      if (series) {
        this.currentDrilldownId.set(point.drilldown);
        this.hoveredIndex.set(null);
        this.drilldown.emit({ seriesId: point.drilldown, parentPoint: point });
      }
    }
  }

  /**
   * Returns to the top level, clears the hover highlight and emits
   * {@link drillup}. Bound to the breadcrumb back button, and public so a
   * consumer rendering its own navigation (`showBreadcrumb: false`) can drive
   * it. It is unguarded — calling it while already at the top level still
   * emits {@link drillup}.
   */
  onDrillUp(): void {
    this.currentDrilldownId.set(null);
    this.hoveredIndex.set(null);
    this.drillup.emit();
  }

  /**
   * Accessible name for a slice's focusable group — name, value, percentage
   * and the current level's total — with "Press Enter to drill down."
   * appended when {@link hasDrilldown} holds, so the navigation is announced
   * rather than left to the visual chevron.
   */
  getSliceAriaLabel(slice: PieSlice): string {
    const label = getPointAriaLabel(
      slice.data.name,
      slice.data.value,
      slice.percentage,
      this.currentTotal()
    );
    if (this.hasDrilldown(slice)) {
      return `${label}. Press Enter to drill down.`;
    }
    return label;
  }

  /** Formats a raw value for the legend and tooltip: grouped `en-US` digits with at most one decimal, and no compact `1.2K` abbreviation. */
  formatValue(value: number): string {
    return formatChartValue(value);
  }

  /** Formats a slice's share of the current level's total as a percentage with one decimal (`12.5%`) for the in-slice label and the tooltip. */
  formatPercentage(value: number): string {
    return formatPercentage(value, 1);
  }
}
