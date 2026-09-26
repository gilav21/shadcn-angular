import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RichTextEmojiButtonComponent } from './rich-text-emoji-button.component';
import { RICH_TEXT_EMOJI_CONTEXT } from './rich-text-emoji.context';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';

/**
 * Browser-only emoji-button case. It asserts the button's padding as computed
 * style from the Tailwind stylesheet, which jsdom does not load, so the value
 * would read empty there. It runs in the real-browser leg only; the portable
 * (jsdom) leg and the shipped `testFiles` exclude this file.
 */
describe('RichTextEmojiButtonComponent', () => {
    let fixture: ComponentFixture<RichTextEmojiButtonComponent>;
    let compactView: WritableSignal<boolean>;

    function render(compact: boolean): HTMLElement {
        const disabledSignal = signal(false);
        const host = {
            disabled: disabledSignal,
            isDisabled: disabledSignal,
            readonly: signal(false),
            registerExclusivePopover: () => ({ notifyOpened: () => {}, release: () => {} }),
        };
        compactView = signal(compact);
        TestBed.configureTestingModule({
            providers: [
                { provide: RichTextEditorAddonHost, useValue: host },
                {
                    provide: RICH_TEXT_EMOJI_CONTEXT,
                    useValue: { tooltip: signal('Insert Emoji'), onInsert: vi.fn<(emoji: string) => void>() },
                },
                { provide: RichTextToolbarViewContext, useValue: { compact: compactView } },
            ],
        });
        fixture = TestBed.createComponent(RichTextEmojiButtonComponent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    afterEach(() => {
        fixture?.destroy();
    });

    it('tightens the button padding while the toolbar view is compact', () => {
        const el = render(true);
        const button = el.querySelector('button') as HTMLButtonElement;
        expect(getComputedStyle(button).paddingLeft).toBe('4px');

        compactView.set(false);
        fixture.detectChanges();
        expect(getComputedStyle(button).paddingLeft).toBe('6px');
    });
});
