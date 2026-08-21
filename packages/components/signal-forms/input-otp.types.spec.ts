/**
 * T-6 — compile-time proof that `ui-input-otp` satisfies the Signal Forms
 * `FormValueControl<string>` contract. See `checkbox.types.spec.ts` for why
 * this file lives outside `packages/components/ui/`.
 *
 * This one caught a real defect rather than merely documenting a passing
 * state: `maxLength` was `input(6)`, i.e. `InputSignal<number>`, and the
 * contract reserves that name for `InputSignal<number | undefined>`. The
 * mismatch is not cosmetic — the `Field` directive binds `maxLength` from the
 * field's schema, and a field with no maxLength rule binds `undefined`, which
 * a `number`-typed input would have passed straight into
 * `Array.from({ length: … })` and rendered zero slots. The input is now
 * widened, with the slot count resolved through `slotCount()`.
 */
import { TestBed } from '@angular/core/testing';
import type { FormValueControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { InputOTPComponent } from '../ui/input-otp';

describe('InputOTPComponent — FormValueControl conformance (T-6)', () => {
    it('is assignable to FormValueControl<string> and exposes `value` as a model', () => {
        const fixture = TestBed.createComponent(InputOTPComponent);
        const control: FormValueControl<string> = fixture.componentInstance;

        expect(typeof control.value.set).toBe('function');
        expect(typeof control.value.subscribe).toBe('function');
        expect(control.value()).toBe('');
    });

    it('renders the default number of slots when the field binds an undefined maxLength', () => {
        const fixture = TestBed.createComponent(InputOTPComponent);
        fixture.componentRef.setInput('maxLength', undefined);
        fixture.detectChanges();

        expect(fixture.componentInstance.slotCount()).toBe(6);
        expect(fixture.nativeElement.querySelectorAll('[data-slot="input-otp-slot"]')).toHaveLength(6);
    });
});
