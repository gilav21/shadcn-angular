/**
 * T-5 and T-8 — the tests that actually bind every converted control into a
 * Signal Form and drive it from both ends.
 *
 * T-6 proves the *shape* is right at compile time; this file proves the
 * plumbing works at runtime: a write into the `FieldTree` reaches the control,
 * a user edit on the control reaches the `FieldTree`, and a field disabled by
 * the schema disables the control.
 *
 * Two notes on the API, because the spec's §3.1 sketch predates it. In
 * `@angular/forms@21.2.17` the directive is `FormField`, selector `[formField]`
 * — there is no `[field]` and no `[formRoot]`. And `form()` accepts a
 * `WritableSignal` of any model, primitives included, so each host here binds a
 * root field straight onto the control instead of building an object schema.
 *
 * This file lives outside `packages/components/ui/` for the reason given in
 * `checkbox.types.spec.ts`: it imports `@angular/forms/signals`, which does not
 * exist on Angular 20, and anything sitting in a component's folder is shipped
 * to consumers by `add --include-tests`.
 */
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';

import { AutocompleteComponent } from '../ui/autocomplete';
import { CheckboxComponent } from '../ui/checkbox';
import { ColorPickerComponent } from '../ui/color-picker';
import { InputComponent } from '../ui/input';
import { InputOTPComponent } from '../ui/input-otp';
import { NumberInputComponent } from '../ui/number-input';
import { PhoneInputComponent } from '../ui/phone-input';
import { RadioGroupComponent } from '../ui/radio-group';
import { RatingComponent } from '../ui/rating';
import { SelectComponent } from '../ui/select';
import { SliderComponent } from '../ui/slider';
import { SwitchComponent } from '../ui/switch';
import { TextareaComponent } from '../ui/textarea';
import { ToggleGroupComponent } from '../ui/toggle-group';

interface Fruit {
    readonly name: string;
}

const APPLE: Fruit = { name: 'Apple' };
const CHERRY: Fruit = { name: 'Cherry' };

@Component({
    template: `<ui-input [formField]="field" />`,
    imports: [InputComponent, FormField],
})
class InputFieldHost {
    readonly model = signal('');
    readonly field = form(this.model);
}

@Component({
    template: `<ui-textarea [formField]="field" />`,
    imports: [TextareaComponent, FormField],
})
class TextareaFieldHost {
    readonly model = signal('');
    readonly field = form(this.model);
}

@Component({
    template: `<ui-input-otp [formField]="field" />`,
    imports: [InputOTPComponent, FormField],
})
class InputOtpFieldHost {
    readonly model = signal('');
    readonly field = form(this.model);
}

@Component({
    template: `<ui-checkbox [formField]="field" />`,
    imports: [CheckboxComponent, FormField],
})
class CheckboxFieldHost {
    readonly model = signal(false);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-switch [formField]="field" />`,
    imports: [SwitchComponent, FormField],
})
class SwitchFieldHost {
    readonly model = signal(false);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-select [formField]="field" />`,
    imports: [SelectComponent, FormField],
})
class SelectFieldHost {
    readonly model = signal<string | undefined>(undefined);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-autocomplete [options]="options" [displayWith]="displayWith" [formField]="field" />`,
    imports: [AutocompleteComponent, FormField],
})
class AutocompleteFieldHost {
    readonly options: Fruit[] = [APPLE, CHERRY];
    readonly displayWith = (opt: Fruit): string => opt?.name ?? '';
    readonly model = signal<Fruit | Fruit[] | null | undefined>(undefined);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-number-input [formField]="field" />`,
    imports: [NumberInputComponent, FormField],
})
class NumberFieldHost {
    readonly model = signal<number | null>(null);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-phone-input [formField]="field" />`,
    imports: [PhoneInputComponent, FormField],
})
class PhoneFieldHost {
    readonly model = signal<string | null>(null);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-radio-group [formField]="field" />`,
    imports: [RadioGroupComponent, FormField],
})
class RadioFieldHost {
    readonly model = signal<string | undefined>(undefined);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-slider [formField]="field" />`,
    imports: [SliderComponent, FormField],
})
class SliderFieldHost {
    readonly model = signal(0);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-toggle-group [formField]="field" />`,
    imports: [ToggleGroupComponent, FormField],
})
class ToggleGroupFieldHost {
    readonly model = signal<string | string[] | undefined>(undefined);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-rating [formField]="field" />`,
    imports: [RatingComponent, FormField],
})
class RatingFieldHost {
    readonly model = signal(0);
    readonly field = form(this.model);
}

@Component({
    template: `<ui-color-picker [formField]="field" />`,
    imports: [ColorPickerComponent, FormField],
})
class ColorPickerFieldHost {
    readonly model = signal('');
    readonly field = form(this.model);
}

@Component({
    template: `<ui-input [formField]="field" />`,
    imports: [InputComponent, FormField],
})
class DisabledInputFieldHost {
    readonly model = signal('');
    readonly field = form(this.model, path => {
        disabled(path);
    });
}

@Component({
    template: `<ui-checkbox [formField]="field" />`,
    imports: [CheckboxComponent, FormField],
})
class DisabledCheckboxFieldHost {
    readonly model = signal(false);
    readonly field = form(this.model, path => {
        disabled(path);
    });
}

@Component({
    template: `<ui-select [formField]="field" />`,
    imports: [SelectComponent, FormField],
})
class DisabledSelectFieldHost {
    readonly model = signal<string | undefined>(undefined);
    readonly field = form(this.model, path => {
        disabled(path);
    });
}

const settle = async (fixture: ComponentFixture<unknown>): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
};

describe('T-5: converted controls round-trip through a Signal Forms FieldTree', () => {
    it('ui-input', async () => {
        const fixture = TestBed.createComponent(InputFieldHost);
        await settle(fixture);
        const control: InputComponent = fixture.debugElement.query(By.directive(InputComponent)).componentInstance;

        fixture.componentInstance.field().value.set('from the field');
        await settle(fixture);
        expect(control.value()).toBe('from the field');

        control.onValueChange('from the control');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe('from the control');
    });

    it('ui-textarea', async () => {
        const fixture = TestBed.createComponent(TextareaFieldHost);
        await settle(fixture);
        const control: TextareaComponent = fixture.debugElement.query(By.directive(TextareaComponent)).componentInstance;

        fixture.componentInstance.field().value.set('from the field');
        await settle(fixture);
        expect(control.value()).toBe('from the field');

        control.onValueChange('from the control');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe('from the control');
    });

    it('ui-input-otp', async () => {
        const fixture = TestBed.createComponent(InputOtpFieldHost);
        await settle(fixture);
        const control: InputOTPComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        fixture.componentInstance.field().value.set('ABC');
        await settle(fixture);
        expect(control.value()).toBe('ABC');

        control.value.set('XYZ');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe('XYZ');
    });

    it('ui-checkbox', async () => {
        const fixture = TestBed.createComponent(CheckboxFieldHost);
        await settle(fixture);
        const control: CheckboxComponent = fixture.debugElement.query(By.directive(CheckboxComponent)).componentInstance;

        fixture.componentInstance.field().value.set(true);
        await settle(fixture);
        expect(control.checked()).toBe(true);

        control.toggle();
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe(false);
    });

    it('ui-switch', async () => {
        const fixture = TestBed.createComponent(SwitchFieldHost);
        await settle(fixture);
        const control: SwitchComponent = fixture.debugElement.query(By.directive(SwitchComponent)).componentInstance;

        fixture.componentInstance.field().value.set(true);
        await settle(fixture);
        expect(control.checked()).toBe(true);

        control.toggle();
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe(false);
    });

    it('ui-select', async () => {
        const fixture = TestBed.createComponent(SelectFieldHost);
        await settle(fixture);
        const control: SelectComponent<string> = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;

        fixture.componentInstance.field().value.set('from the field');
        await settle(fixture);
        // Written through the CVA, so it lands on the rendered state; `value()`
        // is the published surface and deliberately does not track form writes.
        expect(control.internalValue()).toBe('from the field');

        control.select('from the control');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe('from the control');
    });

    it('ui-autocomplete', async () => {
        const fixture = TestBed.createComponent(AutocompleteFieldHost);
        await settle(fixture);
        const control: AutocompleteComponent<Fruit> =
            fixture.debugElement.query(By.directive(AutocompleteComponent)).componentInstance;

        fixture.componentInstance.field().value.set(APPLE);
        await settle(fixture);
        expect(control.selectedItems()).toEqual([APPLE]);

        control.onSelect(CHERRY);
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe(CHERRY);
    });

    it('ui-number-input', async () => {
        const fixture = TestBed.createComponent(NumberFieldHost);
        await settle(fixture);
        const control: NumberInputComponent =
            fixture.debugElement.query(By.directive(NumberInputComponent)).componentInstance;

        fixture.componentInstance.field().value.set(11);
        await settle(fixture);
        expect(control.displayValue()).toBe('11');

        control.onInputChange('22');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe(22);
    });

    it('ui-phone-input', async () => {
        const fixture = TestBed.createComponent(PhoneFieldHost);
        await settle(fixture);
        const control: PhoneInputComponent =
            fixture.debugElement.query(By.directive(PhoneInputComponent)).componentInstance;

        fixture.componentInstance.field().value.set('+442071234567');
        await settle(fixture);
        expect(control.nationalNumber()).toBe('2071234567');

        control.onNationalChange('5551234567');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe('+445551234567');
    });

    it('ui-radio-group', async () => {
        const fixture = TestBed.createComponent(RadioFieldHost);
        await settle(fixture);
        const control: RadioGroupComponent<string> =
            fixture.debugElement.query(By.directive(RadioGroupComponent)).componentInstance;

        fixture.componentInstance.field().value.set('from the field');
        await settle(fixture);
        expect(control.internalValue()).toBe('from the field');

        control.selectValue('from the control');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe('from the control');
    });

    it('ui-slider', async () => {
        const fixture = TestBed.createComponent(SliderFieldHost);
        await settle(fixture);
        const control: SliderComponent = fixture.debugElement.query(By.directive(SliderComponent)).componentInstance;

        fixture.componentInstance.field().value.set(30);
        await settle(fixture);
        expect(control.value()).toBe(30);

        control.value.set(70);
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe(70);
    });

    it('ui-toggle-group', async () => {
        const fixture = TestBed.createComponent(ToggleGroupFieldHost);
        await settle(fixture);
        const control: ToggleGroupComponent =
            fixture.debugElement.query(By.directive(ToggleGroupComponent)).componentInstance;

        fixture.componentInstance.field().value.set('bold');
        await settle(fixture);
        expect(control.selection()).toEqual(['bold']);

        control.toggle('italic');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe('italic');
    });

    it('ui-rating', async () => {
        const fixture = TestBed.createComponent(RatingFieldHost);
        await settle(fixture);
        const control: RatingComponent = fixture.debugElement.query(By.directive(RatingComponent)).componentInstance;

        fixture.componentInstance.field().value.set(3);
        await settle(fixture);
        expect(control.value()).toBe(3);

        control.onKeydown(new KeyboardEvent('keydown', { key: 'End' }));
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe(5);
    });

    it('ui-color-picker', async () => {
        const fixture = TestBed.createComponent(ColorPickerFieldHost);
        await settle(fixture);
        const control: ColorPickerComponent =
            fixture.debugElement.query(By.directive(ColorPickerComponent)).componentInstance;

        fixture.componentInstance.field().value.set('#ff0000');
        await settle(fixture);
        expect(control.currentColor()).toBe('#ff0000');

        control.selectPreset('#0000ff');
        await settle(fixture);
        expect(fixture.componentInstance.model()).toBe('#0000ff');
    });
});

describe('T-8: a field disabled by the schema disables the control', () => {
    it('ui-input', async () => {
        const fixture = TestBed.createComponent(DisabledInputFieldHost);
        await settle(fixture);

        expect(fixture.debugElement.query(By.css('input')).nativeElement.disabled).toBe(true);
    });

    it('ui-checkbox', async () => {
        const fixture = TestBed.createComponent(DisabledCheckboxFieldHost);
        await settle(fixture);

        expect(fixture.debugElement.query(By.css('input[type="checkbox"]')).nativeElement.disabled).toBe(true);
    });

    it('ui-select', async () => {
        const fixture = TestBed.createComponent(DisabledSelectFieldHost);
        await settle(fixture);
        const control: SelectComponent<string> = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;

        expect(control.isDisabled()).toBe(true);
    });
});
