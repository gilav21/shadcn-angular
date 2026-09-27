import { signal, type WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EmojiPickerComponent } from '../../../emoji-picker';
import { RichTextEmojiButtonComponent } from './rich-text-emoji-button.component';
import { RICH_TEXT_EMOJI_CONTEXT, type RichTextEmojiContext } from './rich-text-emoji.context';
import { RichTextEditorAddonHost } from '../..';

interface MockHost {
    disabled: WritableSignal<boolean>;
    isDisabled: WritableSignal<boolean>;
    readonly: WritableSignal<boolean>;
    registerExclusivePopover: (close: () => void) => { notifyOpened: () => void; release: () => void };
}

interface ButtonProbe {
    onEmoji(emoji: string): void;
}

function buildContext(): RichTextEmojiContext & { onInsert: ReturnType<typeof vi.fn> } {
    return {
        tooltip: signal('Insert Emoji'),
        onInsert: vi.fn<(emoji: string) => void>(),
    };
}

describe('RichTextEmojiButtonComponent', () => {
    let fixture: ComponentFixture<RichTextEmojiButtonComponent>;
    let host: MockHost;
    let ctx: ReturnType<typeof buildContext>;
    let openNotices: number;
    let closeFromGroup: () => void;

    function render(): HTMLElement {
        const disabledSignal = signal(false);
        openNotices = 0;
        host = {
            disabled: disabledSignal,
            isDisabled: disabledSignal,
            readonly: signal(false),
            registerExclusivePopover: (close) => {
                closeFromGroup = close;
                return { notifyOpened: () => { openNotices++; }, release: () => {} };
            },
        };
        ctx = buildContext();
        TestBed.configureTestingModule({
            providers: [
                { provide: RichTextEditorAddonHost, useValue: host },
                { provide: RICH_TEXT_EMOJI_CONTEXT, useValue: ctx },
            ],
        });
        fixture = TestBed.createComponent(RichTextEmojiButtonComponent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    function probe(): ButtonProbe {
        return fixture.componentInstance as unknown as ButtonProbe;
    }

    afterEach(() => {
        fixture?.destroy();
    });

    it('renders a toolbar button with the localized tooltip, icon, and picker', () => {
        const el = render();
        const button = el.querySelector('button') as HTMLButtonElement;
        expect(button.title).toBe('Insert Emoji');
        expect(button.querySelector('svg')).toBeTruthy();
        expect(fixture.debugElement.query(By.directive(EmojiPickerComponent))).toBeTruthy();
    });

    it('inserts a picked emoji through the context callback', () => {
        render();
        probe().onEmoji('🎉');
        expect(ctx.onInsert).toHaveBeenCalledWith('🎉');
    });

    it('does not insert while the editor is disabled', () => {
        const el = render();
        host.disabled.set(true);
        fixture.detectChanges();
        expect((el.querySelector('button') as HTMLButtonElement).disabled).toBe(true);

        probe().onEmoji('🎉');
        expect(ctx.onInsert).not.toHaveBeenCalled();
    });

    it('joins the toolbar single-open group: opening the picker notifies it, and the group closes the picker', () => {
        const el = render();
        const picker = fixture.debugElement.query(By.directive(EmojiPickerComponent))
            .componentInstance as EmojiPickerComponent;

        (el.querySelector('button') as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(picker.open()).toBe(true);
        expect(openNotices).toBe(1);

        closeFromGroup();
        fixture.detectChanges();
        expect(picker.open()).toBe(false);
        expect(openNotices).toBe(1);
    });
});
