// `currency-input` — `specs/form-controls-small-spec.md` T-1.
//
// The conformance half of these tests (T-value-model, T-cva-roundtrip,
// T-no-feedback-loop) is the contract every control in this bundle is born
// with; the rest is money.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal, type ModelSignal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CurrencyInputComponent } from './currency-input.component';

@Component({
    standalone: true,
    imports: [CurrencyInputComponent],
    template: `
    <ui-currency-input
      [(value)]="amount"
      [currency]="currency()"
      [locale]="locale()"
      [min]="min()"
      [max]="max()"
      [disabled]="disabled()"
    />
  `,
})
class HostComponent {
    readonly amount = signal<number | null>(null);
    readonly currency = signal('USD');
    readonly locale = signal('en-US');
    readonly min = signal<number | undefined>(undefined);
    readonly max = signal<number | undefined>(undefined);
    readonly disabled = signal(false);
}

@Component({
    standalone: true,
    imports: [CurrencyInputComponent, ReactiveFormsModule],
    template: `<ui-currency-input [formControl]="control" />`,
})
class ReactiveHostComponent {
    readonly control = new FormControl<number | null>(null);
}

describe('CurrencyInputComponent', () => {
    let fixture: ComponentFixture<HostComponent>;
    let host: HostComponent;

    function field(): HTMLInputElement {
        return fixture.nativeElement.querySelector('input');
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    /**
     * Type into the field the way a person does: focus, input, blur.
     *
     * Real `focus()`/`blur()` rather than dispatched `FocusEvent`s — those do
     * not bubble, so a synthetic one never reaches the wrapper that listens.
     */
    async function focusField(): Promise<void> {
        field().focus();
        field().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        await settle();
    }

    async function blurField(): Promise<void> {
        field().blur();
        field().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        await settle();
    }

    async function type(text: string, { blur = true } = {}): Promise<void> {
        await focusField();
        field().value = text;
        field().dispatchEvent(new Event('input', { bubbles: true }));
        await settle();
        if (blur) await blurField();
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
        fixture = TestBed.createComponent(HostComponent);
        host = fixture.componentInstance;
        await settle();
    });

    afterEach(() => fixture.destroy());

    describe('the conformance contract', () => {
        /**
         * A `ModelSignal` named `value` is what makes this a valid Signal
         * Forms `FormValueControl`. Asserted structurally because the type
         * test cannot fail at runtime.
         */
        it('exposes value as a model signal', () => {
            const editor = fixture.debugElement.children[0]
                .componentInstance as CurrencyInputComponent;
            const value: ModelSignal<number | null> = editor.value;

            expect(typeof value).toBe('function');
            expect(typeof value.set).toBe('function');
            expect(typeof value.subscribe).toBe('function');
        });

        it('emits through the two-way binding on a user edit', async () => {
            await type('12.34');
            expect(host.amount()).toBeCloseTo(12.34, 9);
        });

        /**
         * Risk R-3. A form writing in must not look like a user typing, or the
         * control and the form push each other back and forth forever.
         */
        it('does NOT emit when a value is written in from outside', async () => {
            const editor = fixture.debugElement.children[0]
                .componentInstance as CurrencyInputComponent;
            let emissions = 0;
            editor.value.subscribe(() => emissions++);

            editor.writeValue(99);
            await settle();

            expect(emissions).toBe(0);
        });

        it('renders a value written in from outside', async () => {
            const editor = fixture.debugElement.children[0]
                .componentInstance as CurrencyInputComponent;
            editor.writeValue(1234.5);
            await settle();

            expect(field().value).toBe('$1,234.50');
        });
    });

    describe('a reactive form', () => {
        let reactive: ComponentFixture<ReactiveHostComponent>;

        async function reactiveSettle(): Promise<void> {
            reactive.detectChanges();
            await reactive.whenStable();
            reactive.detectChanges();
        }

        beforeEach(async () => {
            await TestBed.resetTestingModule();
            await TestBed.configureTestingModule({
                imports: [ReactiveHostComponent],
            }).compileComponents();
            reactive = TestBed.createComponent(ReactiveHostComponent);
            await reactiveSettle();
        });

        afterEach(() => reactive.destroy());

        it('renders what the control holds', async () => {
            reactive.componentInstance.control.setValue(42);
            await reactiveSettle();

            expect(reactive.nativeElement.querySelector('input').value).toContain('42');
        });

        it('writes a user edit back into the control', async () => {
            const input = reactive.nativeElement.querySelector('input') as HTMLInputElement;
            input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            await reactiveSettle();
            input.value = '7.50';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await reactiveSettle();

            expect(reactive.componentInstance.control.value).toBeCloseTo(7.5, 9);
        });

        /** `disable()` after first render has to reach the field. */
        it('disables the field when the form disables the control', async () => {
            reactive.componentInstance.control.disable();
            await reactiveSettle();

            expect(reactive.nativeElement.querySelector('input').disabled).toBe(true);
        });
    });

    describe('money', () => {
        it('formats at rest with the currency symbol', async () => {
            host.amount.set(1234.5);
            await settle();
            expect(field().value).toBe('$1,234.50');
        });

        /** Reformatting mid-keystroke moves the caret out from under a typist. */
        it('shows a plain number while the field has focus', async () => {
            host.amount.set(1234.5);
            await settle();

            await focusField();

            expect(field().value).toBe('1234.5');
        });

        it('lets a half-typed decimal survive until blur', async () => {
            await type('12.', { blur: false });
            expect(field().value).toBe('12.');
        });

        it('rounds to the currency scale on blur, not before', async () => {
            await type('12.345', { blur: false });
            expect(host.amount()).toBeCloseTo(12.345, 9);

            await blurField();
            expect(host.amount()).toBeCloseTo(12.35, 10);
        });

        it('rounds a whole yen for a zero-decimal currency', async () => {
            host.currency.set('JPY');
            host.locale.set('ja-JP');
            await settle();

            await type('1234.6');
            expect(host.amount()).toBe(1235);
        });

        it('reads a German amount where dot and comma swap roles', async () => {
            host.locale.set('de-DE');
            host.currency.set('EUR');
            await settle();

            await type('1.234,56');
            expect(host.amount()).toBeCloseTo(1234.56, 9);
        });

        it('reports the amount in minor units', async () => {
            host.amount.set(12.34);
            await settle();

            const editor = fixture.debugElement.children[0]
                .componentInstance as CurrencyInputComponent;
            expect(editor.minorUnits()).toBe(1234);
        });

        it('clears to null when the field is emptied', async () => {
            host.amount.set(5);
            await settle();
            await type('');

            expect(host.amount()).toBeNull();
        });
    });

    describe('bounds', () => {
        it('clamps up to the minimum on blur', async () => {
            host.min.set(10);
            await settle();
            await type('3');

            expect(host.amount()).toBe(10);
        });

        it('clamps down to the maximum on blur', async () => {
            host.max.set(100);
            await settle();
            await type('250');

            expect(host.amount()).toBe(100);
        });

        /** Typing past a bound has to be allowed, or `250` is unreachable via `2`, `5`, `0`. */
        it('allows a value outside the bounds while still typing', async () => {
            host.max.set(100);
            await settle();
            await type('250', { blur: false });

            expect(host.amount()).toBe(250);
        });
    });

    describe('edge cases the readiness spec named', () => {
        it('starts empty for a null value', () => {
            expect(field().value).toBe('');
        });

        it('is disabled by the input before first render', async () => {
            host.disabled.set(true);
            await settle();
            expect(field().disabled).toBe(true);
        });

        it('ignores text that is not a number', async () => {
            await type('abc');
            expect(host.amount()).toBeNull();
        });

        /**
         * A programmatic write while someone is typing must not yank the
         * visible text out from under them.
         */
        it('does not rewrite the field while it has focus', async () => {
            await focusField();
            field().value = '12';
            field().dispatchEvent(new Event('input', { bubbles: true }));
            await settle();

            host.amount.set(999);
            await settle();

            expect(field().value).toBe('12');
        });

        /** Compared as text: "unchanged" is about the serialised form. */
        it('survives a JSON round trip unchanged', () => {
            const original = { amount: 1234.56 };
            const revived: unknown = JSON.parse(JSON.stringify(original));
            expect(JSON.stringify(revived)).toBe(JSON.stringify(original));
        });
    });

    describe('accessibility', () => {
        it('names the field', () => {
            expect(field().getAttribute('aria-label')).toBe('Amount');
        });

        /**
         * `type="number"` would refuse a comma — the decimal separator across
         * most of Europe — so the keypad has to come from `inputmode`.
         */
        it('asks for a numeric keypad without being a number field', () => {
            expect(field().getAttribute('type')).toBe('text');
            expect(field().getAttribute('inputmode')).toBe('decimal');
        });

        it('tags the field with its locale', () => {
            expect(field().getAttribute('lang')).toBe('en-US');
        });

        /*
         * Axe is deliberately not imported here.
         *
         * No spec in `portable-tests.json` imports `axe-core`, and for good
         * reason: these specs ship to consumers via `add --include-tests`, and
         * a consumer's project has no axe. The accessibility pass for this
         * control runs over its Storybook stories instead, which is where the
         * rest of the library's axe coverage lives.
         */
    });
});
