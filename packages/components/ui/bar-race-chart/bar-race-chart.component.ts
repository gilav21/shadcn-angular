import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  OnDestroy,
  ElementRef,
  inject,
  AfterViewInit,
  DestroyRef,
} from '@angular/core';
import { cn, isRtl } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { BAR_RACE_CHART_LOCALES, type BarRaceChartLocale } from './bar-race-chart.locales';
import { ChartDataPoint, ChartDirection } from '../../lib/chart.types';
import {
  getChartColor,
  formatChartValue,
  getChartSummary,
} from '../../lib/chart.utils';

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
  templateUrl: './bar-race-chart.component.html',
  host: {
    class: 'block',
  },
})
export class BarRaceChartComponent implements OnDestroy, AfterViewInit {
  dir = input<ChartDirection>('auto');
  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

  private readonly _domRtl = signal(false);


  isRtl = computed(() => {
    const d = this.dir();
    if (d === 'rtl') return true;
    if (d === 'ltr') return false;
    return this._domRtl();
  });

  ngAfterViewInit(): void {
    this._checkDirection();
    setTimeout(() => this._checkDirection(), 0);
  }

  private _checkDirection(): void {
    this._domRtl.set(isRtl(this.el.nativeElement));
  }

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

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<BarRaceChartLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, BAR_RACE_CHART_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly localeDir = this.i18n.dir;

  frameChange = output<number>();
  animationComplete = output<void>();

  currentFrameIndex = signal(0);
  isPlaying = signal(false);
  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly colorMap = new Map<string, string>();

  svgWidth = computed(() => this._measuredWidth() ?? this.width());
  svgHeight = computed(() => this.height());

  barHeight = computed(() => {
    const area = this.chartArea();
    const maxB = this.maxBars();
    const totalGaps = (maxB - 1) * this.barGap();
    return (area.height - totalGaps) / maxB;
  });

  padding = computed(() => ({
    top: 10,
    right: this.isRtl() ? 120 : 80,
    bottom: 10,
    left: this.isRtl() ? 80 : 120,
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

      // colorMap.set is called just above if the key is missing, so get() is guaranteed to return a string
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const color = this.colorMap.get(point.name)!;
      const normalizedValue = point.value / maxVal;
      const barWidth = normalizedValue * area.width;
      const y = area.top + rank * (bHeight + gap);

      const x = this.isRtl() ? area.right - barWidth : area.left;

      return {
        name: point.name,
        value: point.value,
        rank,
        previousRank: rank,
        color,
        x,
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

  containerClasses = computed(() => cn('relative block w-full', this.class()));

  constructor() {
    setTimeout(() => {
      if (this.autoPlay()) {
        this.play();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  play(): void {
    if (this.isPlaying()) return;
    this.isPlaying.set(true);
    this.animateNextFrame();
  }

  pause(): void {
    this.isPlaying.set(false);
    this.stopAnimation();
  }

  togglePlay(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  reset(): void {
    this.pause();
    this.currentFrameIndex.set(0);
    this.frameChange.emit(0);
  }

  goToFrame(index: number): void {
    const frames = this.frames();
    const validIndex = Math.max(0, Math.min(frames.length - 1, index));
    this.currentFrameIndex.set(validIndex);
    this.frameChange.emit(validIndex);
  }

  private animateNextFrame(): void {
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

  private stopAnimation(): void {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  onSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number.parseInt(target.value, 10);
    this.pause();
    this.goToFrame(value);
  }

  formatValue(value: number): string {
    return formatChartValue(value, { compact: true });
  }
}
