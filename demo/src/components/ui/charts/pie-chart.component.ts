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
} from './chart.types';
import {
  getChartColor,
  describeArc,
  getSliceCentroid,
  sumValues,
  formatChartValue,
  formatPercentage,
  getChartSummary,
  getPointAriaLabel,
} from './chart.utils';

@Component({
  selector: 'ui-pie-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      [class]="containerClasses()"
      [attr.aria-label]="chartAriaLabel()"
      role="img"
    >
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.viewBox]="viewBox()"
        class="overflow-visible"
      >
        <g [attr.transform]="'translate(' + center() + ',' + center() + ')'">
          @for (slice of slices(); track slice.index) {
            <g
              class="cursor-pointer outline-none"
              [class.opacity-50]="hoveredIndex() !== null && hoveredIndex() !== slice.index"
              tabindex="0"
              role="button"
              [attr.aria-label]="getSliceAriaLabel(slice)"
              (mouseenter)="onSliceHover(slice)"
              (mouseleave)="onSliceLeave()"
              (focus)="onSliceHover(slice)"
              (blur)="onSliceLeave()"
              (click)="onSliceClick($event, slice)"
              (keydown.enter)="onSliceClick($event, slice)"
              (keydown.space)="onSliceClick($event, slice)"
            >
              <path
                [attr.d]="slice.path"
                [attr.fill]="slice.color"
                class="transition-all duration-200 ease-out"
                [class.scale-105]="hoveredIndex() === slice.index"
                [attr.transform-origin]="'0 0'"
                [style.filter]="hoveredIndex() === slice.index ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'none'"
              />
              @if (showLabels() && slice.percentage >= 5) {
                <text
                  [attr.x]="slice.centroid.x"
                  [attr.y]="slice.centroid.y"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  class="text-xs font-medium fill-white pointer-events-none"
                  [class.fill-foreground]="isLightColor(slice.color)"
                >
                  {{ formatPercentage(slice.percentage) }}
                </text>
              }
            </g>
          }
        </g>
      </svg>

      @if (showLegend() && legendPosition() !== 'none') {
        <div [class]="legendClasses()">
          @for (slice of slices(); track slice.index) {
            <button
              type="button"
              class="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
              [class.opacity-50]="hoveredIndex() !== null && hoveredIndex() !== slice.index"
              (mouseenter)="onSliceHover(slice)"
              (mouseleave)="onSliceLeave()"
              (click)="onSliceClick($event, slice)"
            >
              <span
                class="w-3 h-3 rounded-sm shrink-0"
                [style.backgroundColor]="slice.color"
              ></span>
              <span class="text-muted-foreground truncate">{{ slice.data.name }}</span>
              <span class="text-foreground font-medium">{{ formatValue(slice.data.value) }}</span>
            </button>
          }
        </div>
      }

      @if (hoveredSlice() && showTooltip()) {
        <div
          class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none"
          [style.left.px]="tooltipPosition().x"
          [style.top.px]="tooltipPosition().y"
        >
          <div class="font-medium">{{ hoveredSlice()!.data.name }}</div>
          <div class="text-muted-foreground">
            {{ formatValue(hoveredSlice()!.data.value) }} ({{ formatPercentage(hoveredSlice()!.percentage) }})
          </div>
        </div>
      }
    </div>
  `,
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
    const flexDirection = pos === 'left' || pos === 'right' ? 'flex-row' : 'flex-col';
    const rowReverse = pos === 'left' ? 'flex-row-reverse' : '';
    const colReverse = pos === 'top' ? 'flex-col-reverse' : '';

    return cn(
      'relative flex gap-4 items-center',
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
      isVertical ? 'flex-col' : 'flex-row flex-wrap justify-center'
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
