import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { By } from '@angular/platform-browser';
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

    it('should clamp increment at max, and stay silent because nothing changed', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        fixture.componentRef.setInput('value', 10);
        fixture.componentRef.setInput('max', 10);
        fixture.detectChanges();

        component.increment();
        fixture.detectChanges();

        expect(component.displayValue()).toBe('10');
        expect(emitted).toEqual([]);
    });

    it('should clamp decrement at min, and stay silent because nothing changed', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        fixture.componentRef.setInput('value', 0);
        fixture.componentRef.setInput('min', 0);
        fixture.detectChanges();

        component.decrement();
        fixture.detectChanges();

        expect(component.displayValue()).toBe('0');
        expect(emitted).toEqual([]);
    });

    it('should parse empty string as null', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        const input = fixture.nativeElement.querySelector('input');
        input.value = '42';
        input.dispatchEvent(new Event('input'));
        input.value = '';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(emitted).toEqual([42, null]);
    });

    it('should parse valid number from input', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        const input = fixture.nativeElement.querySelector('input');
        input.value = '42.5';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(emitted[0]).toBe(42.5);
    });

    it('should emit null for invalid text', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        const input = fixture.nativeElement.querySelector('input');
        input.value = '42';
        input.dispatchEvent(new Event('input'));
        input.value = 'abc';
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();

        expect(emitted).toEqual([42, null]);
    });

    it('should use custom step', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

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
        component.value.subscribe((v: number | null) => emitted.push(v));

        fixture.componentRef.setInput('value', 3);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        fixture.detectChanges();

        expect(emitted[0]).toBe(4);
    });

    it('should support ArrowDown key to decrement', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        fixture.componentRef.setInput('value', 3);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        fixture.detectChanges();

        expect(emitted[0]).toBe(2);
    });

    /**
     * A REAL blur, not `component.onBlur()`.
     *
     * Every other blur test here calls the method directly, which is why none
     * of them noticed that the binding never fired: `blur` does not bubble,
     * and `ui-input` has no `blur` output, so clamping never ran for a user.
     */
    it('clamps on a real blur, not just when onBlur is called', async () => {
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
        fixture.componentRef.setInput('max', 100);
        fixture.detectChanges();

        input.value = '250';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();

        input.focus();
        input.blur();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.value()).toBe(100);
    });

    it('should clamp value to max on blur', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

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

    it('should ignore other keys in onKeydown', () => {
        const spy = vi.spyOn(component, 'increment');
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        vi.spyOn(enterEvent, 'preventDefault');

        component.onKeydown(enterEvent);

        expect(spy).not.toHaveBeenCalled();
        expect(enterEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should increment from null current value using 0 fallback', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        component.writeValue(null);
        fixture.detectChanges();

        component.increment();

        expect(emitted[0]).toBe(1);
    });

    it('should decrement from null current value using 0 fallback', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        component.writeValue(null);
        fixture.detectChanges();

        component.decrement();

        expect(emitted[0]).toBe(-1);
    });

    it('should keep value null on blur when current value is null', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        component.writeValue(null);
        fixture.detectChanges();

        component.onBlur();

        expect(emitted).toHaveLength(0);
        expect(component['_currentValue']()).toBeNull();
    });

    it('should call onTouched on blur', () => {
        const touched = vi.fn();
        component.registerOnTouched(touched);

        component.onBlur();

        expect(touched).toHaveBeenCalled();
    });

    it('should focus the underlying input', () => {
        const inner = component.inputRef();
        const spy = vi.spyOn(inner, 'focus');

        component.focus();

        expect(spy).toHaveBeenCalled();
    });

    it('should increment on wheel scroll up when input is focused', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        fixture.componentRef.setInput('value', 5);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        input.focus();

        const wheelEvent = new WheelEvent('wheel', { deltaY: -1, cancelable: true });
        vi.spyOn(wheelEvent, 'preventDefault');
        input.dispatchEvent(wheelEvent);

        expect(wheelEvent.preventDefault).toHaveBeenCalled();
        expect(emitted[emitted.length - 1]).toBe(6);
    });

    it('should decrement on wheel scroll down when input is focused', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        fixture.componentRef.setInput('value', 5);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        input.focus();

        const wheelEvent = new WheelEvent('wheel', { deltaY: 1, cancelable: true });
        input.dispatchEvent(wheelEvent);

        expect(emitted[emitted.length - 1]).toBe(4);
    });

    it('should not change value when wheel deltaY is 0', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        fixture.componentRef.setInput('value', 5);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        input.focus();

        const wheelEvent = new WheelEvent('wheel', { deltaY: 0, cancelable: true });
        vi.spyOn(wheelEvent, 'preventDefault');
        input.dispatchEvent(wheelEvent);

        expect(wheelEvent.preventDefault).toHaveBeenCalled();
        expect(emitted).toHaveLength(0);
    });

    it('should ignore wheel when the input is not the active element', () => {
        const emitted: (number | null)[] = [];
        component.value.subscribe((v: number | null) => emitted.push(v));

        fixture.componentRef.setInput('value', 5);
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
        input.blur();

        const wheelEvent = new WheelEvent('wheel', { deltaY: -1, cancelable: true });
        vi.spyOn(wheelEvent, 'preventDefault');
        input.dispatchEvent(wheelEvent);

        expect(wheelEvent.preventDefault).not.toHaveBeenCalled();
        expect(emitted).toHaveLength(0);
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

describe('NumberInputComponent — i18n integration', () => {
    async function setup(opts: { locale?: string; providerLocale?: string } = {}) {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [NumberInputComponent],
            providers: opts.providerLocale ? [provideUiLocale(opts.providerLocale)] : [],
        }).compileComponents();
        const fixture = TestBed.createComponent(NumberInputComponent);
        if (opts.locale) fixture.componentRef.setInput('locale', opts.locale);
        fixture.detectChanges();
        return fixture;
    }

    it('defaults resolvedLocale to "en"', async () => {
        const fixture = await setup();
        expect(fixture.componentInstance.resolvedLocale()).toBe('en');
    });

    it('resolves locale from the per-instance input', async () => {
        const fixture = await setup({ locale: 'de' });
        expect(fixture.componentInstance.resolvedLocale()).toBe('de');
    });

    it('falls back to UI_LOCALE_ID when no locale input is set', async () => {
        const fixture = await setup({ providerLocale: 'fr' });
        expect(fixture.componentInstance.resolvedLocale()).toBe('fr');
    });
});

@Component({
    template: `<ui-number-input [(value)]="amount" (valueChange)="emissions.push($event)" />`,
    imports: [NumberInputComponent],
})
class TwoWayNumberHost {
    readonly amount = signal<number | null>(null);
    readonly emissions: (number | null)[] = [];
}

@Component({
    template: `
        <form [formGroup]="form">
            <ui-number-input formControlName="qty" (valueChange)="emissions.push($event)" />
        </form>
    `,
    imports: [NumberInputComponent, ReactiveFormsModule],
})
class FormGroupNumberHost {
    readonly form = new FormGroup({ qty: new FormControl<number | null>(null) });
    readonly emissions: (number | null)[] = [];
}

@Component({
    template: `<ui-number-input [max]="100" (valueChange)="emissions.push($event)" />`,
    imports: [NumberInputComponent],
})
class ClampedNumberHost {
    readonly emissions: (number | null)[] = [];
}

/** The reference harness from the signal-forms readiness spec, applied to `number-input`. */
describe('NumberInputComponent — signal-forms readiness', () => {
    const nativeInput = (fixture: ComponentFixture<unknown>): HTMLInputElement =>
        fixture.debugElement.query(By.css('input')).nativeElement;

    /**
     * What the template renders. The DOM value is two `ngModel` hops away — this
     * component binds `displayValue()` into `ui-input`, whose own CVA then binds
     * it into the native element — so the rest of this file asserts the computed
     * rather than racing both hops, and so do the view tests below.
     */
    const rendered = (fixture: ComponentFixture<unknown>): string =>
        (fixture.debugElement.query(By.directive(NumberInputComponent)).componentInstance as NumberInputComponent).displayValue();

    const type = (fixture: ComponentFixture<unknown>, text: string): void => {
        const el = nativeInput(fixture);
        el.value = text;
        el.dispatchEvent(new Event('input'));
        fixture.detectChanges();
    };

    it('T-1: two-way [(value)] updates the model on user input', () => {
        const fixture = TestBed.createComponent(TwoWayNumberHost);
        fixture.detectChanges();

        type(fixture, '42');

        expect(fixture.componentInstance.amount()).toBe(42);
    });

    it('T-2: two-way [(value)] updates the view when the model changes', async () => {
        const fixture = TestBed.createComponent(TwoWayNumberHost);
        fixture.detectChanges();

        fixture.componentInstance.amount.set(7);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(rendered(fixture)).toBe('7');
    });

    it('T-3: works with formControlName and reports value to the form group', () => {
        const fixture = TestBed.createComponent(FormGroupNumberHost);
        fixture.detectChanges();

        type(fixture, '13');

        expect(fixture.componentInstance.form.value.qty).toBe(13);
    });

    it('T-4: writeValue from the form updates the rendered value', async () => {
        const fixture = TestBed.createComponent(FormGroupNumberHost);
        fixture.detectChanges();

        fixture.componentInstance.form.setValue({ qty: 5 });
        fixture.detectChanges();
        await fixture.whenStable();

        expect(rendered(fixture)).toBe('5');
    });

    it('T-9: emits valueChange exactly once per user input', () => {
        const fixture = TestBed.createComponent(TwoWayNumberHost);
        fixture.detectChanges();

        type(fixture, '42');

        expect(fixture.componentInstance.emissions).toEqual([42]);
    });

    it('T-10: does not re-emit when writeValue is called with the current value', () => {
        const fixture = TestBed.createComponent(TwoWayNumberHost);
        fixture.detectChanges();
        const numberInput: NumberInputComponent = fixture.debugElement
            .query(By.directive(NumberInputComponent)).componentInstance;
        type(fixture, '42');
        fixture.componentInstance.emissions.length = 0;

        numberInput.writeValue(42);
        fixture.detectChanges();

        expect(fixture.componentInstance.emissions).toEqual([]);
    });

    it('stays silent when the form writes a value the user did not type', () => {
        const fixture = TestBed.createComponent(FormGroupNumberHost);
        fixture.detectChanges();

        fixture.componentInstance.form.setValue({ qty: 9 });
        fixture.detectChanges();

        expect(fixture.componentInstance.emissions).toEqual([]);
    });

    it('emits the clamped value on blur, once, on top of the typed one', () => {
        const fixture = TestBed.createComponent(ClampedNumberHost);
        fixture.detectChanges();
        const numberInput: NumberInputComponent = fixture.debugElement
            .query(By.directive(NumberInputComponent)).componentInstance;

        type(fixture, '500');
        numberInput.onBlur();
        fixture.detectChanges();

        expect(fixture.componentInstance.emissions).toEqual([500, 100]);
    });
});
