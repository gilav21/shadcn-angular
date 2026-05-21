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
  data = input.required<ChartDataPoint[]>();
  size = input(300);
  innerRadius = input(0);
  showLabels = input(true);
  showLegend = input(true);
  legendPosition = input<LegendPosition>('right');
  showTooltip = input(true);
  animated = input(true);
  class = input('');
  title = input<string | undefined>(undefined);

  sliceClick = output<ChartClickEvent>();
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

  onSliceHover(slice: PieSlice) {
    this.hoveredIndex.set(slice.index);
    this.sliceHover.emit({ point: slice.data, index: slice.index });
  }

  onSliceLeave() {
    this.hoveredIndex.set(null);
    this.sliceHover.emit(null);
  }

  onSliceClick(event: Event, slice: PieSlice) {
    this.sliceClick.emit({
      point: slice.data,
      index: slice.index,
      event: event instanceof MouseEvent ? event : undefined,
    });
  }

  getSliceAriaLabel(slice: PieSlice): string {
    return getPointAriaLabel(
      slice.data.name,
      slice.data.value,
      slice.percentage,
      this.total()
    );
  }

  formatValue(value: number): string {
    return formatChartValue(value);
  }

  formatPercentage(value: number): string {
    return formatPercentage(value, 1);
  }

  isLightColor(color: string): boolean {
    return color.includes('yellow') || color.includes('50%)');
  }
}
