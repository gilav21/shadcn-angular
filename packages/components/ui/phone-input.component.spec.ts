import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { PhoneInputComponent } from './phone-input.component';
import { DEFAULT_COUNTRIES } from './phone-input-data';
import { describe, it, expect, beforeEach } from 'vitest';

describe('PhoneInputComponent', () => {
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

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="phone-input"', () => {
        const el = fixture.nativeElement.querySelector('[data-slot="phone-input"]');
        expect(el).toBeTruthy();
    });

    it('should render an input of type tel', () => {
        const input = fixture.nativeElement.querySelector('input[type="tel"]');
        expect(input).toBeTruthy();
    });

    it('should default to US country', () => {
        expect(component.selectedCountry().code).toBe('US');
    });

    it('should change country when defaultCountry input changes', async () => {
        fixture.componentRef.setInput('defaultCountry', 'DE');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.selectedCountry().code).toBe('DE');
    });

    it('should render country flag and dialCode in trigger button', () => {
        const button = fixture.nativeElement.querySelector('button[type="button"]');
        expect(button.textContent).toContain('🇺🇸');
        expect(button.textContent).toContain('+1');
    });

    it('should have a search input inside the popover content when opened', () => {
        const triggerBtn = fixture.nativeElement.querySelector('button[type="button"]');
        triggerBtn.click();
        fixture.detectChanges();

        const searchInput = fixture.nativeElement.querySelector('input[type="text"]');
        expect(searchInput).toBeTruthy();
        expect(searchInput.placeholder).toBe('Search country...');
    });

    it('should disable input and trigger when disabled', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const telInput = fixture.nativeElement.querySelector('input[type="tel"]');
        expect(telInput.disabled).toBe(true);

        const triggerBtn = fixture.nativeElement.querySelector('button[type="button"]');
        expect(triggerBtn.disabled).toBe(true);
    });

    it('should emit E.164 on national number change', () => {
        const emitted: string[] = [];
        component.valueChange.subscribe(v => emitted.push(v));

        component.onNationalChange('5551234567');
        expect(emitted[0]).toBe('+15551234567');
    });

    it('should strip non-digit chars when building E.164', () => {
        const emitted: string[] = [];
        component.valueChange.subscribe(v => emitted.push(v));

        component.onNationalChange('(555) 123-4567');
        expect(emitted[0]).toBe('+15551234567');
    });

    it('should emit empty string when national number is empty', () => {
        const emitted: string[] = [];
        component.valueChange.subscribe(v => emitted.push(v));

        component.onNationalChange('');
        expect(emitted[0]).toBe('');
    });

    it('should update selectedCountry when a country is selected', () => {
        const germany = DEFAULT_COUNTRIES.find(c => c.code === 'DE')!;
        component.selectCountry(germany);
        expect(component.selectedCountry().code).toBe('DE');
        expect(component.selectedCountry().dialCode).toBe('+49');
    });

    it('should filter countries by name on search', () => {
        component.onSearchInput({ target: { value: 'ger' } } as unknown as Event);
        const filtered = component.filteredCountries();
        expect(filtered.some(c => c.code === 'DE')).toBe(true);
        expect(filtered.some(c => c.code === 'US')).toBe(false);
    });

    it('should filter countries by dialCode on search', () => {
        component.onSearchInput({ target: { value: '+44' } } as unknown as Event);
        const filtered = component.filteredCountries();
        expect(filtered.some(c => c.code === 'GB')).toBe(true);
    });

    it('should clear searchQuery when a country is selected', () => {
        component.onSearchInput({ target: { value: 'ger' } } as unknown as Event);
        const de = DEFAULT_COUNTRIES.find(c => c.code === 'DE')!;
        component.selectCountry(de);
        expect(component.searchQuery()).toBe('');
    });

    it('should clear nationalNumber when a different country is selected', () => {
        component.onNationalChange('5551234567');
        expect(component.nationalNumber()).toBe('5551234567');

        const de = DEFAULT_COUNTRIES.find(c => c.code === 'DE')!;
        component.selectCountry(de);
        expect(component.nationalNumber()).toBe('');
    });

    it('should expose mask on the selected country', () => {
        expect(component.selectedCountry().mask).toBe('(000) 000-0000');
        const gb = DEFAULT_COUNTRIES.find(c => c.code === 'GB')!;
        component.selectCountry(gb);
        expect(component.selectedCountry().mask).toBe('0000 000000');
    });

    it('should use country placeholder when no placeholder input is given', () => {
        expect(component.effectivePlaceholder()).toBe('(555) 000-0000');
    });

    it('should use custom placeholder when provided', async () => {
        fixture.componentRef.setInput('placeholder', 'Enter phone');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(component.effectivePlaceholder()).toBe('Enter phone');
    });
});

describe('PhoneInputComponent writeValue', () => {
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

    it('should parse E.164 into country and national number', () => {
        component.writeValue('+4915123456789');
        expect(component.selectedCountry().code).toBe('DE');
        expect(component.nationalNumber()).toBe('15123456789');
    });

    it('should keep current country when dial code is ambiguous and current matches', () => {
        component.writeValue('+15551234567');
        expect(component.selectedCountry().dialCode).toBe('+1');
        expect(component.nationalNumber()).toBe('5551234567');
    });

    it('should handle null/empty writeValue gracefully', () => {
        component.writeValue(null);
        expect(component.nationalNumber()).toBe('');
    });

    it('should handle non-E.164 value gracefully', () => {
        component.writeValue('5551234567');
        expect(component.nationalNumber()).toBe('5551234567');
    });
});

@Component({
    selector: 'app-test-host-mask',
    imports: [PhoneInputComponent, FormsModule],
    template: `<ui-phone-input [(ngModel)]="value" />`,
})
class TestHostMaskComponent {
    value = '';
}

describe('PhoneInputComponent mask enforcement (via InputMaskDirective)', () => {
    let fixture: ComponentFixture<TestHostMaskComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostMaskComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(TestHostMaskComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    it('should reject letters typed into the masked tel input', async () => {
        const telInput = fixture.nativeElement.querySelector('input[type="tel"]') as HTMLInputElement;
        expect(telInput).toBeTruthy();

        telInput.value = 'abc';
        telInput.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(telInput.value).not.toContain('a');
        expect(telInput.value).not.toContain('b');
        expect(telInput.value).not.toContain('c');
    });

    it('should format raw digits according to the US mask', async () => {
        const telInput = fixture.nativeElement.querySelector('input[type="tel"]') as HTMLInputElement;

        telInput.value = '5551234567';
        telInput.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(telInput.value).toBe('(555) 123-4567');
    });

    it('should strip letters from a mixed input and keep only digits formatted', async () => {
        const telInput = fixture.nativeElement.querySelector('input[type="tel"]') as HTMLInputElement;

        telInput.value = '5a5b5c1234567';
        telInput.dispatchEvent(new Event('input'));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(telInput.value).toBe('(555) 123-4567');
    });
});

@Component({
    selector: 'app-test-reactive',
    imports: [PhoneInputComponent, ReactiveFormsModule],
    template: `<ui-phone-input [formControl]="control" />`,
})
class TestReactiveComponent {
    readonly control = new FormControl<string>('');
}

describe('PhoneInputComponent with ReactiveFormsModule', () => {
    let fixture: ComponentFixture<TestReactiveComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestReactiveComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(TestReactiveComponent);
        fixture.detectChanges();
    });

    it('should reflect control value via nationalNumber', async () => {
        fixture.componentInstance.control.setValue('+4915123456789');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const phoneInput = fixture.debugElement.children[0].componentInstance as PhoneInputComponent;
        expect(phoneInput.nationalNumber()).toBe('15123456789');
    });

    it('should update control when national number changes', () => {
        const phoneInput = fixture.debugElement.children[0].componentInstance as PhoneInputComponent;
        phoneInput.onNationalChange('5551234567');
        expect(fixture.componentInstance.control.value).toBe('+15551234567');
    });

    it('should disable input when control is disabled', async () => {
        fixture.componentInstance.control.disable();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input[type="tel"]');
        expect(input.disabled).toBe(true);
    });
});

@Component({
    selector: 'app-test-ngmodel',
    imports: [PhoneInputComponent, FormsModule],
    template: `<ui-phone-input [(ngModel)]="value" />`,
})
class TestNgModelComponent {
    value = '';
}

describe('PhoneInputComponent with ngModel', () => {
    let fixture: ComponentFixture<TestNgModelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestNgModelComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(TestNgModelComponent);
        fixture.detectChanges();
    });

    it('should bind value via ngModel', async () => {
        fixture.componentInstance.value = '+4915123456789';
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const phoneInput = fixture.debugElement.children[0].componentInstance as PhoneInputComponent;
        expect(phoneInput.nationalNumber()).toBe('15123456789');
    });
});
