import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
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

    it('should create and render slots', () => {
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        const slots = fixture.debugElement.queryAll(By.css('[class*="border-y"]')); // Slot class selector approximation
        expect(slots).toHaveLength(6);
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

    it('should update on input', async () => {
        fixture.detectChanges();
        const hiddenInput = fixture.debugElement.query(By.css('input'));

        hiddenInput.nativeElement.value = '456';
        hiddenInput.nativeElement.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(host.otpValue()).toBe('456');
    });

    it('should navigation with arrows', () => {
        host.otpValue.set('12');
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        // Focus (sets index to length = 2)
        otpComponent.onFocus();
        fixture.detectChanges();
        expect(otpComponent.focusedIndex()).toBe(2);

        const container = fixture.debugElement.query(By.css('[data-slot="input-otp"]'));

        // Left arrow -> 1
        container.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();
        expect(otpComponent.focusedIndex()).toBe(1);

        // Left arrow -> 0
        container.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();
        expect(otpComponent.focusedIndex()).toBe(0);

        // Right arrow -> 1
        container.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        fixture.detectChanges();
        expect(otpComponent.focusedIndex()).toBe(1);
    });

    it('should handle backspace', () => {
        host.otpValue.set('123');
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        const container = fixture.debugElement.query(By.css('[data-slot="input-otp"]'));
        container.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
        fixture.detectChanges();

        expect(host.otpValue()).toBe('12');
    });

    it('should focus hidden input and set focused index when a slot is clicked', () => {
        host.otpValue.set('12');
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        const focusSpy = vi.spyOn(otpComponent.hiddenInput.nativeElement, 'focus');

        const slots = fixture.debugElement.queryAll(By.css('[data-slot="input-otp-slot"]'));
        slots[4].nativeElement.click();
        fixture.detectChanges();

        expect(focusSpy).toHaveBeenCalledTimes(1);
        // Clamped to current value length (2)
        expect(otpComponent.focusedIndex()).toBe(2);
    });

    it('should focus a slot within the value range without clamping', () => {
        host.otpValue.set('1234');
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;
        vi.spyOn(otpComponent.hiddenInput.nativeElement, 'focus');

        otpComponent.focusSlot(1);
        fixture.detectChanges();

        expect(otpComponent.focusedIndex()).toBe(1);
    });

    it('should reset focused index to -1 on blur', () => {
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        otpComponent.onFocus();
        expect(otpComponent.focusedIndex()).toBe(0);

        const hiddenInput = fixture.debugElement.query(By.css('input'));
        hiddenInput.nativeElement.dispatchEvent(new Event('blur'));
        fixture.detectChanges();

        expect(otpComponent.focusedIndex()).toBe(-1);
    });

    it('should expose a public focus() method that focuses the hidden input', () => {
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;
        const focusSpy = vi.spyOn(otpComponent.hiddenInput.nativeElement, 'focus');

        otpComponent.focus();

        expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it('should move focus right but not past the value length', () => {
        host.otpValue.set('123');
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        otpComponent.focusedIndex.set(0);
        const container = fixture.debugElement.query(By.css('[data-slot="input-otp"]'));

        for (let i = 0; i < 5; i++) {
            container.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        }
        fixture.detectChanges();

        // Capped at value length (3)
        expect(otpComponent.focusedIndex()).toBe(3);
    });

    it('should ignore keys other than arrows and backspace', () => {
        host.otpValue.set('12');
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;
        otpComponent.focusedIndex.set(1);

        const container = fixture.debugElement.query(By.css('[data-slot="input-otp"]'));
        container.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        fixture.detectChanges();

        expect(otpComponent.focusedIndex()).toBe(1);
        expect(host.otpValue()).toBe('12');
    });

    it('should not change value on Backspace when the value is empty', () => {
        host.otpValue.set('');
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        const container = fixture.debugElement.query(By.css('[data-slot="input-otp"]'));
        container.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
        fixture.detectChanges();

        expect(host.otpValue()).toBe('');
    });

    it('should handle Backspace when the hidden input ref is unavailable', () => {
        host.otpValue.set('123');
        fixture.detectChanges();
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        // Force the optional-chaining false branch on the hidden input ref.
        (otpComponent as unknown as { hiddenInput: undefined }).hiddenInput = undefined;
        otpComponent.onKeydown(new KeyboardEvent('keydown', { key: 'Backspace' }));

        expect(host.otpValue()).toBe('12');
        expect(otpComponent.focusedIndex()).toBe(2);
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
        otpComponent = fixture.debugElement.query(By.directive(InputOTPComponent)).componentInstance;

        otpComponent.onFocus();
        fixture.detectChanges();

        const caret = fixture.debugElement.query(By.css('.animate-caret-blink'));
        expect(caret).toBeTruthy();

        const separatorDots = fixture.debugElement.queryAll(By.css('.rounded-full'));
        expect(separatorDots).toHaveLength(1);
    });
});

describe('InputOTP sub-components', () => {
    it('should create the group component', () => {
        const fixture = TestBed.createComponent(InputOTPGroupComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should create the separator component', () => {
        const fixture = TestBed.createComponent(InputOTPSeparatorComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance).toBeTruthy();
    });

    it('should create the slot component with a default index input', () => {
        const fixture = TestBed.createComponent(InputOTPSlotComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance).toBeTruthy();
        expect(fixture.componentInstance.index()).toBe(0);
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
 * T-3 / T-4 are deliberately absent: `input-otp` is not a
 * `ControlValueAccessor` (verified in the spec's §3.4.b inventory), so it has
 * no `formControlName` or `writeValue` behaviour to assert.
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
