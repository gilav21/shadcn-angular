import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent, ToastService } from '../../../../../packages/components/ui';

type ToastType = 'default' | 'success' | 'error';

@Component({
  selector: 'app-toast-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="toast" class="text-2xl font-semibold scroll-m-20">Toast</h2>
      <p class="text-muted-foreground">Show notification toasts to users.</p>

      <div class="flex gap-2">
        <ui-button (click)="showToast('default')" (keydown.enter)="showToast('default')">Show Toast</ui-button>
        <ui-button variant="outline" (click)="showToast('success')" (keydown.enter)="showToast('success')">Success Toast</ui-button>
        <ui-button variant="destructive" (click)="showToast('error')" (keydown.enter)="showToast('error')">Error Toast</ui-button>
      </div>
    </section>
  `,
})
export class ToastDemoComponent {
  private readonly toastService = inject(ToastService);

  showToast(type: ToastType) {
    switch (type) {
      case 'success':
        this.toastService.success('Success!', 'Your action was completed successfully.');
        break;
      case 'error':
        this.toastService.error('Error', 'Something went wrong. Please try again.');
        break;
      default:
        this.toastService.toast({ title: 'Notification', description: 'This is a toast message.' });
    }
  }
}
