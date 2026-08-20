import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent, type BadgeVariant } from '../badge';
import {
    CardComponent,
    CardContentComponent,
    CardDescriptionComponent,
    CardHeaderComponent,
    CardTitleComponent,
} from '../card';

/**
 * Which way a metric moved, and therefore how its delta is treated.
 *
 * `'up'` and `'down'` describe a *favourable* and an *unfavourable* change
 * rather than the arithmetic sign of the delta string — a falling churn rate is
 * `'up'`. `'neutral'` is the resting state for a metric with no stated
 * direction: a `secondary` badge and no arrow.
 */
export type StatCardTrend = 'up' | 'down' | 'neutral';

const TREND_VARIANTS: Readonly<Record<StatCardTrend, BadgeVariant>> = {
    up: 'default',
    down: 'destructive',
    neutral: 'secondary',
};

/** `d` attribute of the arrow drawn inside the delta badge, on a 24×24 grid. */
const TREND_PATHS: Readonly<Record<StatCardTrend, string | null>> = {
    up: 'M12 19V5m0 0-7 7m7-7 7 7',
    down: 'M12 5v14m0 0 7-7m-7 7-7-7',
    neutral: null,
};

/**
 * StatCard — a KPI tile: label, value, an optional delta badge and an optional
 * projected sparkline.
 *
 * Extracted from the `dashboard` block, which now composes it. The host is
 * `display: contents` so `ui-card` remains the real grid item wherever the tile
 * is dropped into a grid, and {@link class} is therefore merged onto the card
 * surface rather than onto this wrapper.
 *
 * ```html
 * <ui-stat-card label="Total Revenue" value="$45,231.89" delta="+20.1%" trend="up" />
 *
 * <ui-stat-card label="Active users" value="2,350">
 *   <ui-line-chart [series]="spark()" [height]="40" />
 * </ui-stat-card>
 * ```
 */
@Component({
    selector: 'ui-stat-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        BadgeComponent,
        CardComponent,
        CardContentComponent,
        CardDescriptionComponent,
        CardHeaderComponent,
        CardTitleComponent,
    ],
    templateUrl: './stat-card.component.html',
    host: {
        class: 'contents',
        '[attr.data-slot]': '"stat-card"',
    },
})
export class StatCardComponent {
    /** Metric name, rendered muted above the value. Truncates rather than wrapping. */
    readonly label = input('');
    /**
     * The headline figure, pre-formatted. It is rendered verbatim, so apply any
     * currency, percentage or locale formatting before binding it.
     *
     * Truncates rather than wrapping. Truncation needs `overflow: hidden`, and
     * the card title it sits in is `leading-none`, so a *textual* value whose
     * glyphs have descenders can clip. Figures — digits, currency, percentages,
     * which is what a KPI value is — are unaffected. Pass
     * `[class]="'leading-tight'"` if you really are putting prose here.
     */
    readonly value = input('');
    /**
     * Change since the previous period, e.g. `'+20.1%'`. Also pre-formatted and
     * rendered verbatim. Leave it unset — or empty — and the badge is omitted
     * entirely rather than rendered blank.
     */
    readonly delta = input<string>();
    /**
     * Direction of the change. Drives both the badge's colour and the arrow
     * drawn beside the delta; see {@link StatCardTrend} for why `'up'` means
     * favourable rather than arithmetically positive.
     */
    readonly trend = input<StatCardTrend>('neutral');
    /**
     * Draw the direction arrow beside the delta.
     *
     * Turn it off to keep the trend's colour without the glyph. The
     * `dashboard` block does exactly that: its tiles carry a favourability flag
     * but no direction, and suppressing the arrow is what makes the extraction
     * render identically to the inline markup it replaced.
     */
    readonly trendIcon = input(true);
    /**
     * Extra classes merged onto the card surface — not onto the
     * `display: contents` host, which styles nothing.
     *
     * Both spellings work: a bound `[class]="'ring-2'"` sets only the input,
     * while a static `class="ring-2"` is written to the input *and* left as an
     * inert literal class on the transparent host.
     */
    readonly class = input('');

    /** Badge colour for the current {@link trend}. */
    readonly deltaVariant = computed<BadgeVariant>(() => TREND_VARIANTS[this.trend()]);

    /**
     * Arrow path for the current {@link trend} — `null` when the trend is
     * neutral, or when {@link trendIcon} suppresses the glyph.
     */
    readonly trendPath = computed(() =>
        this.trendIcon() ? TREND_PATHS[this.trend()] : null,
    );

    /**
     * Only spaced when an arrow is actually drawn, so a neutral badge stays
     * byte-identical to a plain text badge.
     */
    readonly badgeClass = computed(() => (this.trendPath() ? 'gap-1' : ''));
}
