import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { RadioGroupComponent, RadioGroupItemComponent } from './radio-group.component';

/** Browser-only radio-group layout: orientation and the label row are utility classes, so only real layout shows them. */
@Component({
    template: `
        <ui-radio-group [orientation]="orientation()">
            <ui-radio-group-item value="a" label="First option" />
            <ui-radio-group-item value="b" label="Second option" />
        </ui-radio-group>
    `,
    imports: [RadioGroupComponent, RadioGroupItemComponent],
})
class LayoutHost {
    readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
}

function mount(orientation: 'vertical' | 'horizontal'): HTMLElement {
    const fixture = TestBed.createComponent(LayoutHost);
    fixture.componentInstance.orientation.set(orientation);
    fixture.detectChanges();
    fixture.nativeElement.dataset.radioLayout = '';
    document.body.appendChild(fixture.nativeElement);
    return fixture.nativeElement as HTMLElement;
}

function itemRects(root: HTMLElement): DOMRect[] {
    // The item host is display: contents, so the grid cells are its rendered rows.
    return Array.from(root.querySelectorAll('ui-radio-group-item > div'), (el) => el.getBoundingClientRect());
}

describe('RadioGroup layout', () => {
    afterEach(() => document.querySelectorAll('[data-radio-layout]').forEach((n) => n.remove()));

    it('stacks items vertically by default', () => {
        const [first, second] = itemRects(mount('vertical'));
        expect(second.top).toBeGreaterThanOrEqual(first.bottom);
    });

    it('lays items out in one row when horizontal', () => {
        const [first, second] = itemRects(mount('horizontal'));
        expect(second.left).toBeGreaterThanOrEqual(first.right);
        expect(second.top).toBeCloseTo(first.top, 0);
    });

    it('places the label beside the radio dot', () => {
        const root = mount('vertical');
        const dot = root.querySelector('[data-slot="radio-group-item"]')!.getBoundingClientRect();
        const label = root.querySelector('label')!.getBoundingClientRect();
        expect(label.left).toBeGreaterThan(dot.right);
        expect(label.top).toBeLessThan(dot.bottom);
    });
});
