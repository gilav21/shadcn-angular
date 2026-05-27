import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonComponent, ToastService } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TOAST_DEMO_LOCALES } from './toast-demo.locales';

type ToastType = 'default' | 'success' | 'error';

@Component({
  selector: 'app-toast-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="toast" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex gap-2">
        <ui-button (click)="showToast('default')" (keydown.enter)="showToast('default')">{{ t().buttonDefault }}</ui-button>
        <ui-button variant="outline" (click)="showToast('success')" (keydown.enter)="showToast('success')">{{ t().buttonSuccess }}</ui-button>
        <ui-button variant="destructive" (click)="showToast('error')" (keydown.enter)="showToast('error')">{{ t().buttonError }}</ui-button>
      </div>
    </section>
  `,
})
export class ToastDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  private readonly toastService = inject(ToastService);
  readonly t = computed(() => TOAST_DEMO_LOCALES[this.localeId()] ?? TOAST_DEMO_LOCALES['en']);

  showToast(type: ToastType) {
    const locale = this.t();
    switch (type) {
      case 'success':
        this.toastService.success(locale.successTitle, locale.successDescription);
        break;
      case 'error':
        this.toastService.error(locale.errorTitle, locale.errorDescription);
        break;
      default:
        this.toastService.toast({ title: locale.toastTitle, description: locale.toastDescription });
    }
  }
}
