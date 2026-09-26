import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, it, expect } from 'vitest';
import {
    ContextMenuComponent,
    ContextMenuTriggerComponent,
    ContextMenuContentComponent,
    ContextMenuItemComponent,
    ContextMenuShortcutComponent,
    ContextMenuSubComponent,
    ContextMenuSubTriggerComponent,
    ContextMenuSubContentComponent,
} from './';

/** Browser-only: direction is resolved from computed style, and the shortcut and flyout placement are asserted as rendered geometry. */
@Component({
    template: `
        <div [attr.dir]="dir()">
            <ui-context-menu>
                <ui-context-menu-trigger>
                    <div style="width: 200px; height: 60px">Right-click here</div>
                </ui-context-menu-trigger>
                <ui-context-menu-content>
                    <ui-context-menu-item>Copy<ui-context-menu-shortcut>⌘C</ui-context-menu-shortcut></ui-context-menu-item>
                    <ui-context-menu-sub>
                        <ui-context-menu-sub-trigger>More</ui-context-menu-sub-trigger>
                        <ui-context-menu-sub-content>
                            <ui-context-menu-item>Paste<ui-context-menu-shortcut>⌘V</ui-context-menu-shortcut></ui-context-menu-item>
                        </ui-context-menu-sub-content>
                    </ui-context-menu-sub>
                </ui-context-menu-content>
            </ui-context-menu>
        </div>
    `,
    imports: [
        ContextMenuComponent,
        ContextMenuTriggerComponent,
        ContextMenuContentComponent,
        ContextMenuItemComponent,
        ContextMenuShortcutComponent,
        ContextMenuSubComponent,
        ContextMenuSubTriggerComponent,
        ContextMenuSubContentComponent,
    ],
})
class DirHost {
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

async function render(dir: 'ltr' | 'rtl') {
    await TestBed.configureTestingModule({ imports: [DirHost] }).compileComponents();
    const fixture = TestBed.createComponent(DirHost);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    await fixture.whenStable();
    const menu: ContextMenuComponent = fixture.debugElement.query(By.directive(ContextMenuComponent)).componentInstance;
    return { fixture, menu };
}

/** Opens the root menu at (x, y) and its flyout, and waits for the flyout to position itself. */
async function openFlyout(dir: 'ltr' | 'rtl', x: number, y: number) {
    const { fixture, menu } = await render(dir);
    menu.show(x, y);
    fixture.detectChanges();
    await fixture.whenStable();
    // As with a pointer, the flyout opens from a root panel that has already clamped itself into the viewport.
    await new Promise(resolve => setTimeout(resolve, 50));
    fixture.debugElement.query(By.directive(ContextMenuSubComponent)).componentInstance.enter();
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 50));
}

// Kept first on purpose: when the flyout's position failed to render, the earliest flyouts opened in a page were the ones left unpositioned.
describe('ContextMenu flyout placement (real browser)', () => {
    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal], [data-context-menu-sub-portal]').forEach(el => el.remove());
    });

    // The flyout sits 4px off its trigger row, top-aligned with it, on the inline-end side when that fits; otherwise
    // it flips to the other side, and it is clamped 8px inside the viewport.
    it.each([
        { name: 'LTR with room: inline-end, top-aligned', dir: 'ltr', at: () => [100, 100], side: 'right', clampedBottom: false },
        { name: 'LTR in the bottom-right corner: flipped left, clamped up', dir: 'ltr', at: () => [innerWidth, innerHeight], side: 'left', clampedBottom: true },
        { name: 'RTL against the left edge: flipped right', dir: 'rtl', at: () => [0, 100], side: 'right', clampedBottom: false },
    ] as const)('places the flyout beside its trigger ($name)', async ({ dir, at, side, clampedBottom }) => {
        const [x, y] = at();
        await openFlyout(dir, x, y);

        const trigger = document.querySelector('[data-slot="context-menu-sub-trigger"]')!.getBoundingClientRect();
        const flyout = document.querySelector('[data-slot="context-menu-sub-content"]')!.getBoundingClientRect();

        if (side === 'right') {
            expect(Math.abs(flyout.left - (trigger.right + 4))).toBeLessThan(1);
        } else {
            expect(Math.abs(trigger.left - 4 - flyout.right)).toBeLessThan(1);
        }
        if (clampedBottom) {
            expect(Math.abs(innerHeight - 8 - flyout.bottom)).toBeLessThan(1);
            expect(flyout.top).toBeLessThan(trigger.top);
        } else {
            expect(Math.abs(flyout.top - trigger.top)).toBeLessThan(1);
        }
    });
});

describe('ContextMenu direction (real browser)', () => {
    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal], [data-context-menu-sub-portal]').forEach(el => el.remove());
    });

    it.each(['ltr', 'rtl'] as const)('isRtl() follows the inherited direction (%s)', async dir => {
        const { menu } = await render(dir);
        expect(menu.isRtl()).toBe(dir === 'rtl');
    });

    // Only the host's wrapper carries dir, so the portalled panels (root and flyout) must take it from the host.
    it.each(['ltr', 'rtl'] as const)('pushes the shortcut to the inline-end edge of the item (%s)', async dir => {
        await openFlyout(dir, 100, 100);

        const items = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="context-menu-item"]'));
        expect(items.map(item => item.textContent?.trim())).toEqual(['Copy⌘C', 'Paste⌘V']);
        for (const item of items) {
            const labelText = Array.from(item.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())!;
            const range = document.createRange();
            range.selectNodeContents(labelText);
            const label = range.getBoundingClientRect();
            const shortcut = item.querySelector('[data-slot="context-menu-shortcut"]')!.getBoundingClientRect();
            const box = item.getBoundingClientRect();
            const style = getComputedStyle(item);

            // Pushed to the item's inline-end edge, with free space between it and the label.
            if (dir === 'rtl') {
                expect(Math.abs(shortcut.left - (box.left + Number.parseFloat(style.paddingLeft)))).toBeLessThan(1);
                expect(label.left - shortcut.right).toBeGreaterThan(8);
            } else {
                expect(Math.abs(box.right - Number.parseFloat(style.paddingRight) - shortcut.right)).toBeLessThan(1);
                expect(shortcut.left - label.right).toBeGreaterThan(8);
            }
        }
    });
});
