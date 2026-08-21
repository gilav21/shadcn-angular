import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonComponent, ToastService } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { TOAST_DEMO_LOCALES } from './toast-demo.locales';

type ToastType = 'default' | 'success' | 'error' | 'info' | 'warning';

@Component({
  selector: 'app-toast-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <section class="space-y-4">
      <h2 id="toast" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="flex flex-wrap gap-2">
        <ui-button (click)="showToast('default')" (keydown.enter)="showToast('default')">{{ t().buttonDefault }}</ui-button>
        <ui-button variant="outline" (click)="showToast('success')" (keydown.enter)="showToast('success')">{{ t().buttonSuccess }}</ui-button>
        <ui-button variant="destructive" (click)="showToast('error')" (keydown.enter)="showToast('error')">{{ t().buttonError }}</ui-button>
        <ui-button variant="outline" (click)="showToast('info')" (keydown.enter)="showToast('info')">{{ t().buttonInfo }}</ui-button>
        <ui-button variant="outline" (click)="showToast('warning')" (keydown.enter)="showToast('warning')">{{ t().buttonWarning }}</ui-button>
        <ui-button variant="secondary" (click)="runPromise()" (keydown.enter)="runPromise()">{{ t().buttonPromise }}</ui-button>
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
      case 'info':
        this.toastService.info(locale.infoTitle, locale.infoDescription);
        break;
      case 'warning':
        this.toastService.warning(locale.warningTitle, locale.warningDescription);
        break;
      default:
        this.toastService.toast({ title: locale.toastTitle, description: locale.toastDescription });
    }
  }

  /**
   * Binds a toast to a promise: the loading toast MUTATES into its result
   * rather than being dismissed and replaced, so there is no flicker and it
   * keeps its slot in the stack.
   */
  runPromise(): void {
    const locale = this.t();
    void this.toastService.promise(
      new Promise<void>(resolve => setTimeout(resolve, 1800)),
      {
        loading: locale.promiseLoading,
        success: locale.promiseSuccess,
        error: locale.promiseError,
      },
    );
  }
}
