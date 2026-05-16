import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { NumberInputComponent } from './number-input.component';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('NumberInputComponent', () => {
    let component: NumberInputComponent;
    let fixture: ComponentFixture<NumberInputComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NumberInputComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(NumberInputComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have data-slot="number-input"', () => {
        const el = fixture.nativeElement.querySelector('[data-slot="number-input"]');
        expect(el).toBeTruthy();
    });

    it('should render an input of type number', () => {
        const input = fixture.nativeElement.querySelector('input');
        expect(input).toBeTruthy();
        expect(input.type).toBe('number');
    });

    it('should clamp increment at max', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        fixture.componentRef.setInput('value', 10);
        fixture.componentRef.setInput('max', 10);
        fixture.detectChanges();

        component.increment();
        fixture.detectChanges();

        expect(emitted[0]).toBe(10);
    });

    it('should clamp decrement at min', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        fixture.componentRef.setInput('value', 0);
        fixture.componentRef.setInput('min', 0);
        fixture.detectChanges();

        component.decrement();
        fixture.detectChanges();

        expect(emitted[0]).toBe(0);
    });

    it('should parse empty string as null', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        const input = fixture.nativeElement.querySelector('input');
        input.value = '';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(emitted[0]).toBeNull();
    });

    it('should parse valid number from input', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        const input = fixture.nativeElement.querySelector('input');
        input.value = '42.5';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(emitted[0]).toBe(42.5);
    });

    it('should emit null for invalid text', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        const input = fixture.nativeElement.querySelector('input');
        input.value = 'abc';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(emitted[0]).toBeNull();
    });

    it('should use custom step', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        fixture.componentRef.setInput('value', 0);
        fixture.componentRef.setInput('step', 5);
        fixture.detectChanges();

        component.increment();

        expect(emitted[0]).toBe(5);
    });

    it('should apply disabled state to input', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input');
        expect(input.disabled).toBe(true);
    });

    it('should support ArrowUp key to increment', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        fixture.componentRef.setInput('value', 3);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        fixture.detectChanges();

        expect(emitted[0]).toBe(4);
    });

    it('should support ArrowDown key to decrement', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        fixture.componentRef.setInput('value', 3);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();

        expect(emitted[0]).toBe(2);
    });

    it('should clamp value to max on blur', () => {
        const emitted: (number | null)[] = [];
        component.valueChange.subscribe((v) => emitted.push(v));

        fixture.componentRef.setInput('max', 10);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input');
        input.value = '15';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        component.onBlur();
        fixture.detectChanges();

        const clampedEmit = emitted.find((v) => v === 10);
        expect(clampedEmit).toBe(10);
        expect(component['_currentValue']()).toBe(10);
    });

    it('should prevent default on ArrowUp/ArrowDown', () => {
        fixture.componentRef.setInput('value', 3);
        fixture.detectChanges();

        const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });

        vi.spyOn(upEvent, 'preventDefault');
        vi.spyOn(downEvent, 'preventDefault');

        component.onKeydown(upEvent);
        component.onKeydown(downEvent);

        expect(upEvent.preventDefault).toHaveBeenCalled();
        expect(downEvent.preventDefault).toHaveBeenCalled();
    });
});

@Component({
    selector: 'app-test-reactive',
    imports: [NumberInputComponent, ReactiveFormsModule],
    template: `<ui-number-input [formControl]="control" />`,
})
class TestReactiveComponent {
    readonly control = new FormControl<number | null>(null);
}

describe('NumberInputComponent with ReactiveFormsModule', () => {
    let fixture: ComponentFixture<TestReactiveComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestReactiveComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(TestReactiveComponent);
        fixture.detectChanges();
    });

    it('should reflect control value via displayValue', async () => {
        fixture.componentInstance.control.setValue(42);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const numberInput = fixture.debugElement.children[0].componentInstance as NumberInputComponent;
        expect(numberInput.displayValue()).toBe('42');
    });

    it('should update control when input changes', () => {
        const input = fixture.nativeElement.querySelector('input');
        input.value = '99';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(fixture.componentInstance.control.value).toBe(99);
    });

    it('should disable input when control is disabled', async () => {
        fixture.componentInstance.control.disable();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input');
        expect(input.disabled).toBe(true);
    });
});

@Component({
    selector: 'app-test-ngmodel',
    imports: [NumberInputComponent, FormsModule],
    template: `<ui-number-input [(ngModel)]="value" />`,
})
class TestNgModelComponent {
    value: number | null = null;
}

describe('NumberInputComponent with ngModel', () => {
    let fixture: ComponentFixture<TestNgModelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TestNgModelComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(TestNgModelComponent);
        fixture.detectChanges();
    });

    it('should bind value via ngModel', async () => {
        fixture.componentInstance.value = 7;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const numberInput = fixture.debugElement.children[0].componentInstance as NumberInputComponent;
        expect(numberInput.displayValue()).toBe('7');
    });
});
