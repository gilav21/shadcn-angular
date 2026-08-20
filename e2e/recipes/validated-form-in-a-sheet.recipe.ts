/**
 * @title Validated form in a side sheet
 * @summary A reactive form in a sheet: labels tied to inputs, errors announced, submit disabled until valid.
 * @components sheet, input, label, button, checkbox
 */
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '@/components/ui/button';
import { CheckboxComponent } from '@/components/ui/checkbox';
import { InputComponent } from '@/components/ui/input';
import { LabelComponent } from '@/components/ui/label';
import {
    SheetComponent,
    SheetContentComponent,
    SheetDescriptionComponent,
    SheetFooterComponent,
    SheetHeaderComponent,
    SheetTitleComponent,
    SheetTriggerComponent,
} from '@/components/ui/sheet';

/**
 * The form pattern that survives an accessibility audit.
 *
 * Three things do the work: every `ui-input` has an `id` its `ui-label` points
 * at, the error message is rendered next to the field it describes rather than
 * in a summary, and submit stays disabled while the group is invalid so the
 * failure state is never a surprise. `ui-sheet` keeps the surrounding page
 * visible, which is what makes a side sheet the right container for an edit
 * form rather than a modal dialog.
 */
@Component({
    selector: 'app-validated-form-in-a-sheet',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        ButtonComponent,
        CheckboxComponent,
        InputComponent,
        LabelComponent,
        SheetComponent,
        SheetContentComponent,
        SheetDescriptionComponent,
        SheetFooterComponent,
        SheetHeaderComponent,
        SheetTitleComponent,
        SheetTriggerComponent,
    ],
    template: `
    <ui-sheet #sheet>
      <ui-sheet-trigger>
        <ui-button data-testid="open-sheet">Invite teammate</ui-button>
      </ui-sheet-trigger>
      <ui-sheet-content side="right">
        <ui-sheet-header>
          <ui-sheet-title>Invite a teammate</ui-sheet-title>
          <ui-sheet-description>They get an email with a join link.</ui-sheet-description>
        </ui-sheet-header>

        <form [formGroup]="form" (ngSubmit)="submit(sheet)" class="space-y-4 p-4">
          <div class="space-y-1">
            <ui-label for="invite-email">Email</ui-label>
            <ui-input id="invite-email" type="email" formControlName="email" />
            @if (emailInvalid()) {
              <p class="text-sm text-destructive" data-testid="email-error">
                Enter a valid email address.
              </p>
            }
          </div>

          <div class="flex items-center gap-2">
            <ui-checkbox id="invite-admin" formControlName="admin" ariaLabel="Grant admin access" />
            <ui-label for="invite-admin">Grant admin access</ui-label>
          </div>

          <ui-sheet-footer>
            <ui-button type="submit" [disabled]="form.invalid" data-testid="submit">
              Send invite
            </ui-button>
          </ui-sheet-footer>
        </form>
      </ui-sheet-content>
    </ui-sheet>

    <p data-testid="invited">{{ invited() }}</p>
  `,
})
export class ValidatedFormInASheetComponent {
    protected readonly invited = signal('');

    protected readonly form = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
        admin: new FormControl(false, { nonNullable: true }),
    });

    protected emailInvalid(): boolean {
        const control = this.form.controls.email;
        return control.invalid && control.touched;
    }

    protected submit(sheet: SheetComponent): void {
        if (this.form.invalid) return;
        this.invited.set(this.form.controls.email.value);
        sheet.hide();
    }
}
