import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../lib/utils';

/**
 * Spinner - Loading indicator with animated spinning icon
 * 
 * Usage:
 * <ui-spinner />
 * <ui-spinner size="lg" />
 * <ui-spinner size="xl" />
 * <ui-spinner [customSize]="48" />
 * 
 * Full page spinner:
 * <div class="fixed inset-0 flex items-center justify-center bg-background/80">
 *   <ui-spinner size="page" />
 * </div>
 */
@Component({
  selector: 'ui-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg 
      [class]="classes()"
      [style]="customStyles()"
      [attr.data-slot]="'spinner'"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      role="status"
      aria-label="Loading"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  `,
  host: { class: 'contents' },
})
export class SpinnerComponent {
  class = input('');
  size = input<'xs' | 'sm' | 'default' | 'lg' | 'xl' | 'page'>('default');
  customSize = input<number | null>(null);

  classes = computed(() => {
    const customSizeValue = this.customSize();

    if (customSizeValue) {
      return cn('animate-spin', this.class());
    }

    const sizeClasses = {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      default: 'h-5 w-5',
      lg: 'h-6 w-6',
      xl: 'h-8 w-8',
      page: 'h-12 w-12',
    };

    return cn(
      'animate-spin',
      sizeClasses[this.size()],
      this.class()
    );
  });

  customStyles = computed(() => {
    const customSizeValue = this.customSize();
    if (customSizeValue) {
      return `width: ${customSizeValue}px; height: ${customSizeValue}px;`;
    }
    return '';
  });
}

/**
 * PageSpinner - Full page loading overlay
 * 
 * Usage:
 * <ui-page-spinner />
 * <ui-page-spinner message="Loading your data..." />
 */
@Component({
  selector: 'ui-page-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  template: `
    <div [class]="classes()" [attr.data-slot]="'page-spinner'">
      <div class="flex flex-col items-center gap-4">
        <ui-spinner size="page" />
        @if (message()) {
          <p class="text-sm text-muted-foreground animate-pulse">{{ message() }}</p>
        }
      </div>
    </div>
  `,
  host: { class: 'contents' },
})
export class PageSpinnerComponent {
  class = input('');
  message = input('');

  classes = computed(() => cn(
    'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
    this.class()
  ));
}
