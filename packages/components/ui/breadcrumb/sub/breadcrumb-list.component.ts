import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { BreadcrumbItem } from '../breadcrumb.component';

@Component({
  selector: 'ui-breadcrumb-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length > 0) {
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
  class = input('');

  // Data-driven mode: items array (takes priority over projection)
  items = input<BreadcrumbItem[]>([]);

  classes = computed(() => cn(
    'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5',
    this.class()
  ));
}
