import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { InputGroupComponent } from './input-group.component';
import { InputGroupInputComponent } from './sub/input-group-input.component';
import { InputGroupAddonComponent } from './sub/input-group-addon.component';

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
