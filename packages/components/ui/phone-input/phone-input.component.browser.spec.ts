import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { PhoneInputComponent } from './phone-input.component';

/** The opacity a user sees: the product of the element's and every ancestor's. */
function effectiveOpacity(el: Element | null): number {
    let product = 1;
    for (let node = el; node; node = node.parentElement) {
        product *= Number.parseFloat(getComputedStyle(node).opacity);
    }
    return product;
}

describe('PhoneInputComponent — disabled look', () => {
    it('dims the trigger and the number field once, like any other disabled input', async () => {
        const fixture = TestBed.createComponent(PhoneInputComponent);
        document.body.appendChild(fixture.nativeElement);
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const trigger = fixture.nativeElement.querySelector('button[type="button"]');
        const field = fixture.nativeElement.querySelector('input[type="tel"]');
        expect(effectiveOpacity(trigger)).toBeCloseTo(0.5, 2);
        expect(effectiveOpacity(field)).toBeCloseTo(0.5, 2);

        fixture.destroy();
        fixture.nativeElement.remove();
    });
});
