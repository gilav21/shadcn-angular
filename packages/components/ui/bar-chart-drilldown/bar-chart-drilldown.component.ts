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
  DrilldownDataPoint,
  DrilldownSeries,
  DrilldownEvent,
  ChartClickEvent,
  BarRect,
  ChartDirection,
} from '../../lib/chart.types';
import {
  getChartColor,
  formatChartValue,
  getChartSummary,
  getPointAriaLabel,
  calculateAxisTicks,
  getDataRange,
} from '../../lib/chart.utils';

@Component({
  selector: 'ui-bar-chart-drilldown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-chart-drilldown.component.html',
  host: {
    class: 'block',
  },
})
export class BarChartDrilldownComponent implements AfterViewInit {
  /**
   * Layout direction. `'auto'` (default) resolves from the host element's
   * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
   * mirrors the column order, swaps the axis gutter to the right-hand edge and
   * flips the breadcrumb's back chevron. See {@link isRtl}.
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
   * The top-level series: one column per entry, drawn in array order (mirrored
   * in RTL). `name` labels the category axis, `value` is the column height, and
   * the optional `color` overrides the palette colour picked from the index.
   * An entry whose `drilldown` holds the `id` of an entry in
   * {@link drilldownSeries} becomes clickable and navigates into that series —
   * a `drilldown` id with no matching series is inert (see {@link hasDrilldown}).
   * Values are assumed non-negative: the scale is anchored at 0.
   */
  data = input.required<DrilldownDataPoint[]>();
  /**
   * The child series reachable from {@link data}, keyed by `id`. The list is
   * flat and navigation is exactly one level deep — a click inside a child
   * series never drills further, so child points need no `drilldown` id. Each
   * series' `name` becomes the breadcrumb caption while it is open
   * ({@link currentSeriesName}).
   */
  drilldownSeries = input<DrilldownSeries[]>([]);
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
   * proportions while scaling — height is never measured from the DOM. It
   * covers the SVG only; the breadcrumb row adds its own height above it.
   */
  height = input(300);
  /** Draw the dashed value-axis gridlines behind the columns, one per {@link axisTicks} entry. */
  showGrid = input(true);
  /** Print each column's formatted value (see {@link formatValue}) above the column. */
  showValues = input(true);
  /**
   * Show the floating tooltip for the hovered/focused column, which also
   * carries the "Click to drill down" hint on drillable columns. Hover still
   * emits {@link barHover} when disabled.
   */
  showTooltip = input(true);
  /** Corner rounding of each column rect, in px (SVG `rx`). Use `0` for square corners. */
  barRadius = input(4);
  /**
   * Gap between adjacent columns, in px of user space. Column width is whatever
   * is left of the plot area after the gaps, so raising this on a dense series
   * narrows the columns rather than widening the chart.
   */
  barGap = input(8);
  /**
   * Render the breadcrumb row — the {@link backButtonText} button plus the
   * current series name. It only appears while drilled down; hiding it leaves
   * {@link onDrillUp} as the only way back, so wire your own control if you
   * turn it off.
   */
  showBreadcrumb = input(true);
  /** Label of the breadcrumb's back button, for localisation. Only visible while drilled down. */
  backButtonText = input('Back');
  /** Extra classes merged onto the chart container, which already carries `relative block w-full`. */
  class = input('');
  /**
   * Human-readable chart name. Used to prefix the SVG's accessible summary and,
   * at the top level, as the breadcrumb caption — it falls back to `'Overview'`
   * when unset. See {@link currentSeriesName}.
   */
  title = input<string | undefined>(undefined);

  /**
   * Emitted after the chart has navigated into a child series, carrying the
   * target `seriesId` and the clicked parent point. {@link barClick} fires first
   * for the same click.
   */
  drilldown = output<DrilldownEvent>();
  /** Emitted after {@link onDrillUp} returns the chart to the top-level {@link data}. */
  drillup = output<void>();
  /**
   * Emitted for every column click or Enter/Space activation, at either level —
   * including columns that also trigger {@link drilldown}. `index` is the
   * position within the currently displayed series.
   */
  barClick = output<ChartClickEvent<DrilldownDataPoint>>();
  /** Emitted with the column on hover/focus and with `null` on mouse-leave/blur, so consumers can mirror the highlight. */
  barHover = output<ChartClickEvent<DrilldownDataPoint> | null>();

  currentDrilldownId = signal<string | null>(null);
  hoveredIndex = signal<number | null>(null);
  tooltipPosition = signal({ x: 0, y: 0 });

  svgWidth = computed(() => this._measuredWidth() ?? this.width());
  svgHeight = computed(() => this.height());

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

  padding = computed(() => ({
    top: 20,
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
    const range = getDataRange(this.currentData());
    return { min: 0, max: range.max * 1.1 };
  });

  axisTicks = computed(() => {
    const range = this.dataRange();
    return calculateAxisTicks(range.min, range.max, 5);
  });

  bars = computed((): BarRect[] => {
    const data = this.currentData();
    if (data.length === 0) return [];

    const area = this.chartArea();
    const range = this.dataRange();
    const gap = this.barGap();
    const barCount = data.length;
    const totalGaps = (barCount - 1) * gap;
    const barWidth = (area.width - totalGaps) / barCount;

    return data.map((point, index) => {
      const normalizedValue = (point.value - range.min) / (range.max - range.min);
      const barHeight = normalizedValue * area.height;

      const x = this.isRtl()
        ? area.right - index * (barWidth + gap) - barWidth
        : area.left + index * (barWidth + gap);

      const y = area.bottom - barHeight;
      const color = getChartColor(index, point.color);

      return {
        index,
        data: point,
        x,
        y,
        width: barWidth,
        height: Math.max(0, barHeight),
        color,
        value: point.value,
        labelPosition: { x: x + barWidth / 2, y: y - 6 },
      };
    });
  });

  hoveredBar = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return null;
    return this.bars().find(b => b.index === idx) ?? null;
  });

  chartAriaLabel = computed(() =>
    getChartSummary('Column chart with drilldown', this.currentData().length, this.currentSeriesName())
  );

  containerClasses = computed(() => cn('relative block w-full', this.class()));

  /**
   * Whether clicking this column navigates anywhere — true only when its point
   * carries a `drilldown` id *and* {@link drilldownSeries} actually contains a
   * series with that id. Drives the tooltip hint and the aria-label suffix.
   */
  hasDrilldown(bar: BarRect): boolean {
    const point = bar.data as DrilldownDataPoint;
    return !!point.drilldown && this.drilldownSeries().some(s => s.id === point.drilldown);
  }

  /**
   * Maps a value-axis tick to its SVG `y` coordinate, on the same scale as the
   * columns, so the template can place gridlines and tick labels. The scale is
   * derived from the *currently displayed* series, so it rescales on drilldown.
   */
  getTickPosition(tick: number): number {
    const range = this.dataRange();
    const area = this.chartArea();
    const normalized = (tick - range.min) / (range.max - range.min);
    return area.bottom - normalized * area.height;
  }

  /**
   * Marks the column as active — dimming its siblings, showing the tooltip and
   * emitting {@link barHover}. Bound to both `mouseenter` and `focus` so
   * keyboard users get the same highlight.
   */
  onBarHover(bar: BarRect): void {
    this.hoveredIndex.set(bar.index);
    this.barHover.emit({ point: bar.data, index: bar.index });
  }

  /** Clears the active column (hiding the tooltip) and emits `null` on {@link barHover}. Bound to `mouseleave` and `blur`. */
  onBarLeave(): void {
    this.hoveredIndex.set(null);
    this.barHover.emit(null);
  }

  /**
   * Emits {@link barClick} for the activated column, then — only at the top
   * level and only when the point resolves to a real series (see
   * {@link hasDrilldown}) — switches the chart to that series and emits
   * {@link drilldown}. `event` is forwarded on the payload only when it is a
   * real `MouseEvent`; keyboard activation (Enter/Space) leaves it undefined.
   */
  onBarClick(event: Event, bar: BarRect): void {
    const point = bar.data as DrilldownDataPoint;

    this.barClick.emit({
      point,
      index: bar.index,
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
   * Returns the chart to the top-level {@link data}, clears the hover state and
   * emits {@link drillup}. Bound to the breadcrumb's back button, and safe to
   * call from a consumer's own control when {@link showBreadcrumb} is off.
   */
  onDrillUp(): void {
    this.currentDrilldownId.set(null);
    this.hoveredIndex.set(null);
    this.drillup.emit();
  }

  /**
   * Accessible name for a column's focusable group: its category name and
   * value, plus a "Press Enter to drill down." hint when
   * {@link hasDrilldown} is true, so screen-reader users can tell the
   * navigable columns apart.
   */
  getBarAriaLabel(bar: BarRect): string {
    const label = getPointAriaLabel(bar.data.name, bar.value);
    if (this.hasDrilldown(bar)) {
      return `${label}. Press Enter to drill down.`;
    }
    return label;
  }

  /** Formats a column's value for the in-chart label and tooltip using compact notation (`1.2K`, `3.4M`), keeping decimals. */
  formatValue(value: number): string {
    return formatChartValue(value, { compact: true });
  }

  /** Like {@link formatValue} but drops decimals, keeping the value-axis tick labels short enough for the fixed axis gutter. */
  formatAxisValue(value: number): string {
    return formatChartValue(value, { compact: true, decimals: 0 });
  }
}
