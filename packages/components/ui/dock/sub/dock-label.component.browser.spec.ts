import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { DockItemComponent } from './dock-item.component';
import { DockIconComponent } from './dock-icon.component';
import { DockLabelComponent } from './dock-label.component';

/** Browser-only: the label's placement is layout, revealed by a real hover. */
@Component({
    template: `
        <div style="padding: 64px">
            <ui-dock-item class="group">
                <ui-dock-label>Home</ui-dock-label>
                <ui-dock-icon>H</ui-dock-icon>
            </ui-dock-item>
        </div>
    `,
    imports: [DockItemComponent, DockIconComponent, DockLabelComponent],
})
class LabelHost {}

describe('DockLabelComponent layout (browser)', () => {
    it('should float the revealed label above the icon, centred on it', async () => {
        const fixture = TestBed.createComponent(LabelHost);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;

        await userEvent.hover(root.querySelector('ui-dock-item')!);

        const label = root.querySelector('[data-slot="dock-label"]')!.getBoundingClientRect();
        const icon = root.querySelector('[data-slot="dock-icon"]')!.getBoundingClientRect();
        expect(label.width).toBeGreaterThan(0);
        expect(label.bottom).toBeLessThanOrEqual(icon.top);
        expect(label.left + label.width / 2).toBeCloseTo(icon.left + icon.width / 2, 0);
    });
});
