import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RichTextSlashCommandsDirective } from './rich-text-slash-commands.directive';
import { RichTextEditorComponent, type RichTextSlashCommand } from '../..';

/**
 * Browser-only slash-menu case. It asserts where the menu is laid out, as a
 * rendered rect, and jsdom performs no layout — every rect is zero there. It
 * runs in the real-browser leg only; the portable (jsdom) leg and the shipped
 * `testFiles` exclude this file.
 */
type RangeWithRect = { getBoundingClientRect?: () => DOMRect };

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextSlashCommandsDirective],
    template: `<ui-rich-text-editor mode="html" [disabled]="disabled()" [readonly]="readonly()"
        [uiRteSlashCommands]="custom()"
        [uiRteSlashCommandsLocale]="locale()"></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    readonly custom = signal<RichTextSlashCommand[]>([]);
    readonly locale = signal<string | undefined>(undefined);
}

describe('RichTextSlashCommandsDirective', () => {
    const openFixtures: ComponentFixture<HostCmp>[] = [];

    function create(): { fixture: ComponentFixture<HostCmp>; editor: HTMLElement; editorCmp: RichTextEditorComponent } {
        const fixture = TestBed.createComponent(HostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        const editorCmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        return { fixture, editor, editorCmp };
    }

    function typeSlash(editor: HTMLElement, editorCmp: RichTextEditorComponent, blockText: string): void {
        editor.innerHTML = `<p>${blockText}</p>`;
        const textNode = editor.querySelector('p')!.firstChild!;
        const range = document.createRange();
        range.setStart(textNode, textNode.textContent!.length);
        range.collapse(true);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        editorCmp.onInput({ target: editor } as unknown as Event);
    }

    function menu(): HTMLElement | null {
        return document.querySelector('[data-slot="rich-text-slash-commands-menu"]');
    }

    let savedRangeRect: PropertyDescriptor | undefined;
    beforeEach(() => {
        savedRangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
    });

    afterEach(() => {
        if (savedRangeRect) {
            Object.defineProperty(Range.prototype, 'getBoundingClientRect', savedRangeRect);
        } else {
            Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
        }
        window.getSelection()?.removeAllRanges();
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('places the menu just below the caret, aligned to its left edge', () => {
        // Near the top-left, so neither the viewport clamp nor the flip above applies.
        (Range.prototype as RangeWithRect).getBoundingClientRect = () => ({
            x: 40, y: 30, left: 40, top: 30, right: 41, bottom: 48, width: 1, height: 18, toJSON: () => ({}),
        } as DOMRect);
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();

        const rect = (menu() as HTMLElement).getBoundingClientRect();
        expect(rect.left).toBe(40);
        expect(rect.top).toBe(52);
    });
});
