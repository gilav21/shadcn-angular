/**
 * T-6 — compile-time proof that `ui-switch` satisfies the Signal Forms
 * `FormCheckboxControl` contract. See `checkbox.types.spec.ts` for why this
 * file lives outside `packages/components/ui/`.
 */
import { TestBed } from '@angular/core/testing';
import type { FormCheckboxControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { SwitchComponent } from '../ui/switch';

describe('SwitchComponent — FormCheckboxControl conformance (T-6)', () => {
    it('is assignable to FormCheckboxControl and exposes `checked` as a model', () => {
        const fixture = TestBed.createComponent(SwitchComponent);
        const control: FormCheckboxControl = fixture.componentInstance;

        expect(typeof control.checked.set).toBe('function');
        expect(typeof control.checked.subscribe).toBe('function');
        expect(control.checked()).toBe(false);
    });

    it('exposes `disabled` in the shape the contract auto-syncs', () => {
        const fixture = TestBed.createComponent(SwitchComponent);
        const control: FormCheckboxControl = fixture.componentInstance;

        expect(control.disabled?.()).toBe(false);

        fixture.componentRef.setInput('disabled', true);

        expect(control.disabled?.()).toBe(true);
    });
});
