import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '@/components/lib/utils';
import { SpinnerComponent } from '../spinner.component';

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
  templateUrl: './page-spinner.component.html',
  host: { class: 'contents' },
})
export class PageSpinnerComponent {
  /**
   * Extra classes merged onto the fixed backdrop. Override `z-50` here when the
   * overlay must sit above (or below) dialogs, and the `bg-background/80
   * backdrop-blur-sm` utilities to change how much of the page shows through.
   */
  class = input('');
  /** Optional caption shown under the spinner. Omit it for a bare spinner — no empty line is reserved when it is blank. */
  message = input('');

  classes = computed(() => cn(
    'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
    this.class()
  ));
}
