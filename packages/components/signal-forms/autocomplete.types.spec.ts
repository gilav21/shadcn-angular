/**
 * T-6 — compile-time proof that `ui-autocomplete` satisfies the Signal Forms
 * `FormValueControl` contract. See `checkbox.types.spec.ts` for why this file
 * lives outside `packages/components/ui/`.
 */
import { TestBed } from '@angular/core/testing';
import type { FormValueControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { AutocompleteComponent, type AutocompleteValue } from '../ui/autocomplete';

describe('AutocompleteComponent — FormValueControl conformance (T-6)', () => {
    it('is assignable to FormValueControl and exposes `value` as a model', () => {
        const fixture = TestBed.createComponent<AutocompleteComponent<string>>(AutocompleteComponent);
        const control: FormValueControl<AutocompleteValue<string> | undefined> = fixture.componentInstance;

        expect(typeof control.value.set).toBe('function');
        expect(typeof control.value.subscribe).toBe('function');
        expect(control.value()).toBeUndefined();
    });

    it('exposes `disabled` in the shape the contract auto-syncs', () => {
        const fixture = TestBed.createComponent<AutocompleteComponent<string>>(AutocompleteComponent);
        const control: FormValueControl<AutocompleteValue<string> | undefined> = fixture.componentInstance;

        expect(control.disabled?.()).toBe(false);

        fixture.componentRef.setInput('disabled', true);

        expect(control.disabled?.()).toBe(true);
    });
});
