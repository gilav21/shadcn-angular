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
    AxisConfig,
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
    selector: 'ui-bar-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      [class]="containerClasses()"
      role="img"
      [attr.aria-label]="chartAriaLabel()"
    >
      <svg
        [attr.width]="svgWidth()"
        [attr.height]="svgHeight()"
        class="overflow-visible"
      >
        @if (showGrid()) {
          <g class="text-border">
            @for (tick of axisTicks(); track tick) {
              @if (isVertical()) {
                <line
                  [attr.x1]="chartArea().left"
                  [attr.y1]="getTickPosition(tick)"
                  [attr.x2]="chartArea().right"
                  [attr.y2]="getTickPosition(tick)"
                  stroke="currentColor"
                  stroke-opacity="0.2"
                  stroke-dasharray="4 4"
                />
              } @else {
                <line
                  [attr.x1]="getTickPosition(tick)"
                  [attr.y1]="chartArea().top"
                  [attr.x2]="getTickPosition(tick)"
                  [attr.y2]="chartArea().bottom"
                  stroke="currentColor"
                  stroke-opacity="0.2"
                  stroke-dasharray="4 4"
                />
              }
            }
          </g>
        }

        <g class="text-muted-foreground text-xs">
          @for (tick of axisTicks(); track tick) {
            @if (isVertical()) {
              <text
                [attr.x]="chartArea().left - 8"
                [attr.y]="getTickPosition(tick)"
                text-anchor="end"
                dominant-baseline="middle"
                fill="currentColor"
              >
                {{ formatAxisValue(tick) }}
              </text>
            } @else {
              <text
                [attr.x]="getTickPosition(tick)"
                [attr.y]="chartArea().bottom + 16"
                text-anchor="middle"
                fill="currentColor"
              >
                {{ formatAxisValue(tick) }}
              </text>
            }
          }
        </g>

        <g class="text-muted-foreground text-xs">
          @for (bar of bars(); track bar.index) {
            @if (isVertical()) {
              <text
                [attr.x]="bar.x + bar.width / 2"
                [attr.y]="chartArea().bottom + 16"
                text-anchor="middle"
                fill="currentColor"
                class="truncate"
              >
                {{ bar.data.name }}
              </text>
            } @else {
              <text
                [attr.x]="chartArea().left - 8"
                [attr.y]="bar.y + bar.height / 2"
                text-anchor="end"
                dominant-baseline="middle"
                fill="currentColor"
              >
                {{ bar.data.name }}
              </text>
            }
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
                  [attr.x]="bar.labelPosition.x"
                  [attr.y]="bar.labelPosition.y"
                  [attr.text-anchor]="isVertical() ? 'middle' : 'start'"
                  [attr.dominant-baseline]="isVertical() ? 'auto' : 'middle'"
                  class="text-xs font-medium pointer-events-none"
                  [class.fill-foreground]="true"
                >
                  {{ formatValue(bar.value) }}
                </text>
              }
            </g>
          }
        </g>

        @if (xAxisLabel()) {
          <text
            [attr.x]="svgWidth() / 2"
            [attr.y]="svgHeight() - 4"
            text-anchor="middle"
            class="text-sm fill-muted-foreground"
          >
            {{ xAxisLabel() }}
          </text>
        }

        @if (yAxisLabel()) {
          <text
            [attr.x]="12"
            [attr.y]="svgHeight() / 2"
            text-anchor="middle"
            [attr.transform]="'rotate(-90 12 ' + svgHeight() / 2 + ')'"
            class="text-sm fill-muted-foreground"
          >
            {{ yAxisLabel() }}
          </text>
        }
      </svg>

      @if (hoveredBar() && showTooltip()) {
        <div
          class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none"
          [style.left.px]="tooltipPosition().x"
          [style.top.px]="tooltipPosition().y"
        >
          <div class="font-medium">{{ hoveredBar()!.data.name }}</div>
          <div class="text-muted-foreground">{{ formatValue(hoveredBar()!.value) }}</div>
        </div>
      }
    </div>
  `,
    host: {
        class: 'block',
    },
})
export class BarChartComponent {
    private el = inject(ElementRef);

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

    barClick = output<ChartClickEvent>();
    barHover = output<ChartClickEvent | null>();

    hoveredIndex = signal<number | null>(null);
    tooltipPosition = signal({ x: 0, y: 0 });

    isVertical = computed(() => this.orientation() === 'vertical');
    isRtl = computed(() => isRtl(this.el.nativeElement));

    svgWidth = computed(() => this.width());
    svgHeight = computed(() => this.height());

    padding = computed(() => ({
        top: 20,
        right: 20,
        bottom: this.xAxisLabel() ? 50 : 35,
        left: this.yAxisLabel() ? 60 : 50,
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
                x = area.left + index * (barSize + gap);
                y = area.bottom - barLength;
                width = barSize;
                height = barLength;
                labelX = x + width / 2;
                labelY = y - 6;
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

    containerClasses = computed(() => cn('relative inline-block', this.class()));

    getTickPosition(tick: number): number {
        const range = this.dataRange();
        const area = this.chartArea();
        const normalized = (tick - range.min) / (range.max - range.min);

        if (this.isVertical()) {
            return area.bottom - normalized * area.height;
        } else {
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
