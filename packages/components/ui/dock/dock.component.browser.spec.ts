import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DockComponent, DockItemData } from './dock.component';

/**
 * Browser-only dock cases: the position variants are layout, so they are
 * asserted as rendered geometry, which jsdom cannot produce. The bar is made
 * taller than its items so top and bottom alignment land on different rows.
 */
@Component({
    template: `<ui-dock [items]="items" [position]="position()" class="h-24 sm:h-24" />`,
    imports: [DockComponent],
})
class PositionHost {
    readonly items: DockItemData[] = [
        { label: 'Home', icon: 'H' },
        { label: 'Settings', icon: 'S' },
        { label: 'Profile', icon: 'P' },
    ];
    readonly position = signal<'bottom' | 'top' | 'left' | 'right'>('bottom');
}

function render(position: 'bottom' | 'top' | 'left' | 'right') {
    const fixture = TestBed.createComponent(PositionHost);
    fixture.componentInstance.position.set(position);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const bar = root.querySelector<HTMLElement>('[data-slot="dock"]')!;
    const items = [...root.querySelectorAll<HTMLElement>('ui-dock-item')].map(el => el.getBoundingClientRect());
    const box = bar.getBoundingClientRect();
    const style = getComputedStyle(bar);
    const contentTop = box.top + Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.paddingTop);
    const contentBottom = box.bottom - Number.parseFloat(style.borderBottomWidth) - Number.parseFloat(style.paddingBottom);
    return { items, contentTop, contentBottom };
}

describe('DockComponent layout (browser)', () => {
    it('should render the bottom position variant by default', () => {
        const { items, contentTop, contentBottom } = render('bottom');
        for (const rect of items) {
            expect(rect.bottom).toBeCloseTo(contentBottom, 0);
            expect(rect.top).toBeGreaterThan(contentTop);
        }
    });

    it('should render the top position variant', () => {
        const { items, contentTop, contentBottom } = render('top');
        for (const rect of items) {
            expect(rect.top).toBeCloseTo(contentTop, 0);
            expect(rect.bottom).toBeLessThan(contentBottom);
        }
    });

    it.each(['left', 'right'] as const)('should stack the %s position variant as a column', position => {
        const { items } = render(position);
        for (let i = 1; i < items.length; i++) {
            expect(items[i].top).toBeGreaterThanOrEqual(items[i - 1].bottom);
            expect(items[i].left).toBeCloseTo(items[0].left, 0);
        }
    });
});
