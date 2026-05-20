import {
  Component,
  ChangeDetectionStrategy,
} from '@angular/core';

/**
 * Interface for data-driven breadcrumb items
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}

@Component({
  selector: 'ui-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav 
      [attr.aria-label]="'breadcrumb'" 
      [attr.data-slot]="'breadcrumb'">
      <ng-content />
    </nav>
  `,
  host: { class: 'contents' },
})
export class BreadcrumbComponent {
}
