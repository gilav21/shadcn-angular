import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { InputComponent, InputVariant } from './input.component';
import { UI_INPUT_GROUP } from '../../lib/input-group.token';

/** Browser-only input styling: variants and the prefix row are utility classes, so only computed style and layout show them. */
@Component({
    template: `
        <div style="width: 300px">
            <ui-input [variant]="variant()" [prefix]="prefix()" />
        </div>
    `,
    imports: [InputComponent],
})
class WidthHost {
    readonly variant = input<InputVariant>('outline');
    readonly prefix = input('');
}

function mount(inputs: { variant?: NonNullable<InputVariant>; prefix?: string } = {}): HTMLElement {
    const fixture = TestBed.createComponent(WidthHost);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
}

describe('Input rendering', () => {
    it('draws the default outline variant as a rounded, bordered field filling its container', () => {
        const root = mount();
        const field = root.querySelector('input')!;
        const style = getComputedStyle(field);
        expect(style.borderTopWidth).toBe('1px');
        expect(Number.parseFloat(style.borderTopLeftRadius)).toBeGreaterThan(0);
        expect(field.getBoundingClientRect().width).toBeCloseTo(300, 0);
    });

    it('lays the prefix before the input, which fills the rest of the container', () => {
        const root = mount({ prefix: '$' });
        const container = root.querySelector('[data-slot="input-container"]')!.getBoundingClientRect();
        const prefix = root.querySelector('[data-slot="input-container"] span')!.getBoundingClientRect();
        const field = root.querySelector('input')!.getBoundingClientRect();
        expect(field.left).toBeGreaterThanOrEqual(prefix.right);
        expect(field.top).toBeLessThan(prefix.bottom);
        // Only the container's 1px border separates the two right edges.
        expect(container.right - field.right).toBeLessThanOrEqual(1);
    });
});

describe('Input inside an input group', () => {
    function mountInGroup(variant?: InputVariant): HTMLInputElement {
        TestBed.configureTestingModule({
            providers: [{ provide: UI_INPUT_GROUP, useValue: { disabled: () => false } }],
        });
        return mount(variant ? { variant } : {}).querySelector('input')!;
    }

    it('drops the outline border so the group draws the frame', () => {
        expect(getComputedStyle(mountInGroup()).borderTopWidth).toBe('0px');
    });

    it('keeps an explicit underline variant', () => {
        const style = getComputedStyle(mountInGroup('underline'));
        expect(style.borderBottomWidth).toBe('1px');
        expect(style.borderTopWidth).toBe('0px');
    });
});
