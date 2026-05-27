import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { InputOTPComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { INPUT_OTP_DEMO_LOCALES } from './input-otp-demo.locales';

@Component({
  selector: 'app-input-otp-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputOTPComponent],
  template: `
    <section class="space-y-4">
      <h2 id="input-otp" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-input-otp [maxLength]="6" [separator]="[2]" />
    </section>
  `,
})
export class InputOtpDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => INPUT_OTP_DEMO_LOCALES[this.localeId()] ?? INPUT_OTP_DEMO_LOCALES['en']);
}
