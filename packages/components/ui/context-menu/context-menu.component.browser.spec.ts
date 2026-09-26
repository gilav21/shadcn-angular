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
} from './';

/** Browser-only: direction is resolved from computed style, and the shortcut placement is asserted as rendered geometry. */
@Component({
    template: `
        <div [attr.dir]="dir()">
            <ui-context-menu>
                <ui-context-menu-trigger>
                    <div style="width: 200px; height: 60px">Right-click here</div>
                </ui-context-menu-trigger>
                <ui-context-menu-content>
                    <ui-context-menu-item>Copy<ui-context-menu-shortcut>⌘C</ui-context-menu-shortcut></ui-context-menu-item>
                </ui-context-menu-content>
            </ui-context-menu>
        </div>
    `,
    imports: [ContextMenuComponent, ContextMenuTriggerComponent, ContextMenuContentComponent, ContextMenuItemComponent, ContextMenuShortcutComponent],
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

describe('ContextMenu direction (real browser)', () => {
    afterEach(() => {
        document.querySelectorAll('[data-context-menu-portal]').forEach(el => el.remove());
        document.documentElement.removeAttribute('dir');
    });

    it.each(['ltr', 'rtl'] as const)('isRtl() follows the inherited direction (%s)', async dir => {
        const { menu } = await render(dir);
        expect(menu.isRtl()).toBe(dir === 'rtl');
    });

    it.each(['ltr', 'rtl'] as const)('pushes the shortcut to the inline-end edge of the item (%s)', async dir => {
        // The panel is portalled to <body>, so it takes the page direction, not the host's.
        document.documentElement.setAttribute('dir', dir);
        const { fixture, menu } = await render(dir);
        menu.show(100, 100);
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise(resolve => setTimeout(resolve, 50));

        const item = document.querySelector<HTMLElement>('[data-slot="context-menu-item"]')!;
        const labelText = Array.from(item.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())!;
        const range = document.createRange();
        range.selectNodeContents(labelText);
        const label = range.getBoundingClientRect();
        const shortcut = document.querySelector('[data-slot="context-menu-shortcut"]')!.getBoundingClientRect();
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
    });
});
