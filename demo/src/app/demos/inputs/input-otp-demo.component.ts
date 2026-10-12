import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, InputOTPComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { INPUT_OTP_DEMO_LOCALES } from './input-otp-demo.locales';

const FORM_EXAMPLE = `// component
readonly login = new FormGroup({ code: new FormControl('') });

<!-- template -->
<form [formGroup]="login">
  <ui-input-otp formControlName="code" [maxLength]="6" />
</form>

// while the request is in flight
this.login.controls.code.disable();`;

@Component({
  selector: 'app-input-otp-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, InputOTPComponent, ReactiveFormsModule],
  template: `
    <section class="space-y-4">
      <h2 id="input-otp" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <ui-input-otp [maxLength]="6" [separator]="[2]" />

      <h3 class="text-lg font-medium mt-8">{{ t().formHeading }}</h3>
      <p class="text-muted-foreground text-sm">{{ t().formDescription }}</p>
      <form [formGroup]="login" class="space-y-3">
        <ui-input-otp formControlName="code" [maxLength]="6" [separator]="[2]" />
        <div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span dir="ltr">{{ t().formValueLabel }}: {{ code() || '—' }}</span>
          <ui-button size="sm" variant="outline" (click)="toggleDisabled()">disable() / enable()</ui-button>
        </div>
      </form>
      <pre class="bg-muted overflow-x-auto rounded-md p-3 text-xs" dir="ltr">{{ formExample }}</pre>
    </section>
  `,
})
export class InputOtpDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => INPUT_OTP_DEMO_LOCALES[this.localeId()] ?? INPUT_OTP_DEMO_LOCALES['en']);

  protected readonly login = new FormGroup({ code: new FormControl('', { nonNullable: true }) });
  protected readonly code = toSignal(this.login.controls.code.valueChanges, {
    initialValue: this.login.controls.code.value,
  });
  protected readonly formExample = FORM_EXAMPLE;

  protected toggleDisabled(): void {
    const control = this.login.controls.code;
    if (control.disabled) {
      control.enable();
    } else {
      control.disable();
    }
  }
}
