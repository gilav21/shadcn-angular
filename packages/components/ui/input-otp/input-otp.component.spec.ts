import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputOTPComponent } from './input-otp.component';
import { InputOTPGroupComponent } from './sub/input-otp-group.component';
import { InputOTPSlotComponent } from './sub/input-otp-slot.component';
import { InputOTPSeparatorComponent } from './sub/input-otp-separator.component';

@Component({
    template: `
    <ui-input-otp 
        [maxLength]="6" 
        [value]="otpValue()" 
        (valueChange)="otpValue.set($event)"
    />
  `,
    imports: [InputOTPComponent]
})
class TestHostComponent {
    otpValue = signal('');
}

describe('InputOTPComponent', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let host: TestHostComponent;
    let otpComponent: InputOTPComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestHostComponent, InputOTPComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        host = fixture.componentInstance;
        // Manual detectChanges
    });

    it('renders one slot per maxLength, six when it is unset', () => {
        const otp = TestBed.createComponent(InputOTPComponent);
        const slotCount = (): number =>
            otp.nativeElement.querySelectorAll('[data-slot="input-otp-slot"]').length;
        otp.detectChanges();
        expect(slotCount()).toBe(6);

        otp.componentRef.setInput('maxLength', 4);
        otp.detectChanges();
        expect(slotCount()).toBe(4);

        otp.componentRef.setInput('maxLength', undefined);
        otp.detectChanges();
        expect(slotCount()).toBe(6);
    });

    it('should display value in slots', () => {
        host.otpValue.set('123');
        fixture.detectChanges();

        const slots = fixture.debugElement.queryAll(By.css('[class*="border-y"]'));
        expect(slots[0].nativeElement.textContent.trim()).toBe('1');
        expect(slots[1].nativeElement.textContent.trim()).toBe('2');
        expect(slots[2].nativeElement.textContent.trim()).toBe('3');
        expect(slots[3].nativeElement.textContent.trim()).toBe('');
    });

    it('focuses the hidden input when a slot is clicked, and highlights no slot once it blurs', () => {
        host.otpValue.set('12');
        fixture.detectChanges();
        const hiddenInput: HTMLInputElement = fixture.nativeElement.querySelector('input');
        const slots: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-slot="input-otp-slot"]'));

        slots[4].click();
        fixture.detectChanges();
        expect(document.activeElement).toBe(hiddenInput);
        expect(slots.map(slot => slot.hasAttribute('data-active'))).toEqual([false, false, true, false, false, false]);

        hiddenInput.dispatchEvent(new Event('blur'));
        fixture.detectChanges();
        expect(slots.some(slot => slot.hasAttribute('data-active'))).toBe(false);
    });

    it('should expose a public focus() method that focuses the hidden input', () => {
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;
        const focusSpy = vi.spyOn(otpComponent.hiddenInput.nativeElement, 'focus');

        otpComponent.focus();

        expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it('should sanitize, upper-case and clamp input to maxLength', () => {
        fixture.detectChanges();
        const hiddenInput = fixture.debugElement.query(By.css('input'));

        hiddenInput.nativeElement.value = 'a1-b2 c3d4e5f6';
        hiddenInput.nativeElement.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(host.otpValue()).toBe('A1B2C3');
        expect(hiddenInput.nativeElement.value).toBe('A1B2C3');
    });

    it('should render a caret in the focused empty slot and separator dots', () => {
        host.otpValue.set('1');
        fixture.detectChanges();
        fixture.nativeElement.querySelector('input').dispatchEvent(new Event('focus'));
        fixture.detectChanges();

        const caret = fixture.debugElement.query(By.css('.animate-caret-blink'));
        expect(caret).toBeTruthy();

        const separatorDots = fixture.debugElement.queryAll(By.css('.rounded-full'));
        expect(separatorDots).toHaveLength(1);
    });
});

@Component({
    template: `
        <ui-input-otp [maxLength]="4" [(value)]="code">
            <ui-input-otp-group>
                <ui-input-otp-slot [index]="0" />
                <ui-input-otp-slot [index]="1" />
            </ui-input-otp-group>
            <ui-input-otp-separator />
            <ui-input-otp-group>
                <ui-input-otp-slot [index]="2" />
                <ui-input-otp-slot [index]="3" />
            </ui-input-otp-group>
        </ui-input-otp>
    `,
    imports: [InputOTPComponent, InputOTPGroupComponent, InputOTPSlotComponent, InputOTPSeparatorComponent],
})
class ShadcnMarkupOtpHost {
    readonly code = signal('12');
}

describe('InputOTP shadcn-style markup', () => {
    it('accepts group/slot/separator children and still renders exactly maxLength slots from its own state', () => {
        const fixture = TestBed.createComponent(ShadcnMarkupOtpHost);
        fixture.detectChanges();

        const slots: HTMLElement[] = Array.from(
            fixture.nativeElement.querySelectorAll('[data-slot="input-otp-slot"]'),
        );
        expect(slots.map(slot => slot.textContent?.trim())).toEqual(['1', '2', '', '']);
    });
});

@Component({
    template: `<ui-input-otp [(value)]="code" (valueChange)="emissions.push($event)" />`,
    imports: [InputOTPComponent],
})
class TwoWayOtpHost {
    readonly code = signal('');
    readonly emissions: string[] = [];
}

/**
 * Reference harness for the signal-forms readiness spec. `value` is already a
 * `model()`, so these pass unchanged — they exist to pin the behaviour every
 * converted control must reproduce.
 *
 * T-3 / T-4 (the `writeValue` behaviour) live in the forms suite below, now
 * that `input-otp` is a `ControlValueAccessor`.
 */
describe('InputOTPComponent — signal-forms readiness', () => {
    const hidden = (fixture: ComponentFixture<unknown>): HTMLInputElement =>
        fixture.debugElement.query(By.css('input')).nativeElement;

    const type = (fixture: ComponentFixture<unknown>, text: string): void => {
        const el = hidden(fixture);
        el.value = text;
        el.dispatchEvent(new Event('input'));
        fixture.detectChanges();
    };

    const slotText = (fixture: ComponentFixture<unknown>): string[] =>
        fixture.debugElement
            .queryAll(By.css('[class*="border-y"]'))
            .map(slot => slot.nativeElement.textContent.trim());

    it('T-1: two-way [(value)] updates the model on user input', () => {
        const fixture = TestBed.createComponent(TwoWayOtpHost);
        fixture.detectChanges();

        type(fixture, '123');

        expect(fixture.componentInstance.code()).toBe('123');
    });

    it('T-2: two-way [(value)] updates the view when the model changes', () => {
        const fixture = TestBed.createComponent(TwoWayOtpHost);
        fixture.detectChanges();

        fixture.componentInstance.code.set('42');
        fixture.detectChanges();

        expect(slotText(fixture).slice(0, 2)).toEqual(['4', '2']);
    });

    it('T-9: emits valueChange exactly once per user interaction', () => {
        const fixture = TestBed.createComponent(TwoWayOtpHost);
        fixture.detectChanges();

        type(fixture, '123');

        expect(fixture.componentInstance.emissions).toEqual(['123']);
    });

    it('T-10: does not re-emit when the value is set to the value it already holds', () => {
        const fixture = TestBed.createComponent(TwoWayOtpHost);
        fixture.detectChanges();
        const otp: InputOTPComponent = fixture.debugElement
            .query(By.directive(InputOTPComponent)).componentInstance;
        type(fixture, '123');
        fixture.componentInstance.emissions.length = 0;

        otp.value.set('123');
        fixture.detectChanges();

        expect(fixture.componentInstance.emissions).toEqual([]);
    });
});

@Component({
    template: `
      <ui-input-otp
        [formControl]="control"
        [maxLength]="4"
        (valueChange)="emissions.push($event)"
      />
    `,
    imports: [InputOTPComponent, ReactiveFormsModule],
})
class FormOtpHost {
    readonly control = new FormControl<string | null>('AB12');
    readonly emissions: string[] = [];
}

describe('InputOTPComponent forms', () => {
    const setup = (): { fixture: ComponentFixture<FormOtpHost>; host: FormOtpHost; formEmissions: unknown[] } => {
        const fixture = TestBed.createComponent(FormOtpHost);
        const host = fixture.componentInstance;
        const formEmissions: unknown[] = [];
        host.control.valueChanges.subscribe(v => formEmissions.push(v));
        fixture.detectChanges();
        return { fixture, host, formEmissions };
    };
    const hidden = (fixture: ComponentFixture<unknown>): HTMLInputElement => fixture.nativeElement.querySelector('input');
    const slotText = (fixture: ComponentFixture<unknown>): string[] =>
        Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('[data-slot="input-otp-slot"]'))
            .map(slot => slot.textContent?.trim() ?? '');

    it('works with formControlName: renders, reports each edit once, never echoes a write, touched on blur', () => {
        const { fixture, host, formEmissions } = setup();
        expect(slotText(fixture)).toEqual(['A', 'B', '1', '2']);

        hidden(fixture).value = 'AB19';
        hidden(fixture).dispatchEvent(new Event('input'));
        fixture.detectChanges();
        expect(host.control.value).toBe('AB19');
        expect(formEmissions).toEqual(['AB19']);

        // emitEvent:false silences the write itself, so any valueChanges emission below is an echo
        host.control.setValue('9Z', { emitEvent: false });
        fixture.detectChanges();
        expect(slotText(fixture)).toEqual(['9', 'Z', '', '']);
        expect(formEmissions).toEqual(['AB19']);

        host.control.setValue(null, { emitEvent: false });
        fixture.detectChanges();
        expect(slotText(fixture)).toEqual(['', '', '', '']);
        expect(hidden(fixture).value).toBe('');
        expect(formEmissions).toEqual(['AB19']);

        expect(host.control.touched).toBe(false);
        hidden(fixture).dispatchEvent(new Event('blur'));
        expect(host.control.touched).toBe(true);
    });

    it('disabled input and form.disable() make the field unfocusable and inert', () => {
        const { fixture, host } = setup();
        const slots = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('[data-slot="input-otp-slot"]'));

        host.control.disable();
        fixture.detectChanges();
        expect(hidden(fixture).disabled).toBe(true);
        slots()[1].click();
        expect(document.activeElement).not.toBe(hidden(fixture));

        host.control.enable();
        fixture.detectChanges();
        expect(hidden(fixture).disabled).toBe(false);
        slots()[1].click();
        expect(document.activeElement).toBe(hidden(fixture));
    });

    it('is disabled by the disabled input alone', () => {
        const fixture = TestBed.createComponent(InputOTPComponent);
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        fixture.nativeElement.querySelector('[data-slot="input-otp-slot"]').click();

        expect(input.disabled).toBe(true);
        expect(document.activeElement).not.toBe(input);
    });
});

describe('InputOTPComponent accessible name', () => {
    const label = async (
        providerLocale: string,
        inputs: Record<string, string> = {},
    ): Promise<string | null> => {
        const { provideUiLocale } = await import('../../lib/i18n');
        TestBed.configureTestingModule({ providers: [provideUiLocale(providerLocale)] });
        const fixture = TestBed.createComponent(InputOTPComponent);
        for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
        fixture.detectChanges();
        return fixture.nativeElement.querySelector('input').getAttribute('aria-label');
    };

    it('names the field from the locale unless the consumer labels it', async () => {
        expect(await label('en')).toBe('One-time code');
        TestBed.resetTestingModule();
        expect(await label('he')).toBe('קוד חד-פעמי');
        TestBed.resetTestingModule();
        expect(await label('en', { ariaLabel: 'PIN' })).toBe('PIN');
        TestBed.resetTestingModule();
        expect(await label('en', { ariaLabelledby: 'heading' })).toBeNull();
    });
});
