import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DropdownMenuSeparatorComponent as Sep, DropdownMenuLabelComponent as Lab } from './index';

@Component({
    template: `<div style="width: 200px"><ui-dropdown-menu-label>Group</ui-dropdown-menu-label><ui-dropdown-menu-separator /></div>`,
    imports: [Lab, Sep],
})
class Host {}

describe('dropdown-menu separator and label hosts (browser)', () => {
    it('paints the separator as a 1px rule and the label with its vertical padding', () => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const sep = root.querySelector('ui-dropdown-menu-separator')!.getBoundingClientRect();
        const label = root.querySelector('ui-dropdown-menu-label')!.getBoundingClientRect();
        expect(sep.height).toBeCloseTo(1, 0);
        expect(sep.width).toBeGreaterThan(190);
        // An inline host paints padding/height but does not push its neighbours: the wrapper only
        // grows to label (20 + 12 padding) + separator (1 + 4 margin) when both are blocks.
        expect(label.height).toBeGreaterThan(0);
        expect((root.firstElementChild as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(36);
    });
});
