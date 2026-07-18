import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhoneInputComponent } from './phone-input.component';
import type { PhoneCountry } from './phone-input-data';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PhoneInputComponent — coverage completion', () => {
    let component: PhoneInputComponent;
    let fixture: ComponentFixture<PhoneInputComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PhoneInputComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(PhoneInputComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('keeps current country and full value when an E.164 dial code matches nothing', () => {
        component.writeValue('+0001234567');
        expect(component.selectedCountry().code).toBe('US');
        expect(component.nationalNumber()).toBe('+0001234567');
    });

    it('invokes the default onTouched via onBlur without a registered handler', () => {
        expect(() => component.onBlur()).not.toThrow();
    });

    it('calls the registered onTouched handler on blur', () => {
        const touched = vi.fn();
        component.registerOnTouched(touched);
        component.onBlur();
        expect(touched).toHaveBeenCalledTimes(1);
    });

    it('does not reset the country from defaultCountry once the user picks one', async () => {
        const de = component.countries().find(c => c.code === 'DE')!;
        component.selectCountry(de);
        expect(component.selectedCountry().code).toBe('DE');

        fixture.componentRef.setInput('defaultCountry', 'FR');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(component.selectedCountry().code).toBe('DE');
    });

    it('falls back to the first country when defaultCountry code is unknown', async () => {
        fixture.componentRef.setInput('defaultCountry', 'ZZ');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.selectedCountry().code).toBe('US');
    });

    it('applies a non-null value input via the value effect', async () => {
        fixture.componentRef.setInput('value', '+4915123456789');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.selectedCountry().code).toBe('DE');
        expect(component.nationalNumber()).toBe('15123456789');
    });

    it('falls back to the mask when neither placeholder input nor country placeholder exist', async () => {
        const custom: PhoneCountry[] = [
            { code: 'ZZ', name: 'Testland', flag: '🏳️', dialCode: '+999', mask: '000-000' },
        ];
        fixture.componentRef.setInput('countries', custom);
        fixture.componentRef.setInput('defaultCountry', 'ZZ');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.effectivePlaceholder()).toBe('000-000');
    });

    it('marks the currently selected country row with the active accent class', () => {
        const classes = component.countryRowClasses(component.selectedCountry());
        expect(classes).toContain('bg-accent/50');
    });

    it('does not mark a non-selected country row with the active accent class', () => {
        const de = component.countries().find(c => c.code === 'DE')!;
        const classes = component.countryRowClasses(de);
        expect(classes).not.toContain('bg-accent/50');
    });

    it('exposes itself as the UI_INPUT_GROUP context via its own injector', () => {
        const group = fixture.debugElement.injector.get(UI_INPUT_GROUP);
        expect(group).toBe(component);
    });
});
