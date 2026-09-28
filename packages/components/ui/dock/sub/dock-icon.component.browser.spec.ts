import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DockIconComponent } from './dock-icon.component';

/** Browser-only: centring is layout, so it is asserted as rendered geometry. */
@Component({
    template: `
        <div style="width: 80px; height: 80px">
            <ui-dock-icon><span class="test-icon-content">Icon</span></ui-dock-icon>
        </div>
    `,
    imports: [DockIconComponent],
})
class IconHost {}

describe('DockIconComponent layout (browser)', () => {
    it('should centre the projected content in the icon box', () => {
        const fixture = TestBed.createComponent(IconHost);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;

        const box = root.querySelector('[data-slot="dock-icon"]')!.getBoundingClientRect();
        const content = root.querySelector('.test-icon-content')!.getBoundingClientRect();
        expect(box.width).toBe(80);
        expect(content.left + content.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
        expect(content.top + content.height / 2).toBeCloseTo(box.top + box.height / 2, 0);
    });
});
