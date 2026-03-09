import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  ButtonComponent,
  InputComponent,
  FieldComponent,
  FieldLabelComponent,
  FieldDescriptionComponent,
  FieldErrorComponent,
  ToastService,
} from '../../../../../packages/components/ui';

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
      <h2 id="form" class="text-2xl font-semibold scroll-m-20">Form</h2>
      <p class="text-muted-foreground">Building forms with validation and helper text using the Field component.</p>

      <div class="max-w-md border rounded-md p-6">
        <form [formGroup]="demoForm" (ngSubmit)="onFormSubmit()" class="space-y-6">

          <ui-field>
            <ui-field-label>Username</ui-field-label>
            <ui-input formControlName="username" placeholder="shadcn" />
            <ui-field-description>
              This is your public display name.
            </ui-field-description>
            @if (demoForm.get('username')?.invalid && demoForm.get('username')?.touched) {
              <ui-field-error>
                @if (demoForm.get('username')?.hasError('required')) { Username is required }
                @if (demoForm.get('username')?.hasError('minlength')) { Username must be at least 2 characters }
              </ui-field-error>
            }
          </ui-field>

          <ui-field>
            <ui-field-label>Email</ui-field-label>
            <ui-input formControlName="email" placeholder="m&#64;example.com" />
            @if (demoForm.get('email')?.invalid && demoForm.get('email')?.touched) {
              <ui-field-error>
                @if (demoForm.get('email')?.hasError('required')) { Email is required }
                @if (demoForm.get('email')?.hasError('email')) { Please enter a valid email }
              </ui-field-error>
            }
          </ui-field>

          <ui-button type="submit">Submit</ui-button>
        </form>
      </div>
    </section>
  `,
})
export class FormDemoComponent {
  private readonly toastService = inject(ToastService);

  readonly demoForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  onFormSubmit() {
    if (this.demoForm.valid) {
      this.toastService.success('Form Submitted', JSON.stringify(this.demoForm.value));
    } else {
      this.demoForm.markAllAsTouched();
    }
  }
}
