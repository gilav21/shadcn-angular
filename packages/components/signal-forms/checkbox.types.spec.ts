/**
 * T-6 — compile-time proof that `ui-checkbox` satisfies the Signal Forms
 * `FormCheckboxControl` contract. The assignment on the `control` line IS the
 * test: if `checked` ever stops being a `ModelSignal<boolean>`, or an input
 * whose name the contract reserves takes an incompatible type, `npm run
 * typecheck` fails here and names the member that broke.
 *
 * Why this lives outside `packages/components/ui/`: `sync-registry` collects
 * every non-`.browser` spec sitting in a component's folder into that
 * component's `testFiles[]`, which `add --include-tests` ships to consumers.
 * These files import `@angular/forms/signals`, which does not exist on Angular
 * 20 — shipping them would break exactly the consumers UC-4 promises not to
 * break. Outside `ui/` nothing collects them, and they are still typechecked
 * by `npm run typecheck` and still run under vitest.
 */
import { TestBed } from '@angular/core/testing';
import type { FormCheckboxControl } from '@angular/forms/signals';
import { describe, expect, it } from 'vitest';
import { CheckboxComponent } from '../ui/checkbox';

describe('CheckboxComponent — FormCheckboxControl conformance (T-6)', () => {
    it('is assignable to FormCheckboxControl and exposes `checked` as a model', () => {
        const fixture = TestBed.createComponent(CheckboxComponent);
        const control: FormCheckboxControl = fixture.componentInstance;

        expect(typeof control.checked.set).toBe('function');
        expect(typeof control.checked.subscribe).toBe('function');
        expect(control.checked()).toBe(false);
    });

    it('exposes `disabled` in the shape the contract auto-syncs', () => {
        const fixture = TestBed.createComponent(CheckboxComponent);
        const control: FormCheckboxControl = fixture.componentInstance;

        expect(control.disabled?.()).toBe(false);

        fixture.componentRef.setInput('disabled', true);

        expect(control.disabled?.()).toBe(true);
    });
});
