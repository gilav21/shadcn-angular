import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { cn } from '../../../lib/utils';
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
  class = input('');
  message = input('');

  classes = computed(() => cn(
    'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
    this.class()
  ));
}
