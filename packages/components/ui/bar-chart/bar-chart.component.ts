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
  calculateAxisTicks,
  getDataRange,
} from '../../lib/chart.utils';

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

  data = input.required<ChartDataPoint[]>();
  orientation = input<ChartOrientation>('vertical');
  width = input(500);
  height = input(300);
  showGrid = input(true);
  showValues = input(true);
  showTooltip = input(true);
  barRadius = input(4);
  barGap = input(8);
  xAxisLabel = input('');
  yAxisLabel = input('');
  class = input('');
  title = input<string | undefined>(undefined);
  dir = input<ChartDirection>('auto');

  barClick = output<ChartClickEvent>();
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

  dataRange = computed(() => {
    const range = getDataRange(this.data());
    return { min: 0, max: range.max * 1.1 };
  });

  axisTicks = computed(() => {
    const range = this.dataRange();
    return calculateAxisTicks(range.min, range.max, 5);
  });

  bars = computed((): BarRect[] => {
    const data = this.data();
    if (data.length === 0) return [];

    const area = this.chartArea();
    const range = this.dataRange();
    const gap = this.barGap();
    const isVert = this.isVertical();
    const barSize = this.computeBarSize(isVert, area, gap, data.length);

    return data.map((point, index) => {
      const normalizedValue = (point.value - range.min) / (range.max - range.min);
      const barLength = normalizedValue * (isVert ? area.height : area.width);
      const color = getChartColor(index, point.color);
      const pos = this.computeBarPosition(isVert, area, gap, barSize, barLength, index);

      return {
        index,
        data: point,
        x: pos.x,
        y: pos.y,
        width: Math.max(0, pos.width),
        height: Math.max(0, pos.height),
        color,
        value: point.value,
        labelPosition: { x: pos.labelX, y: pos.labelY },
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

  private computeBarPosition(
    isVert: boolean,
    area: { left: number; right: number; top: number; bottom: number },
    gap: number,
    barSize: number,
    barLength: number,
    index: number
  ): { x: number; y: number; width: number; height: number; labelX: number; labelY: number } {
    if (isVert) {
      const x = this.isRtl()
        ? area.right - index * (barSize + gap) - barSize
        : area.left + index * (barSize + gap);
      const y = area.bottom - barLength;
      return { x, y, width: barSize, height: barLength, labelX: x + barSize / 2, labelY: y - 6 };
    }
    if (this.isRtl()) {
      const x = area.right - barLength;
      const y = area.top + index * (barSize + gap);
      return { x, y, width: barLength, height: barSize, labelX: x - 6, labelY: y + barSize / 2 };
    }
    const x = area.left;
    const y = area.top + index * (barSize + gap);
    return { x, y, width: barLength, height: barSize, labelX: x + barLength + 6, labelY: y + barSize / 2 };
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

  getTickPosition(tick: number): number {
    const range = this.dataRange();
    const area = this.chartArea();
    const normalized = (tick - range.min) / (range.max - range.min);

    if (this.isVertical()) {
      return area.bottom - normalized * area.height;
    } else {
      if (this.isRtl()) {
        return area.right - normalized * area.width;
      }
      return area.left + normalized * area.width;
    }
  }

  onBarHover(bar: BarRect): void {
    this.hoveredIndex.set(bar.index);
    this.barHover.emit({ point: bar.data, index: bar.index });
  }

  onBarLeave(): void {
    this.hoveredIndex.set(null);
    this.barHover.emit(null);
  }

  onBarClick(event: Event, bar: BarRect): void {
    this.barClick.emit({
      point: bar.data,
      index: bar.index,
      event: event instanceof MouseEvent ? event : undefined,
    });
  }

  getBarAriaLabel(bar: BarRect): string {
    return getPointAriaLabel(bar.data.name, bar.value);
  }

  formatValue(value: number): string {
    return formatChartValue(value, { compact: true });
  }

  formatAxisValue(value: number): string {
    return formatChartValue(value, { compact: true, decimals: 0 });
  }
}
