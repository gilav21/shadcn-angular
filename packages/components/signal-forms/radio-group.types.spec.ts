/**
 * T-6 — compile-time proof that `ui-radio-group` satisfies the Signal Forms
 * `FormValueControl` contract. See `checkbox.types.spec.ts` for why this file
 * lives outside `packages/components/ui/`.
 */
import { TestBed } from '@angular/core/testing';
import type { FormValueControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { RadioGroupComponent } from '../ui/radio-group';

describe('RadioGroupComponent — FormValueControl conformance (T-6)', () => {
    it('is assignable to FormValueControl and exposes `value` as a model', () => {
        const fixture = TestBed.createComponent<RadioGroupComponent<string>>(RadioGroupComponent);
        const control: FormValueControl<string | undefined> = fixture.componentInstance;

        expect(typeof control.value.set).toBe('function');
        expect(typeof control.value.subscribe).toBe('function');
    });

    it('exposes `disabled` in the shape the contract auto-syncs', () => {
        const fixture = TestBed.createComponent<RadioGroupComponent<string>>(RadioGroupComponent);
        const control: FormValueControl<string | undefined> = fixture.componentInstance;

        expect(control.disabled?.()).toBe(false);

        fixture.componentRef.setInput('disabled', true);

        expect(control.disabled?.()).toBe(true);
    });
});
