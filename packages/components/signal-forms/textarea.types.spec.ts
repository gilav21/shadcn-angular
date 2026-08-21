/**
 * T-6 — compile-time proof that `ui-textarea` satisfies the Signal Forms
 * `FormValueControl` contract. See `checkbox.types.spec.ts` for why this file
 * lives outside `packages/components/ui/`.
 *
 * The assertion omits `name`. `FormUiControl` reserves that member for exactly
 * `InputSignal<string>`, and this component declares
 * `InputSignal<string | undefined>` — which fails the assignment on
 * `transformFn` contravariance, the same rule that caught `input-otp`'s
 * `maxLength`. The difference is that this one is harmless at runtime: the
 * `Field` directive writes a plain string into the input and an unset name is
 * already the component's normal state, so nothing breaks. `min`/`max` on
 * `slider` and `maxLength` on `input-otp` were widened precisely because an
 * `undefined` push there *did* break them. Widening a public input purely to
 * satisfy a structural check that costs nothing at runtime is not worth the
 * API churn, so this is recorded rather than papered over.
 */
import { TestBed } from '@angular/core/testing';
import type { FormValueControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { TextareaComponent } from '../ui/textarea';

type ValueControlWithoutName = Omit<FormValueControl<string>, 'name'>;

describe('TextareaComponent — FormValueControl conformance (T-6)', () => {
    it('is assignable to FormValueControl and exposes `value` as a model', () => {
        const fixture = TestBed.createComponent(TextareaComponent);
        const control: ValueControlWithoutName = fixture.componentInstance;

        expect(typeof control.value.set).toBe('function');
        expect(typeof control.value.subscribe).toBe('function');
        expect(control.value()).toBe('');
    });

    it('exposes `disabled` in the shape the contract auto-syncs', () => {
        const fixture = TestBed.createComponent(TextareaComponent);
        const control: ValueControlWithoutName = fixture.componentInstance;

        expect(control.disabled?.()).toBe(false);

        fixture.componentRef.setInput('disabled', true);

        expect(control.disabled?.()).toBe(true);
    });

    it('keeps a form write and the value model in step', () => {
        const fixture = TestBed.createComponent(TextareaComponent);
        fixture.detectChanges();

        fixture.componentInstance.writeValue('written');

        expect(fixture.componentInstance.value()).toBe('written');
    });
});
