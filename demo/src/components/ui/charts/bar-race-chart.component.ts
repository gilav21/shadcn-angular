import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    OnDestroy,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { ChartDataPoint } from './chart.types';
import {
    getChartColor,
    formatChartValue,
    getChartSummary,
} from './chart.utils';

interface RaceBar {
    name: string;
    value: number;
    rank: number;
    previousRank: number;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    animatedY: number;
    animatedWidth: number;
}

@Component({
    selector: 'ui-bar-race-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div [class]="containerClasses()">
      <div class="flex items-center justify-between mb-4">
        <div class="text-2xl font-bold text-foreground">
          {{ currentFrameLabel() }}
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="p-2 rounded-md hover:bg-muted transition-colors"
            [attr.aria-label]="isPlaying() ? 'Pause' : 'Play'"
            (click)="togglePlay()"
          >
            @if (isPlaying()) {
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            }
          </button>
          <button
            type="button"
            class="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Reset"
            (click)="reset()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        </div>
      </div>

      <svg
        [attr.width]="svgWidth()"
        [attr.height]="svgHeight()"
        class="overflow-visible"
        role="img"
        [attr.aria-label]="chartAriaLabel()"
      >
        <g>
          @for (bar of displayBars(); track bar.name) {
            <g class="transition-transform duration-300 ease-out">
              <rect
                [attr.x]="chartArea().left"
                [attr.y]="bar.animatedY"
                [attr.width]="bar.animatedWidth"
                [attr.height]="barHeight()"
                [attr.rx]="barRadius()"
                [attr.fill]="bar.color"
                class="transition-all ease-out"
                [style.transition-duration.ms]="animationDuration()"
              />
              <text
                [attr.x]="chartArea().left - 8"
                [attr.y]="bar.animatedY + barHeight() / 2"
                text-anchor="end"
                dominant-baseline="middle"
                class="text-sm fill-foreground font-medium transition-all ease-out"
                [style.transition-duration.ms]="animationDuration()"
              >
                {{ bar.name }}
              </text>
              <text
                [attr.x]="chartArea().left + bar.animatedWidth + 8"
                [attr.y]="bar.animatedY + barHeight() / 2"
                dominant-baseline="middle"
                class="text-sm fill-muted-foreground transition-all ease-out"
                [style.transition-duration.ms]="animationDuration()"
              >
                {{ formatValue(bar.value) }}
              </text>
            </g>
          }
        </g>
      </svg>

      <div class="mt-4">
        <div class="flex items-center gap-2">
          <input
            type="range"
            [min]="0"
            [max]="frames().length - 1"
            [value]="currentFrameIndex()"
            class="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            (input)="onSliderChange($event)"
          />
        </div>
        <div class="flex justify-between text-xs text-muted-foreground mt-1">
          @if (frameLabels().length > 0) {
            <span>{{ frameLabels()[0] }}</span>
            <span>{{ frameLabels()[frameLabels().length - 1] }}</span>
          }
        </div>
      </div>
    </div>
  `,
    host: {
        class: 'block',
    },
})
export class BarRaceChartComponent implements OnDestroy {
    frames = input.required<ChartDataPoint[][]>();
    frameLabels = input<string[]>([]);
    animationDuration = input(500);
    autoPlay = input(false);
    loop = input(false);
    maxBars = input(10);
    width = input(600);
    height = input(400);
    barRadius = input(4);
    barGap = input(4);
    class = input('');
    title = input<string | undefined>(undefined);

    frameChange = output<number>();
    animationComplete = output<void>();

    currentFrameIndex = signal(0);
    isPlaying = signal(false);
    private animationTimer: ReturnType<typeof setTimeout> | null = null;
    private colorMap = new Map<string, string>();

    svgWidth = computed(() => this.width());
    svgHeight = computed(() => this.height());

    barHeight = computed(() => {
        const area = this.chartArea();
        const maxB = this.maxBars();
        const totalGaps = (maxB - 1) * this.barGap();
        return (area.height - totalGaps) / maxB;
    });

    padding = computed(() => ({
        top: 10,
        right: 80,
        bottom: 10,
        left: 120,
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

    currentFrame = computed(() => {
        const idx = this.currentFrameIndex();
        return this.frames()[idx] ?? [];
    });

    currentFrameLabel = computed(() => {
        const idx = this.currentFrameIndex();
        const labels = this.frameLabels();
        return labels[idx] ?? `Frame ${idx + 1}`;
    });

    maxValue = computed(() => {
        const frame = this.currentFrame();
        if (frame.length === 0) return 100;
        return Math.max(...frame.map(d => d.value)) * 1.1;
    });

    displayBars = computed((): RaceBar[] => {
        const frame = this.currentFrame();
        if (frame.length === 0) return [];

        const area = this.chartArea();
        const maxVal = this.maxValue();
        const maxB = this.maxBars();
        const bHeight = this.barHeight();
        const gap = this.barGap();

        const sorted = [...frame]
            .sort((a, b) => b.value - a.value)
            .slice(0, maxB);

        return sorted.map((point, rank) => {
            if (!this.colorMap.has(point.name)) {
                this.colorMap.set(point.name, getChartColor(this.colorMap.size, point.color));
            }

            const color = this.colorMap.get(point.name)!;
            const normalizedValue = point.value / maxVal;
            const barWidth = normalizedValue * area.width;
            const y = area.top + rank * (bHeight + gap);

            return {
                name: point.name,
                value: point.value,
                rank,
                previousRank: rank,
                color,
                x: area.left,
                y,
                width: barWidth,
                height: bHeight,
                animatedY: y,
                animatedWidth: barWidth,
            };
        });
    });

    chartAriaLabel = computed(() =>
        getChartSummary('Bar race chart', this.currentFrame().length, this.title())
    );

    containerClasses = computed(() => cn('relative', this.class()));

    constructor() {
        setTimeout(() => {
            if (this.autoPlay()) {
                this.play();
            }
        });
    }

    ngOnDestroy() {
        this.stopAnimation();
    }

    play() {
        if (this.isPlaying()) return;
        this.isPlaying.set(true);
        this.animateNextFrame();
    }

    pause() {
        this.isPlaying.set(false);
        this.stopAnimation();
    }

    togglePlay() {
        if (this.isPlaying()) {
            this.pause();
        } else {
            this.play();
        }
    }

    reset() {
        this.pause();
        this.currentFrameIndex.set(0);
        this.frameChange.emit(0);
    }

    goToFrame(index: number) {
        const frames = this.frames();
        const validIndex = Math.max(0, Math.min(frames.length - 1, index));
        this.currentFrameIndex.set(validIndex);
        this.frameChange.emit(validIndex);
    }

    private animateNextFrame() {
        if (!this.isPlaying()) return;

        const frames = this.frames();
        const currentIdx = this.currentFrameIndex();

        if (currentIdx >= frames.length - 1) {
            if (this.loop()) {
                this.currentFrameIndex.set(0);
                this.frameChange.emit(0);
            } else {
                this.isPlaying.set(false);
                this.animationComplete.emit();
                return;
            }
        } else {
            this.currentFrameIndex.set(currentIdx + 1);
            this.frameChange.emit(currentIdx + 1);
        }

        this.animationTimer = setTimeout(() => {
            this.animateNextFrame();
        }, this.animationDuration());
    }

    private stopAnimation() {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
    }

    onSliderChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = parseInt(target.value, 10);
        this.pause();
        this.goToFrame(value);
    }

    formatValue(value: number): string {
        return formatChartValue(value, { compact: true });
    }
}
