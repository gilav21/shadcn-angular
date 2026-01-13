import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { InputOTPComponent } from './input-otp.component';

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
        expect(slots.length).toBe(6);
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
});
