import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { RichTextOutlinePanelComponent } from './rich-text-outline-panel.component';
import {
    RICH_TEXT_OUTLINE_CONTEXT,
    type OutlineHeading,
    type RichTextOutlineContext,
} from './rich-text-outline.context';
import { RICH_TEXT_OUTLINE_LOCALES } from './rich-text-outline.locales';

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

/**
 * Browser-only outline-panel case. It asserts each row's indent as the
 * resolved pixel padding; jsdom does no rem-to-pixel resolution and hands back
 * the declared `rem` value instead. It runs in the real-browser leg only; the
 * portable (jsdom) leg and the shipped `testFiles` exclude this file.
 */
describe('RichTextOutlinePanelComponent', () => {
    let fixture: ComponentFixture<RichTextOutlinePanelComponent>;

    const headings = signal<readonly OutlineHeading[]>([]);
    const scrollTo = vi.fn();

    const context: RichTextOutlineContext = {
        locale: signal(RICH_TEXT_OUTLINE_LOCALES['en']),
        headings,
        isOpen: signal(true),
        close: vi.fn(),
        scrollTo,
        onEntryKeydown: vi.fn(),
    };

    beforeEach(async () => {
        headings.set([]);
        scrollTo.mockClear();

        await TestBed.configureTestingModule({
            imports: [RichTextOutlinePanelComponent],
            providers: [{ provide: RICH_TEXT_OUTLINE_CONTEXT, useValue: context }],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextOutlinePanelComponent);
        fixture.detectChanges();
    });

    afterEach(async () => {
        fixture.destroy();
        await emulateTouch(false);
    });

    /** WCAG 2.5.8: the panel's close button is a 44x44 target on a touch screen and stays 28x28 for a mouse. */
    it('grows the close button to a 44x44 touch target on a coarse pointer only', async () => {
        const closeRect = () => (fixture.nativeElement as HTMLElement)
            .querySelector(`button[aria-label="${RICH_TEXT_OUTLINE_LOCALES['en'].ariaClose}"]`)!.getBoundingClientRect();
        const fine = closeRect();
        fixture.destroy();
        await emulateTouch(true);
        fixture = TestBed.createComponent(RichTextOutlinePanelComponent);
        fixture.detectChanges();
        const coarse = closeRect();

        expect([fine.width, fine.height]).toEqual([28, 28]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });

    it('lists headings indented by level and jumps on click', () => {
        headings.set([
            { level: 1, text: 'Intro', index: 0 },
            { level: 2, text: 'Setup', index: 1 },
            { level: 3, text: 'Details', index: 2 },
        ]);
        fixture.detectChanges();

        const rows = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('[data-outline-entry]'),
        ) as HTMLElement[];
        expect(rows.map((r) => r.textContent?.trim())).toEqual(['Intro', 'Setup', 'Details']);
        // 0.5rem, plus 0.75rem per level below h1.
        expect(rows.map((r) => getComputedStyle(r).paddingInlineStart)).toEqual(['8px', '20px', '32px']);

        rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(scrollTo).toHaveBeenCalledWith(1);
    });
});
