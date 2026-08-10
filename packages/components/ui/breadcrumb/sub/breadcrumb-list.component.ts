import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { BreadcrumbItem } from '../breadcrumb.component';
import { SkeletonComponent } from '../../skeleton';

@Component({
  selector: 'ui-breadcrumb-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  template: `
    @if (skeleton()) {
      @for (item of skeletonItems(); track item; let isLast = $last) {
        <ui-skeleton class="h-4 w-16 rounded-md" />
        @if (!isLast) {
          <ui-skeleton class="size-3.5 rounded-md" />
        }
      }
    } @else if (items().length > 0) {
      <!-- Simple mode: render from items array with auto-separators -->
      @for (item of items(); track item.label; let isLast = $last) {
        <span class="inline-flex items-center gap-1.5" data-slot="breadcrumb-item">
          @if (item.isCurrentPage) {
            <span
              role="link"
              aria-disabled="true"
              aria-current="page"
              class="text-foreground font-normal"
              data-slot="breadcrumb-page">
              {{ item.label }}
            </span>
          } @else {
            <a
              [href]="item.href || '#'"
              class="hover:text-foreground transition-colors"
              data-slot="breadcrumb-link">
              {{ item.label }}
            </a>
          }
        </span>
        @if (!isLast) {
          <span role="presentation" aria-hidden="true" class="[&>svg]:size-3.5" data-slot="breadcrumb-separator">
            <svg class="size-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        }
      }
    } @else {
      <!-- Custom mode: render projected content -->
      <ng-content />
    }
  `,
  host: {
    '[class]': 'classes()',
    '[attr.data-slot]': '"breadcrumb-list"',
  },
})
export class BreadcrumbListComponent {
  /** Extra classes merged onto the list. It already wraps onto multiple lines and tightens its gap below the `sm` breakpoint, so deep trails degrade gracefully on phones. */
  class = input('');

  /**
   * Data-driven mode: the whole trail as an array, with separators inserted
   * automatically and the entry flagged `isCurrentPage` rendered as the
   * non-clickable end of the trail. A non-empty array takes priority over any
   * projected content, which is then ignored entirely.
   */
  items = input<BreadcrumbItem[]>([]);

  /** Renders {@link skeletonCount} placeholder crumbs instead of the real trail. Outranks both {@link items} and projected content while set. */
  readonly skeleton = input(false);
  /** How many placeholder crumbs the skeleton shows — pick the depth you expect so the layout does not jump when the real trail arrives. */
  readonly skeletonCount = input(3);

  readonly skeletonItems = computed(() =>
    Array.from({ length: this.skeletonCount() }, (_, i) => i)
  );

  classes = computed(() => cn(
    'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5',
    this.class()
  ));
}
