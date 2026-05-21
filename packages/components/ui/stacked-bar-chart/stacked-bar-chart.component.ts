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
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
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
  dir = input<ChartDirection>('auto');
  private readonly el = inject(ElementRef);

  private readonly _domRtl = signal(false);


  isRtl = computed(() => {
    const d = this.dir();
    if (d === 'rtl') return true;
    if (d === 'ltr') return false;
    return this._domRtl();
  });

  ngAfterViewInit() {
    this._checkDirection();
    setTimeout(() => this._checkDirection(), 0);
  }

  private _checkDirection() {
    this._domRtl.set(isRtl(this.el.nativeElement));
  }
  series = input.required<ChartSeries[]>();
  categories = input.required<string[]>();
  stacking = input<StackingMode>('absolute');
  width = input(500);
  height = input(300);
  showGrid = input(true);
  showTotal = input(false);
  showLegend = input(true);
  barRadius = input(4);
  barGap = input(12);
  class = input('');
  title = input<string | undefined>(undefined);

  segmentClick = output<{ series: string; category: string; value: number }>();

  private readonly hoveredKey = signal<{ category: number; series: number } | null>(null);
  tooltipPosition = signal({ x: 0, y: 0 });

  svgWidth = computed(() => this.width());
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

        const normalizedValue = isPercent
          ? percentage / 100
          : value / maxVal;
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

  containerClasses = computed(() => cn('relative inline-block max-w-full', this.class()));

  getTickPosition(tick: number): number {
    const maxVal = this.maxValue();
    const area = this.chartArea();
    const normalized = tick / maxVal;
    return area.bottom - normalized * area.height;
  }

  getBarCenterX(bar: StackedBar): number {
    const segment = bar.segments[0];
    return segment ? segment.x + segment.width / 2 : 0;
  }

  getBarTopY(bar: StackedBar): number {
    const topSegment = bar.segments.at(-1);
    return topSegment?.y ?? 0;
  }

  getSeriesColor(index: number): string {
    const s = this.series()[index];
    return getChartColor(index, s?.color);
  }

  isHovered(categoryIndex: number, seriesIndex: number): boolean {
    const key = this.hoveredKey();
    return key !== null && key.category === categoryIndex && key.series === seriesIndex;
  }

  onSegmentHover(categoryIndex: number, segment: StackedSegment) {
    this.hoveredKey.set({ category: categoryIndex, series: segment.seriesIndex });
  }

  onSegmentLeave() {
    this.hoveredKey.set(null);
  }

  onSegmentClick(event: Event, segment: StackedSegment, bar: StackedBar) {
    this.segmentClick.emit({
      series: segment.seriesName,
      category: bar.category,
      value: segment.value,
    });
  }

  getSegmentAriaLabel(segment: StackedSegment, bar: StackedBar): string {
    return `${segment.seriesName} in ${bar.category}: ${formatChartValue(segment.value)}`;
  }

  formatValue(value: number): string {
    return formatChartValue(value, { compact: true });
  }

  formatAxisValue(value: number): string {
    if (this.stacking() === 'percent') {
      return `${value}%`;
    }
    return formatChartValue(value, { compact: true, decimals: 0 });
  }

  formatPercentage(value: number): string {
    return formatPercentage(value, 1);
  }
}
