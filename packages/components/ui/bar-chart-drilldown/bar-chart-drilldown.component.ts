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
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
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

  data = input.required<DrilldownDataPoint[]>();
  drilldownSeries = input<DrilldownSeries[]>([]);
  width = input(500);
  height = input(300);
  showGrid = input(true);
  showValues = input(true);
  showTooltip = input(true);
  barRadius = input(4);
  barGap = input(8);
  showBreadcrumb = input(true);
  backButtonText = input('Back');
  class = input('');
  title = input<string | undefined>(undefined);

  drilldown = output<DrilldownEvent>();
  drillup = output<void>();
  barClick = output<ChartClickEvent<DrilldownDataPoint>>();
  barHover = output<ChartClickEvent<DrilldownDataPoint> | null>();

  currentDrilldownId = signal<string | null>(null);
  hoveredIndex = signal<number | null>(null);
  tooltipPosition = signal({ x: 0, y: 0 });

  svgWidth = computed(() => this.width());
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

  containerClasses = computed(() => cn('relative inline-block max-w-full', this.class()));

  hasDrilldown(bar: BarRect): boolean {
    const point = bar.data as DrilldownDataPoint;
    return !!point.drilldown && this.drilldownSeries().some(s => s.id === point.drilldown);
  }

  getTickPosition(tick: number): number {
    const range = this.dataRange();
    const area = this.chartArea();
    const normalized = (tick - range.min) / (range.max - range.min);
    return area.bottom - normalized * area.height;
  }

  onBarHover(bar: BarRect) {
    this.hoveredIndex.set(bar.index);
    this.barHover.emit({ point: bar.data as DrilldownDataPoint, index: bar.index });
  }

  onBarLeave() {
    this.hoveredIndex.set(null);
    this.barHover.emit(null);
  }

  onBarClick(event: Event, bar: BarRect) {
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

  onDrillUp() {
    this.currentDrilldownId.set(null);
    this.hoveredIndex.set(null);
    this.drillup.emit();
  }

  getBarAriaLabel(bar: BarRect): string {
    const label = getPointAriaLabel(bar.data.name, bar.value);
    if (this.hasDrilldown(bar)) {
      return `${label}. Press Enter to drill down.`;
    }
    return label;
  }

  formatValue(value: number): string {
    return formatChartValue(value, { compact: true });
  }

  formatAxisValue(value: number): string {
    return formatChartValue(value, { compact: true, decimals: 0 });
  }
}
