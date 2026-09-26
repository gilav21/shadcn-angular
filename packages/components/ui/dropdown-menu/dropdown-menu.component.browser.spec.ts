import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import {
    DropdownMenuComponent,
    DropdownMenuTriggerComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
} from './index';

/**
 * Browser-only dropdown cases: `align` and `inset` are pure CSS, so they are
 * asserted as rendered geometry, which jsdom cannot produce.
 */
@Component({
    template: `
        <div [attr.dir]="dir()" style="padding: 0 160px">
            <ui-dropdown-menu [open]="true">
                <ui-dropdown-menu-trigger>Open</ui-dropdown-menu-trigger>
                <ui-dropdown-menu-content [align]="align()">
                    <ui-dropdown-menu-item shortcut="⌘K" [inset]="true">Profile</ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>Settings</ui-dropdown-menu-item>
                </ui-dropdown-menu-content>
            </ui-dropdown-menu>
        </div>
    `,
    imports: [DropdownMenuComponent, DropdownMenuTriggerComponent, DropdownMenuContentComponent, DropdownMenuItemComponent],
})
class AlignHostComponent {
    readonly align = signal<'start' | 'center' | 'end'>('center');
    readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

async function render(align: 'start' | 'center' | 'end', dir: 'ltr' | 'rtl' = 'ltr'): Promise<{ trigger: DOMRect; content: HTMLElement }> {
    await TestBed.configureTestingModule({ imports: [AlignHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AlignHostComponent);
    fixture.componentInstance.align.set(align);
    fixture.componentInstance.dir.set(dir);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return {
        trigger: root.querySelector<HTMLElement>('[data-slot="dropdown-trigger"]')!.getBoundingClientRect(),
        content: root.querySelector<HTMLElement>('[data-slot="dropdown-content"]')!,
    };
}

describe('DropdownMenu content layout (browser)', () => {
    it('centers the panel on the trigger with align="center" and indents inset rows', async () => {
        const { trigger, content } = await render('center');
        const panel = content.getBoundingClientRect();

        // The panel is wider than the short trigger, so only real centring lines the midpoints up.
        expect(panel.width).toBeGreaterThan(trigger.width);
        expect(panel.left + panel.width / 2).toBeCloseTo(trigger.left + trigger.width / 2, 0);

        const [inset, plain] = Array.from(content.querySelectorAll<HTMLElement>('[data-slot="dropdown-item"]'));
        expect(inset.textContent).toContain('⌘K');
        const insetPad = Number.parseFloat(getComputedStyle(inset).paddingInlineStart);
        const plainPad = Number.parseFloat(getComputedStyle(plain).paddingInlineStart);
        expect(insetPad).toBeGreaterThan(plainPad);
    });

    it('lines up the trailing edges with align="end", mirrored under RTL', async () => {
        const ltr = await render('end');
        expect(ltr.content.getBoundingClientRect().right).toBeCloseTo(ltr.trigger.right, 0);
        expect(ltr.content.getBoundingClientRect().left).toBeLessThan(ltr.trigger.left);

        TestBed.resetTestingModule();
        const rtl = await render('end', 'rtl');
        expect(rtl.content.getBoundingClientRect().left).toBeCloseTo(rtl.trigger.left, 0);
        expect(rtl.content.getBoundingClientRect().right).toBeGreaterThan(rtl.trigger.right);
    });
});
