import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ToastService, ToastComponent } from '../toast.component';

@Component({
  selector: 'ui-toaster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastComponent],
  templateUrl: './toaster.component.html',
  host: { class: 'contents' },
})
export class ToasterComponent {
  readonly toastService = inject(ToastService);

  vertical = input<'top' | 'center' | 'bottom'>('bottom');
  horizontal = input<'start' | 'center' | 'end'>('end');

  containerClasses = computed(() => {
    const v = this.vertical();
    const h = this.horizontal();

    const verticalClasses: Record<string, string> = {
      'top': 'top-0',
      'center': 'top-1/2 -translate-y-1/2',
      'bottom': 'bottom-0',
    };

    const horizontalClasses: Record<string, string> = {
      'start': 'ltr:left-0 rtl:right-0',
      'center': 'left-1/2 -translate-x-1/2',
      'end': 'ltr:right-0 rtl:left-0',
    };

    return cn(
      'fixed z-[100] flex flex-col gap-2 p-4 w-full max-w-[calc(100vw-2rem)] sm:max-w-[420px]',
      verticalClasses[v],
      horizontalClasses[h]
    );
  });
}
