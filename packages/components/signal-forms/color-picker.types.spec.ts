/**
 * T-6 — compile-time proof that `ui-color-picker` satisfies the Signal Forms
 * `FormValueControl` contract. See `checkbox.types.spec.ts` for why this file
 * lives outside `packages/components/ui/`.
 *
 * This component needed the most work of the set: `value` was already taken by
 * the HSV brightness channel, and the colour itself had no input at all — it
 * could only be set through `writeValue`. The channel is now `hsvValue` and
 * `value` is the hex colour.
 */
import { TestBed } from '@angular/core/testing';
import type { FormValueControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { ColorPickerComponent } from '../ui/color-picker';

describe('ColorPickerComponent — FormValueControl conformance (T-6)', () => {
    it('is assignable to FormValueControl and exposes `value` as a model', () => {
        const fixture = TestBed.createComponent(ColorPickerComponent);
        const control: FormValueControl<string> = fixture.componentInstance;

        expect(typeof control.value.set).toBe('function');
        expect(typeof control.value.subscribe).toBe('function');
    });

    it('exposes `disabled` in the shape the contract auto-syncs', () => {
        const fixture = TestBed.createComponent(ColorPickerComponent);
        const control: FormValueControl<string> = fixture.componentInstance;

        expect(control.disabled?.()).toBe(false);

        fixture.componentRef.setInput('disabled', true);

        expect(control.disabled?.()).toBe(true);
    });
});
