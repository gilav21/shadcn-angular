import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RichTextSlashCommandsDirective } from './rich-text-slash-commands.directive';
import { RichTextCommandRegistry, RichTextEditorComponent, type RichTextSlashCommand } from '../..';

type RangeWithRect = { getBoundingClientRect?: () => DOMRect };

/** The directive positions its menu from the caret rect, so supply a stable
 *  non-degenerate one. Installed unconditionally: this suite runs in a real
 *  browser where `Range.prototype.getBoundingClientRect` already exists, and the
 *  old `if (!('getBoundingClientRect' in Range.prototype))` guard therefore
 *  skipped it entirely — every menu position then came from live layout, which
 *  is what made this file's placement assertions flaky under load. */
function fixedCaretRect(): DOMRect {
    return {
        x: 120, y: 100, left: 120, top: 100, right: 130, bottom: 118, width: 10, height: 18,
        toJSON: () => ({}),
    } as DOMRect;
}

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

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextSlashCommandsDirective],
    template: `<ui-rich-text-editor mode="html" [uiRteSlashCommands]="mode()"></ui-rich-text-editor>`,
})
class ToggleHostCmp {
    readonly mode = signal<boolean | RichTextSlashCommand[]>(true);
}

describe('RichTextSlashCommandsDirective', () => {
    const openFixtures: ComponentFixture<unknown>[] = [];
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

    let savedRangeRect: PropertyDescriptor | undefined;
    beforeEach(() => {
        savedRangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
        Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
            configurable: true,
            writable: true,
            value: fixedCaretRect,
        });
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
        while (openDualFixtures.length > 0) {
            const fixture = openDualFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('closes and stops opening the menu when uiRteSlashCommands is false, reopening when re-enabled', () => {
        const fixture = TestBed.createComponent(ToggleHostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        const editorCmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;

        typeSlash(editor, editorCmp, '/h');
        fixture.detectChanges();
        expect(menu()).toBeTruthy();

        fixture.componentInstance.mode.set(false);
        fixture.detectChanges();
        expect(menu()).toBeNull();

        typeSlash(editor, editorCmp, '/h');
        fixture.detectChanges();
        expect(menu()).toBeNull();

        fixture.componentInstance.mode.set(true);
        fixture.detectChanges();
        typeSlash(editor, editorCmp, '/h');
        fixture.detectChanges();
        expect(menu()).toBeTruthy();
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

    it('stays open when scrolling inside the menu but closes when the page scrolls', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();
        const list = document.querySelector('[data-slot="rich-text-slash-commands-menu"] [class*="overflow-y-auto"]')!;
        list.dispatchEvent(new Event('scroll', { bubbles: true }));
        fixture.detectChanges();
        expect(menu()).toBeTruthy();

        window.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('positions an empty-block menu at the caret line, not the viewport corner', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();
        const el = menu() as HTMLElement;
        expect(el.style.position).toBe('fixed');
        expect(el.style.top).not.toBe('0px');
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

    function enter(): KeyboardEvent {
        return new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    }

    const ZERO_RECT = {
        x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
    } as DOMRect;

    it('closes on an outside pointer-down but stays open for editor and menu pointer-downs', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();
        expect(menu()).toBeTruthy();

        menuOptions()[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(menu()).toBeTruthy();

        editor.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(menu()).toBeTruthy();

        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('ignores keys that are not menu keys while the menu is open', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();
        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'x', cancelable: true }));
        fixture.detectChanges();
        expect(menu()).toBeTruthy();
    });

    it('no-ops non-dismiss keys with no results and closes on Escape', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/zzzznope');
        fixture.detectChanges();
        expect(menuOptions()).toHaveLength(0);

        editorCmp.onKeydown(enter());
        fixture.detectChanges();
        expect(menu()).toBeTruthy();

        editorCmp.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('does not execute a command selected while the editor is disabled', () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/h1');
        fixture.detectChanges();
        fixture.componentInstance.disabled.set(true);
        fixture.detectChanges();

        menuOptions()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        fixture.detectChanges();
        expect(editor.querySelector('h1')).toBeNull();
    });

    it('highlights an option on hover and runs it on click', async () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();

        menuOptions()[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        fixture.detectChanges();
        expect(menuOptions()[1].getAttribute('aria-selected')).toBe('true');

        menuOptions()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await fixture.whenStable();
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('runs custom commands that use insertHtml, showLinkDialog, and focusEditor', async () => {
        const { fixture, editor, editorCmp } = create();
        fixture.componentInstance.custom.set([
            { id: 'c.html', label: 'Html Cmd', keywords: ['htmlcmd'], order: 300, run: (ctx) => ctx.insertHtml('<b>BOLD</b>') },
            { id: 'c.link', label: 'Link Cmd', keywords: ['linkcmd'], order: 301, run: (ctx) => ctx.showLinkDialog() },
            { id: 'c.focus', label: 'Focus Cmd', keywords: ['focuscmd'], order: 302, run: (ctx) => ctx.focusEditor() },
        ]);
        fixture.detectChanges();

        typeSlash(editor, editorCmp, '/htmlcmd');
        fixture.detectChanges();
        editorCmp.onKeydown(enter());
        await fixture.whenStable();
        fixture.detectChanges();
        expect(editor.querySelector('b')?.textContent).toBe('BOLD');

        typeSlash(editor, editorCmp, '/linkcmd');
        fixture.detectChanges();
        editorCmp.onKeydown(enter());
        await fixture.whenStable();
        fixture.detectChanges();

        typeSlash(editor, editorCmp, '/focuscmd');
        fixture.detectChanges();
        editorCmp.onKeydown(enter());
        await fixture.whenStable();
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('refocuses the editor when a command leaves the selection outside it', async () => {
        const { fixture, editor, editorCmp } = create();
        fixture.componentInstance.custom.set([
            { id: 'c.blur', label: 'Blur Cmd', keywords: ['blurcmd'], order: 300, run: () => window.getSelection()?.removeAllRanges() },
        ]);
        fixture.detectChanges();
        typeSlash(editor, editorCmp, '/blurcmd');
        fixture.detectChanges();
        editorCmp.onKeydown(enter());
        await fixture.whenStable();
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('selects a command even when the live selection was cleared first', async () => {
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/h1');
        fixture.detectChanges();
        window.getSelection()?.removeAllRanges();
        editorCmp.onKeydown(enter());
        await fixture.whenStable();
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('breaks command order ties by label', () => {
        const { fixture, editor, editorCmp } = create();
        fixture.componentInstance.custom.set([
            { id: 'c.z', label: 'Zebra Dup', keywords: ['dupkey'], order: 500, run: () => undefined },
            { id: 'c.a', label: 'Alpha Dup', keywords: ['dupkey'], order: 500, run: () => undefined },
        ]);
        fixture.detectChanges();
        typeSlash(editor, editorCmp, '/dupkey');
        fixture.detectChanges();
        const labels = menuOptions().map(o => o.textContent?.trim() ?? '');
        const alpha = labels.findIndex(l => l.includes('Alpha Dup'));
        const zebra = labels.findIndex(l => l.includes('Zebra Dup'));
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThan(zebra);
    });

    it('falls back to the anchor block rect when the caret rect is degenerate', () => {
        (Range.prototype as RangeWithRect).getBoundingClientRect = () => ZERO_RECT;
        const blockRect = {
            x: 50, y: 80, left: 50, top: 80, right: 60, bottom: 96, width: 10, height: 16, toJSON: () => ({}),
        } as DOMRect;
        const origEl = HTMLElement.prototype.getBoundingClientRect;
        HTMLElement.prototype.getBoundingClientRect = () => blockRect;
        try {
            const { fixture, editor, editorCmp } = create();
            typeSlash(editor, editorCmp, '/');
            fixture.detectChanges();
            const el = menu() as HTMLElement;
            expect(el.style.top).not.toBe('0px');
        } finally {
            HTMLElement.prototype.getBoundingClientRect = origEl;
        }
    });

    it('leaves the menu unpositioned and still opens when no rect is usable', async () => {
        (Range.prototype as RangeWithRect).getBoundingClientRect = () => ZERO_RECT;
        const { fixture, editor, editorCmp } = create();
        typeSlash(editor, editorCmp, '/');
        fixture.detectChanges();
        expect(menu()).toBeTruthy();

        editorCmp.onKeydown(enter());
        await fixture.whenStable();
        fixture.detectChanges();
        expect(menu()).toBeNull();
    });

    it('guards positioning and outside-pointer handling against missing state', () => {
        const { fixture } = create();
        const dir = fixture.debugElement.query(By.directive(RichTextSlashCommandsDirective))
            .injector.get(RichTextSlashCommandsDirective) as unknown as {
                updatePosition(): void;
                onOutsidePointer(event: Event): void;
            };
        window.getSelection()?.removeAllRanges();
        expect(() => dir.updatePosition()).not.toThrow();
        expect(() => dir.onOutsidePointer(new MouseEvent('mousedown'))).not.toThrow();
    });

    it('renders the menu in the native top layer when the popover API is available', () => {
        type WithPopover = { showPopover?: () => void; hidePopover?: () => void };
        const proto = HTMLElement.prototype as WithPopover;
        const hadShow = 'showPopover' in HTMLElement.prototype;
        // Fill the API in only when the engine lacks it. This used to overwrite
        // the native implementation unconditionally while the `finally` below
        // restored only in the `!hadShow` branch — so under Chromium, where the
        // API does exist, the fake was installed and NEVER removed. Every later
        // spec file in the run then got a `showPopover` that set an attribute
        // instead of promoting to the top layer, and any assertion on
        // `:popover-open` failed for reasons unrelated to the code under test.
        proto.showPopover ??= function showPopover(this: HTMLElement) { this.setAttribute('data-open', ''); };
        proto.hidePopover ??= () => undefined;
        try {
            const { fixture, editor, editorCmp } = create();
            typeSlash(editor, editorCmp, '/');
            fixture.detectChanges();
            const el = menu() as HTMLElement;
            expect(el.getAttribute('popover')).toBe('manual');
            expect(el.style.zIndex).toBe('');
        } finally {
            if (!hadShow) {
                delete proto.showPopover;
                delete proto.hidePopover;
            }
        }
    });
});
