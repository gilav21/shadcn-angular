import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { RangeDataPoint, ChartClickEvent } from './chart.types';
import {
    getChartColor,
    formatChartValue,
    getChartSummary,
    calculateAxisTicks,
} from './chart.utils';

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
    template: `
    <div [class]="containerClasses()">
      <svg
        [attr.width]="svgWidth()"
        [attr.height]="svgHeight()"
        class="overflow-visible"
        role="img"
        [attr.aria-label]="chartAriaLabel()"
      >
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

              @if (showRangeLabels()) {
                <text
                  [attr.x]="bar.x + bar.width / 2"
                  [attr.y]="bar.highY - 6"
                  text-anchor="middle"
                  class="text-xs font-medium fill-foreground pointer-events-none"
                >
                  {{ formatValue(bar.data.high) }}
                </text>
                <text
                  [attr.x]="bar.x + bar.width / 2"
                  [attr.y]="bar.lowY + 14"
                  text-anchor="middle"
                  class="text-xs font-medium fill-foreground pointer-events-none"
                >
                  {{ formatValue(bar.data.low) }}
                </text>
              }
            </g>
          }
        </g>
      </svg>

      @if (hoveredBar()) {
        <div
          class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none"
          [style.left.px]="tooltipPosition().x"
          [style.top.px]="tooltipPosition().y"
        >
          <div class="font-medium">{{ hoveredBar()!.data.name }}</div>
          <div class="text-muted-foreground">
            Range: {{ formatValue(hoveredBar()!.data.low) }} – {{ formatValue(hoveredBar()!.data.high) }}
          </div>
        </div>
      }
    </div>
  `,
    host: {
        class: 'block',
    },
})
export class ColumnRangeChartComponent {
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

    svgWidth = computed(() => this.width());
    svgHeight = computed(() => this.height());

    padding = computed(() => ({
        top: 30,
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

            const x = area.left + index * (barWidth + gap);
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

    containerClasses = computed(() => cn('relative inline-block', this.class()));

    getTickPosition(tick: number): number {
        const range = this.dataRange();
        const area = this.chartArea();
        const normalized = (tick - range.min) / (range.max - range.min);
        return area.bottom - normalized * area.height;
    }

    onBarHover(bar: RangeBar) {
        this.hoveredIndex.set(bar.index);
    }

    onBarLeave() {
        this.hoveredIndex.set(null);
    }

    onBarClick(event: Event, bar: RangeBar) {
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
