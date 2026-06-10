import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';

@Component({
  selector: 'ui-pagination-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="classes()"
      [attr.aria-current]="isActive() ? 'page' : null"
      [attr.data-slot]="'pagination-link'"
      [attr.data-size]="size()"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
  styleUrl: './pagination-link.component.css',
  host: { class: 'contents' },
})
export class PaginationLinkComponent {
  isActive = input(false);
  size = input<'default' | 'sm' | 'lg' | 'icon'>('icon');
  class = input('');
  disabled = input(false);

  classes = computed(() => {
    const sizeClasses = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-10 px-8',
      icon: 'h-9 w-9',
    };
    return cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      this.isActive()
        ? 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground'
        : 'hover:bg-accent hover:text-accent-foreground',
      sizeClasses[this.size()],
      this.class()
    );
  });
}
