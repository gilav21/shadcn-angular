import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { cdp } from 'vitest/browser';
import { RichTextHistoryPanelComponent } from './rich-text-history-panel.component';
import { RICH_TEXT_HISTORY_LOCALES } from './rich-text-history.locales';
import { RichTextEditorAddonHost, type RichTextHistoryEntrySnapshot } from '../..';

const LOCALE_EN = RICH_TEXT_HISTORY_LOCALES['en'];

/**
 * Switches Chromium's touch emulation, which is what flips `(pointer: coarse)`
 * and `(hover: none)` — `Emulation.setEmulatedMedia` silently ignores the
 * `pointer` feature.
 */
async function emulateTouch(enabled: boolean): Promise<void> {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });
}

function snapshot(index: number): RichTextHistoryEntrySnapshot {
    return {
        index,
        timestamp: 1_700_000_000_000 + index * 60_000,
        preview: `Draft ${index + 1}`,
        previewLines: [`Draft ${index + 1}`],
        lineCount: 1,
    };
}

/**
 * Browser-only history-panel case: it measures the rendered close button,
 * which needs real CSS and layout. The portable (jsdom) leg and the shipped
 * `testFiles` exclude this file.
 */
describe('RichTextHistoryPanelComponent — close button (browser)', () => {
    afterEach(() => emulateTouch(false));

    async function closeButtonRect(): Promise<DOMRect> {
        const disabled = signal(false);
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [RichTextHistoryPanelComponent],
            providers: [{
                provide: RichTextEditorAddonHost,
                useValue: {
                    disabled,
                    isDisabled: computed(() => disabled()),
                    readonly: signal(false),
                    currentHistoryIndex: signal(1),
                    historyEntries: signal([snapshot(0), snapshot(1)]),
                    historyVersion: signal(0),
                    reconstructHistoryEntry: () => null,
                    flushPendingHistoryPush: () => undefined,
                    restoreHistoryEntry: () => undefined,
                },
            }],
        });
        const fixture = TestBed.createComponent(RichTextHistoryPanelComponent);
        fixture.componentRef.setInput('locale', LOCALE_EN);
        fixture.detectChanges();
        fixture.componentInstance.openFromShortcut();
        fixture.detectChanges();
        await fixture.whenStable();
        const close = document.querySelector<HTMLElement>(`button[aria-label="${LOCALE_EN.ariaClose}"]`)!;
        // The popover zooms in; a mid-animation rect is scaled down.
        await Promise.all(document.getAnimations().map((animation) => animation.finished));
        const rect = close.getBoundingClientRect();
        fixture.destroy();
        return rect;
    }

    /** WCAG 2.5.8: the popover's close button is a 44x44 target on a touch screen and stays 28x28 for a mouse. */
    it('grows the close button to a 44x44 touch target on a coarse pointer only', async () => {
        await emulateTouch(false);
        const fine = await closeButtonRect();
        await emulateTouch(true);
        const coarse = await closeButtonRect();

        expect([fine.width, fine.height]).toEqual([28, 28]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });
});
