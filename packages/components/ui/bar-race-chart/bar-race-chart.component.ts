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
  afterNextRender,
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
  extent,
} from '../../lib/chart.utils';
import { linearScale } from '../../lib/chart-scale';

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
  labelX: number;
  labelAnchor: 'start' | 'end';
}

/** Room, in px, a negative bar's value label needs between the bar end and the name labels at the start edge. */
const LABEL_ROOM = 64;

/** A frame's points, one per name (the last entry for a name wins), highest value first. */
function rankFrame(frame: ChartDataPoint[]): ChartDataPoint[] {
  return [...new Map(frame.map(point => [point.name, point])).values()].sort((a, b) => b.value - a.value);
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
  /**
   * Layout direction of the plot. `'auto'` (default) resolves from the host
   * element's inherited DOM direction after view init; `'ltr'`/`'rtl'` force
   * it. RTL grows the bars from the right edge and moves the name/value labels
   * to the opposite sides. Independent of the container's `dir` attribute,
   * which follows the {@link locale} dictionary. See {@link isRtl}.
   */
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
  }

  private _checkDirection(): void {
    this._domRtl.set(isRtl(this.el.nativeElement));
  }

  /**
   * The whole race: one entry per time step, each holding that step's
   * `{ name, value, color? }` points. Only the frame at
   * {@link currentFrameIndex} is drawn — it is sorted by `value` descending and
   * cut to {@link maxBars}, so array order within a frame is irrelevant and
   * bars re-order as values change. Names are the identity across frames: a
   * point keeps its palette colour (assigned on first sight, or from its own
   * `color`) and its `track` identity for the CSS transition, so reusing the
   * same names between frames is what makes bars slide instead of pop; two
   * entries with one name in a frame are one bar, the last winning. The value
   * axis is rescaled per frame to 110% of that frame's largest (and lowest)
   * value, so lengths are relative within a frame, not across the race. Bars
   * grow from the zero baseline: negative values extend toward the start edge.
   */
  frames = input.required<ChartDataPoint[][]>();
  /**
   * Caption shown above the chart for each frame, matched to {@link frames} by
   * index; a missing entry falls back to `Frame N`. The first and last entries
   * are also printed as the end captions of the timeline slider, so leave this
   * empty to hide those.
   */
  frameLabels = input<string[]>([]);
  /**
   * Milliseconds each frame is held during playback, and also the CSS
   * transition duration applied to the bars and labels — so it doubles as the
   * tween length: the movement finishes exactly as the next frame arrives.
   * Changing it mid-playback takes effect on the next scheduled step.
   */
  animationDuration = input(500);
  /** Start playing on init, without waiting for a {@link play} call or a click on the toolbar button. Read once, shortly after construction. */
  autoPlay = input(false);
  /**
   * On reaching the last frame, jump back to the first and keep playing instead
   * of stopping. With `false` (default) playback halts there and
   * {@link animationComplete} fires; when looping that event never fires.
   */
  loop = input(false);
  /**
   * How many bars to show — the top N of each frame by value; the rest are
   * dropped. Also the divisor for bar thickness: the plot height is split into
   * exactly this many slots whether or not the frame has that many points, so
   * raising it thins every bar.
   */
  maxBars = input(10);
  /**
   * Design width of the SVG user-space coordinate system, in px, and the
   * fallback until the host element has been measured. The rendered SVG is
   * `width="100%"` with this as its `max-width`, so the chart scales down in
   * narrow containers but never past this width. The host must be a
   * block-level box — an inline-block parent collapses a `width:100%` SVG,
   * which is why the container carries `w-full` and the host `class: 'block'`.
   */
  width = input(600);
  /**
   * Design height of the SVG coordinate system, in px. Combined with the
   * measured width it fixes the `aspect-ratio`, so the chart keeps its
   * proportions while scaling — height is never measured from the DOM. It is
   * also the budget split between {@link maxBars} bars and {@link barGap} gaps.
   */
  height = input(400);
  /** Corner rounding of each bar rect, in px (SVG `rx`). Use `0` for square corners. */
  barRadius = input(4);
  /**
   * Vertical gap between bars, in px of user space. The gaps are taken out of
   * the plot height before it is divided by {@link maxBars}, so raising this
   * shrinks the bars rather than growing the chart.
   */
  barGap = input(4);
  /** Extra classes merged onto the chart container, which already carries `relative block w-full`. */
  class = input('');
  /** Human-readable chart name, used only to prefix the SVG's accessible summary. */
  title = input<string | undefined>(undefined);

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<BarRaceChartLocale>>();
  private readonly i18n = createLocaleBindings(this.locale, BAR_RACE_CHART_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly localeDir = this.i18n.dir;

  /**
   * Emits the new {@link frames} index whenever the displayed frame changes —
   * from playback, {@link reset}, {@link goToFrame} or the timeline slider —
   * so external captions can stay in step. {@link goToFrame} emits even when
   * the requested index resolves to the frame already shown, so the stream can
   * repeat a value.
   */
  frameChange = output<number>();
  /** Emits once when playback runs off the last frame and stops. Never emitted while {@link loop} is `true`, and not emitted by {@link pause}. */
  animationComplete = output<void>();

  currentFrameIndex = signal(0);
  isPlaying = signal(false);
  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Palette colour per name, in first-appearance order over all frames (each
   * walked in rank order), or the point's own `color`. Pure in {@link frames},
   * so replacing the frames restarts the palette.
   */
  private readonly colorMap = computed(() => {
    const colors = new Map<string, string>();
    for (const frame of this.frames()) {
      for (const point of rankFrame(frame)) {
        if (!colors.has(point.name)) colors.set(point.name, getChartColor(colors.size, point.color));
      }
    }
    return colors;
  });

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

  /** The positive end of the value axis: the frame's largest value plus 10% headroom for its label (100 for an empty frame). */
  maxValue = computed(() => {
    const frame = this.currentFrame();
    if (frame.length === 0) return 100;
    return Math.max(0, extent(frame.map(d => d.value))?.[1] ?? 0) * 1.1;
  });

  /** The negative end of the value axis: the frame's lowest value plus 10% headroom, or 0 when nothing is negative. */
  minValue = computed(() => Math.min(0, extent(this.currentFrame().map(d => d.value))?.[0] ?? 0) * 1.1);

  private readonly valueScale = computed(() => {
    const area = this.chartArea();
    const range: [number, number] = this.isRtl() ? [area.right, area.left] : [area.left, area.right];
    return linearScale([this.minValue(), this.maxValue()], range);
  });

  /** The x of the value 0, where every bar is anchored: the start edge unless the frame has negative values. */
  baselineX = computed(() => this.valueScale().scale(0));

  displayBars = computed((): RaceBar[] => {
    const frame = this.currentFrame();
    if (frame.length === 0) return [];

    const scale = this.valueScale();
    const baseline = this.baselineX();
    const colors = this.colorMap();
    const bHeight = this.barHeight();
    const gap = this.barGap();
    const area = this.chartArea();
    const startEdge = this.isRtl() ? area.right : area.left;

    return rankFrame(frame).slice(0, this.maxBars()).map((point, rank) => {
      const end = scale.scale(point.value);
      const barWidth = Math.abs(end - baseline);
      const y = area.top + rank * (bHeight + gap);
      // Positive values grow away from the start edge, negative ones toward it.
      const growsRight = (point.value >= 0) !== this.isRtl();
      const x = Math.min(baseline, end);
      const freeEnd = growsRight ? x + barWidth : x;
      // A positive label has the side padding to itself; a negative one runs toward the name labels,
      // so when it has no room before them it moves inside the bar end.
      const outside = point.value >= 0 || Math.abs(freeEnd - startEdge) >= LABEL_ROOM || barWidth < LABEL_ROOM;

      return {
        name: point.name,
        value: point.value,
        rank,
        previousRank: rank,
        color: colors.get(point.name) ?? getChartColor(rank, point.color),
        x,
        y,
        width: barWidth,
        height: bHeight,
        animatedY: y,
        animatedWidth: barWidth,
        labelX: growsRight === outside ? freeEnd + 12 : freeEnd - 12,
        labelAnchor: growsRight === outside ? 'start' : 'end',
      };
    });
  });

  chartAriaLabel = computed(() =>
    getChartSummary('Bar race chart', this.currentFrame().length, this.title())
  );

  containerClasses = computed(() => cn('relative block w-full', this.class()));

  constructor() {
    // Runs after the first render and never after destroy, unlike a timer started here.
    afterNextRender(() => {
      this._checkDirection();
      if (this.autoPlay()) {
        this.play();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  /**
   * Starts playback from the current frame. The first step is taken
   * immediately — the frame after the current one is shown at once, then each
   * further step waits {@link animationDuration}. A no-op while already
   * playing. Called on the last frame with {@link loop} off it stops again at
   * once, emitting {@link animationComplete} without moving; call
   * {@link reset} first to replay.
   */
  play(): void {
    if (this.isPlaying()) return;
    this.isPlaying.set(true);
    this.animateNextFrame();
  }

  /** Stops playback on the current frame, cancelling the pending step. {@link animationComplete} is not emitted; {@link play} resumes from here. */
  pause(): void {
    this.isPlaying.set(false);
    this.stopAnimation();
  }

  /** {@link pause} while playing, {@link play} otherwise. Backs the toolbar's play/pause button. */
  togglePlay(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Stops playback and returns to the first frame, emitting
   * {@link frameChange} with `0`. Bars animate back rather than snapping,
   * since the transition is the same one playback uses. Does not restart
   * playback — follow with {@link play} to replay.
   */
  reset(): void {
    this.pause();
    this.currentFrameIndex.set(0);
    this.frameChange.emit(0);
  }

  /**
   * Jumps to a frame by {@link frames} index, clamped into range, and emits
   * {@link frameChange} with the clamped value. Playback is left alone — call
   * {@link pause} first for a manual scrub, or the next scheduled step will
   * continue from wherever you landed.
   */
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

  /**
   * Handles the timeline range input: pauses playback so the scrub isn't
   * fought by the timer, then jumps to the dragged frame via
   * {@link goToFrame}. Bound to `input`, so it fires continuously during the
   * drag.
   */
  onSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number.parseInt(target.value, 10);
    this.pause();
    this.goToFrame(value);
  }

  /** Formats a bar's value for the label printed at the end of the bar, using compact notation (`1.2K`, `3.4M`) so it stays inside the padding gutter. */
  formatValue(value: number): string {
    return formatChartValue(value, { compact: true });
  }
}
