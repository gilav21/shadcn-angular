import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { createLocaleSelector, type LocaleInput } from '../../../lib/i18n';
import { PAGINATION_LOCALES, type PaginationLocale } from '../pagination.locales';

@Component({
  selector: 'ui-pagination-ellipsis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()" [attr.data-slot]="'pagination-ellipsis'" aria-hidden="true">
      <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
      </svg>
      <span class="sr-only">{{ t().morePages }}</span>
    </span>
  `,
  host: { class: 'contents' },
})
export class PaginationEllipsisComponent {
  readonly class = input('');

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<PaginationLocale>>();

  protected readonly t = createLocaleSelector(this.locale, PAGINATION_LOCALES);

  readonly classes = computed(() => cn(
    'flex h-9 w-9 items-center justify-center',
    this.class()
  ));
}
