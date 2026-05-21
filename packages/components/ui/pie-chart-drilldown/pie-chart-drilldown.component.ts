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
  data = input.required<DrilldownDataPoint[]>();
  drilldownSeries = input<DrilldownSeries[]>([]);
  size = input(300);
  innerRadius = input(0);
  showLabels = input(true);
  showLegend = input(true);
  legendPosition = input<LegendPosition>('right');
  showTooltip = input(true);
  showBreadcrumb = input(true);
  backButtonText = input('Back');
  class = input('');
  title = input<string | undefined>(undefined);

  drilldown = output<DrilldownEvent>();
  drillup = output<void>();
  sliceClick = output<ChartClickEvent<DrilldownDataPoint>>();
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

  hasDrilldown(slice: PieSlice): boolean {
    const point = slice.data as DrilldownDataPoint;
    return !!point.drilldown && this.drilldownSeries().some(s => s.id === point.drilldown);
  }

  onSliceHover(slice: PieSlice) {
    this.hoveredIndex.set(slice.index);
    this.sliceHover.emit({ point: slice.data as DrilldownDataPoint, index: slice.index });
  }

  onSliceLeave() {
    this.hoveredIndex.set(null);
    this.sliceHover.emit(null);
  }

  onSliceClick(event: Event, slice: PieSlice) {
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

  onDrillUp() {
    this.currentDrilldownId.set(null);
    this.hoveredIndex.set(null);
    this.drillup.emit();
  }

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

  formatValue(value: number): string {
    return formatChartValue(value);
  }

  formatPercentage(value: number): string {
    return formatPercentage(value, 1);
  }
}
