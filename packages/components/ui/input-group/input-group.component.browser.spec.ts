import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { InputGroupComponent } from './input-group.component';
import { InputGroupInputComponent } from './sub/input-group-input.component';
import { InputGroupAddonComponent } from './sub/input-group-addon.component';
import { InputComponent } from '../input';

@Component({
    template: `
    <ui-input-group [variant]="variant">
      <ui-input [clearable]="true" value="x" />
    </ui-input-group>
  `,
    imports: [InputGroupComponent, InputComponent],
})
class ClearableHost {
    variant: 'outline' | 'underline' | 'ghost' = 'outline';
}

/** The real group reports its variant to the input through the token, which a fake group in the input's own spec cannot prove. */
describe('InputGroup with a clearable ui-input (browser)', () => {
    it.each([
        { variant: 'outline' as const, framed: true },
        { variant: 'underline' as const, framed: false },
        { variant: 'ghost' as const, framed: false },
    ])('insets the text from a $variant group only where the group draws a side frame', ({ variant, framed }) => {
        const fixture = TestBed.createComponent(ClearableHost);
        fixture.componentInstance.variant = variant;
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;

        // The group alone owns the border: the input's container draws none.
        const container = getComputedStyle(root.querySelector('[data-slot="input-container"]')!);
        expect(container.borderTopWidth).toBe('0px');
        expect(container.borderBottomWidth).toBe('0px');

        const padding = getComputedStyle(root.querySelector('input')!).paddingLeft;
        if (framed) {
            expect(padding).not.toBe('0px');
        } else {
            expect(padding).toBe('0px');
        }
    });
});

/** Real-browser layout check: the one-row arrangement is geometry, which jsdom cannot lay out. */
@Component({
    template: `
    <ui-input-group>
      <ui-input-group-addon>$</ui-input-group-addon>
      <ui-input-group-input placeholder="Amount" />
      <ui-input-group-addon>USD</ui-input-group-addon>
    </ui-input-group>
  `,
    imports: [InputGroupComponent, InputGroupInputComponent, InputGroupAddonComponent],
})
class RowHost {}

describe('InputGroup layout (browser)', () => {
    it('lays the addons and the input out in one row, vertically centred', () => {
        TestBed.configureTestingModule({ imports: [RowHost] });
        const fixture = TestBed.createComponent(RowHost);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;

        const [prefix, suffix] = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="input-group-addon"]'))
            .map(el => el.getBoundingClientRect());
        const input = root.querySelector('input')!.getBoundingClientRect();
        const centreY = (r: DOMRect) => r.top + r.height / 2;

        expect(prefix.right).toBeLessThanOrEqual(input.left + 1);
        expect(input.right).toBeLessThanOrEqual(suffix.left + 1);
        expect(centreY(prefix)).toBeCloseTo(centreY(input), 0);
        expect(centreY(suffix)).toBeCloseTo(centreY(input), 0);
    });
});
