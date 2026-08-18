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
import {
  ChartSeries,
  StackingMode,
  ChartDirection
} from '../../lib/chart.types';
import {
  getChartColor,
  formatChartValue,
  formatPercentage,
  getChartSummary,
  calculateAxisTicks,
} from '../../lib/chart.utils';

interface StackedBar {
  categoryIndex: number;
  category: string;
  segments: StackedSegment[];
  total: number;
}

interface StackedSegment {
  seriesIndex: number;
  seriesName: string;
  value: number;
  percentage: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

@Component({
  selector: 'ui-stacked-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stacked-bar-chart.component.html',
  host: {
    class: 'block',
  },
})
export class StackedBarChartComponent implements AfterViewInit {
  /**
   * Layout direction. `'auto'` (default) resolves from the host element's
   * inherited DOM direction after view init; `'ltr'`/`'rtl'` force it. RTL
   * mirrors the category order and moves the value-axis gutter to the
   * right-hand edge; segments always stack upward. See {@link isRtl}.
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
   * One stack layer per series, stacked bottom-to-top in array order, and one
   * legend swatch per series. Each series' `data` is matched to
   * {@link categories} **by index, not by `name`** — `data[i]` is the segment
   * in category `i`, and a missing or short entry contributes 0. The optional
   * `color` overrides the palette colour picked from the series index; `id` (or
   * `name` as fallback) is the legend's track key, so keep it unique.
   */
  series = input.required<ChartSeries[]>();
  /**
   * The category-axis labels, one stack per entry, in draw order (mirrored in
   * RTL). Its length defines how many stacks are drawn — series entries beyond
   * it are ignored. See {@link series} for the index-based pairing.
   */
  categories = input.required<string[]>();
  /**
   * `'absolute'` (default) scales every stack against the largest total, so
   * stack heights stay comparable; `'percent'` normalises each stack to fill
   * the full plot height and switches the axis to a fixed `0/25/50/75/100`
   * scale with `%` tick labels. Percent mode also adds the share to the
   * tooltip via {@link formatPercentage}.
   */
  stacking = input<StackingMode>('absolute');
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
   * covers the SVG only; the legend adds its own height below it.
   */
  height = input(300);
  /** Draw the dashed value-axis gridlines behind the stacks, one per {@link axisTicks} entry. */
  showGrid = input(true);
  /**
   * Print each stack's total (see {@link formatValue}) above its top segment.
   * The total is always the raw sum of the series values, so it stays
   * meaningful even when {@link stacking} is `'percent'` and the bars are
   * normalised. Off by default.
   */
  showTotal = input(false);
  /** Render the series legend — colour swatch plus series name — in a wrapping row under the chart. */
  showLegend = input(true);
  /**
   * Corner rounding of each *segment* rect, in px (SVG `rx`) — every segment is
   * rounded, not just the top of the stack, so large values visibly separate
   * the layers. Use `0` for a flush stack.
   */
  barRadius = input(4);
  /**
   * Gap between adjacent stacks, in px of user space. Stack width is whatever
   * is left of the plot area after the gaps, so raising this with many
   * categories narrows the stacks rather than widening the chart.
   */
  barGap = input(12);
  /** Extra classes merged onto the chart container, which already carries `relative block w-full`. */
  class = input('');
  /** Human-readable chart name, used only to prefix the SVG's accessible summary. */
  title = input<string | undefined>(undefined);

  /**
   * Emitted when a segment is clicked, or activated with Enter/Space while
   * focused, identifying it by series name and category label rather than by
   * index. `value` is the raw series value, never the percentage.
   */
  segmentClick = output<{ series: string; category: string; value: number }>();

  private readonly hoveredKey = signal<{ category: number; series: number } | null>(null);
  tooltipPosition = signal({ x: 0, y: 0 });

  svgWidth = computed(() => this._measuredWidth() ?? this.width());
  svgHeight = computed(() => this.height());

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

  maxValue = computed(() => {
    const cats = this.categories();
    const seriesData = this.series();

    if (this.stacking() === 'percent') return 100;

    let max = 0;
    for (let i = 0; i < cats.length; i++) {
      let total = 0;
      for (const s of seriesData) {
        total += s.data[i]?.value ?? 0;
      }
      max = Math.max(max, total);
    }
    return max * 1.1;
  });

  axisTicks = computed(() => {
    if (this.stacking() === 'percent') {
      return [0, 25, 50, 75, 100];
    }
    return calculateAxisTicks(0, this.maxValue(), 5);
  });

  stackedBars = computed((): StackedBar[] => {
    const cats = this.categories();
    const seriesData = this.series();
    const area = this.chartArea();
    const gap = this.barGap();
    const barCount = cats.length;
    const totalGaps = (barCount - 1) * gap;
    const barWidth = (area.width - totalGaps) / barCount;
    const isPercent = this.stacking() === 'percent';
    const maxVal = this.maxValue();

    return cats.map((category, catIndex) => {
      const x = this.isRtl()
        ? area.right - catIndex * (barWidth + gap) - barWidth
        : area.left + catIndex * (barWidth + gap);
      let total = 0;

      for (const s of seriesData) {
        total += s.data[catIndex]?.value ?? 0;
      }

      let currentY = area.bottom;
      const segments: StackedSegment[] = [];

      for (let sIdx = 0; sIdx < seriesData.length; sIdx++) {
        const s = seriesData[sIdx];
        const value = s.data[catIndex]?.value ?? 0;
        const percentage = total > 0 ? (value / total) * 100 : 0;

        const scaledValue = maxVal > 0 ? value / maxVal : 0;
        const normalizedValue = isPercent ? percentage / 100 : scaledValue;
        const segmentHeight = normalizedValue * area.height;

        segments.push({
          seriesIndex: sIdx,
          seriesName: s.name,
          value,
          percentage,
          x,
          y: currentY - segmentHeight,
          width: barWidth,
          height: Math.max(0, segmentHeight),
          color: getChartColor(sIdx, s.color),
        });

        currentY -= segmentHeight;
      }

      return {
        categoryIndex: catIndex,
        category,
        segments,
        total,
      };
    });
  });

  hoveredSegment = computed(() => {
    const key = this.hoveredKey();
    if (!key) return null;
    const bar = this.stackedBars().find(b => b.categoryIndex === key.category);
    return bar?.segments.find(s => s.seriesIndex === key.series) ?? null;
  });

  chartAriaLabel = computed(() =>
    getChartSummary('Stacked column chart', this.categories().length, this.title())
  );

  containerClasses = computed(() => cn('relative block w-full', this.class()));

  /**
   * Maps a value-axis tick to its SVG `y` coordinate, on the same scale as the
   * segments, so the template can place gridlines and tick labels. In percent
   * mode the scale maximum is a flat 100, so the ticks read as percentages.
   */
  getTickPosition(tick: number): number {
    const maxVal = this.maxValue();
    const area = this.chartArea();
    const normalized = tick / maxVal;
    return area.bottom - normalized * area.height;
  }

  /**
   * Horizontal centre of a stack in SVG user space, taken from its first
   * segment (all segments share the stack's `x`/`width`). Used to centre the
   * category label and the {@link showTotal} caption; returns `0` for a stack
   * with no series.
   */
  getBarCenterX(bar: StackedBar): number {
    const segment = bar.segments[0];
    return segment ? segment.x + segment.width / 2 : 0;
  }

  /**
   * SVG `y` of the top of a stack — the `y` of its last (topmost) segment — so
   * the {@link showTotal} caption can sit just above it. Returns `0` for a
   * stack with no series.
   */
  getBarTopY(bar: StackedBar): number {
    const topSegment = bar.segments.at(-1);
    return topSegment?.y ?? 0;
  }

  /**
   * Colour of the series at `index` — its own `color` if set, otherwise the
   * palette entry for that index. Used for the legend swatches so they match
   * the segments, which are coloured the same way.
   */
  getSeriesColor(index: number): string {
    const s = this.series()[index];
    return getChartColor(index, s?.color);
  }

  /**
   * Whether this exact segment is the active one — hover is tracked per
   * category *and* series, so only one segment brightens while every other
   * segment in the chart dims.
   */
  isHovered(categoryIndex: number, seriesIndex: number): boolean {
    const key = this.hoveredKey();
    return key !== null && key.category === categoryIndex && key.series === seriesIndex;
  }

  /**
   * Marks the segment as active — brightening it, dimming the rest and showing
   * the tooltip. Bound to both `mouseenter` and `focus` so keyboard users get
   * the same highlight. There is no hover output; consumers observe clicks via
   * {@link segmentClick}.
   */
  onSegmentHover(categoryIndex: number, segment: StackedSegment): void {
    this.hoveredKey.set({ category: categoryIndex, series: segment.seriesIndex });
  }

  /** Clears the active segment, hiding the tooltip and restoring every segment's opacity. Bound to `mouseleave` and `blur`. */
  onSegmentLeave(): void {
    this.hoveredKey.set(null);
  }

  /**
   * Emits {@link segmentClick} for the activated segment. Bound to `click` and
   * to Enter/Space so mouse and keyboard behave identically; the originating
   * `event` is not forwarded on the payload.
   */
  onSegmentClick(event: Event, segment: StackedSegment, bar: StackedBar): void {
    this.segmentClick.emit({
      series: segment.seriesName,
      category: bar.category,
      value: segment.value,
    });
  }

  /**
   * Accessible name for a segment's focusable group — "&lt;series&gt; in
   * &lt;category&gt;: &lt;value&gt;" — so screen-reader users can walk the stack
   * layer by layer. Always reports the raw value, in full (non-compact)
   * notation, even in percent mode.
   */
  getSegmentAriaLabel(segment: StackedSegment, bar: StackedBar): string {
    return `${segment.seriesName} in ${bar.category}: ${formatChartValue(segment.value)}`;
  }

  /** Formats a raw value for the tooltip and the {@link showTotal} caption using compact notation (`1.2K`, `3.4M`), keeping decimals. */
  formatValue(value: number): string {
    return formatChartValue(value, { compact: true });
  }

  /**
   * Formats a value-axis tick: a bare `N%` in percent mode, otherwise
   * {@link formatValue}'s compact notation without decimals, keeping the labels
   * short enough for the fixed axis gutter.
   */
  formatAxisValue(value: number): string {
    if (this.stacking() === 'percent') {
      return `${value}%`;
    }
    return formatChartValue(value, { compact: true, decimals: 0 });
  }

  /**
   * Formats a segment's share of its stack — already a 0–100 number, not a
   * fraction — to one decimal place with a `%` suffix. The template shows it in
   * the tooltip only when {@link stacking} is `'percent'`.
   */
  formatPercentage(value: number): string {
    return formatPercentage(value, 1);
  }
}
