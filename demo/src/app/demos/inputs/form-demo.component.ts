import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  ButtonComponent,
  InputComponent,
  FieldComponent,
  FieldLabelComponent,
  FieldDescriptionComponent,
  FieldErrorComponent,
  ToastService,
} from '../../../../../packages/components/ui';
import { FORM_DEMO_LOCALES } from './form-demo.locales';

@Component({
  selector: 'app-form-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    InputComponent,
    FieldComponent,
    FieldLabelComponent,
    FieldDescriptionComponent,
    FieldErrorComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="form" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="max-w-md border rounded-md p-6">
        <form [formGroup]="demoForm" (ngSubmit)="onFormSubmit()" class="space-y-6">

          <ui-field>
            <ui-field-label>{{ t().fields.username }}</ui-field-label>
            <ui-input formControlName="username" [placeholder]="t().fields.usernamePlaceholder" />
            <ui-field-description>{{ t().fields.usernameDesc }}</ui-field-description>
            @if (demoForm.get('username')?.invalid && demoForm.get('username')?.touched) {
              <ui-field-error>
                @if (demoForm.get('username')?.hasError('required')) { {{ t().errors.usernameRequired }} }
                @if (demoForm.get('username')?.hasError('minlength')) { {{ t().errors.usernameMinLength }} }
              </ui-field-error>
            }
          </ui-field>

          <ui-field>
            <ui-field-label>{{ t().fields.email }}</ui-field-label>
            <ui-input formControlName="email" [placeholder]="t().fields.emailPlaceholder" />
            @if (demoForm.get('email')?.invalid && demoForm.get('email')?.touched) {
              <ui-field-error>
                @if (demoForm.get('email')?.hasError('required')) { {{ t().errors.emailRequired }} }
                @if (demoForm.get('email')?.hasError('email')) { {{ t().errors.emailInvalid }} }
              </ui-field-error>
            }
          </ui-field>

          <ui-button type="submit">{{ t().submitButton }}</ui-button>
        </form>
      </div>
    </section>
  `,
})
export class FormDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  private readonly toastService = inject(ToastService);

  protected readonly t = computed(() => FORM_DEMO_LOCALES[this.localeId()] ?? FORM_DEMO_LOCALES['en']);

  readonly demoForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  onFormSubmit(): void {
    if (this.demoForm.valid) {
      this.toastService.success(this.t().toast.successTitle, JSON.stringify(this.demoForm.value));
    } else {
      this.demoForm.markAllAsTouched();
    }
  }
}
