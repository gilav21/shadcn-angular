import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
    NonNullableFormBuilder,
    type FormControl,
} from '@angular/forms';
import { inject } from '@angular/core';
import { InputComponent } from '@/components/ui/input';
import { LabelComponent } from '@/components/ui/label';
import { ButtonComponent } from '@/components/ui/button';
import { CheckboxComponent } from '@/components/ui/checkbox';

interface SignupForm {
    email: FormControl<string>;
    password: FormControl<string>;
    agreed: FormControl<boolean>;
}

/**
 * ReactiveForms integration: ui-input + ui-checkbox both implement
 * ControlValueAccessor and should plug into Validators.required /
 * Validators.email transparently. The submit button is disabled while
 * the form is invalid; error messages render under each field once
 * the user has touched it.
 */
@Component({
    selector: 'app-form-validation-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        InputComponent, LabelComponent, ButtonComponent, CheckboxComponent,
        ReactiveFormsModule,
    ],
    template: `
        <main class="p-8 space-y-4 w-[480px]">
            <h1 class="text-xl font-bold">Sign up</h1>
            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
                <div>
                    <ui-label for="fv-email">Email</ui-label>
                    <ui-input elementId="fv-email" type="email"
                        formControlName="email" data-testid="email" />
                    @if (email.touched && email.invalid) {
                        @if (email.hasError('required')) {
                            <p data-testid="email-required" class="text-destructive text-sm mt-1">
                                Email is required
                            </p>
                        } @else if (email.hasError('email')) {
                            <p data-testid="email-format" class="text-destructive text-sm mt-1">
                                Enter a valid email
                            </p>
                        }
                    }
                </div>
                <div>
                    <ui-label for="fv-password">Password</ui-label>
                    <ui-input elementId="fv-password" type="password"
                        formControlName="password" data-testid="password" />
                    @if (password.touched && password.hasError('minlength')) {
                        <p data-testid="password-min" class="text-destructive text-sm mt-1">
                            At least 8 characters
                        </p>
                    }
                </div>
                <ui-checkbox label="I agree to the terms" elementId="fv-tos"
                    formControlName="agreed" data-testid="agreed" />
                <ui-button type="submit" [disabled]="form.invalid" data-testid="submit">
                    Sign up
                </ui-button>
                <p data-testid="status">{{ status() }}</p>
            </form>
        </main>
    `,
})
export class FormValidationDemoComponent {
    private readonly fb = inject(FormBuilder).nonNullable satisfies NonNullableFormBuilder;
    protected readonly form = this.fb.group<SignupForm>({
        email: this.fb.control('', [Validators.required, Validators.email]),
        password: this.fb.control('', [Validators.required, Validators.minLength(8)]),
        agreed: this.fb.control(false, [Validators.requiredTrue]),
    });

    protected get email(): FormControl<string> { return this.form.controls.email; }
    protected get password(): FormControl<string> { return this.form.controls.password; }

    protected status(): string {
        if (this.form.invalid) return 'invalid';
        return 'valid';
    }

    protected onSubmit(): void {
        // No-op — the spec checks form.valid via the status field.
    }
}
