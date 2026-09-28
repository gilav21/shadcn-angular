import { signal, type Provider, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RichTextColorsButtonComponent } from './rich-text-colors-button.component';
import {
    RICH_TEXT_COLOR_BUTTON_CONTEXT,
    type RichTextColorButtonContext,
    type RichTextColorKind,
} from './rich-text-colors.context';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';

/**
 * Browser-only colour-button cases. They assert the button's padding and the
 * indicator's box as computed style from the Tailwind stylesheet, which jsdom
 * does not load, so every value would read empty there. They run in the
 * real-browser leg only; the portable (jsdom) leg and the shipped `testFiles`
 * exclude this file.
 */
function buildContext(kind: RichTextColorKind): RichTextColorButtonContext {
    return {
        kind,
        tooltip: signal(kind === 'foreground' ? 'Text Color' : 'Background Color'),
        heading: signal('Pick a colour'),
        presets: signal(['#ff0000', '#00ff00']),
        alpha: signal(kind === 'background'),
        showRecent: signal(false),
        seededColor: signal('#123456'),
        activeColor: signal(''),
        onOpen: vi.fn<() => void>(),
        onClose: vi.fn<() => void>(),
        onSelect: vi.fn<(color: string) => void>(),
    };
}

describe('RichTextColorsButtonComponent', () => {
    let fixture: ComponentFixture<RichTextColorsButtonComponent>;
    let compactView: WritableSignal<boolean>;

    function render(kind: RichTextColorKind, compact?: boolean): HTMLElement {
        const disabledSignal = signal(false);
        const host = {
            disabled: disabledSignal,
            isDisabled: disabledSignal,
            readonly: signal(false),
            registerExclusivePopover: () => ({ notifyOpened: () => {}, release: () => {} }),
        };
        const providers: Provider[] = [
            { provide: RichTextEditorAddonHost, useValue: host },
            { provide: RICH_TEXT_COLOR_BUTTON_CONTEXT, useValue: buildContext(kind) },
        ];
        if (compact !== undefined) {
            compactView = signal(compact);
            providers.push({
                provide: RichTextToolbarViewContext,
                useValue: { compact: compactView },
            });
        }
        TestBed.configureTestingModule({ providers });
        fixture = TestBed.createComponent(RichTextColorsButtonComponent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    afterEach(() => {
        fixture?.destroy();
    });

    it('tightens the button padding while the toolbar view is compact', () => {
        const el = render('background', true);
        const button = el.querySelector('button') as HTMLButtonElement;
        expect(getComputedStyle(button).paddingLeft).toBe('4px');

        compactView.set(false);
        fixture.detectChanges();
        expect(getComputedStyle(button).paddingLeft).toBe('6px');
    });

    it('keeps the indicator inside the shared 16px icon box', () => {
        const el = render('foreground');
        const bar = el.querySelector('[data-slot="rte-color-indicator"]') as HTMLElement;
        const box = getComputedStyle(bar.parentElement as HTMLElement);
        expect([box.width, box.height]).toEqual(['16px', '16px']);
        expect(getComputedStyle(bar).height).toBe('3px');
    });
});
