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
  /** Marks this as the current page: applies the outlined style and sets `aria-current="page"`, which is what assistive tech reads. Set it on exactly one link in the row. */
  isActive = input(false);
  /** Size token, published as `data-size` and resolved by the component's density CSS into height and inline padding (`icon`, the default, is the square 36×36 page box). It scales with `--density-button`/`--density`. */
  size = input<'default' | 'sm' | 'lg' | 'icon'>('icon');
  /** Extra classes merged onto the button. Because the size rules live in a `@layer components` block, a `h-*`/`w-*` utility passed here wins over them. */
  class = input('');
  /** Disables the button, dimming it and removing it from the tab order. Note it is a `<button>`, not an anchor, so there is no href to fall back to; wire navigation to its click. */
  disabled = input(false);

  classes = computed(() => {
    const sizeClasses = {
      default: '',
      sm: 'text-xs',
      lg: '',
      icon: '',
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
