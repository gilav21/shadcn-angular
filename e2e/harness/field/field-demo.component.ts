import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    FieldComponent,
    FieldGroupComponent,
    FieldSetComponent,
    FieldLabelComponent,
    FieldLegendComponent,
    FieldDescriptionComponent,
    FieldErrorComponent,
    FieldAutoErrorsComponent,
    FieldSeparatorComponent,
} from '@/components/ui/field';

/**
 * Harness for the `field` component family, including the reactive-form
 * auto-errors flow (`ui-field-auto-errors`).
 */
@Component({
    selector: 'app-field-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
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
        <main class="p-8">
            <ui-field-group data-testid="field-group">
                <ui-field-set data-testid="field-set">
                    <ui-field-legend data-testid="field-legend">Account</ui-field-legend>
                    <ui-field data-testid="root">
                        <ui-field-label data-testid="field-label" for="email">Email</ui-field-label>
                        <input id="email" data-testid="email-input" [formControl]="email" />
                        <ui-field-description data-testid="field-description">
                            We never share your email.
                        </ui-field-description>
                        <ui-field-auto-errors data-testid="field-auto-errors" />
                    </ui-field>
                    <ui-field-separator data-testid="field-separator" />
                    <ui-field>
                        <ui-field-label for="name">Name</ui-field-label>
                        <input id="name" />
                        <ui-field-error data-testid="field-error">Static error message</ui-field-error>
                    </ui-field>
                </ui-field-set>
            </ui-field-group>
        </main>
    `,
})
export class FieldDemoComponent {
    readonly email = new FormControl('', [Validators.required, Validators.minLength(5)]);
}
