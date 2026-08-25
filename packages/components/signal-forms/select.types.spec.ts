/**
 * T-6 — compile-time proof that `ui-select` satisfies the Signal Forms
 * `FormValueControl` contract. See `checkbox.types.spec.ts` for why this file
 * lives outside `packages/components/ui/`.
 *
 * This one fails before the Task 4 conversion: `value` was an `input()` paired
 * with a hand-written `valueChange` output, and the contract requires a
 * `ModelSignal`.
 */
import { TestBed } from '@angular/core/testing';
import type { FormValueControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { SelectComponent } from '../ui/select';

describe('SelectComponent — FormValueControl conformance (T-6)', () => {
    it('is assignable to FormValueControl and exposes `value` as a model', () => {
        const fixture = TestBed.createComponent<SelectComponent<string>>(SelectComponent);
        const control: FormValueControl<string | undefined> = fixture.componentInstance;

        expect(typeof control.value.set).toBe('function');
        expect(typeof control.value.subscribe).toBe('function');
        expect(control.value()).toBeUndefined();
    });

    it('exposes `disabled` in the shape the contract auto-syncs', () => {
        const fixture = TestBed.createComponent<SelectComponent<string>>(SelectComponent);
        const control: FormValueControl<string | undefined> = fixture.componentInstance;

        expect(control.disabled?.()).toBe(false);

        fixture.componentRef.setInput('disabled', true);

        expect(control.disabled?.()).toBe(true);
    });
});
