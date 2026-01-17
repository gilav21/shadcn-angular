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
import { cn } from '../../lib/utils';
import {
    DrilldownDataPoint,
    DrilldownSeries,
    DrilldownEvent,
    ChartClickEvent,
    BarRect,
} from './chart.types';
import {
    getChartColor,
    formatChartValue,
    getChartSummary,
    getPointAriaLabel,
    calculateAxisTicks,
    getDataRange,
} from './chart.utils';

@Component({
    selector: 'ui-bar-chart-drilldown',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="containerClasses()">
      <!-- Breadcrumb -->
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

      <svg
        [attr.width]="svgWidth()"
        [attr.height]="svgHeight()"
        class="overflow-visible"
        role="img"
        [attr.aria-label]="chartAriaLabel()"
      >
        <!-- Grid lines -->
        @if (showGrid()) {
          <g class="text-border">
            @for (tick of axisTicks(); track tick) {
              <line
                [attr.x1]="chartArea().left"
                [attr.y1]="getTickPosition(tick)"
                [attr.x2]="chartArea().right"
                [attr.y2]="getTickPosition(tick)"
                stroke="currentColor"
                stroke-opacity="0.2"
                stroke-dasharray="4 4"
              />
            }
          </g>
        }

        <!-- Axis labels -->
        <g class="text-muted-foreground text-xs">
          @for (tick of axisTicks(); track tick) {
            <text
              [attr.x]="chartArea().left - 8"
              [attr.y]="getTickPosition(tick)"
              text-anchor="end"
              dominant-baseline="middle"
              fill="currentColor"
            >
              {{ formatAxisValue(tick) }}
            </text>
          }
        </g>

        <!-- Category labels -->
        <g class="text-muted-foreground text-xs">
          @for (bar of bars(); track bar.index) {
            <text
              [attr.x]="bar.x + bar.width / 2"
              [attr.y]="chartArea().bottom + 16"
              text-anchor="middle"
              fill="currentColor"
            >
              {{ bar.data.name }}
            </text>
          }
        </g>

        <!-- Bars -->
        <g>
          @for (bar of bars(); track bar.index) {
            <g
              class="cursor-pointer outline-none"
              [class.opacity-50]="hoveredIndex() !== null && hoveredIndex() !== bar.index"
              tabindex="0"
              role="button"
              [attr.aria-label]="getBarAriaLabel(bar)"
              (mouseenter)="onBarHover(bar)"
              (mouseleave)="onBarLeave()"
              (focus)="onBarHover(bar)"
              (blur)="onBarLeave()"
              (click)="onBarClick($event, bar)"
              (keydown.enter)="onBarClick($event, bar)"
              (keydown.space)="onBarClick($event, bar)"
            >
              <rect
                [attr.x]="bar.x"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                [attr.rx]="barRadius()"
                [attr.fill]="bar.color"
                class="transition-all duration-200 ease-out"
                [class.brightness-110]="hoveredIndex() === bar.index"
              />

              @if (showValues()) {
                <text
                  [attr.x]="bar.x + bar.width / 2"
                  [attr.y]="bar.y - 6"
                  text-anchor="middle"
                  class="text-xs font-medium fill-foreground pointer-events-none"
                >
                  {{ formatValue(bar.value) }}
                </text>
              }
            </g>
          }
        </g>
      </svg>

      <!-- Tooltip -->
      @if (hoveredBar() && showTooltip()) {
        <div
          class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none"
          [style.left.px]="tooltipPosition().x"
          [style.top.px]="tooltipPosition().y"
        >
          <div class="font-medium">{{ hoveredBar()!.data.name }}</div>
          <div class="text-muted-foreground">{{ formatValue(hoveredBar()!.value) }}</div>
          @if (hasDrilldown(hoveredBar()!)) {
            <div class="text-xs text-primary mt-1">Click to drill down</div>
          }
        </div>
      }
    </div>
  `,
    host: {
        class: 'block',
    },
})
export class BarChartDrilldownComponent {
    private el = inject(ElementRef);

    /** Main data points */
    data = input.required<DrilldownDataPoint[]>();
    /** Drilldown series */
    drilldownSeries = input<DrilldownSeries[]>([]);
    /** Chart width */
    width = input(500);
    /** Chart height */
    height = input(300);
    /** Show grid lines */
    showGrid = input(true);
    /** Show value labels */
    showValues = input(true);
    /** Show tooltip */
    showTooltip = input(true);
    /** Bar corner radius */
    barRadius = input(4);
    /** Gap between bars */
    barGap = input(8);
    /** Show breadcrumb */
    showBreadcrumb = input(true);
    /** Back button text */
    backButtonText = input('← Back');
    /** Additional classes */
    class = input('');
    /** Chart title */
    title = input<string | undefined>(undefined);

    /** Emitted on drilldown */
    drilldown = output<DrilldownEvent>();
    /** Emitted on drillup */
    drillup = output<void>();
    /** Emitted on bar click */
    barClick = output<ChartClickEvent<DrilldownDataPoint>>();
    /** Emitted on bar hover */
    barHover = output<ChartClickEvent<DrilldownDataPoint> | null>();

    // State
    currentDrilldownId = signal<string | null>(null);
    hoveredIndex = signal<number | null>(null);
    tooltipPosition = signal({ x: 0, y: 0 });

    // Computed
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
        right: 20,
        bottom: 35,
        left: 50,
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
            const x = area.left + index * (barWidth + gap);
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

    containerClasses = computed(() => cn('relative inline-block', this.class()));

    // Methods
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
