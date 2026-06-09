import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import {
  CheckboxComponent,
  InputComponent,
  FieldComponent,
  FieldGroupComponent,
  FieldSetComponent,
  FieldLabelComponent,
  FieldLegendComponent,
  FieldDescriptionComponent,
  FieldErrorComponent,
  FieldAutoErrorsComponent,
  FieldSeparatorComponent,
} from '../../../../../packages/components/ui';
import { FIELD_DEMO_LOCALES } from './field-demo.locales';

@Component({
  selector: 'app-field-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CheckboxComponent,
    InputComponent,
    FieldComponent,
    FieldGroupComponent,
    FieldSetComponent,
    FieldLabelComponent,
    FieldLegendComponent,
    FieldDescriptionComponent,
    FieldErrorComponent,
    FieldAutoErrorsComponent,
    FieldSeparatorComponent,
    ReactiveFormsModule,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="field" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="grid gap-6 max-w-md">
        <ui-field-group>
          <ui-field-set>
            <ui-field-legend>{{ t().legend }}</ui-field-legend>
            <ui-field-description>{{ t().legendDesc }}</ui-field-description>

            <ui-field-group>
              <ui-field>
                <ui-field-label for="name">{{ t().fields.fullName }}</ui-field-label>
                <ui-input id="name" [placeholder]="t().fields.fullNamePlaceholder" />
              </ui-field>

              <ui-field>
                <ui-field-label for="email-field">{{ t().fields.email }}</ui-field-label>
                <ui-input id="email-field" type="email" [placeholder]="t().fields.emailPlaceholder" />
                <ui-field-description>{{ t().fields.emailDesc }}</ui-field-description>
              </ui-field>

              <ui-field>
                <ui-field-label for="invalid-field">{{ t().fields.requiredField }}</ui-field-label>
                <ui-input id="invalid-field" [placeholder]="t().fields.requiredFieldPlaceholder" class="border-destructive" />
                <ui-field-error>{{ t().fields.requiredFieldError }}</ui-field-error>
              </ui-field>
            </ui-field-group>
          </ui-field-set>

          <ui-field-separator />

          <ui-field orientation="horizontal">
            <ui-checkbox id="terms-field" />
            <ui-field-label for="terms-field" class="font-normal">{{ t().fields.agreeTerms }}</ui-field-label>
          </ui-field>

          <ui-field-separator />

          <ui-field-set>
            <ui-field-legend>{{ t().autoErrors.legend }}</ui-field-legend>
            <ui-field-description>{{ t().autoErrors.legendDesc }}</ui-field-description>

            <ui-field>
              <ui-field-label for="username-field">{{ t().autoErrors.username }}</ui-field-label>
              <ui-input id="username-field" [formControl]="username" [placeholder]="t().autoErrors.usernamePlaceholder" />
              <ui-field-auto-errors />
            </ui-field>
          </ui-field-set>
        </ui-field-group>
      </div>
    </section>
  `,
})
export class FieldDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => FIELD_DEMO_LOCALES[this.localeId()] ?? FIELD_DEMO_LOCALES['en']);
  protected readonly username = new FormControl('', [Validators.required, Validators.minLength(5)]);
}
