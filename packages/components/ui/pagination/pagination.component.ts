import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../lib/i18n';
import { PAGINATION_LOCALES, type PaginationLocale } from './pagination.locales';

@Component({
  selector: 'ui-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      role="navigation"
      [attr.aria-label]="t().pagination"
      [attr.dir]="dir()"
      [class]="classes()"
      [attr.data-slot]="'pagination'">
      @if (totalPages() > 0) {
        <!-- Simple mode: auto-generate pagination -->
        <ul class="flex flex-row flex-wrap items-center gap-1" data-slot="pagination-content">
          <!-- Previous button -->
          <li>
            <button
              type="button"
              [class]="navButtonClasses()"
              [disabled]="currentPage() <= 1"
              data-slot="pagination-previous"
              (click)="onPageChange(currentPage() - 1)">
              <svg class="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>{{ t().previous }}</span>
            </button>
          </li>

          <!-- Page numbers -->
          @for (page of pageNumbers(); track page) {
            <li>
              @if (page === -1) {
                <span class="flex h-9 w-9 items-center justify-center" data-slot="pagination-ellipsis" aria-hidden="true">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                    <circle cx="5" cy="12" r="1.5" />
                  </svg>
                  <span class="sr-only">{{ t().morePages }}</span>
                </span>
              } @else {
                <button
                  type="button"
                  [class]="pageLinkClasses(page === currentPage())"
                  [attr.aria-current]="page === currentPage() ? 'page' : null"
                  data-slot="pagination-link"
                  (click)="onPageChange(page)">
                  {{ page }}
                </button>
              }
            </li>
          }

          <!-- Next button -->
          <li>
            <button
              type="button"
              [class]="navButtonClasses()"
              [disabled]="currentPage() >= totalPages()"
              data-slot="pagination-next"
              (click)="onPageChange(currentPage() + 1)">
              <span>{{ t().next }}</span>
              <svg class="h-4 w-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </li>
        </ul>
      } @else {
        <!-- Template mode: project content -->
        <ng-content />
      }
    </nav>
  `,
  host: { class: 'contents' },
})
export class PaginationComponent {
  readonly class = input('');

  // Simple mode inputs
  readonly currentPage = input(0);
  readonly totalPages = input(0);
  readonly siblingCount = input(1);

  /**
   * Locale dictionary or registry key (`'en'`, `'he'`, …). Falls back to the
   * app-wide `UI_LOCALE_ID` token when not set.
   */
  readonly locale = input<LocaleInput<PaginationLocale>>();

  // Output for page changes
  readonly pageChange = output<number>();

  private readonly i18n = createLocaleBindings(this.locale, PAGINATION_LOCALES);
  protected readonly t = this.i18n.t;
  protected readonly dir = this.i18n.dir;

  readonly classes = computed(() => cn('mx-auto flex w-full justify-center', this.class()));

  readonly navButtonClasses = computed(() => cn(
    'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2 cursor-pointer',
    'hover:bg-accent hover:text-accent-foreground transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50'
  ));

  readonly pageLinkClasses = (isActive: boolean): string => cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer h-9 w-9',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    isActive
      ? 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground'
      : 'hover:bg-accent hover:text-accent-foreground'
  );

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const siblings = this.siblingCount();

    if (total <= 0) return [];

    const range = (start: number, end: number) =>
      Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const totalPageNumbers = siblings * 2 + 5; // siblings + first + last + current + 2 ellipsis

    if (total <= totalPageNumbers) {
      return range(1, total);
    }

    const leftSiblingIndex = Math.max(current - siblings, 1);
    const rightSiblingIndex = Math.min(current + siblings, total);

    const showLeftEllipsis = leftSiblingIndex > 2;
    const showRightEllipsis = rightSiblingIndex < total - 1;

    if (!showLeftEllipsis && showRightEllipsis) {
      const leftCount = 3 + 2 * siblings;
      return [...range(1, leftCount), -1, total];
    }

    if (showLeftEllipsis && !showRightEllipsis) {
      const rightCount = 3 + 2 * siblings;
      return [1, -1, ...range(total - rightCount + 1, total)];
    }

    return [1, -1, ...range(leftSiblingIndex, rightSiblingIndex), -1, total];
  });

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }
}
