import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** jsdom lacks ResizeObserver; the panel's ScrollArea constructs one on view init. */
class ResizeObserverStub {
    observe(): void { /* no-op */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
}
type ResizeObserverGlobal = { ResizeObserver?: typeof ResizeObserver };
const originalResizeObserver = (globalThis as ResizeObserverGlobal).ResizeObserver;

beforeEach(() => {
    (globalThis as ResizeObserverGlobal).ResizeObserver =
        ResizeObserverStub as unknown as typeof ResizeObserver;
});

afterEach(() => {
    if (originalResizeObserver) {
        (globalThis as ResizeObserverGlobal).ResizeObserver = originalResizeObserver;
    } else {
        delete (globalThis as ResizeObserverGlobal).ResizeObserver;
    }
});
import { ShortcutBindingService } from '../../../../lib/shortcut-binding.service';
import { RichTextHistoryDirective } from './rich-text-history.directive';
import { RichTextHistoryPanelComponent } from './rich-text-history-panel.component';
import { RichTextEditorComponent } from '../..';

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextHistoryDirective],
    template: `<ui-rich-text-editor
        mode="html"
        uiRteHistory
        [uiRteHistoryButton]="button()"
        [uiRteHistoryLocale]="locale()"
        (historyRestore)="restored.set($event)"
    ></ui-rich-text-editor>`,
})
class HostCmp {
    readonly button = signal(true);
    readonly locale = signal<string | undefined>(undefined);
    readonly restored = signal<number | null>(null);
}

@Component({
    standalone: true,
    imports: [RichTextEditorComponent, RichTextHistoryDirective],
    template: `<ui-rich-text-editor mode="html" [uiRteHistory]="enabled()"></ui-rich-text-editor>`,
})
class ToggleHostCmp {
    readonly enabled = signal(true);
}

interface Harness {
    fixture: ComponentFixture<HostCmp>;
    editor: HTMLElement;
    editorCmp: RichTextEditorComponent;
    panel: RichTextHistoryPanelComponent;
}

/** A detached history row inside a `[data-history-list]` container of the given type. */
function makeRow(listType: 'popover' | 'dialog', index: number): { list: HTMLElement; row: HTMLElement } {
    const list = document.createElement('div');
    list.dataset['historyList'] = listType;
    const row = document.createElement('div');
    row.dataset['historyEntryAction'] = 'true';
    row.dataset['historyEntryIndex'] = String(index);
    row.tabIndex = 0;
    list.appendChild(row);
    document.body.appendChild(list);
    return { list, row };
}

describe('RichTextHistoryDirective', () => {
    const openFixtures: ComponentFixture<unknown>[] = [];

    async function create(): Promise<Harness> {
        const fixture = TestBed.createComponent(HostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        await Promise.resolve();
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('[contenteditable]') as HTMLElement;
        const editorCmp = fixture.debugElement.query(By.directive(RichTextEditorComponent))
            .componentInstance as RichTextEditorComponent;
        const directive = fixture.debugElement.query(By.directive(RichTextHistoryDirective))
            .injector.get(RichTextHistoryDirective);
        const panel = (directive as unknown as { panelRef: { instance: RichTextHistoryPanelComponent } })
            .panelRef.instance;
        return { fixture, editor, editorCmp, panel };
    }

    /** Push `text` as a discrete history snapshot. */
    function pushEntry(h: Harness, text: string): void {
        h.editorCmp.writeValue(text);
        h.fixture.detectChanges();
        (h.editorCmp as unknown as { pushHistory(): void }).pushHistory();
    }

    function historyLength(h: Harness): number {
        return (h.editorCmp as unknown as { history: unknown[] }).history.length;
    }

    /** Call a protected panel method by name. */
    function invoke(panel: RichTextHistoryPanelComponent, method: string, ...args: unknown[]): unknown {
        return (panel as unknown as Record<string, (...a: unknown[]) => unknown>)[method](...args);
    }

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
        document.querySelectorAll('[data-history-list]').forEach((el) => {
            if (el.parentElement === document.body) {
                el.remove();
            }
        });
        while (openFixtures.length > 0) {
            const fixture = openFixtures.pop()!;
            if (!fixture.componentRef.hostView.destroyed) {
                fixture.destroy();
            }
        }
    });

    it('removes the panel live when uiRteHistory flips to false and restores on re-enable', async () => {
        const fixture = TestBed.createComponent(ToggleHostCmp);
        openFixtures.push(fixture);
        fixture.detectChanges();
        await Promise.resolve();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('ui-rich-text-history-panel')).toBeTruthy();

        fixture.componentInstance.enabled.set(false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('ui-rich-text-history-panel')).toBeFalsy();

        fixture.componentInstance.enabled.set(true);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('ui-rich-text-history-panel')).toBeTruthy();
    });

    it('mounts the panel with a corner button into the editor container', async () => {
        const h = await create();
        expect(h.panel).toBeInstanceOf(RichTextHistoryPanelComponent);
        const button = h.fixture.nativeElement.querySelector('ui-rich-text-history-panel ui-button');
        expect(button).toBeTruthy();
    });

    it('restores an earlier revision and keeps forward entries for redo', async () => {
        const h = await create();
        pushEntry(h, 'one');
        pushEntry(h, 'two');
        pushEntry(h, 'three');
        const before = historyLength(h);
        expect(before).toBeGreaterThanOrEqual(4);

        const { row } = makeRow('dialog', 1);
        invoke(h.panel, 'onHistoryEntryKeydown', { key: 'Enter', currentTarget: row, preventDefault: vi.fn() }, 1);

        expect(h.editor.textContent).toContain('one');
        expect((h.editorCmp as unknown as { historyIndex: number }).historyIndex).toBe(1);
        expect(historyLength(h)).toBe(before);
        expect(h.fixture.componentInstance.restored()).toBe(1);
    });

    it('applies a revision on Space as well as Enter', async () => {
        const h = await create();
        pushEntry(h, 'one');
        pushEntry(h, 'two');
        const { row } = makeRow('dialog', 1);
        invoke(h.panel, 'onHistoryEntryKeydown', { key: ' ', currentTarget: row, preventDefault: vi.fn() }, 1);
        expect(h.editor.textContent).toContain('one');
    });

    it('flushes a pending debounced snapshot when the panel opens', async () => {
        vi.useFakeTimers();
        const h = await create();
        h.editor.textContent = 'draft';
        h.editor.dispatchEvent(new Event('input', { bubbles: true }));
        expect(historyLength(h)).toBe(1);

        invoke(h.panel, 'onHistoryPanelOpenChange', true);
        expect(historyLength(h)).toBe(2);
        expect(h.panel['historyPanelOpen']()).toBe(true);
        vi.useRealTimers();
    });

    it('keeps the popover open after a quick apply', async () => {
        const h = await create();
        pushEntry(h, 'one');
        pushEntry(h, 'two');
        invoke(h.panel, 'onHistoryPanelOpenChange', true);

        const { row } = makeRow('popover', 1);
        invoke(h.panel, 'onQuickApplyFromHistory', 1, { currentTarget: row });

        expect(h.panel['historyPanelOpen']()).toBe(true);
        expect(h.editor.textContent).toContain('one');
    });

    it('marks the applied entry via lastAppliedHistoryIndex', async () => {
        const h = await create();
        pushEntry(h, 'one');
        pushEntry(h, 'two');
        const { row } = makeRow('dialog', 1);
        invoke(h.panel, 'onHistoryEntryKeydown', { key: 'Enter', currentTarget: row, preventDefault: vi.fn() }, 1);
        expect(h.panel['lastAppliedHistoryIndex']()).toBe(1);
    });

    it('opens the browser dialog via the shortcut when the button is hidden', async () => {
        const h = await create();
        h.fixture.componentInstance.button.set(false);
        h.fixture.detectChanges();

        h.editorCmp.onKeydown(new KeyboardEvent('keydown', {
            key: 'h', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));

        expect(h.panel['historyBrowserOpen']()).toBe(true);
        expect(h.panel['historyPanelOpen']()).toBe(false);
    });

    it('opens the popover via the shortcut when the button is visible', async () => {
        const h = await create();
        h.editorCmp.onKeydown(new KeyboardEvent('keydown', {
            key: 'h', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(h.panel['historyPanelOpen']()).toBe(true);
        expect(h.panel['historyBrowserOpen']()).toBe(false);
    });

    it('honours a shortcut-binding override for the history action', async () => {
        const h = await create();
        const shortcuts = TestBed.inject(ShortcutBindingService);
        shortcuts.setShortcutOverride('rich-text.history', 'Ctrl+Shift+J');

        h.editorCmp.onKeydown(new KeyboardEvent('keydown', {
            key: 'h', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(h.panel['historyPanelOpen']()).toBe(false);

        h.editorCmp.onKeydown(new KeyboardEvent('keydown', {
            key: 'j', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(h.panel['historyPanelOpen']()).toBe(true);
        shortcuts.clearShortcutOverride('rich-text.history');
    });

    it('moves focus with arrow, Home and End keys within a history list', async () => {
        const h = await create();
        const list = document.createElement('div');
        list.dataset['historyList'] = 'dialog';
        const rows = [0, 1, 2].map((i) => {
            const row = document.createElement('div');
            row.dataset['historyEntryAction'] = 'true';
            row.dataset['historyEntryIndex'] = String(i);
            row.tabIndex = 0;
            list.appendChild(row);
            return row;
        });
        document.body.appendChild(list);

        rows[0].focus();
        invoke(h.panel, 'onHistoryEntryKeydown', { key: 'ArrowDown', currentTarget: rows[0], preventDefault: vi.fn() }, 0);
        expect(document.activeElement).toBe(rows[1]);

        invoke(h.panel, 'onHistoryEntryKeydown', { key: 'End', currentTarget: rows[1], preventDefault: vi.fn() }, 1);
        expect(document.activeElement).toBe(rows[2]);

        invoke(h.panel, 'onHistoryEntryKeydown', { key: 'Home', currentTarget: rows[2], preventDefault: vi.fn() }, 2);
        expect(document.activeElement).toBe(rows[0]);
        list.remove();
    });

    it('closes the popover and the browser on Escape from a row', async () => {
        const h = await create();
        const popover = makeRow('popover', 0);
        h.panel['historyPanelOpen'].set(true);
        invoke(h.panel, 'onHistoryEntryKeydown', { key: 'Escape', currentTarget: popover.row, preventDefault: vi.fn() }, 0);
        expect(h.panel['historyPanelOpen']()).toBe(false);

        const dialog = makeRow('dialog', 0);
        h.panel['historyBrowserOpen'].set(true);
        invoke(h.panel, 'onHistoryEntryKeydown', { key: 'Escape', currentTarget: dialog.row, preventDefault: vi.fn() }, 0);
        expect(h.panel['historyBrowserOpen']()).toBe(false);
    });

    it('exposes reconstructed html and markdown in the preview dialog', async () => {
        const h = await create();
        pushEntry(h, '<p>alpha</p>');
        pushEntry(h, '<p>beta</p>');
        const alphaIndex = h.editorCmp.historyEntries().findIndex((e) => e.preview.includes('alpha'));
        expect(alphaIndex).toBeGreaterThanOrEqual(0);
        invoke(h.panel, 'openHistoryPreview', alphaIndex, undefined);
        h.fixture.detectChanges();

        const selected = h.panel['selectedHistoryEntry']();
        expect(selected?.html).toContain('alpha');
        expect(selected?.markdown).toContain('alpha');
        expect(h.panel['historyPreviewOpen']()).toBe(true);
    });

    it('localizes the panel strings for Hebrew', async () => {
        const h = await create();
        h.fixture.componentInstance.locale.set('he');
        h.fixture.detectChanges();
        await h.fixture.whenStable();
        expect(h.panel.locale().button).toBe('היסטוריה ({count})');
        expect(h.panel.locale().restore).toBe('שחזור גרסה זו');
    });
});
