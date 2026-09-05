import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { FormControl, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import { provideUiLocale } from '../../lib/i18n/i18n.token';
import { FIELD_ERROR_LOCALES } from './field.locales';
import {
    richTextMaxLength,
    richTextMinWords,
    richTextRequired,
} from '../rich-text-editor/rich-text-editor.validators';
import {
    FieldComponent,
    FieldGroupComponent,
    FieldSetComponent,
    FieldLabelComponent,
    FieldLegendComponent,
    FieldDescriptionComponent,
    FieldErrorComponent,
    FieldSeparatorComponent,
    FieldAutoErrorsComponent
} from './index';

@Component({
    template: `
    <ui-field-group>
      <ui-field-set>
        <ui-field-legend>Personal Info</ui-field-legend>
        
        <ui-field [orientation]="orientation">
          <ui-field-label for="name">Name</ui-field-label>
          <input id="name" type="text" />
          <ui-field-description>Your full name</ui-field-description>
          <ui-field-error>Name is required</ui-field-error>
        </ui-field>

        <ui-field-separator></ui-field-separator>

      </ui-field-set>
    </ui-field-group>
  `,
    imports: [
        FieldComponent,
        FieldGroupComponent,
        FieldSetComponent,
        FieldLabelComponent,
        FieldLegendComponent,
        FieldDescriptionComponent,
        FieldErrorComponent,
        FieldSeparatorComponent
    ]
})
class TestHostComponent {
    orientation: 'vertical' | 'horizontal' = 'vertical';
}

describe('FieldComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [
                TestHostComponent,
                FieldComponent,
                FieldGroupComponent,
                FieldSetComponent,
                FieldLabelComponent,
                FieldLegendComponent,
                FieldDescriptionComponent,
                FieldErrorComponent,
                FieldSeparatorComponent
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        // Manual detectChanges management
    });

    it('should create all parts', () => {
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.directive(FieldComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldGroupComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldSetComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldLabelComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldLegendComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldDescriptionComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldErrorComponent))).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(FieldSeparatorComponent))).toBeTruthy();
    });

    it('should render correct html structure', () => {
        fixture.detectChanges();
        const fieldset = fixture.debugElement.query(By.css('fieldset'));
        expect(fieldset).toBeTruthy();
        const legend = fixture.debugElement.query(By.css('legend'));
        expect(legend).toBeTruthy();
        const label = fixture.debugElement.query(By.css('label'));
        expect(label).toBeTruthy();
        const hr = fixture.debugElement.query(By.css('hr'));
        expect(hr).toBeTruthy();
    });

    it('should handle orientation prop', () => {
        host.orientation = 'horizontal';
        fixture.detectChanges();
        const field = fixture.debugElement.query(By.css('[data-slot="field"]'));
        expect(field.nativeElement.classList.contains('flex')).toBe(true);
        expect(field.nativeElement.getAttribute('data-orientation')).toBe('horizontal');
    });

    it('should apply label attributes', () => {
        fixture.detectChanges();
        const label = fixture.debugElement.query(By.css('label'));
        expect(label.nativeElement.getAttribute('for')).toBe('name');
    });

    it('should apply error role', () => {
        fixture.detectChanges();
        const error = fixture.debugElement.query(By.css('[data-slot="field-error"]'));
        expect(error.nativeElement.getAttribute('role')).toBe('alert');
        expect(error.nativeElement.classList.contains('text-destructive')).toBe(true);
    });

    it('combines registered describedBy ids from projected description and error', () => {
        fixture.detectChanges();
        const field = fixture.debugElement.query(By.directive(FieldComponent))
            .componentInstance as FieldComponent;
        const describedBy = field.describedBy();
        expect(describedBy).toBeTruthy();
        expect((describedBy as string).split(' ')).toHaveLength(2);
    });

    it('resolves generated ids on description and error sub-components', () => {
        fixture.detectChanges();
        const description = fixture.debugElement.query(By.directive(FieldDescriptionComponent))
            .componentInstance as FieldDescriptionComponent;
        const error = fixture.debugElement.query(By.directive(FieldErrorComponent))
            .componentInstance as FieldErrorComponent;
        expect(description.resolvedId()).toBeTruthy();
        expect(error.resolvedId()).toBeTruthy();
    });
});

describe('FieldComponent describedBy without registrations', () => {
    it('returns null when no describedBy ids are registered', async () => {
        @Component({
            template: `<ui-field><input /></ui-field>`,
            imports: [FieldComponent]
        })
        class BareFieldHost {}

        await TestBed.configureTestingModule({ imports: [BareFieldHost] }).compileComponents();
        const fixture = TestBed.createComponent(BareFieldHost);
        fixture.detectChanges();
        const field = fixture.debugElement.query(By.directive(FieldComponent))
            .componentInstance as FieldComponent;
        expect(field.describedBy()).toBeNull();
    });
});

@Component({
    template: `
    <ui-field>
      <ui-field-label for="email">Email</ui-field-label>
      <input id="email" [formControl]="email" />
      <ui-field-auto-errors [messages]="messages" [locale]="locale" />
    </ui-field>
  `,
    imports: [FieldComponent, FieldLabelComponent, FieldAutoErrorsComponent, ReactiveFormsModule]
})
class AutoErrorsHostComponent {
    email = new FormControl('', [Validators.required, Validators.minLength(5)]);
    messages: Record<string, string> = {};
    locale?: string;
}

@Component({
    template: `<ui-field-auto-errors [control]="ctrl" />`,
    imports: [FieldAutoErrorsComponent]
})
class ExplicitControlHostComponent {
    ctrl = new FormControl('', [Validators.required]);
}

function errorText(fixture: ComponentFixture<unknown>): string | null {
    const el = fixture.debugElement.query(By.css('[data-slot="field-error"]'));
    return el ? el.nativeElement.textContent.trim() : null;
}

describe('FieldAutoErrorsComponent', () => {
    let fixture: ComponentFixture<AutoErrorsHostComponent>;
    let host: AutoErrorsHostComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AutoErrorsHostComponent, ExplicitControlHostComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(AutoErrorsHostComponent);
        host = fixture.componentInstance;
    });

    it('renders nothing while the control is pristine and untouched', () => {
        fixture.detectChanges();
        expect(errorText(fixture)).toBeNull();
    });

    it('shows the localized required message once touched', async () => {
        fixture.detectChanges();
        host.email.markAsTouched();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(errorText(fixture)).toBe('This field is required');
        const error = fixture.debugElement.query(By.css('[data-slot="field-error"]'));
        expect(error.nativeElement.getAttribute('role')).toBe('alert');
    });

    it('interpolates validation error values into the template', async () => {
        fixture.detectChanges();
        host.email.setValue('ab');
        host.email.markAsTouched();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(errorText(fixture)).toBe('Minimum 5 characters');
    });

    it('clears the message when the control becomes valid', async () => {
        fixture.detectChanges();
        host.email.markAsTouched();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(errorText(fixture)).toBe('This field is required');

        host.email.setValue('valid input');
        await fixture.whenStable();
        fixture.detectChanges();
        expect(errorText(fixture)).toBeNull();
    });

    it('per-instance messages input wins over the locale dictionary', async () => {
        host.messages = { required: 'Custom required!' };
        fixture.detectChanges();
        host.email.markAsTouched();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(errorText(fixture)).toBe('Custom required!');
    });

    it('locale input switches the message language', async () => {
        host.locale = 'he';
        fixture.detectChanges();
        host.email.markAsTouched();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(errorText(fixture)).toBe('שדה חובה');
    });

    it('works with an explicit control input (no surrounding field control)', async () => {
        const explicitFixture = TestBed.createComponent(ExplicitControlHostComponent);
        explicitFixture.detectChanges();
        explicitFixture.componentInstance.ctrl.markAsTouched();
        await explicitFixture.whenStable();
        explicitFixture.detectChanges();
        expect(errorText(explicitFixture)).toBe('This field is required');
    });

    it('falls back to the raw error key when no message or locale entry exists', async () => {
        const unknownFixture = TestBed.createComponent(ExplicitControlHostComponent);
        const ctrl = unknownFixture.componentInstance.ctrl;
        ctrl.setValue('anything');
        ctrl.setErrors({ someUnknownKey: true });
        ctrl.markAsDirty();
        unknownFixture.detectChanges();
        await unknownFixture.whenStable();
        unknownFixture.detectChanges();
        expect(errorText(unknownFixture)).toBe('someUnknownKey');
    });
});

describe('FieldAutoErrorsComponent with global UI_LOCALE_ID', () => {
    it('uses the app-wide locale when no locale input is set', async () => {
        await TestBed.configureTestingModule({
            imports: [AutoErrorsHostComponent],
            providers: [provideUiLocale('he')]
        }).compileComponents();

        const fixture = TestBed.createComponent(AutoErrorsHostComponent);
        fixture.detectChanges();
        fixture.componentInstance.email.markAsTouched();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(errorText(fixture)).toBe('שדה חובה');
    });
});

@Component({
    template: `<ui-field-auto-errors [control]="ctrl" />`,
    imports: [FieldAutoErrorsComponent],
})
class RichTextErrorsHostComponent {
    ctrl = new FormControl('');
}

// T-19
describe('FieldAutoErrorsComponent — rich-text validators', () => {
    /** Build the host with the given validators and value, then touch it. */
    async function renderWith(validators: ValidatorFn[], value: string): Promise<ComponentFixture<RichTextErrorsHostComponent>> {
        await TestBed.configureTestingModule({
            imports: [RichTextErrorsHostComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(RichTextErrorsHostComponent);
        fixture.componentInstance.ctrl = new FormControl(value, validators);
        fixture.detectChanges();
        fixture.componentInstance.ctrl.markAsTouched();
        await fixture.whenStable();
        fixture.detectChanges();
        return fixture;
    }

    it('renders the required message for richTextRequired with no messages input', async () => {
        const fixture = await renderWith([richTextRequired()], '<p><br></p>');

        expect(errorText(fixture)).toBe('This field is required');
    });

    it('renders the maxlength message with the interpolated limit', async () => {
        const fixture = await renderWith([richTextMaxLength(10)], '<p><b>hello</b> world</p>');

        expect(errorText(fixture)).toBe('Maximum 10 characters');
    });

    it('renders the minWords message with the interpolated requirement', async () => {
        const fixture = await renderWith([richTextMinWords(3)], '<p>two words</p>');

        expect(errorText(fixture)).toBe('Minimum 3 words');
    });

    it('every FIELD_ERROR_LOCALES dictionary carries a non-empty minWords string', () => {
        const entries = Object.entries(FIELD_ERROR_LOCALES);
        expect(entries.length).toBeGreaterThan(0);
        for (const [code, locale] of entries) {
            expect(locale.minWords, code).toBeTruthy();
            expect(locale.minWords, code).toContain('{requiredWords}');
        }
    });
});
