import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, it, expect } from 'vitest';
import { cdp } from 'vitest/browser';
import { KanbanComponent, type KanbanCard, type KanbanColumn } from '../kanban';

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

@Component({
    template: `<ui-kanban [columns]="columns" [cards]="cards" [locale]="rtl() ? 'he' : 'en'" />`,
    imports: [KanbanComponent],
})
class DeleteHost {
    readonly rtl = signal(false);
    readonly columns: KanbanColumn[] = [
        { id: 'todo', title: 'To do', order: 0 },
        { id: 'done', title: 'Done', order: 1 },
    ];
    readonly cards: KanbanCard[] = [
        { id: 'c1', columnId: 'todo', title: 'Write the release notes', order: 0 },
        { id: 'c2', columnId: 'done', title: 'Fix login redirect', order: 0 },
    ];
}

/** Real-browser touch-target checks: hit-area size and visibility are layout, which jsdom cannot compute. */
describe('Kanban delete toast close button (browser)', () => {
    afterEach(() => emulateTouch(false));

    /** Deletes a card under the current pointer emulation, so no transition runs mid-measure. */
    async function deleteCard(rtl: boolean) {
        const fixture = TestBed.createComponent(DeleteHost);
        fixture.componentInstance.rtl.set(rtl);
        fixture.detectChanges();
        const kanban = fixture.debugElement.query(By.directive(KanbanComponent)).componentInstance as KanbanComponent;
        kanban.onDeleteCard(fixture.componentInstance.cards[0]);
        fixture.detectChanges();
        await fixture.whenStable();
        const toast = document.querySelector<HTMLElement>('[data-slot="kanban-delete-toast"] > div')!;
        const close = toast.querySelector<HTMLElement>(':scope > button[aria-label]')!;
        const geometry = {
            toast: toast.getBoundingClientRect(),
            close: close.getBoundingClientRect(),
            opacity: getComputedStyle(close).opacity,
            text: toast.querySelector('.grid')!.getBoundingClientRect(),
            undo: toast.querySelector('ui-button button')!.getBoundingClientRect(),
        };
        kanban.dismissDeleteToast();
        fixture.destroy();
        return geometry;
    }

    /**
     * WCAG 2.5.8 and CLAUDE.md §6: on a touch screen the close button must be
     * a visible 44x44 target in the toast's corner that covers neither the
     * message nor the Undo button. A mouse user keeps the 24x24 hover-revealed
     * button.
     */
    it.each([false, true])(
        'is a visible 44x44 touch target clear of the message and Undo on a coarse pointer only (rtl locale: %s)',
        async rtl => {
            await emulateTouch(false);
            const fine = (await deleteCard(rtl)).close;
            await emulateTouch(true);
            const { toast: t, close: c, opacity, text, undo } = await deleteCard(rtl);

            expect([fine.width, fine.height]).toEqual([24, 24]);
            expect(c.width).toBeGreaterThanOrEqual(44);
            expect(c.height).toBeGreaterThanOrEqual(44);
            expect(opacity).toBe('1');
            expect(c.top - t.top).toBeLessThanOrEqual(4);
            if (rtl) {
                expect(c.left - t.left).toBeLessThanOrEqual(4);
                expect(c.right).toBeLessThanOrEqual(Math.min(text.left, undo.left));
            } else {
                expect(t.right - c.right).toBeLessThanOrEqual(4);
                expect(c.left).toBeGreaterThanOrEqual(Math.max(text.right, undo.right));
            }
        },
    );
});

describe('Kanban column header buttons (browser)', () => {
    afterEach(() => emulateTouch(false));

    async function headerButtonRects(): Promise<DOMRect[]> {
        const fixture = TestBed.createComponent(DeleteHost);
        fixture.detectChanges();
        await fixture.whenStable();
        const root = fixture.nativeElement as HTMLElement;
        const rects = [
            root.querySelector('[data-slot="kanban-add-card-button"]')!,
            root.querySelector('button[aria-label="Collapse column"]')!,
        ].map((button) => button.getBoundingClientRect());
        fixture.destroy();
        return rects;
    }

    /** WCAG 2.5.8: a column's add-card and collapse buttons are 44x44 targets on a touch screen and stay 24x24 for a mouse. */
    it('grows the add-card and collapse buttons to 44x44 touch targets on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await headerButtonRects();
        await emulateTouch(true);
        const coarse = await headerButtonRects();

        expect(fine.map((r) => [r.width, r.height])).toEqual([[24, 24], [24, 24]]);
        for (const r of coarse) {
            expect(r.width).toBeGreaterThanOrEqual(44);
            expect(r.height).toBeGreaterThanOrEqual(44);
        }
    });
});

