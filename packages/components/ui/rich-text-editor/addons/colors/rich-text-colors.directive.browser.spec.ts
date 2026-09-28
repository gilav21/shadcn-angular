import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { RichTextColorsDirective } from './rich-text-colors.directive';
import { RichTextColorsButtonComponent } from './rich-text-colors-button.component';
import type { RichTextColorButtonContext, RichTextColorKind } from './rich-text-colors.context';
import { RichTextEditorComponent } from '../..';

/**
 * Browser-only colours-addon cases. Closing the popover returns focus to its
 * trigger button; a real browser leaves the document selection in the editor
 * when a button is focused, but jsdom collapses the selection into the focused
 * button, so the ranged selection these cases depend on is gone there. They run
 * in the real-browser leg only; the portable (jsdom) leg and the shipped
 * `testFiles` exclude this file.
 */
@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextColorsDirective],
    template: `<ui-rich-text-editor mode="html" uiRteColors></ui-rich-text-editor>`,
})
class HostCmp {}

type ButtonProbe = {
    context: RichTextColorButtonContext;
    onColorChange(color: string): void;
    onOpenChange(next: boolean): void;
    onUserInteract(): void;
};

describe('RichTextColorsDirective (browser)', () => {
    let fixture: ComponentFixture<HostCmp> | undefined;

    function buttonByKind(kind: RichTextColorKind): ButtonProbe {
        const match = fixture!.debugElement
            .queryAll(By.directive(RichTextColorsButtonComponent))
            .map((d) => d.componentInstance as unknown as ButtonProbe)
            .find((p) => p.context.kind === kind);
        if (!match) throw new Error(`No colour button for kind "${kind}"`);
        return match;
    }

    function selectContent(html: string): RichTextEditorComponent {
        const cmp = fixture!.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const el = fixture!.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        el.innerHTML = html;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture!.detectChanges();
        const range = document.createRange();
        range.selectNodeContents(el.firstElementChild ?? el);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        fixture!.detectChanges();
        return cmp;
    }

    const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

    afterEach(() => {
        document.getSelection()?.removeAllRanges();
        fixture?.destroy();
        fixture = undefined;
    });

    it('does not re-apply over a selection, where the colour is already in the DOM', async () => {
        fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();
        const cmp = selectContent('<p>ranged text</p>');
        const apply = vi.spyOn(cmp, 'applyInlineStyle');

        const bg = buttonByKind('background');
        bg.onOpenChange(true);
        fixture.detectChanges();
        bg.onUserInteract();
        bg.onColorChange('#ff0000');
        bg.onOpenChange(false);
        await settle();

        // A second identical apply would only add a duplicate history entry.
        expect(apply).toHaveBeenCalledTimes(1);
    });
});
