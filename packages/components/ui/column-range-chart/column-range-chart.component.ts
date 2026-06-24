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

  data = input.required<RangeDataPoint[]>();
  width = input(500);
  height = input(300);
  showGrid = input(true);
  showRangeLabels = input(true);
  barRadius = input(4);
  barGap = input(12);
  class = input('');
  title = input<string | undefined>(undefined);
  unit = input('');

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

    return data.map((point, index) => {
      const normalizedLow = (point.low - range.min) / (range.max - range.min);
      const normalizedHigh = (point.high - range.min) / (range.max - range.min);

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

  getTickPosition(tick: number): number {
    const range = this.dataRange();
    const area = this.chartArea();
    const normalized = (tick - range.min) / (range.max - range.min);
    return area.bottom - normalized * area.height;
  }

  onBarHover(bar: RangeBar): void {
    this.hoveredIndex.set(bar.index);
  }

  onBarLeave(): void {
    this.hoveredIndex.set(null);
  }

  onBarClick(event: Event, bar: RangeBar): void {
    this.barClick.emit({
      point: bar.data,
      index: bar.index,
      event: event instanceof MouseEvent ? event : undefined,
    });
  }

  getBarAriaLabel(bar: RangeBar): string {
    const unit = this.unit();
    return `${bar.data.name}: ${bar.data.low}${unit} to ${bar.data.high}${unit}`;
  }

  formatValue(value: number): string {
    return formatChartValue(value, { decimals: 0 }) + this.unit();
  }

  formatAxisValue(value: number): string {
    return formatChartValue(value, { compact: true, decimals: 0 }) + this.unit();
  }
}
