import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    DestroyRef,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { observeChartWidth } from '../../lib/chart-responsive';
import { ChartDataPoint, ChartClickEvent, ChartDirection } from '../../lib/chart.types';
import { getChartColor, formatChartValue, formatPercentage, getChartSummary } from '../../lib/chart.utils';
import { ChartTooltipComponent, ChartTooltipRow } from '../chart-tooltip';

type PercentageMode = 'first' | 'previous';

interface FunnelStage {
    index: number;
    name: string;
    value: number;
    percent: number;
    color: string;
    points: string;
    topWidth: number;
    centerX: number;
    midY: number;
}

const PAD = 8;

@Component({
    selector: 'ui-funnel-chart',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './funnel-chart.component.html',
    imports: [ChartTooltipComponent],
    host: {
        class: 'block',
    },
})
export class FunnelChartComponent {
    private readonly el = inject(ElementRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly _measuredWidth = observeChartWidth(this.el, this.destroyRef);

    /**
     * One funnel stage per entry, top to bottom in array order — pass them
     * already sorted from widest to narrowest, since nothing re-sorts them and
     * a rising value simply draws a stage that flares outwards. Each stage's
     * top edge is `value / max` of the available width and its bottom edge is
     * the *next* stage's width, which is what produces the taper; the last
     * stage repeats its own width, so it renders as a rectangle rather than a
     * point. `name` labels the stage, and the optional `color` overrides the
     * palette colour picked from the entry's index. Percentages are derived
     * separately — see {@link percentageMode}.
     */
    readonly data = input.required<ChartDataPoint[]>();
    /**
     * Fallback width in px of the SVG user-space coordinate system, used only
     * until the host element has been measured — the rendered SVG is
     * `width="100%"` and the `viewBox` tracks the measured width, so the funnel
     * genuinely reflows rather than scaling. The host must be a block-level box
     * for that measurement to be meaningful; an inline-block parent collapses a
     * `width:100%` SVG, which is why the host carries `class: 'block'` and the
     * container `w-full`.
     */
    readonly width = input(440);
    /**
     * Height of the SVG in px, applied literally to the element as well as the
     * `viewBox` — unlike the width it is never measured, so the funnel keeps
     * this height at every container width and its stages grow wider/flatter as
     * the chart reflows. All stages share it equally: each is
     * `(height - 16 - gap * (n - 1)) / n` tall, so a long funnel yields thin
     * stages unless you raise this.
     */
    readonly height = input(300);
    /**
     * What each stage's printed percentage is measured against. `'first'`
     * (default) compares every stage to the top of the funnel — overall
     * retention. `'previous'` compares it to the stage directly above —
     * step-by-step conversion, which isolates where the drop-off happens.
     * Either way the first stage is 100%, and a zero reference yields 0%
     * instead of a division blow-up. Affects the in-chart labels, the tooltip's
     * "Share" row, and the per-stage aria-labels — never the geometry, which
     * always scales off the largest value.
     */
    readonly percentageMode = input<PercentageMode>('first');
    /**
     * Vertical gap between stages, in px of user space. It is taken out of the
     * stage heights rather than added to the chart, so raising it on a long
     * funnel shrinks the stages instead of growing {@link height}.
     */
    readonly gap = input(2);
    /** Print `name · percentage` centred inside each stage. The percentage follows {@link percentageMode}; the raw value stays tooltip-only. */
    readonly showValues = input(true);
    /**
     * Render the floating {@link ChartTooltipComponent} (value plus share) for
     * the hovered or focused stage. Disabling it only removes the tooltip —
     * stages still highlight on hover and still emit {@link stageClick}.
     */
    readonly showTooltip = input(true);
    /** Extra classes merged onto the chart container, which already carries `relative w-full`. */
    readonly class = input('');
    /** Human-readable chart name, used only to prefix the group's accessible summary (see {@link ariaLabel}). */
    readonly title = input<string | undefined>(undefined);
    /**
     * Layout direction, accepted for parity with the cartesian charts in this
     * family. The funnel is horizontally centred and its labels are
     * centre-anchored, so no part of the current rendering reads this value;
     * inherited DOM direction still governs the label text itself.
     */
    readonly dir = input<ChartDirection>('auto');

    /**
     * Emitted when a stage is clicked, or activated with Enter while focused.
     * The payload's `point` is the original {@link data} entry and `index` its
     * position; no `event` is attached, so use the DOM event on your own
     * handler if you need modifier keys.
     */
    readonly stageClick = output<ChartClickEvent>();

    private readonly _hover = signal<number | null>(null);
    private readonly _tooltipPos = signal({ x: 0, y: 0 });
    readonly hovered = this._hover.asReadonly();
    readonly tooltipPos = this._tooltipPos.asReadonly();

    readonly classes = computed(() => cn('relative w-full', this.class()));
    readonly svgWidth = computed(() => this._measuredWidth() ?? this.width());
    readonly viewBox = computed(() => `0 0 ${this.svgWidth()} ${this.height()}`);

    readonly ariaLabel = computed(() =>
        getChartSummary('Funnel chart', this.data().length, this.title()),
    );

    private readonly maxValue = computed(() => {
        const values = this.data().map(d => d.value);
        return values.length ? Math.max(...values) : 1;
    });

    private percentFor(index: number): number {
        const data = this.data();
        if (index === 0) return 100;
        const ref = this.percentageMode() === 'first' ? data[0].value : data[index - 1].value;
        return ref === 0 ? 0 : (data[index].value / ref) * 100;
    }

    readonly stages = computed((): FunnelStage[] => {
        const data = this.data();
        const n = data.length;
        if (n === 0) return [];
        const max = this.maxValue();
        const innerW = this.svgWidth() - PAD * 2;
        const centerX = this.svgWidth() / 2;
        const gap = this.gap();
        const stageH = (this.height() - PAD * 2 - gap * (n - 1)) / n;

        return data.map((d, i) => {
            const topWidth = (d.value / max) * innerW;
            const nextValue = i < n - 1 ? data[i + 1].value : d.value;
            const bottomWidth = (nextValue / max) * innerW;
            const yTop = PAD + i * (stageH + gap);
            const yBottom = yTop + stageH;
            const points = [
                `${centerX - topWidth / 2},${yTop}`,
                `${centerX + topWidth / 2},${yTop}`,
                `${centerX + bottomWidth / 2},${yBottom}`,
                `${centerX - bottomWidth / 2},${yBottom}`,
            ].join(' ');
            return {
                index: i,
                name: d.name,
                value: d.value,
                percent: this.percentFor(i),
                color: getChartColor(i, d.color),
                points,
                topWidth,
                centerX,
                midY: yTop + stageH / 2,
            };
        });
    });

    readonly tooltipRows = computed((): ChartTooltipRow[] => {
        const i = this._hover();
        if (i === null) return [];
        const d = this.data()[i];
        if (!d) return [];
        return [
            { label: 'Value', value: formatChartValue(d.value), color: getChartColor(i, d.color) },
            { label: 'Share', value: formatPercentage(this.percentFor(i)) },
        ];
    });

    readonly hoverTitle = computed(() => {
        const i = this._hover();
        return i === null ? undefined : this.data()[i]?.name;
    });

    /** Renders an already-computed percentage (as produced for each stage under {@link percentageMode}) as `NN.N%` for the in-chart and aria labels. */
    formatPercent(value: number): string {
        return formatPercentage(value);
    }

    /**
     * Sets the active stage and moves the tooltip anchor in one step; `null`
     * clears the highlight. `x`/`y` are SVG user-space coordinates, and default
     * to the origin — pass them whenever `index` is non-null, or the tooltip
     * shows up in the container's top-left corner. {@link onStageEnter} and
     * {@link onLeave} are the wired-up callers; call this directly only to drive
     * the highlight from outside the chart.
     */
    setHover(index: number | null, x = 0, y = 0): void {
        this._hover.set(index);
        this._tooltipPos.set({ x, y });
    }

    /**
     * Highlights the stage — undimming it while its siblings fade — and anchors
     * the tooltip just above the stage's midpoint, clamped to stay 8px inside
     * the top edge. Bound to both `mouseenter` and `focus` so keyboard users get
     * the same feedback.
     */
    onStageEnter(stage: FunnelStage): void {
        this.setHover(stage.index, stage.centerX, Math.max(8, stage.midY - 8));
    }

    /** Clears the highlight and hides the tooltip, restoring every stage to full opacity. Bound to `mouseleave` and `blur`. */
    onLeave(): void {
        this.setHover(null);
    }

    /**
     * Emits {@link stageClick} for the stage at `index`, silently ignoring an
     * index that no longer resolves against {@link data}. Bound to both `click`
     * and `keydown.enter`.
     */
    onStageClick(index: number): void {
        const d = this.data()[index];
        if (d) this.stageClick.emit({ point: d, index });
    }
}
