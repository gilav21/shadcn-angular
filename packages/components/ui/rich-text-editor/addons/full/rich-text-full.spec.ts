import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EmojiPickerComponent } from '../../../emoji-picker';
import type { MentionItem, RichTextEntitySearchFn } from '../mentions';
import type { RichTextActionDefinition } from '../actions';
import type { AiProvider } from '../../../../lib/ai';
import { RTE_FULL } from './index';
import { RichTextEditorComponent } from '../..';

/**
 * `RTE_FULL` is the generated composition array — importing it registers every
 * addon directive, and each also matches on `[uiRteFull]`, so the single marker
 * attribute activates them all. Drift is impossible by construction (native
 * selector matching), so there is no forwarding table to guard; the sync script
 * owns the array + selector clauses and has its own completeness test. Here we
 * only prove the composition works at runtime.
 */
@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RTE_FULL],
    template: `
        <ui-rich-text-editor
            data-testid="full"
            mode="html"
            uiRteFull
            [uiRteAi]="ai"
            [uiRteMentionsSearch]="searchMentions"
            [uiRteActions]="actionDefs"
            (emojiInsert)="emojiInserted.push($event)"
        ></ui-rich-text-editor>
        <ui-rich-text-editor data-testid="plain" mode="html"></ui-rich-text-editor>
    `,
})
class HostCmp {
    readonly ai: AiProvider = () => 'AI SAYS HELLO';
    readonly searchMentions: RichTextEntitySearchFn<MentionItem> = (query) =>
        [{ id: '1', value: 'user-one', label: `User ${query || 'One'}` }];
    readonly actionDefs: RichTextActionDefinition[] = [
        { id: 'open', label: 'Open', triggers: ['click'], fields: [] },
    ];
    readonly emojiInserted: string[] = [];
}

function hasNgDir(type: unknown): boolean {
    return typeof type === 'function' && 'ɵdir' in type;
}

describe('RTE_FULL composition array', () => {
    it('is non-empty and every element is a directive class', () => {
        expect(RTE_FULL.length).toBeGreaterThan(0);
        for (const directive of RTE_FULL) {
            expect(hasNgDir(directive)).toBe(true);
        }
    });
});

type GlobalWithObservers = {
    ResizeObserver?: unknown;
    matchMedia?: unknown;
};

/** Minimal no-op ResizeObserver for the emoji picker's scroll-area under jsdom. */
class NoopResizeObserver {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}

describe('uiRteFull composition (real editor)', () => {
    let fixture: ComponentFixture<HostCmp>;

    let hadResizeObserver = false;
    let hadMatchMedia = false;
    beforeEach(() => {
        const globalRef = globalThis as GlobalWithObservers;
        hadResizeObserver = 'ResizeObserver' in globalThis;
        if (!hadResizeObserver) {
            globalRef.ResizeObserver = NoopResizeObserver;
        }
        hadMatchMedia = 'matchMedia' in globalThis;
        if (!hadMatchMedia) {
            globalRef.matchMedia = (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
                addListener: () => undefined,
                removeListener: () => undefined,
                dispatchEvent: () => false,
            });
        }
    });

    function fullEditor(): HTMLElement {
        return fixture.nativeElement.querySelector('[data-testid="full"]') as HTMLElement;
    }

    function slot(id: string): HTMLElement | null {
        return fullEditor().querySelector(`[data-addon-slot="${id}"]`);
    }

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        if (fixture && !fixture.componentRef.hostView.destroyed) {
            fixture.destroy();
        }
        const globalRef = globalThis as GlobalWithObservers;
        if (!hadResizeObserver) {
            delete globalRef.ResizeObserver;
        }
        if (!hadMatchMedia) {
            delete globalRef.matchMedia;
        }
    });

    it('activates representative slots from several addons under one marker', () => {
        fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();

        for (const id of ['emoji.insert', 'colors.foreground', 'links.insert', 'tables.insert', 'view.outline']) {
            expect(slot(id)).toBeTruthy();
        }
    });

    it('gives the control editor (no marker) no addon UI', () => {
        fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();

        const plain = fixture.nativeElement.querySelector('[data-testid="plain"]') as HTMLElement;
        expect(plain.querySelectorAll('[data-addon-slot]')).toHaveLength(0);
    });

    it('forwards a composed output (emojiInsert) end-to-end', () => {
        fixture = TestBed.createComponent(HostCmp);
        fixture.detectChanges();

        const picker = fixture.debugElement.query(By.directive(EmojiPickerComponent))
            .componentInstance as EmojiPickerComponent;
        picker.selectEmoji('🎉');
        fixture.detectChanges();

        const editor = fullEditor().querySelector('[contenteditable]') as HTMLElement;
        expect(editor.textContent).toContain('🎉');
        expect(fixture.componentInstance.emojiInserted).toEqual(['🎉']);
    });
});
