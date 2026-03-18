import { Component, ChangeDetectionStrategy } from '@angular/core';
import { InputOTPComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-input-otp-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputOTPComponent],
  template: `
    <section class="space-y-4">
      <h2 id="input-otp" class="text-2xl font-semibold scroll-m-20">Input OTP</h2>
      <p class="text-muted-foreground">One-time password input fields.</p>

      <ui-input-otp [maxLength]="6" [separator]="[2]" />
    </section>
  `,
})
export class InputOtpDemoComponent {}
