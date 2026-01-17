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
  selector: 'ui-pie-chart-drilldown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="containerClasses()">
      @if (isDrilledDown() && showBreadcrumb()) {
        <div class="flex items-center gap-2 mb-4">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
            (click)="onDrillUp()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            {{ backButtonText() }}
          </button>
          <span class="text-muted-foreground">/</span>
          <span class="text-sm font-medium">{{ currentSeriesName() }}</span>
        </div>
      }

      <div [class]="chartContainerClasses()">
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          [attr.viewBox]="viewBox()"
          class="overflow-visible"
          role="img"
          [attr.aria-label]="chartAriaLabel()"
        >
          <g [attr.transform]="'translate(' + center() + ',' + center() + ')'">
            @for (slice of currentSlices(); track slice.index) {
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
                  [style.filter]="hoveredIndex() === slice.index ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'none'"
                />
                @if (showLabels() && slice.percentage >= 5) {
                  <text
                    [attr.x]="slice.centroid.x"
                    [attr.y]="slice.centroid.y"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    class="text-xs font-medium fill-white pointer-events-none"
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
            @for (slice of currentSlices(); track slice.index) {
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
                @if (hasDrilldown(slice)) {
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                }
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
            @if (hasDrilldown(hoveredSlice()!)) {
              <div class="text-xs text-primary mt-1">Click to drill down</div>
            }
          </div>
        }
      </div>
    </div>
  `,
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

  containerClasses = computed(() => cn('relative', this.class()));

  chartContainerClasses = computed(() => {
    const pos = this.legendPosition();
    const flexDir = pos === 'left' || pos === 'right' ? 'flex-row' : 'flex-col';
    const reverse = pos === 'left' ? 'flex-row-reverse' : pos === 'top' ? 'flex-col-reverse' : '';

    return cn('relative flex gap-4 items-center', flexDir, reverse);
  });

  legendClasses = computed(() => {
    const pos = this.legendPosition();
    const isVertical = pos === 'left' || pos === 'right';
    return cn('flex gap-2', isVertical ? 'flex-col' : 'flex-row flex-wrap justify-center');
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
