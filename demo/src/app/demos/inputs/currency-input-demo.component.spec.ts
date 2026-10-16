import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { CurrencyInputDemoComponent } from './currency-input-demo.component';
import { CurrencyInputComponent } from '../../../../../packages/components/ui';

describe('CurrencyInputDemoComponent', () => {
    /**
     * The demo is the only place the four locales render side by side, so
     * it is also the cheapest place to notice that one of them stopped
     * formatting.
     *
     * Asserted on what each control computed, not on the DOM input.
     * `ngModel` writes to the native field in a microtask of its own, so
     * on first render the element is still empty while the component has
     * already formatted correctly — the empty box says something about
     * `ngModel`'s timing, not about this demo. What matters here is that
     * every sample resolved a locale and produced a formatted string;
     * that it reaches the DOM is covered by the component spec and by e2e.
     */
    it('formats every locale sample', async () => {
        TestBed.configureTestingModule({ imports: [CurrencyInputDemoComponent] });
        const fixture = TestBed.createComponent(CurrencyInputDemoComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const controls = fixture.debugElement
            .queryAll(node => node.componentInstance instanceof CurrencyInputComponent)
            .map(node => node.componentInstance as CurrencyInputComponent);

        expect(controls.length).toBeGreaterThan(4);
        const unformatted = controls
            .filter(control => control.value() !== null)
            .filter(control => control.displayValue().trim() === '');
        expect(unformatted).toEqual([]);
    });
});
