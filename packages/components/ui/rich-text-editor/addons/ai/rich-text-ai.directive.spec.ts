import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Subject } from 'rxjs';
import type { AiProvider } from '../../../../lib/ai';
import { RichTextAiDirective } from './rich-text-ai.directive';
import { RichTextEditorComponent } from '../..';

/**
 * jsdom implements neither `Range.prototype.getBoundingClientRect` (the chip and
 * panel positioning read it) nor a layout engine, so install a fixed-rect stub
 * for the duration of each test and restore the original afterwards.
 */
type RangeRectFn = () => DOMRect;
const rangeProto = Range.prototype as Range & { getBoundingClientRect?: RangeRectFn };
let originalRangeRect: RangeRectFn | undefined;

function fixedRect(): DOMRect {
    return {
        x: 10, y: 20, left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40,
        toJSON: () => ({}),
    } as DOMRect;
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextAiDirective],
    template: `<ui-rich-text-editor
        mode="html"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [uiRteAi]="provider()"
        [uiRteAiLocale]="locale()"
        (aiRequest)="requests.push($event)"
        (aiResult)="results.push($event)"
        (aiError)="errors.push($event)"
    ></ui-rich-text-editor>`,
})
class HostCmp {
    readonly disabled = signal(false);
    readonly readonly = signal(false);
    readonly provider = signal<AiProvider | undefined>(undefined);
    readonly locale = signal<string | undefined>(undefined);
    requests: { task: string; prompt?: string }[] = [];
    results: string[] = [];
    errors: string[] = [];
}

describe('RichTextAiDirective', () => {
    const fixtures: ComponentFixture<HostCmp>[] = [];

    function createFixture(): ComponentFixture<HostCmp> {
        const fixture = TestBed.createComponent(HostCmp);
        fixtures.push(fixture);
        document.body.appendChild(fixture.nativeElement);
        fixture.detectChanges();
        return fixture;
    }

    function editorOf(fixture: ComponentFixture<HostCmp>): { el: HTMLElement; cmp: RichTextEditorComponent } {
        const cmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const el = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLElement;
        return { el, cmp };
    }

    function directiveOf(fixture: ComponentFixture<HostCmp>): RichTextAiDirective {
        return fixture.debugElement.query(By.directive(RichTextAiDirective))
            .injector.get(RichTextAiDirective);
    }

    function setContent(fixture: ComponentFixture<HostCmp>, html: string): HTMLElement {
        const { el } = editorOf(fixture);
        el.innerHTML = html;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        return el;
    }

    function selectAll(el: HTMLElement): void {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
    }

    function query(fixture: ComponentFixture<HostCmp>, slot: string): HTMLElement | null {
        return fixture.nativeElement.querySelector(`[data-slot="${slot}"]`);
    }

    beforeEach(() => {
        originalRangeRect = rangeProto.getBoundingClientRect;
        rangeProto.getBoundingClientRect = fixedRect;
    });

    afterEach(() => {
        for (const f of fixtures) {
            f.nativeElement.remove();
            f.destroy();
        }
        fixtures.length = 0;
        if (originalRangeRect) {
            rangeProto.getBoundingClientRect = originalRangeRect;
        } else {
            delete rangeProto.getBoundingClientRect;
        }
    });

    it('shows the Ask-AI chip on a selection only when a provider is set', () => {
        const fixture = createFixture();
        const el = setContent(fixture, '<p>hello world</p>');
        selectAll(el);
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-trigger')).toBeNull();

        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        selectAll(el);
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-trigger')).toBeTruthy();
    });

    it('does not show the chip when readonly or disabled', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>hello world</p>');
        selectAll(el);
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-trigger')).toBeNull();
    });

    it('opens the panel from the chip and lists the six built-in tasks', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>hello world</p>');
        selectAll(el);
        fixture.detectChanges();

        (query(fixture, 'rich-text-ai-trigger') as HTMLButtonElement).click();
        fixture.detectChanges();

        const menu = query(fixture, 'rich-text-ai-menu');
        expect(menu).toBeTruthy();
        expect(menu?.querySelectorAll(':scope > button')).toHaveLength(6);
    });

    function openMenu(fixture: ComponentFixture<HostCmp>): void {
        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>hello world</p>');
        selectAll(el);
        fixture.detectChanges();
        directiveOf(fixture).openPanel();
        fixture.detectChanges();
    }

    it('closes the task menu on Escape', () => {
        const fixture = createFixture();
        openMenu(fixture);
        expect(query(fixture, 'rich-text-ai-panel')).toBeTruthy();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-panel')).toBeNull();
    });

    it('closes the task menu on an outside pointer press', () => {
        const fixture = createFixture();
        openMenu(fixture);
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-panel')).toBeNull();
    });

    it('keeps the task menu open when pressing inside the panel', () => {
        const fixture = createFixture();
        openMenu(fixture);
        query(fixture, 'rich-text-ai-panel')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-panel')).toBeTruthy();
    });

    it('closes the task menu on page scroll', () => {
        const fixture = createFixture();
        openMenu(fixture);
        window.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-panel')).toBeNull();
    });

    it('registers the /ai slash command only when a provider is set', () => {
        const fixture = createFixture();
        const { cmp } = editorOf(fixture);
        expect(cmp.commands.listCommands().some((c) => c.id === 'insert.ai')).toBe(false);

        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        expect(cmp.commands.listCommands().some((c) => c.id === 'insert.ai')).toBe(true);
    });

    it('opens the panel via the /ai slash command run handler', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>hi</p>');
        selectAll(el);
        fixture.detectChanges();

        const cmd = editorOf(fixture).cmp.commands.listCommands().find((c) => c.id === 'insert.ai');
        cmd?.run({} as never);
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-panel')).toBeTruthy();
    });

    it('replaces the selection with the result and keeps it on accept, adding a history entry', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set((req) => `[${req.input}]`);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>hello world</p>');
        const { cmp } = editorOf(fixture);
        const before = cmp.historyEntries().length;
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('[hello world]');

        dir.accept();
        fixture.detectChanges();
        expect(el.textContent).toContain('[hello world]');
        expect(el.querySelector('[data-ai-draft]')).toBeNull();
        expect(fixture.componentInstance.results).toContain('[hello world]');
        expect(cmp.historyEntries().length).toBeGreaterThan(before);
    });

    it('restores the original content on discard', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'REPLACED');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>keep me</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        expect(el.textContent).toContain('REPLACED');

        dir.discard();
        fixture.detectChanges();
        expect(el.textContent).toContain('keep me');
        expect(el.textContent).not.toContain('REPLACED');
    });

    it('streams progressive output from an Observable provider', () => {
        const fixture = createFixture();
        const subject = new Subject<string>();
        fixture.componentInstance.provider.set(() => subject);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>seed</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-loading')).toBeTruthy();

        subject.next('Hel');
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('Hel');
        subject.next('Hello');
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('Hello');

        subject.complete();
        fixture.detectChanges();
        dir.accept();
        fixture.detectChanges();
        expect(el.textContent).toContain('Hello');
    });

    it('surfaces provider errors and stays in review', () => {
        const fixture = createFixture();
        const subject = new Subject<string>();
        fixture.componentInstance.provider.set(() => subject);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>x</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        subject.error(new Error('boom'));
        fixture.detectChanges();

        expect(query(fixture, 'rich-text-ai-error')?.textContent).toContain('boom');
        expect(fixture.componentInstance.errors).toContain('boom');
        expect(query(fixture, 'rich-text-ai-review')).toBeTruthy();
        dir.discard();
    });

    it('does nothing when no provider is set', () => {
        const fixture = createFixture();
        const el = setContent(fixture, '<p>text</p>');
        selectAll(el);
        fixture.detectChanges();
        directiveOf(fixture).openPanel();
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-panel')).toBeNull();
    });

    it('runs a custom prompt and emits aiRequest with the prompt', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set((req) => `(${req.prompt}) ${req.input}`);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>base</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runCustom('make it formal');
        fixture.detectChanges();
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('(make it formal) base');
        expect(fixture.componentInstance.requests.at(-1)).toEqual({ task: 'custom', prompt: 'make it formal' });
        dir.accept();
    });

    it('resolves Hebrew locale strings for the chip and menu', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>שלום</p>');
        selectAll(el);
        fixture.detectChanges();

        expect(query(fixture, 'rich-text-ai-trigger')?.textContent).toContain('שאל AI');
        (query(fixture, 'rich-text-ai-trigger') as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-menu')?.textContent).toContain('שפר ניסוח');
    });

    function clickEl(el: Element): void {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    function collapseCaret(el: HTMLElement): void {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    it('runs a built-in task when a menu button is clicked', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set((req) => `[${req.input}]`);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>hello world</p>');
        selectAll(el);
        fixture.detectChanges();

        directiveOf(fixture).openPanel();
        fixture.detectChanges();
        const first = query(fixture, 'rich-text-ai-menu')!.querySelector<HTMLButtonElement>(':scope > button')!;
        clickEl(first);
        fixture.detectChanges();
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('[hello world]');
        expect(query(fixture, 'rich-text-ai-review')).toBeTruthy();
    });

    it('runs a custom prompt typed into the panel input and cleared on reopen', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set((req) => `(${req.prompt}) ${req.input}`);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>base</p>');
        selectAll(el);
        fixture.detectChanges();

        directiveOf(fixture).openPanel();
        fixture.detectChanges();
        const input = query(fixture, 'rich-text-ai-menu')!.querySelector('input') as HTMLInputElement;
        input.value = 'make it bold';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        const menuButtons = query(fixture, 'rich-text-ai-menu')!.querySelectorAll('button');
        clickEl(menuButtons[menuButtons.length - 1]);
        fixture.detectChanges();
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('(make it bold) base');
        expect(fixture.componentInstance.requests.at(-1)).toEqual({ task: 'custom', prompt: 'make it bold' });
    });

    it('accepts, discards, and retries via the review buttons', () => {
        const fixture = createFixture();
        let calls = 0;
        fixture.componentInstance.provider.set(() => `draft-${++calls}`);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>seed</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        fixture.detectChanges();

        const retry = query(fixture, 'rich-text-ai-review')!.querySelectorAll('button')[2];
        clickEl(retry);
        fixture.detectChanges();
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('draft-2');

        const accept = query(fixture, 'rich-text-ai-review')!.querySelectorAll('button')[0];
        clickEl(accept);
        fixture.detectChanges();
        expect(el.textContent).toContain('draft-2');
        expect(query(fixture, 'rich-text-ai-panel')).toBeNull();
    });

    it('discards the draft via the review Discard button', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'NEW');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>original</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        fixture.detectChanges();
        const discard = query(fixture, 'rich-text-ai-review')!.querySelectorAll('button')[1];
        clickEl(discard);
        fixture.detectChanges();
        expect(el.textContent).toContain('original');
    });

    it('discards the draft on Escape while in review', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'REPLACED');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>keep</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        fixture.detectChanges();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        fixture.detectChanges();
        expect(el.textContent).toContain('keep');
        expect(query(fixture, 'rich-text-ai-panel')).toBeNull();
    });

    it('keeps the panel open on an outside pointer press once past the menu phase', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>hi</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        fixture.detectChanges();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-panel')).toBeTruthy();
        dir.discard();
    });

    it('ignores non-Escape keys and a second openPanel while the menu is open', () => {
        const fixture = createFixture();
        openMenu(fixture);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        directiveOf(fixture).openPanel();
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-panel')).toBeTruthy();
    });

    it('hides the chip on a collapsed caret and ignores selectionchange while the panel is open', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>hello</p>');
        collapseCaret(el);
        document.dispatchEvent(new Event('selectionchange'));
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-trigger')).toBeNull();

        directiveOf(fixture).openPanel();
        fixture.detectChanges();
        document.dispatchEvent(new Event('selectionchange'));
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-trigger')).toBeNull();
    });

    it('captures a collapsed caret for a continue task and discards it', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set((req) => `${req.input}!`);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>story</p>');
        collapseCaret(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('continue');
        fixture.detectChanges();
        expect(el.querySelector('[data-ai-draft]')).toBeTruthy();

        dir.discard();
        fixture.detectChanges();
        expect(el.querySelector('[data-ai-draft]')).toBeNull();
        expect(el.textContent).toContain('story');
    });

    it('does nothing when opening the panel with no selection range', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        setContent(fixture, '<p>text</p>');
        document.getSelection()?.removeAllRanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        fixture.detectChanges();
        expect(query(fixture, 'rich-text-ai-menu')).toBeTruthy();
        expect(fixture.nativeElement.querySelector('[data-ai-draft]')).toBeNull();
    });

    it('retries the last task from scratch when no draft exists yet', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set((req) => `redo:${req.input}`);
        fixture.detectChanges();
        const el = setContent(fixture, '<p>again</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.retryLast();
        fixture.detectChanges();
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('redo:again');
        dir.discard();
    });

    it('no-ops the stream when the provider is removed before a retry', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'first');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>src</p>');
        selectAll(el);
        fixture.detectChanges();

        const dir = directiveOf(fixture);
        dir.openPanel();
        dir.runTask('rewrite');
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('first');

        fixture.componentInstance.provider.set(undefined);
        fixture.detectChanges();
        dir.retryLast();
        fixture.detectChanges();
        expect(el.querySelector('[data-ai-draft]')?.textContent).toBe('');
        dir.discard();
    });

    it('accepting with no active draft is a safe no-op', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        setContent(fixture, '<p>content</p>');
        expect(() => directiveOf(fixture).accept()).not.toThrow();
    });

    it('falls back to the block element rect when the caret rect is degenerate', () => {
        const fixture = createFixture();
        fixture.componentInstance.provider.set(() => 'x');
        fixture.detectChanges();
        const el = setContent(fixture, '<p>positioned</p>');
        selectAll(el);
        fixture.detectChanges();

        const elementProto = Element.prototype as Element & { getBoundingClientRect: () => DOMRect };
        const originalElementRect = elementProto.getBoundingClientRect;
        rangeProto.getBoundingClientRect = () => ({
            x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
        } as DOMRect);
        elementProto.getBoundingClientRect = fixedRect;
        try {
            directiveOf(fixture).openPanel();
            fixture.detectChanges();
            expect(query(fixture, 'rich-text-ai-panel')).toBeTruthy();
        } finally {
            elementProto.getBoundingClientRect = originalElementRect;
            rangeProto.getBoundingClientRect = fixedRect;
        }
    });
});
