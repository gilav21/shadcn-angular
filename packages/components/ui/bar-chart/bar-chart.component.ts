import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  ElementRef,
  inject,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
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
export class BarChartComponent {
  private readonly el = inject(ElementRef);

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

  ngAfterViewInit() {
    this._checkDirection();

    setTimeout(() => this._checkDirection(), 0);
  }

  private _checkDirection() {
    this._domRtl.set(isRtl(this.el.nativeElement));
  }

  svgWidth = computed(() => this.width());
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

    const barCount = data.length;
    const totalGaps = (barCount - 1) * gap;
    const availableSpace = isVert ? area.width : area.height;
    const barSize = (availableSpace - totalGaps) / barCount;

    return data.map((point, index) => {
      const normalizedValue = (point.value - range.min) / (range.max - range.min);
      const barLength = normalizedValue * (isVert ? area.height : area.width);
      const color = getChartColor(index, point.color);

      let x: number, y: number, width: number, height: number;
      let labelX: number, labelY: number;

      if (isVert) {
        // Vertical (Column) Chart
        if (this.isRtl()) {
          x = area.right - index * (barSize + gap) - barSize;
        } else {
          x = area.left + index * (barSize + gap);
        }
        y = area.bottom - barLength;
        width = barSize;
        height = barLength;
        labelX = x + width / 2;
        labelY = y - 6;
      } else if (this.isRtl()) {
        x = area.right - barLength;
        y = area.top + index * (barSize + gap);
        width = barLength;
        height = barSize;
        labelX = x - 6;
        labelY = y + height / 2;
      } else {
        x = area.left;
        y = area.top + index * (barSize + gap);
        width = barLength;
        height = barSize;
        labelX = x + width + 6;
        labelY = y + height / 2;
      }

      return {
        index,
        data: point,
        x,
        y,
        width: Math.max(0, width),
        height: Math.max(0, height),
        color,
        value: point.value,
        labelPosition: { x: labelX, y: labelY },
      };
    });
  });

  hoveredBar = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return null;
    return this.bars().find(b => b.index === idx) ?? null;
  });

  chartAriaLabel = computed(() => {
    const type = this.isVertical() ? 'Column chart' : 'Bar chart';
    return getChartSummary(type, this.data().length, this.title());
  });

  containerClasses = computed(() => cn('relative inline-block max-w-full', this.class()));

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

  onBarHover(bar: BarRect) {
    this.hoveredIndex.set(bar.index);
    this.barHover.emit({ point: bar.data, index: bar.index });
  }

  onBarLeave() {
    this.hoveredIndex.set(null);
    this.barHover.emit(null);
  }

  onBarClick(event: Event, bar: BarRect) {
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
