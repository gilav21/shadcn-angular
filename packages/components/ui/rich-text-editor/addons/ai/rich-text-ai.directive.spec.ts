import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import type { AiProvider } from '../../../../lib/ai';
import { RichTextAiDirective } from './rich-text-ai.directive';

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

    afterEach(() => {
        for (const f of fixtures) {
            f.nativeElement.remove();
            f.destroy();
        }
        fixtures.length = 0;
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
});
