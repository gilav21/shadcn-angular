import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../lib/utils';

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
  templateUrl: './spinner.component.html',
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
