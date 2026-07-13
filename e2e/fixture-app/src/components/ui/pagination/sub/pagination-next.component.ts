import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '@/components/lib/utils';
import { createLocaleSelector, type LocaleInput } from '@/components/lib/i18n';
import { PAGINATION_LOCALES, type PaginationLocale } from '../pagination.locales';

@Component({
  selector: 'ui-pagination-next',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [class]="classes()" [attr.data-slot]="'pagination-next'" [disabled]="disabled()">
      <span>{{ t().next }}</span>
      <svg class="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  `,
  host: { class: 'contents' },
})
export class PaginationNextComponent {
  readonly class = input('');
  readonly disabled = input(false);

  /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
  readonly locale = input<LocaleInput<PaginationLocale>>();

  protected readonly t = createLocaleSelector(this.locale, PAGINATION_LOCALES);

  readonly classes = computed(() => cn(
    'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2 cursor-pointer',
    'hover:bg-accent hover:text-accent-foreground transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    this.class()
  ));
}
