import { Component, ChangeDetectionStrategy } from '@angular/core';
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
  FieldSeparatorComponent,
} from '../../../../../packages/components/ui';

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
    FieldSeparatorComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="field" class="text-2xl font-semibold scroll-m-20">Field</h2>
      <p class="text-muted-foreground">
        Form field wrapper with label, description, and error support.
      </p>

      <div class="grid gap-6 max-w-md">
        <ui-field-group>
          <ui-field-set>
            <ui-field-legend>Contact Information</ui-field-legend>
            <ui-field-description>Enter your contact details.</ui-field-description>

            <ui-field-group>
              <ui-field>
                <ui-field-label for="name">Full Name</ui-field-label>
                <ui-input id="name" placeholder="John Doe" />
              </ui-field>

              <ui-field>
                <ui-field-label for="email-field">Email</ui-field-label>
                <ui-input id="email-field" type="email" placeholder="john&#64;example.com" />
                <ui-field-description>We'll never share your email.</ui-field-description>
              </ui-field>

              <ui-field>
                <ui-field-label for="invalid-field">Required Field</ui-field-label>
                <ui-input id="invalid-field" placeholder="This field has an error" class="border-destructive" />
                <ui-field-error>This field is required.</ui-field-error>
              </ui-field>
            </ui-field-group>
          </ui-field-set>

          <ui-field-separator />

          <ui-field orientation="horizontal">
            <ui-checkbox id="terms-field" />
            <ui-field-label for="terms-field" class="font-normal">I agree to the terms</ui-field-label>
          </ui-field>
        </ui-field-group>
      </div>
    </section>
  `,
})
export class FieldDemoComponent {}
