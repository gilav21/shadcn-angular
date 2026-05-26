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
  value = input(0);
  max = input(100);
  class = input('');
  ariaLabel = input<string | undefined>(undefined);
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

  toString(): string {
    return String(this.value());
  }
}
