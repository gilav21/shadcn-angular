/**
 * T-6 — compile-time proof that `ui-input-group-input` satisfies the Signal Forms
 * `FormValueControl` contract. See `checkbox.types.spec.ts` for why this file
 * lives outside `packages/components/ui/`, and `input.types.spec.ts` for why an
 * `Omit` appears in some of these assertions.
 */
import { TestBed } from '@angular/core/testing';
import type { FormValueControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { InputGroupInputComponent } from '../ui/input-group';

describe('InputGroupInputComponent — FormValueControl conformance (T-6)', () => {
    it('is assignable to FormValueControl and exposes `value` as a model', () => {
        const fixture = TestBed.createComponent(InputGroupInputComponent);
        const control: FormValueControl<string> = fixture.componentInstance;

        expect(typeof control.value.set).toBe('function');
        expect(typeof control.value.subscribe).toBe('function');
        expect(control.value()).toBe('');
    });

    it('keeps a form write and the value model in step', () => {
        const fixture = TestBed.createComponent(InputGroupInputComponent);
        fixture.detectChanges();

        fixture.componentInstance.writeValue('written');

        expect(fixture.componentInstance.value()).toBe('written');
    });
});
