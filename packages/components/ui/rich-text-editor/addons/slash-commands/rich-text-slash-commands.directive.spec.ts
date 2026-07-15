import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, afterEach } from 'vitest';
import { RichTextEditorComponent, RichTextCommandRegistry, type RichTextSlashCommand } from '../..';
import { RichTextSlashCommandsDirective } from './rich-text-slash-commands.directive';

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

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextSlashCommandsDirective],
    template: `
        <ui-rich-text-editor mode="html" uiRteSlashCommands></ui-rich-text-editor>
        <ui-rich-text-editor mode="html" uiRteSlashCommands></ui-rich-text-editor>`,
})
class DualHostCmp {}

describe('RichTextSlashCommandsDirective', () => {
    const openFixtures: ComponentFixture<HostCmp>[] = [];
    const openDualFixtures: ComponentFixture<DualHostCmp>[] = [];

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

    function menuOptions(): HTMLElement[] {
        return Array.from(document.querySelectorAll('[data-slash-index]'));
    }

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
        while (openDualFixtures.length > 0) {
            const fixture = openDualFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('opens the menu when typing "/"', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/hea');
        fixture.detectChanges();
        expect(menu()).toBeTruthy();
        const labels = menuOptions().map(o => o.textContent);
        expect(labels.some(l => l?.includes('Heading 1'))).toBe(true);
    });

    it('does not open when "/" follows a letter', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, 'a/hea');
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('does not open while readonly or disabled', () => {
        const { fixture, editor, editorCmp } = create();
        fixture.componentInstance.readonly.set(true);
        fixture.detectChanges();
        typeSlash(editor, editorCmp, '/h');
        fixture.detectChanges();
        expect(menu()).toBeNull();

        fixture.componentInstance.readonly.set(false);
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();
        typeSlash(editor, editorCmp, '/h');
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('narrows the list as the query grows', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/h1');
        fixture.detectChanges();
        const labels = menuOptions().map(o => o.textContent);
        expect(labels).toHaveLength(1);
        expect(labels[0]).toContain('Heading 1');
    });

    it('Enter executes the highlighted command and removes the trigger text (block transform)', async () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/h1');
        fixture.detectChanges();
        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();
        expect(editor.querySelector('h1')).toBeTruthy();
        expect(editor.textContent).not.toContain('/h1');
        expect(menu()).toBeNull();
    });

    it('transforms a block into a bullet list, quote, and inline code through the host seam', async () => {
        const cases: Array<[string, string]> = [
            ['/bullet', 'ul > li'],
            ['/quote', 'blockquote'],
            ['/code', 'code'],
        ];
        for (const [query, selector] of cases) {
            const { fixture, editor, editorCmp } = create();
            typeSlash(editor, editorCmp, query);
            fixture.detectChanges();
            editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
            await fixture.whenStable();
            fixture.detectChanges();
            expect(editor.querySelector(selector)).toBeTruthy();
        }
    });

    it('ArrowDown/ArrowUp move the highlighted option and Escape closes', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();
        const first = menuOptions()[0];
        expect(first.getAttribute('aria-selected')).toBe('true');

        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
        fixture.detectChanges();
        expect(menuOptions()[1].getAttribute('aria-selected')).toBe('true');

        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
        fixture.detectChanges();
        expect(menuOptions()[0].getAttribute('aria-selected')).toBe('true');

        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('includes commands contributed through the shared command registry', () => {
        const { fixture, editor, editorCmp } = create();
        const registry = TestBed.inject(RichTextCommandRegistry);
        registry.registerCommand({
            id: 'reg.hello', label: 'Registry Hello', keywords: ['hello'], order: 200, run: () => undefined,
        });
        typeSlash(editor, editorCmp, '/hello');
        fixture.detectChanges();
        expect(menuOptions().some(o => o.textContent?.includes('Registry Hello'))).toBe(true);
        registry.unregisterCommand('reg.hello');
    });

    it('includes custom commands from the [uiRteSlashCommands] input and runs them', async () => {
        const { fixture, editor, editorCmp } = create();
        fixture.componentInstance.custom.set([{
            id: 'custom.stamp', label: 'Stamp Text', keywords: ['stamp'], order: 200,
            run: (ctx) => ctx.insertText('STAMPED'),
        }]);
        fixture.detectChanges();
        typeSlash(editor, editorCmp, '/stamp');
        fixture.detectChanges();
        expect(menuOptions().some(o => o.textContent?.includes('Stamp Text'))).toBe(true);
        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
        await fixture.whenStable();
        fixture.detectChanges();
        expect(editor.textContent).toContain('STAMPED');
    });

    it('localizes the menu strings for Hebrew', () => {
        const { fixture, editor, editorCmp } = create();
        fixture.componentInstance.locale.set('he');
        fixture.detectChanges();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();
        expect(menu()!.getAttribute('aria-label')).toBe('תפריט פקודות');
        expect(menuOptions().some(o => o.textContent?.includes('פסקה'))).toBe(true);
    });

    it('shows the no-results message when nothing matches', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/zzzznope');
        fixture.detectChanges();
        expect(menuOptions()).toHaveLength(0);
        expect(menu()!.textContent).toContain('No commands found');
    });

    it('scopes instance-registered commands to their own editor, while global commands appear everywhere', () => {
        // A single fixture hosting BOTH editors: TestBed replaces the previous
        // fixture's host element, so two createComponent fixtures cannot be
        // live in the DOM at the same time.
        const fixture = TestBed.createComponent(DualHostCmp);
        openDualFixtures.push(fixture);
        fixture.detectChanges();
        const editorCmps = fixture.debugElement.queryAll(By.directive(RichTextEditorComponent))
            .map(de => de.componentInstance as RichTextEditorComponent);
        const editors = Array.from(
            fixture.nativeElement.querySelectorAll('[contenteditable]'),
        ) as HTMLElement[];
        const [aCmp, bCmp] = editorCmps;
        const [aEditor, bEditor] = editors;

        const teardownInstance = aCmp.commands.registerCommand({
            id: 'test.only-in-a', label: 'Only in A', keywords: ['test'], order: 1, run: () => void 0,
        });
        const teardownGlobal = TestBed.inject(RichTextCommandRegistry).registerCommand({
            id: 'test.everywhere', label: 'Everywhere', keywords: ['test'], order: 2, run: () => void 0,
        });

        typeSlash(aEditor, aCmp, '/test');
        fixture.detectChanges();
        let labels = menuOptions().map(o => o.textContent?.trim() ?? '');
        expect(labels.some(l => l.includes('Only in A'))).toBe(true);
        expect(labels.some(l => l.includes('Everywhere'))).toBe(true);

        aCmp.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        fixture.detectChanges();
        expect(menu()).toBeNull();
        window.getSelection()?.removeAllRanges();

        typeSlash(bEditor, bCmp, '/test');
        fixture.detectChanges();
        labels = menuOptions().map(o => o.textContent?.trim() ?? '');
        expect(labels.some(l => l.includes('Everywhere'))).toBe(true);
        expect(labels.some(l => l.includes('Only in A'))).toBe(false);

        teardownInstance();
        teardownGlobal();
    });

    it('a torn-down instance registration disappears from that editor\'s own menu', () => {
        const { fixture, editor, editorCmp } = create();
        const teardown = editorCmp.commands.registerCommand({
            id: 'test.transient', label: 'Transient Command', keywords: ['transient'], order: 1, run: () => void 0,
        });

        typeSlash(editor, editorCmp, '/transient');
        fixture.detectChanges();
        expect(menuOptions().some(o => o.textContent?.includes('Transient Command'))).toBe(true);

        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        fixture.detectChanges();
        expect(menu()).toBeNull();

        teardown();
        typeSlash(editor, editorCmp, '/transient');
        fixture.detectChanges();
        expect(menuOptions().some(o => o.textContent?.includes('Transient Command'))).toBe(false);
    });

    it('an instance command wins an id collision with a global command', () => {
        const { fixture, editor, editorCmp } = create();
        const offGlobal = TestBed.inject(RichTextCommandRegistry).registerCommand({
            id: 'test.collide', label: 'Global Loser', keywords: ['collide'], order: 1, run: () => void 0,
        });
        const offInstance = editorCmp.commands.registerCommand({
            id: 'test.collide', label: 'Instance Winner', keywords: ['collide'], order: 1, run: () => void 0,
        });

        typeSlash(editor, editorCmp, '/collide');
        fixture.detectChanges();
        const labels = menuOptions().map(o => o.textContent?.trim() ?? '');
        expect(labels.some(l => l.includes('Instance Winner'))).toBe(true);
        expect(labels.some(l => l.includes('Global Loser'))).toBe(false);

        offInstance();
        offGlobal();
    });
});
