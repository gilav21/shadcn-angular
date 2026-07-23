import { signal, type Provider, type WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EmojiPickerComponent } from '../../../emoji-picker';
import { RichTextEmojiButtonComponent } from './rich-text-emoji-button.component';
import { RICH_TEXT_EMOJI_CONTEXT, type RichTextEmojiContext } from './rich-text-emoji.context';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';

interface MockHost {
    disabled: WritableSignal<boolean>;
    readonly: WritableSignal<boolean>;
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

    function render(compact?: boolean): HTMLElement {
        host = { disabled: signal(false), readonly: signal(false) };
        ctx = buildContext();
        const providers: Provider[] = [
            { provide: RichTextEditorAddonHost, useValue: host },
            { provide: RICH_TEXT_EMOJI_CONTEXT, useValue: ctx },
        ];
        if (compact !== undefined) {
            providers.push({
                provide: RichTextToolbarViewContext,
                useValue: { compact: signal(compact) },
            });
        }
        TestBed.configureTestingModule({ providers });
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
        expect(button.className).toContain('p-1.5');
        expect(fixture.debugElement.query(By.directive(EmojiPickerComponent))).toBeTruthy();
    });

    it('uses compact padding inside a compact toolbar view', () => {
        const el = render(true);
        expect((el.querySelector('button') as HTMLButtonElement).className).toContain('p-1');
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
});
