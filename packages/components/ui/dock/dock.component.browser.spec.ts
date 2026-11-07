import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, it, expect } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { DockComponent, DockItemData } from './dock.component';

/**
 * Browser-only dock cases: the position variants are layout, so they are
 * asserted as rendered geometry, which jsdom cannot produce. The bar is made
 * taller than its items so top and bottom alignment land on different rows.
 */
type DockPosition = 'bottom' | 'top' | 'left' | 'right';

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
    readonly position = signal<DockPosition>('bottom');
}

@Component({
    template: `<ui-dock [items]="items" [position]="position()" />`,
    imports: [DockComponent],
})
class NaturalHost {
    readonly items: DockItemData[] = ['A', 'B', 'C', 'D'].map(icon => ({ label: icon, icon }));
    readonly position = signal<'left' | 'right'>('left');
}

@Component({
    template: `<div style="padding: 120px"><ui-dock [items]="items" [position]="position()" /></div>`,
    imports: [DockComponent],
})
class LabelHost {
    readonly items: DockItemData[] = ['Home', 'Settings', 'Profile'].map(label => ({ label, icon: label[0] }));
    readonly position = signal<DockPosition>('bottom');
}

function render(position: DockPosition) {
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

    it.each(['left', 'right'] as const)('should size the %s column to hold every item, with no consumer height', position => {
        const fixture = TestBed.createComponent(NaturalHost);
        fixture.componentInstance.position.set(position);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        const bar = root.querySelector<HTMLElement>('[data-slot="dock"]')!;
        const box = bar.getBoundingClientRect();
        const items = [...root.querySelectorAll<HTMLElement>('ui-dock-item')].map(el => el.getBoundingClientRect());
        expect(items).toHaveLength(4);
        expect(items.at(-1)!.bottom).toBeLessThanOrEqual(box.bottom);
        expect(bar.scrollHeight).toBeLessThanOrEqual(bar.clientHeight);
    });

    describe('hover label', () => {
        const original: [number, number] = [globalThis.innerWidth, globalThis.innerHeight];
        afterEach(async () => {
            await page.viewport(...original);
        });

        // 360 is a phone, where the horizontal bar scrolls and would clip an outside label; 1100 is the desktop case.
        it.each([360, 1100])('should show the whole label next to a hovered item in all four positions at %ipx wide', async width => {
            await page.viewport(width, 700);
            for (const position of ['bottom', 'top', 'left', 'right'] as const) {
                const fixture = TestBed.createComponent(LabelHost);
                fixture.componentInstance.position.set(position);
                fixture.detectChanges();
                const root = fixture.nativeElement as HTMLElement;
                const item = root.querySelectorAll('ui-dock-item')[1];

                await userEvent.hover(item);

                const label = item.querySelector('[data-slot="dock-label"]')!;
                const rect = label.getBoundingClientRect();
                const icon = item.querySelector('[data-slot="dock-icon"]')!.getBoundingClientRect();
                const topmost = (x: number, y: number) => document.elementFromPoint(x, y);
                // All four corners hit the label, so a clip on any side fails; the centre alone would miss a half-clipped label.
                for (const [x, y] of [[rect.left + 6, rect.top + 6], [rect.right - 6, rect.top + 6], [rect.left + 6, rect.bottom - 6], [rect.right - 6, rect.bottom - 6]]) {
                    expect(label.contains(topmost(x, y)), `${position} label corner at ${width}px`).toBe(true);
                }
                const overlapsIcon = rect.left < icon.right && rect.right > icon.left && rect.top < icon.bottom && rect.bottom > icon.top;
                expect(overlapsIcon, `${position} label covers its icon`).toBe(false);
                const facing = {
                    bottom: rect.bottom <= icon.top,
                    top: rect.top >= icon.bottom,
                    left: rect.left >= icon.right,
                    right: rect.right <= icon.left,
                }[position];
                expect(facing, `${position} label sits on the side away from the dock edge`).toBe(true);
                fixture.destroy();
            }
        });
    });
});
