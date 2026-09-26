import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { RichTextOutlineDirective } from './rich-text-outline.directive';
import { RichTextEditorComponent } from '../..';

/**
 * Browser-only outline-directive case. It sizes the viewport through
 * `vitest/browser` and measures where the docked panel lands in LTR and RTL
 * as rendered rects — neither exists without a real browser, and importing
 * `vitest/browser` outside Browser Mode fails the whole file. It runs in the
 * real-browser leg only; the portable (jsdom) leg and the shipped `testFiles`
 * exclude this file.
 */
@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextOutlineDirective],
    template: `<ui-rich-text-editor mode="html" [uiRteOutline]="{ toolbar: true }"></ui-rich-text-editor>`,
})
class HostCmp {}

describe('RichTextOutlineDirective', () => {
    const fixtures: ComponentFixture<HostCmp>[] = [];

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        return fixture;
    }

    function outlineButton(fixture: ComponentFixture<HostCmp>): HTMLButtonElement | null {
        return fixture.nativeElement.querySelector('[data-addon-slot="view.outline"]');
    }

    function panel(fixture: ComponentFixture<HostCmp>): HTMLElement | null {
        return fixture.nativeElement.querySelector('[data-slot="rich-text-outline-panel"]');
    }

    afterEach(() => {
        while (fixtures.length > 0) {
            const fixture = fixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
            fixture.nativeElement.remove();
        }
    });

    it('docks the panel against the start edge: left in LTR, right in RTL', async () => {
        // Below md the panel spans the full width, so both edges would match.
        const { innerWidth, innerHeight } = globalThis;
        await page.viewport(1024, 768);
        try {
            const fixture = createFixture();
            outlineButton(fixture)!.click();
            fixture.detectChanges();
            const gaps = (): { start: number; end: number } => {
                const nav = panel(fixture)!;
                const box = nav.getBoundingClientRect();
                const parent = nav.offsetParent as HTMLElement;
                const inner = parent.getBoundingClientRect();
                const border = getComputedStyle(parent);
                return {
                    start: Math.round(box.left - inner.left - Number.parseFloat(border.borderLeftWidth)),
                    end: Math.round(inner.right - Number.parseFloat(border.borderRightWidth) - box.right),
                };
            };

            const ltr = gaps();
            expect(ltr.start).toBe(0);
            expect(ltr.end).toBeGreaterThan(0);

            fixture.nativeElement.dir = 'rtl';
            fixture.detectChanges();
            const rtl = gaps();
            expect(rtl.end).toBe(0);
            expect(rtl.start).toBeGreaterThan(0);
        } finally {
            await page.viewport(innerWidth, innerHeight);
        }
    });
});
