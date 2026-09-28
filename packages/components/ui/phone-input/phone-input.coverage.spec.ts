import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhoneInputComponent } from './phone-input.component';
import type { PhoneCountry } from './phone-input-data';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';
import { describe, it, expect, beforeEach } from 'vitest';

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
        fixture.componentRef.setInput('defaultCountry', 'DE');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(component.selectedCountry().code).toBe('DE');

        fixture.componentRef.setInput('defaultCountry', 'ZZ');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.selectedCountry().code).toBe('US');
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
        const de = component.countries().find(c => c.code === 'DE')!;
        expect(component.countryRowClasses(de)).not.toContain('bg-accent/50');
    });

    it('exposes itself as the UI_INPUT_GROUP context via its own injector', () => {
        const group = fixture.debugElement.injector.get(UI_INPUT_GROUP);
        expect(group).toBe(component);
    });
});
