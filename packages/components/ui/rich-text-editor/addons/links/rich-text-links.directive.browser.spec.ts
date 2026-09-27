import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { RichTextLinksDirective } from './rich-text-links.directive';
import { RichTextLinksButtonComponent } from './rich-text-links-button.component';
import type { RichTextLinksButtonContext } from './rich-text-links.context';
import { RichTextEditorComponent } from '../..';

/**
 * Browser-only links-addon cases. Re-linking a selection that covers part of an
 * existing link first clears that link with the browser's `unlink` editing
 * command, which jsdom does not implement (it has no editing engine), so the
 * emptied anchor would stay behind there. They run in the real-browser leg
 * only; the portable (jsdom) leg and the shipped `testFiles` exclude this file.
 */
@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextLinksDirective],
    template: `<ui-rich-text-editor mode="html" uiRteLinks></ui-rich-text-editor>`,
})
class HostCmp {}

type ButtonProbe = { context: RichTextLinksButtonContext };

describe('RichTextLinksDirective (browser)', () => {
    let fixture: ComponentFixture<HostCmp> | undefined;

    afterEach(() => {
        document.getSelection()?.removeAllRanges();
        fixture?.destroy();
        fixture = undefined;
    });

    it('treats a selection running past a link as new link text, not an edit of that link', () => {
        // Seeding from the anchor dropped the part of the selection outside it,
        // and submitting left that part behind: "see docs now" became
        // "see docs now now".
        fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();
        const el = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        el.innerHTML = '<p>see <a href="https://old.example/">docs</a> now</p>';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        const anchorText = el.querySelector('a')!.firstChild!;
        const tail = el.querySelector('p')!.lastChild!;
        const range = document.createRange();
        range.setStart(anchorText, 0);
        range.setEnd(tail, 4);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        const probe = fixture.debugElement.query(By.directive(RichTextLinksButtonComponent))
            .componentInstance as unknown as ButtonProbe;
        probe.context.onOpen();
        fixture.detectChanges();

        expect(probe.context.editing()).toBe(false);
        expect(probe.context.seededText()).toBe('docs now');

        probe.context.onSubmit({ text: 'docs now', url: 'https://new.example/' });
        fixture.detectChanges();
        expect(el.textContent).toBe('see docs now');
        expect(el.querySelectorAll('a')).toHaveLength(1);
    });
});
