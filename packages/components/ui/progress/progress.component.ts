import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { UI_LOCALE_ID, formatNumber } from '../../lib/i18n';

@Component({
  selector: 'ui-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress.component.html',
  host: { class: 'block' },
})
export class ProgressComponent {
  /**
   * Current amount of progress, in the same units as {@link max}. The rendered
   * fill is clamped to 0–100%, so out-of-range values are shown as empty or
   * full — but they are still reported verbatim to assistive technology via the
   * hidden native `<progress>`.
   */
  value = input(0);
  /** Upper bound of {@link value}; the fill width is `value / max`. Leave at 100 to pass percentages directly. */
  max = input(100);
  /** Extra classes merged onto the track — override `h-2` for a thicker bar or `bg-primary/20` for a different trough colour. */
  class = input('');
  /**
   * Accessible name for the bar, applied to the hidden native `<progress>`.
   * Supply this (or {@link ariaLabelledby}) whenever no visible label sits
   * beside the bar, since the visual fill itself is `aria-hidden`.
   */
  ariaLabel = input<string | undefined>(undefined);
  /** `id` of an existing element that names the bar. Prefer it over {@link ariaLabel} when the label is already on screen, so the two never drift apart. */
  ariaLabelledby = input<string | undefined>(undefined);
  /**
   * BCP-47 locale tag used to format `aria-valuetext` (the screen-reader
   * percentage announcement) via `Intl.NumberFormat`'s `style: 'percent'`.
   * Falls back to the app-wide `UI_LOCALE_ID`. The raw `aria-valuenow`
   * stays unformatted per ARIA spec.
   */
  locale = input<string>();
  private readonly globalLocale = inject(UI_LOCALE_ID);

  percentage = computed(() => {
    const val = this.value();
    const maxVal = this.max();
    return Math.min(100, Math.max(0, (val / maxVal) * 100));
  });

  /** Locale-formatted percentage text — `'45%'` in en, `'45 %'` in fr, etc. */
  readonly valueText = computed(() =>
    formatNumber(this.percentage() / 100, this.locale() ?? this.globalLocale(), { style: 'percent', maximumFractionDigits: 0 }),
  );

  classes = computed(() =>
    cn(
      'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
      this.class()
    )
  );

  /** String form of the raw {@link value} — unclamped and unformatted, unlike {@link valueText}. Lets a progress instance be interpolated directly in a template. */
  toString(): string {
    return String(this.value());
  }
}
