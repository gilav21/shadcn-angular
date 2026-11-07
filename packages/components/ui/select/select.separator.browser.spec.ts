import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { SelectSeparatorComponent as Sep, SelectLabelComponent as Lab } from './index';

@Component({
    template: `<div style="width: 200px"><ui-select-label>Group</ui-select-label><ui-select-separator /></div>`,
    imports: [Lab, Sep],
})
class Host {}

describe('select separator and label hosts (browser)', () => {
    it('paints the separator as a 1px rule and the label with its vertical padding', () => {
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const sep = root.querySelector('ui-select-separator')!.getBoundingClientRect();
        const label = root.querySelector('ui-select-label')!.getBoundingClientRect();
        expect(sep.height).toBeCloseTo(1, 0);
        expect(sep.width).toBeGreaterThan(190);
        // An inline host paints padding/height but does not push its neighbours: the wrapper only
        // grows to label (16 + 12 padding) + separator (1 + 4 margin) when both are blocks.
        expect(label.height).toBeGreaterThan(0);
        expect((root.firstElementChild as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    });
});
