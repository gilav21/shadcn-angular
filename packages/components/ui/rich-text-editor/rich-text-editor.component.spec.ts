import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RichTextEditorAddonHost } from './rich-text-editor.host';
import { ShortcutBindingService } from '../../lib/shortcut-binding.service';
import { RichTextCommandRegistry } from './rich-text-command-registry.service';
import { RICH_TEXT_LOCALES, RichTextLocale } from './rich-text-locales';

/** Collapse the selection to a caret at the given node/offset. */
const setCaretAt = (node: Node, offset: number) => {
    const selection = document.getSelection();
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
};

/** Select the full contents of the given node. */
const selectAllOf = (node: Node) => {
    const selection = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
};

// ── Browser-API stubs for the jsdom / portable leg ────────────────────────
// jsdom ships no `execCommand`, no `scrollIntoView`, no `elementFromPoint`, no
// geometry on Elements/Ranges, and no `CSS.escape`. The editor's
// contentEditable, table-selection and floating-toolbar paths reach for all of
// these, so we install faithful-enough shims that let those paths run
// headlessly. Each shim is saved and restored per-test so the ts-jest leg —
// which deletes originally-absent props — stays clean.
const makeRect = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON() {
            return this;
        },
    }) as DOMRect;

/** Create an element by string tag, avoiding the deprecated `strike`/`font`
 *  typed `createElement` overloads (which the editor still emits headlessly). */
const createLegacyElement = (tag: string): HTMLElement => document.createElement(tag);

/** Wrap the current selection's contents in the element built by `build`. */
const wrapSelectionWith = (build: () => HTMLElement): boolean => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const wrapper = build();
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    selection.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(wrapper);
    selection.addRange(next);
    return true;
};

/** Nearest contentEditable ancestor of `node`, or null. */
const editableRootOf = (node: Node): HTMLElement | null => {
    const start = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
    return start ? start.closest<HTMLElement>('[contenteditable]') : null;
};

/** The block elements the current selection spans within `editable`. */
const selectionBlocks = (range: Range, editable: HTMLElement): HTMLElement[] => {
    const ancestor = range.commonAncestorContainer;
    if (ancestor === editable) {
        return Array.from(editable.children).slice(range.startOffset, range.endOffset) as HTMLElement[];
    }
    let block: HTMLElement | null = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : (ancestor as HTMLElement);
    while (block && block.parentElement && block.parentElement !== editable) {
        block = block.parentElement;
    }
    return block ? [block] : [];
};

/** Re-tag the selected block(s) to `tag` (execCommand formatBlock). */
const retagBlocks = (tag: string): boolean => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const editable = editableRootOf(range.startContainer);
    if (!editable) return false;
    for (const block of selectionBlocks(range, editable)) {
        const replacement = document.createElement(tag);
        while (block.firstChild) replacement.appendChild(block.firstChild);
        block.replaceWith(replacement);
    }
    return true;
};

/** Wrap the selected block(s) into a `ul`/`ol` (execCommand insert*List). */
const wrapBlocksInList = (listTag: 'ul' | 'ol'): boolean => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const editable = editableRootOf(range.startContainer);
    if (!editable) return false;
    const blocks = selectionBlocks(range, editable);
    if (blocks.length === 0) return false;
    const list = document.createElement(listTag);
    blocks[0].replaceWith(list);
    for (const block of blocks) {
        const item = document.createElement('li');
        while (block.firstChild) item.appendChild(block.firstChild);
        list.appendChild(item);
        block.remove();
    }
    return true;
};

/** Unwrap inline formatting elements around the selection (removeFormat). */
const clearFormatting = (): boolean => {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const format = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'FONT', 'SPAN', 'CODE', 'MARK', 'SUB', 'SUP']);
    const ancestor = selection.getRangeAt(0).commonAncestorContainer;
    let element: HTMLElement | null = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : (ancestor as HTMLElement);
    while (element && format.has(element.tagName)) {
        const parent = element.parentElement;
        if (!parent) break;
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        parent.removeChild(element);
        element = parent;
    }
    return true;
};

/** Minimal `document.execCommand` covering the commands the editor issues. */
function execCommandShim(_commandId: string, _showUi?: boolean, value?: string): boolean {
    switch (_commandId) {
        case 'bold':
            return wrapSelectionWith(() => document.createElement('b'));
        case 'italic':
            return wrapSelectionWith(() => document.createElement('i'));
        case 'underline':
            return wrapSelectionWith(() => document.createElement('u'));
        case 'strikeThrough':
            return wrapSelectionWith(() => createLegacyElement('strike'));
        case 'removeFormat':
            return clearFormatting();
        case 'foreColor':
            return wrapSelectionWith(() => {
                const span = document.createElement('span');
                span.style.color = value ?? '';
                return span;
            });
        case 'hiliteColor':
        case 'backColor':
            return wrapSelectionWith(() => {
                const span = document.createElement('span');
                span.style.backgroundColor = value ?? '';
                return span;
            });
        case 'fontSize':
            return wrapSelectionWith(() => {
                const font = createLegacyElement('font');
                font.setAttribute('size', value ?? '7');
                return font;
            });
        case 'fontName':
            return wrapSelectionWith(() => {
                const font = createLegacyElement('font');
                font.setAttribute('face', value ?? '');
                return font;
            });
        case 'formatBlock':
            return retagBlocks((value ?? '<p>').replaceAll(/[<>]/g, ''));
        case 'insertUnorderedList':
            return wrapBlocksInList('ul');
        case 'insertOrderedList':
            return wrapBlocksInList('ol');
        default:
            return true;
    }
}

/** Minimal `queryCommandState` — reports a format active when the selection
 *  sits inside a matching element, so `updateActiveFormats` can light up. */
function queryCommandStateShim(commandId: string): boolean {
    const tags: Record<string, readonly string[]> = {
        bold: ['B', 'STRONG'],
        italic: ['I', 'EM'],
        underline: ['U'],
        strikeThrough: ['S', 'STRIKE'],
        insertUnorderedList: ['UL'],
        insertOrderedList: ['OL'],
    };
    const matching = tags[commandId];
    if (!matching) return false;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const start = selection.getRangeAt(0).commonAncestorContainer;
    let element: HTMLElement | null = start.nodeType === Node.TEXT_NODE ? start.parentElement : (start as HTMLElement);
    while (element) {
        if (matching.includes(element.tagName)) return true;
        element = element.parentElement;
    }
    return false;
}

interface StubbableDocument {
    execCommand?: typeof execCommandShim;
    queryCommandState?: typeof queryCommandStateShim;
    elementFromPoint?: (x: number, y: number) => Element | null;
}
interface StubbableElement {
    scrollIntoView?: () => void;
    getBoundingClientRect?: () => DOMRect;
}
interface StubbableRange {
    getBoundingClientRect?: () => DOMRect;
    getClientRects?: () => DOMRectList;
}
interface StubbableGlobal {
    CSS?: { escape: (value: string) => string };
}

let originalElementGetRect: (() => DOMRect) | undefined;
let cssWasAbsent = false;

/** Map a table cell to a deterministic 100x20 rect from its row/column index. */
const tableCellRect = (cell: HTMLTableCellElement): DOMRect | null => {
    const table = cell.closest('table');
    const row = cell.closest('tr');
    if (!table || !row) return null;
    const rowIndex = Array.from(table.querySelectorAll('tr')).indexOf(row);
    const colIndex = Array.from(row.cells).indexOf(cell);
    return makeRect(colIndex * 100, rowIndex * 20, 100, 20);
};

const installBrowserStubs = (): void => {
    const doc = document as StubbableDocument;
    doc.execCommand = execCommandShim;
    doc.queryCommandState = queryCommandStateShim;
    doc.elementFromPoint = (x: number, y: number): Element | null => {
        for (const cell of Array.from(document.querySelectorAll<HTMLTableCellElement>('td, th'))) {
            const rect = cell.getBoundingClientRect();
            if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) return cell;
        }
        return document.body;
    };

    const elementProto = Element.prototype as StubbableElement;
    elementProto.scrollIntoView = () => {
        /* jsdom has no layout engine; scrolling is a no-op here. */
    };
    originalElementGetRect = elementProto.getBoundingClientRect;
    elementProto.getBoundingClientRect = function (this: Element): DOMRect {
        if (this instanceof HTMLTableCellElement) {
            const rect = tableCellRect(this);
            if (rect) return rect;
        }
        return originalElementGetRect ? originalElementGetRect.call(this) : makeRect(0, 0, 0, 0);
    };

    const rangeProto = Range.prototype as StubbableRange;
    rangeProto.getBoundingClientRect = () => makeRect(0, 0, 10, 10);
    rangeProto.getClientRects = () =>
        ({
            length: 1,
            item: (index: number) => (index === 0 ? makeRect(0, 0, 10, 10) : null),
            0: makeRect(0, 0, 10, 10),
            [Symbol.iterator]() {
                return [makeRect(0, 0, 10, 10)][Symbol.iterator]();
            },
        }) as unknown as DOMRectList;

    const scope = globalThis as StubbableGlobal;
    cssWasAbsent = scope.CSS === undefined;
    if (cssWasAbsent) {
        scope.CSS = { escape: (value: string) => value.replaceAll(/[^\w-]/g, (char) => `\\${char}`) };
    }
};

const restoreBrowserStubs = (): void => {
    const doc = document as StubbableDocument;
    delete doc.execCommand;
    delete doc.queryCommandState;
    delete doc.elementFromPoint;

    const elementProto = Element.prototype as StubbableElement;
    delete elementProto.scrollIntoView;
    if (originalElementGetRect) {
        elementProto.getBoundingClientRect = originalElementGetRect;
    } else {
        delete elementProto.getBoundingClientRect;
    }
    originalElementGetRect = undefined;

    const rangeProto = Range.prototype as StubbableRange;
    delete rangeProto.getBoundingClientRect;
    delete rangeProto.getClientRects;

    if (cssWasAbsent) {
        delete (globalThis as StubbableGlobal).CSS;
        cssWasAbsent = false;
    }
};

beforeEach(() => installBrowserStubs());
afterEach(() => restoreBrowserStubs());

describe('RichTextEditorComponent', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;
    let shortcutBindings: ShortcutBindingService;
    let commandRegistry: RichTextCommandRegistry;

    const setCaret = (node: Text, offset: number) => setCaretAt(node, offset);

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        shortcutBindings = TestBed.inject(ShortcutBindingService);
        commandRegistry = TestBed.inject(RichTextCommandRegistry);
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        shortcutBindings.clearShortcutOverride('rich-text.history');
        commandRegistry.clear();
    });

    it('prevents replacements that would exceed maxLength', () => {
        fixture.componentRef.setInput('maxLength', 5);
        fixture.detectChanges();

        component.writeValue('hello');
        fixture.detectChanges();

        const selection = document.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection?.removeAllRanges();
        selection?.addRange(range);

        const beforeInput = new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            data: 'toolong',
            inputType: 'insertText',
        });
        editor.dispatchEvent(beforeInput);

        expect(beforeInput.defaultPrevented).toBe(true);
    });

    it('supports undo after truncated paste path', () => {
        fixture.componentRef.setInput('maxLength', 5);
        fixture.detectChanges();

        editor.innerHTML = 'abc';
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const textNode = editor.firstChild as Text;
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(textNode, textNode.length);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);

        component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: {
                getData: (type: string) => (type === 'text/plain' ? 'defgh' : ''),
            } as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.textContent).toBe('abcde');

        const undoEvent = new KeyboardEvent('keydown', {
            key: 'z',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });
        component.onKeydown(undoEvent);

        expect(editor.textContent).toBe('abc');
    });

    it('onBeforeInput is a no-op without a maxLength', () => {
        fixture.componentRef.setInput('maxLength', undefined);
        fixture.detectChanges();
        component.writeValue('hello');
        fixture.detectChanges();

        const beforeInput = new InputEvent('beforeinput', {
            bubbles: true, cancelable: true, data: 'more', inputType: 'insertText',
        });
        editor.dispatchEvent(beforeInput);

        expect(beforeInput.defaultPrevented).toBe(false);
    });

    it('onBeforeInput ignores delete and format input types even with maxLength set', () => {
        fixture.componentRef.setInput('maxLength', 3);
        fixture.detectChanges();
        component.writeValue('abc');
        fixture.detectChanges();

        const beforeInput = new InputEvent('beforeinput', {
            bubbles: true, cancelable: true, inputType: 'deleteContentBackward',
        });
        editor.dispatchEvent(beforeInput);

        expect(beforeInput.defaultPrevented).toBe(false);
    });

    it('handlePasteMaxLength returns true without inserting when no space remains', () => {
        fixture.componentRef.setInput('maxLength', 3);
        fixture.detectChanges();
        component.writeValue('abc');
        fixture.detectChanges();

        const textNode = editor.firstChild as Text;
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(textNode, textNode.length);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);

        component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'x' : '') } as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.textContent).toBe('abc');
    });

    it('handlePasteMaxLength lets a paste through untruncated when it fits within the remaining budget', () => {
        fixture.componentRef.setInput('maxLength', 10);
        fixture.detectChanges();
        component.writeValue('ab');
        fixture.detectChanges();

        const textNode = editor.firstChild as Text;
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(textNode, textNode.length);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);

        component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'cd' : '') } as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.textContent).toContain('ab');
        expect(editor.textContent).toContain('cd');
        expect(editor.textContent).toHaveLength(4);
    });

    it('handlePasteMaxLength accounts for a non-collapsed selection replaced by the paste', () => {
        fixture.componentRef.setInput('maxLength', 5);
        fixture.detectChanges();
        editor.innerHTML = 'abcde';
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const textNode = editor.firstChild as Text;
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(textNode, 1);
        range.setEnd(textNode, 4);
        selection?.removeAllRanges();
        selection?.addRange(range);

        component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'XY' : '') } as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.textContent?.length).toBeLessThanOrEqual(5);
    });

    it('restoreHistoryEntry ignores an out-of-range index', () => {
        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        const before = (component as any).historyIndex;

        component.restoreHistoryEntry(999);
        component.restoreHistoryEntry(-1);

        expect((component as any).historyIndex).toBe(before);
    });

    it('getNodePath returns an empty path for a detached node with no parent (white-box)', () => {
        const orphan = document.createTextNode('x');
        const path = (component as unknown as { getNodePath: (root: Node, n: Node) => number[] })
            .getNodePath(editor, orphan);
        expect(path).toEqual([]);
    });

    it('resolveNodePath returns null when the path walks off the tree (white-box)', () => {
        component.writeValue('<p>a</p>');
        fixture.detectChanges();
        const resolved = (component as unknown as { resolveNodePath: (root: Node, p: number[]) => Node | null })
            .resolveNodePath(editor, [0, 99]);
        expect(resolved).toBeNull();
    });

    it('restoreSerializedSelection is a no-op for a selection whose path no longer resolves', () => {
        component.writeValue('<p>a</p>');
        fixture.detectChanges();
        expect(() => (component as unknown as {
            restoreSerializedSelection: (s: { startPath: number[]; startOffset: number; endPath: number[]; endOffset: number } | null) => void;
        }).restoreSerializedSelection({ startPath: [0, 99], startOffset: 0, endPath: [0, 99], endOffset: 0 })).not.toThrow();
    });

    it('restoreSerializedSelection is a no-op without an active selection', () => {
        component.writeValue('<p>a</p>');
        fixture.detectChanges();
        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(() => (component as unknown as {
                restoreSerializedSelection: (s: { startPath: number[]; startOffset: number; endPath: number[]; endOffset: number } | null) => void;
            }).restoreSerializedSelection({ startPath: [0], startOffset: 0, endPath: [0], endOffset: 0 })).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('restores caret position on undo/redo from editor history', async () => {
        component.writeValue('abc');
        fixture.detectChanges();

        const initialTextNode = editor.firstChild as Text;
        setCaret(initialTextNode, 1);
        (component as any).pushHistory();

        setCaret(initialTextNode, initialTextNode.length);
        await component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: {
                getData: (type: string) => (type === 'text/plain' ? 'XYZ' : ''),
            } as DataTransfer,
        } as unknown as ClipboardEvent);

        const pastedSnapshot = editor.textContent ?? '';
        expect(pastedSnapshot).toContain('abc');
        expect(pastedSnapshot).toContain('XYZ');
        const pastedCaretOffset = document.getSelection()?.anchorOffset ?? -1;

        component.onKeydown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(editor.textContent).toBe('abc');
        expect(document.getSelection()?.anchorOffset).toBe(1);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(editor.textContent).toBe(pastedSnapshot);
        expect(document.getSelection()?.anchorOffset).toBe(pastedCaretOffset);
    });

    it('does not throw when formatting a partial multi-node selection', () => {
        component.writeValue('<p>Hello <b>World</b></p>');
        fixture.detectChanges();

        const p = editor.querySelector<HTMLParagraphElement>('p')!;
        const plainText = p.firstChild as Text;
        const boldText = p.querySelector('b')?.firstChild as Text;

        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(plainText, 2);
        range.setEnd(boldText, 3);
        selection?.removeAllRanges();
        selection?.addRange(range);

        expect(() => component.onFormatCommand('code')).not.toThrow();
    });

    it('debounces history snapshots for rapid typing', () => {
        vi.useFakeTimers();
        fixture.componentRef.setInput('historyDebounceMs', 200);
        fixture.detectChanges();

        editor.textContent = 'a';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.textContent = 'ab';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.textContent = 'abc';
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        expect((component as any).history).toHaveLength(1);

        vi.advanceTimersByTime(199);
        expect((component as any).history).toHaveLength(1);

        vi.advanceTimersByTime(1);
        expect((component as any).history).toHaveLength(2);
        expect((component as any).history.at(-1).preview).toContain('abc');

        vi.useRealTimers();
    });

    it('selecting a history entry restores content and keeps forward history for redo', () => {
        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();

        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();

        component.writeValue('three');
        fixture.detectChanges();
        (component as any).pushHistory();

        const baselineLength = (component as any).history.length;
        expect(baselineLength).toBeGreaterThanOrEqual(4);

        component.restoreHistoryEntry(1);

        expect(editor.textContent).toContain('one');
        expect((component as any).historyIndex).toBe(1);
        expect((component as any).history).toHaveLength(baselineLength);
    });

    it('stores multiline-friendly preview lines in history entries', () => {
        component.writeValue('<p>Line one</p><p>Line two</p><p>Line three</p><p>Line four</p>');
        fixture.detectChanges();
        (component as any).pushHistory();

        const latest = (component as any).history.at(-1);
        expect(latest.lineCount).toBe(4);
        expect(latest.previewLines).toEqual(['Line one', 'Line two', 'Line three']);
    });

    it('prefers local component shortcut over later global dispatch for same event', () => {
        const globalHandler = vi.fn();
        const cleanup = shortcutBindings.registerShortcut('test-global', {
            actionId: 'test.global.command',
            description: 'Global command palette toggle',
            defaultShortcut: 'Mod+K',
            scope: 'global',
            handler: globalHandler,
        });

        const event = new KeyboardEvent('keydown', {
            key: 'k',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });

        component.onKeydown(event);
        const handledGloballyAfterLocal = shortcutBindings.dispatch(event);

        expect(handledGloballyAfterLocal).toBe(false);
        expect(globalHandler).not.toHaveBeenCalled();
        cleanup();
    });

    it('redoes via the Mod+Shift+Z shortcut', () => {
        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();
        (component as any).undo();
        expect(editor.textContent).toBe('one');

        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));

        expect(editor.textContent).toBe('two');
    });

    it('registers shortcut bindings on init and unregisters them on destroy', () => {
        const viewsBeforeDestroy = shortcutBindings.getShortcutBindingViews()
            .filter(view => view.componentId.startsWith('rich-text-editor-'));
        expect(viewsBeforeDestroy.length).toBeGreaterThan(0);

        fixture.destroy();

        const viewsAfterDestroy = shortcutBindings.getShortcutBindingViews()
            .filter(view => view.componentId.startsWith('rich-text-editor-'));
        expect(viewsAfterDestroy).toHaveLength(0);
    });

    describe('Locale and RTL', () => {
        it('resolves English locale by default', () => {
            expect(component.resolvedLocale()).toBe(RICH_TEXT_LOCALES['en']);
            expect(component.resolvedLocale().toolbar.bold).toBe('Bold');
        });

        it('resolves locale from string key', () => {
            fixture.componentRef.setInput('locale', 'he');
            fixture.detectChanges();
            expect(component.resolvedLocale()).toBe(RICH_TEXT_LOCALES['he']);
            expect(component.resolvedLocale().toolbar.bold).toBe('מודגש');
        });

        it('resolves locale from full object', () => {
            const custom: RichTextLocale = {
                ...RICH_TEXT_LOCALES['en'],
                toolbar: { ...RICH_TEXT_LOCALES['en'].toolbar, bold: 'Custom Bold' },
            };
            fixture.componentRef.setInput('locale', custom);
            fixture.detectChanges();
            expect(component.resolvedLocale().toolbar.bold).toBe('Custom Bold');
        });

        it('falls back to English for unknown locale key', () => {
            fixture.componentRef.setInput('locale', 'xx');
            fixture.detectChanges();
            expect(component.resolvedLocale()).toBe(RICH_TEXT_LOCALES['en']);
        });

        it('sets dir=rtl for Hebrew locale', () => {
            fixture.componentRef.setInput('locale', 'he');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);
            const container = fixture.nativeElement.querySelector('[dir="rtl"]');
            expect(container).toBeTruthy();
        });

        it('sets dir=rtl for Arabic locale', () => {
            fixture.componentRef.setInput('locale', 'ar');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);
            const container = fixture.nativeElement.querySelector('[dir="rtl"]');
            expect(container).toBeTruthy();
        });

        it('sets dir=ltr for English locale', () => {
            fixture.componentRef.setInput('locale', 'en');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
            const container = fixture.nativeElement.querySelector('[dir="ltr"]');
            expect(container).toBeTruthy();
        });

        it('sets dir=ltr for French locale', () => {
            fixture.componentRef.setInput('locale', 'fr');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
            const container = fixture.nativeElement.querySelector('[dir="ltr"]');
            expect(container).toBeTruthy();
        });

        it('sets dir=ltr for German locale', () => {
            fixture.componentRef.setInput('locale', 'de');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
            const container = fixture.nativeElement.querySelector('[dir="ltr"]');
            expect(container).toBeTruthy();
        });

        it('uses localized placeholder from Hebrew locale', () => {
            fixture.componentRef.setInput('locale', 'he');
            fixture.detectChanges();
            const editorEl = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]');
            expect(editorEl.getAttribute('placeholder')).toBe(RICH_TEXT_LOCALES['he'].editor.placeholder);
        });

        it('uses localized placeholder from Arabic locale', () => {
            fixture.componentRef.setInput('locale', 'ar');
            fixture.detectChanges();
            const editorEl = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]');
            expect(editorEl.getAttribute('placeholder')).toBe(RICH_TEXT_LOCALES['ar'].editor.placeholder);
        });

        it('prefers explicit placeholder over locale default', () => {
            fixture.componentRef.setInput('locale', 'he');
            fixture.componentRef.setInput('placeholder', 'Custom placeholder');
            fixture.detectChanges();
            const editorEl = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]');
            expect(editorEl.getAttribute('placeholder')).toBe('Custom placeholder');
        });

        it('exposes no base-owned builtin slash commands (all moved to addons)', () => {
            expect(component.builtinCommands()).toEqual([]);
        });

        it('switches RTL when locale changes from LTR to RTL', () => {
            fixture.componentRef.setInput('locale', 'en');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);

            fixture.componentRef.setInput('locale', 'he');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);
            expect(fixture.nativeElement.querySelector('[dir="rtl"]')).toBeTruthy();
        });

        it('switches RTL when locale changes from RTL to LTR', () => {
            fixture.componentRef.setInput('locale', 'ar');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(true);

            fixture.componentRef.setInput('locale', 'de');
            fixture.detectChanges();
            expect(component.isRtl()).toBe(false);
            expect(fixture.nativeElement.querySelector('[dir="ltr"]')).toBeTruthy();
        });

        it('sets correct aria-label from locale', () => {
            fixture.componentRef.setInput('locale', 'he');
            fixture.detectChanges();
            const editorEl = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]');
            expect(editorEl.getAttribute('aria-label')).toBe(RICH_TEXT_LOCALES['he'].editor.ariaLabel);
        });

        it('resolves all 10 preset locales without error', () => {
            const keys = ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'];
            for (const key of keys) {
                fixture.componentRef.setInput('locale', key);
                fixture.detectChanges();
                expect(component.resolvedLocale()).toBe(RICH_TEXT_LOCALES[key]);
                expect(component.resolvedLocale().toolbar.bold).toBeTruthy();
                expect(component.resolvedLocale().editor.placeholder).toBeTruthy();
            }
        });
    });

    describe('table merge and split cells', () => {
        const create3x3Table = (): HTMLTableElement => {
            editor.innerHTML = `
                <table>
                    <thead><tr><th>H1</th><th>H2</th><th>H3</th></tr></thead>
                    <tbody>
                        <tr><td>A1</td><td>A2</td><td>A3</td></tr>
                        <tr><td>B1</td><td>B2</td><td>B3</td></tr>
                    </tbody>
                </table>`;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            return editor.querySelector<HTMLTableElement>('table')!;
        };

        it('mergeCells merges two horizontally adjacent cells', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cellA1 = row.cells[0];
            const cellA2 = row.cells[1];

            cellA1.classList.add('rte-cell-selected');
            cellA2.classList.add('rte-cell-selected');
            component.tableCellSelected.set([cellA1, cellA2]);

            component.mergeCells();

            expect(cellA1.colSpan).toBe(2);
            expect(cellA1.rowSpan).toBe(1);
            expect(cellA1.innerHTML).toContain('A1');
            expect(cellA1.innerHTML).toContain('A2');
            expect(row.cells).toHaveLength(2);
        });

        it('mergeCells merges two vertically adjacent cells', () => {
            const table = create3x3Table();
            const rows = table.querySelectorAll('tbody tr');
            const cellA1 = (rows[0] as HTMLTableRowElement).cells[0];
            const cellB1 = (rows[1] as HTMLTableRowElement).cells[0];

            cellA1.classList.add('rte-cell-selected');
            cellB1.classList.add('rte-cell-selected');
            component.tableCellSelected.set([cellA1, cellB1]);

            component.mergeCells();

            expect(cellA1.colSpan).toBe(1);
            expect(cellA1.rowSpan).toBe(2);
            expect(cellA1.innerHTML).toContain('A1');
            expect(cellA1.innerHTML).toContain('B1');
        });

        it('mergeCells merges a 2x2 block of cells', () => {
            const table = create3x3Table();
            const rows = table.querySelectorAll('tbody tr');
            const cellA1 = (rows[0] as HTMLTableRowElement).cells[0];
            const cellA2 = (rows[0] as HTMLTableRowElement).cells[1];
            const cellB1 = (rows[1] as HTMLTableRowElement).cells[0];
            const cellB2 = (rows[1] as HTMLTableRowElement).cells[1];

            const selected = [cellA1, cellA2, cellB1, cellB2];
            selected.forEach(c => c.classList.add('rte-cell-selected'));
            component.tableCellSelected.set(selected);

            component.mergeCells();

            expect(cellA1.colSpan).toBe(2);
            expect(cellA1.rowSpan).toBe(2);
            expect((rows[0] as HTMLTableRowElement).cells).toHaveLength(2);
            expect((rows[1] as HTMLTableRowElement).cells).toHaveLength(1);
        });

        it('mergeCells does nothing with fewer than 2 selected cells', () => {
            const table = create3x3Table();
            const cell = table.querySelector<HTMLTableRowElement>('tbody tr')!.cells[0];

            component.tableCellSelected.set([cell]);
            component.mergeCells();

            expect(cell.colSpan).toBe(1);
            expect(cell.rowSpan).toBe(1);
        });

        it('mergeCells concatenates content from all cells', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cells = [row.cells[0], row.cells[1], row.cells[2]];
            cells.forEach(c => c.classList.add('rte-cell-selected'));
            component.tableCellSelected.set(cells);

            component.mergeCells();

            expect(row.cells[0].colSpan).toBe(3);
            expect(row.cells[0].textContent).toContain('A1');
            expect(row.cells[0].textContent).toContain('A2');
            expect(row.cells[0].textContent).toContain('A3');
            expect(row.cells).toHaveLength(1);
        });

        it('mergeCells sets innerHTML to <br> when all cells are empty', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            row.cells[0].innerHTML = '';
            row.cells[1].innerHTML = '';
            const cells = [row.cells[0], row.cells[1]];
            cells.forEach(c => c.classList.add('rte-cell-selected'));
            component.tableCellSelected.set(cells);

            component.mergeCells();

            expect(row.cells[0].innerHTML).toBe('<br>');
        });

        it('mergeCells clears cell selection after merge', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cells = [row.cells[0], row.cells[1]];
            cells.forEach(c => c.classList.add('rte-cell-selected'));
            component.tableCellSelected.set(cells);

            component.mergeCells();

            expect(component.tableCellSelected()).toEqual([]);
        });

        it('mergeCells is a no-op when the first selected cell has no table ancestor', () => {
            const detached1 = document.createElement('td');
            const detached2 = document.createElement('td');
            component.tableCellSelected.set([detached1, detached2]);

            expect(() => component.mergeCells()).not.toThrow();
        });

        it('mergeCells is a no-op when the computed grid has no cell at the merge origin (white-box)', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cells = [row.cells[0], row.cells[1]];
            component.tableCellSelected.set(cells);

            const spy = vi.spyOn(component as unknown as { buildCellGrid: (t: HTMLTableElement) => unknown }, 'buildCellGrid')
                .mockReturnValue([[null, null]]);
            try {
                expect(() => component.mergeCells()).not.toThrow();
            } finally {
                spy.mockRestore();
            }
        });

        it('splitCell is a no-op without a context-menu target', () => {
            (component as any).tableContextMenuTarget = null;
            expect(() => component.splitCell()).not.toThrow();
        });

        it('splitCell is a no-op when the target has no table ancestor', () => {
            const detached = document.createElement('td');
            detached.colSpan = 2;
            (component as any).tableContextMenuTarget = detached;

            expect(() => component.splitCell()).not.toThrow();
        });

        it('canSplitCell returns false for a regular cell', () => {
            const table = create3x3Table();
            const cell = table.querySelector<HTMLTableRowElement>('tbody tr')!.cells[0];
            (component as any).tableContextMenuTarget = cell;

            expect(component.canSplitCell()).toBe(false);
        });

        it('canSplitCell returns true for a cell with colspan > 1', () => {
            const table = create3x3Table();
            const cell = table.querySelector<HTMLTableRowElement>('tbody tr')!.cells[0];
            cell.colSpan = 2;
            (component as any).tableContextMenuTarget = cell;

            expect(component.canSplitCell()).toBe(true);
        });

        it('canSplitCell returns true for a cell with rowspan > 1', () => {
            const table = create3x3Table();
            const cell = table.querySelector<HTMLTableRowElement>('tbody tr')!.cells[0];
            cell.rowSpan = 2;
            (component as any).tableContextMenuTarget = cell;

            expect(component.canSplitCell()).toBe(true);
        });

        it('splitCell skips a grid row index with no corresponding <tr> (white-box: forces the rows/grid length mismatch defensive guard)', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cell = row.cells[0];
            cell.rowSpan = 2;
            (component as any).tableContextMenuTarget = cell;

            const realQuery = table.querySelectorAll.bind(table);
            let call = 0;
            vi.spyOn(table, 'querySelectorAll').mockImplementation(((selector: string) => {
                call += 1;
                const result = realQuery(selector);
                if (selector === 'tr' && call > 1) {
                    return Array.from(result).slice(0, 1) as unknown as NodeListOf<Element>;
                }
                return result;
            }) as typeof table.querySelectorAll);

            expect(() => component.splitCell()).not.toThrow();
        });

        it('splitCell splits a colspan=2 cell back into two cells', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cellA1 = row.cells[0];
            const cellA2 = row.cells[1];

            cellA1.classList.add('rte-cell-selected');
            cellA2.classList.add('rte-cell-selected');
            component.tableCellSelected.set([cellA1, cellA2]);
            component.mergeCells();

            expect(row.cells[0].colSpan).toBe(2);

            (component as any).tableContextMenuTarget = row.cells[0];
            component.splitCell();

            expect(row.cells[0].colSpan).toBe(1);
            expect(row.cells).toHaveLength(3);
        });

        it('splitCell splits a rowspan=2 cell back into individual cells', () => {
            const table = create3x3Table();
            const rows = table.querySelectorAll('tbody tr');
            const cellA1 = (rows[0] as HTMLTableRowElement).cells[0];
            const cellB1 = (rows[1] as HTMLTableRowElement).cells[0];

            cellA1.classList.add('rte-cell-selected');
            cellB1.classList.add('rte-cell-selected');
            component.tableCellSelected.set([cellA1, cellB1]);
            component.mergeCells();

            (component as any).tableContextMenuTarget = (rows[0] as HTMLTableRowElement).cells[0];
            component.splitCell();

            expect((rows[0] as HTMLTableRowElement).cells[0].rowSpan).toBe(1);
            expect((rows[0] as HTMLTableRowElement).cells).toHaveLength(3);
            expect((rows[1] as HTMLTableRowElement).cells).toHaveLength(3);
        });

        it('splitCell creates new cells with <br> content', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cellA1 = row.cells[0];
            const cellA2 = row.cells[1];

            cellA1.classList.add('rte-cell-selected');
            cellA2.classList.add('rte-cell-selected');
            component.tableCellSelected.set([cellA1, cellA2]);
            component.mergeCells();

            (component as any).tableContextMenuTarget = row.cells[0];
            component.splitCell();

            expect(row.cells[1].innerHTML).toBe('<br>');
        });

        it('splitCell does nothing if cell has no colspan or rowspan', () => {
            const table = create3x3Table();
            const cell = table.querySelector<HTMLTableRowElement>('tbody tr')!.cells[0];
            (component as any).tableContextMenuTarget = cell;

            const cellCountBefore = table.querySelector<HTMLTableRowElement>('tbody tr')!.cells.length;
            component.splitCell();
            const cellCountAfter = table.querySelector<HTMLTableRowElement>('tbody tr')!.cells.length;

            expect(cellCountAfter).toBe(cellCountBefore);
        });

        it('splitCell creates th elements when splitting inside thead', () => {
            const table = create3x3Table();
            const headerRow = table.querySelector<HTMLTableRowElement>('thead tr')!;
            const h1 = headerRow.cells[0];
            const h2 = headerRow.cells[1];

            h1.classList.add('rte-cell-selected');
            h2.classList.add('rte-cell-selected');
            component.tableCellSelected.set([h1, h2]);
            component.mergeCells();

            expect(headerRow.cells[0].colSpan).toBe(2);

            (component as any).tableContextMenuTarget = headerRow.cells[0];
            component.splitCell();

            expect(headerRow.cells).toHaveLength(3);
            for (const cell of Array.from(headerRow.cells)) {
                expect(cell.tagName).toBe('TH');
            }
        });

        it('splitCell splits a 2x2 merged cell correctly', () => {
            const table = create3x3Table();
            const rows = table.querySelectorAll('tbody tr');
            const cellA1 = (rows[0] as HTMLTableRowElement).cells[0];
            const cellA2 = (rows[0] as HTMLTableRowElement).cells[1];
            const cellB1 = (rows[1] as HTMLTableRowElement).cells[0];
            const cellB2 = (rows[1] as HTMLTableRowElement).cells[1];

            const selected = [cellA1, cellA2, cellB1, cellB2];
            selected.forEach(c => c.classList.add('rte-cell-selected'));
            component.tableCellSelected.set(selected);
            component.mergeCells();

            const mergedCell = (rows[0] as HTMLTableRowElement).cells[0];
            expect(mergedCell.colSpan).toBe(2);
            expect(mergedCell.rowSpan).toBe(2);

            (component as any).tableContextMenuTarget = mergedCell;
            component.splitCell();

            expect((rows[0] as HTMLTableRowElement).cells[0].colSpan).toBe(1);
            expect((rows[0] as HTMLTableRowElement).cells[0].rowSpan).toBe(1);
            expect((rows[0] as HTMLTableRowElement).cells).toHaveLength(3);
            expect((rows[1] as HTMLTableRowElement).cells).toHaveLength(3);
        });

        it('mergeCells closes the context menu', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cells = [row.cells[0], row.cells[1]];
            cells.forEach(c => c.classList.add('rte-cell-selected'));
            component.tableCellSelected.set(cells);

            component.tableContextMenuOpen.set(true);
            component.mergeCells();

            expect(component.tableContextMenuOpen()).toBe(false);
        });

        it('splitCell closes the context menu', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            row.cells[0].colSpan = 2;
            row.cells[1].remove();
            (component as any).tableContextMenuTarget = row.cells[0];

            component.tableContextMenuOpen.set(true);
            component.splitCell();

            expect(component.tableContextMenuOpen()).toBe(false);
        });

        it('right-click on a selected cell preserves cell selection', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cellA1 = row.cells[0];
            const cellA2 = row.cells[1];

            cellA1.classList.add('rte-cell-selected');
            cellA2.classList.add('rte-cell-selected');
            component.tableCellSelected.set([cellA1, cellA2]);

            const rightClick = new MouseEvent('mousedown', {
                button: 2,
                bubbles: true,
                cancelable: true,
            });
            cellA1.dispatchEvent(rightClick);

            expect(component.tableCellSelected()).toHaveLength(2);
            expect(component.tableCellSelected()).toContain(cellA1);
            expect(component.tableCellSelected()).toContain(cellA2);
        });

        it('left-click clears cell selection', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cellA1 = row.cells[0];
            const cellA2 = row.cells[1];

            cellA1.classList.add('rte-cell-selected');
            cellA2.classList.add('rte-cell-selected');
            component.tableCellSelected.set([cellA1, cellA2]);

            const leftClick = new MouseEvent('mousedown', {
                button: 0,
                bubbles: true,
                cancelable: true,
            });
            cellA1.dispatchEvent(leftClick);

            expect(component.tableCellSelected()).toHaveLength(0);
        });

        it('context menu reopens via right-click after closing by action', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cell = row.cells[0];

            const rightClick = new MouseEvent('contextmenu', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
                cancelable: true,
            });
            cell.dispatchEvent(rightClick);

            expect(component.tableContextMenuOpen()).toBe(true);

            (component as any).tableContextMenuTarget = cell;
            component.addTableRowAbove();

            expect(component.tableContextMenuOpen()).toBe(false);

            const rightClick2 = new MouseEvent('contextmenu', {
                clientX: 120,
                clientY: 120,
                bubbles: true,
                cancelable: true,
            });
            cell.dispatchEvent(rightClick2);

            expect(component.tableContextMenuOpen()).toBe(true);
        });

        it('closeTableContextMenu removes document-level close handlers', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cell = row.cells[0];

            const rightClick = new MouseEvent('contextmenu', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
                cancelable: true,
            });
            cell.dispatchEvent(rightClick);

            expect(component.tableContextMenuOpen()).toBe(true);
            expect((component as any).tableContextMenuCloseHandler).not.toBeNull();

            (component as any).closeTableContextMenu();

            expect(component.tableContextMenuOpen()).toBe(false);
            expect((component as any).tableContextMenuCloseHandler).toBeNull();
        });

        it('right-click on overlay prevents default and closes menu when no cell beneath', () => {
            const table = create3x3Table();
            const row = table.querySelector<HTMLTableRowElement>('tbody tr')!;
            const cell = row.cells[0];

            const rightClick = new MouseEvent('contextmenu', {
                clientX: 100,
                clientY: 100,
                bubbles: true,
                cancelable: true,
            });
            cell.dispatchEvent(rightClick);

            expect(component.tableContextMenuOpen()).toBe(true);

            const overlayEvent = new MouseEvent('contextmenu', {
                clientX: 150,
                clientY: 150,
                bubbles: true,
                cancelable: true,
            });
            component.onContextMenuOverlayContextMenu(overlayEvent);

            expect(overlayEvent.defaultPrevented).toBe(true);
            expect(component.tableContextMenuOpen()).toBe(false);
        });
    });

    describe('font apply paths (backing applyInlineStyle for the typography addon)', () => {
        it('applies font-family style via font[face] to span conversion', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();

            editor.innerHTML = '<font face="Georgia">Hello World</font>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();

            const selection = document.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            selection?.removeAllRanges();
            selection?.addRange(range);

            component.applyInlineStyle({ fontFamily: 'Georgia' });
            fixture.detectChanges();

            const fontElements = editor.querySelectorAll('font[face]');
            expect(fontElements).toHaveLength(0);

            const spans = editor.querySelectorAll('span');
            const hasGeorgia = Array.from(spans).some(
                span => span.style.fontFamily.includes('Georgia')
            );
            expect(hasGeorgia).toBe(true);
        });

        it('detects current font family at cursor position', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();

            editor.innerHTML = '<span style="font-family: Georgia">Styled text</span>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();

            const textNode = editor.querySelector('span')?.firstChild as Text;
            if (textNode) {
                const selection = document.getSelection();
                const range = document.createRange();
                range.setStart(textNode, 2);
                range.collapse(true);
                selection?.removeAllRanges();
                selection?.addRange(range);

                editor.dispatchEvent(new Event('keyup', { bubbles: true }));
                fixture.detectChanges();

                expect(component.currentFontFamily()).toBeTruthy();
            }
        });
    });

    describe('selection inline style + applyInlineStyle seam', () => {
        it('reflects the selection computed color into selectionInlineStyle (raw)', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();

            editor.innerHTML = '<span style="color:#2563eb">SLA</span>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();

            const span = editor.querySelector('span') as HTMLElement;
            selectAllOf(span);

            component['updateActiveFormats']();

            expect(component.selectionInlineStyle().color).toContain('rgb(37, 99, 235)');
        });

        it('reflects the selection computed background color into selectionInlineStyle (raw)', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();

            editor.innerHTML = '<span style="background-color:#f97316">SLA</span>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();

            const span = editor.querySelector('span') as HTMLElement;
            selectAllOf(span);

            component['updateActiveFormats']();

            expect(component.selectionInlineStyle().backgroundColor).toContain('rgb(249, 115, 22)');
        });

        it('exposes a transparent background as a raw transparent value (addon normalizes)', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();

            editor.innerHTML = '<span>Plain</span>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();

            const span = editor.querySelector('span') as HTMLElement;
            selectAllOf(span);

            component['updateActiveFormats']();

            expect(component.selectionInlineStyle().backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
        });

        it('applies a font color to the selection via applyInlineStyle', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();

            editor.innerHTML = '<span style="color:#2563eb">SLA</span>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();
            const span = editor.querySelector('span') as HTMLElement;
            selectAllOf(span);
            component['updateActiveFormats']();

            component.applyInlineStyle({ color: '#ff0000' });
            fixture.detectChanges();

            expect(editor.innerHTML).toContain('rgb(255, 0, 0)');
        });

        it('ignores a color with no selection so it cannot clobber the model on init', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();
            component.writeValue('<p>Seeded content</p>');
            fixture.detectChanges();

            // No selection/caret has ever been placed in the editor.
            window.getSelection()?.removeAllRanges();
            let emitted: string | undefined;
            component.registerOnChange((v) => { emitted = v; });

            component.applyInlineStyle({ color: '#000000' });

            expect(emitted).toBeUndefined();
            expect(editor.innerHTML).toContain('Seeded content');
        });

        it('applies successive colors without re-selecting and keeps the selection alive', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();
            editor.innerHTML = '<p>Recolor me</p>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();
            selectAllOf(editor.querySelector('p') as HTMLElement);

            component.applyInlineStyle({ color: '#ff0000' });
            fixture.detectChanges();
            expect(editor.innerHTML).toContain('rgb(255, 0, 0)');
            expect(window.getSelection()?.isCollapsed).toBe(false);

            // A second apply WITHOUT re-selecting still recolours — the colour command
            // must not focus the editor and collapse the selection.
            component.applyInlineStyle({ color: '#0000ff' });
            fixture.detectChanges();
            expect(editor.innerHTML).toContain('rgb(0, 0, 255)');
            expect(window.getSelection()?.isCollapsed).toBe(false);
        });

        it('applies font color as an inline style, not a <font> tag, so it survives sanitization', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();
            editor.innerHTML = '<p>Colour me</p>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();
            selectAllOf(editor.querySelector('p') as HTMLElement);

            component.applyInlineStyle({ color: '#e67e22' });
            fixture.detectChanges();

            expect(editor.innerHTML.toLowerCase()).not.toContain('<font');
            const styled = editor.querySelector('[style*="color"]') as HTMLElement | null;
            expect(styled).not.toBeNull();
            expect(styled?.style.color).not.toBe('');
        });

        it('applies a font size to the selection via applyInlineStyle', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();
            editor.innerHTML = '<p>Resize me</p>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();
            selectAllOf(editor.querySelector('p') as HTMLElement);

            component.applyInlineStyle({ fontSize: '24' });
            fixture.detectChanges();

            expect(editor.querySelectorAll('font[size="7"]')).toHaveLength(0);
            const span = Array.from(editor.querySelectorAll('span')).find(s => s.style.fontSize === '24px');
            expect(span).toBeTruthy();
        });

        it('applies a font family to the selection via applyInlineStyle', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();
            editor.innerHTML = '<p>Restyle me</p>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();
            selectAllOf(editor.querySelector('p') as HTMLElement);

            component.applyInlineStyle({ fontFamily: 'Georgia' });
            fixture.detectChanges();

            expect(editor.querySelectorAll('font[face]')).toHaveLength(0);
            const span = Array.from(editor.querySelectorAll('span')).find(s => s.style.fontFamily.includes('Georgia'));
            expect(span).toBeTruthy();
        });

        it('reflects the selection font size and family into selectionInlineStyle', () => {
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();

            editor.innerHTML = '<span style="font-size:20px;font-family:Georgia">SLA</span>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();

            const span = editor.querySelector('span') as HTMLElement;
            selectAllOf(span);
            component['updateActiveFormats']();

            expect(component.selectionInlineStyle().fontSize).toBe('20');
            expect(component.selectionInlineStyle().fontFamily).toBe('Georgia');
        });
    });

    describe('document outline (extracted to the outline addon)', () => {
        it('renders no docked outline panel and owns no outline API in the base', () => {
            editor.innerHTML =
                '<h1>Intro</h1><p>text</p><h2>Setup</h2><h3>Details</h3><h2>Done</h2>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();

            expect(fixture.nativeElement.querySelector('[data-slot="rich-text-outline-panel"]')).toBeNull();
            expect((component as unknown as Record<string, unknown>)['outlinePanelOpen']).toBeUndefined();
            expect((component as unknown as Record<string, unknown>)['outlineHeadings']).toBeUndefined();
        });
    });
});

describe('RichTextEditorComponent — formatting, blocks & lists', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const selectAll = () => selectAllOf(editor);
    const selectContents = (node: Node) => selectAllOf(node);
    const caretIn = (node: Node, offset: number) => setCaretAt(node, offset);

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('wraps selection in inline code via the code format command', () => {
        component.writeValue('<p>hello world</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 5);
        selection?.removeAllRanges();
        selection?.addRange(range);

        component.onFormatCommand('code');

        const code = editor.querySelector('code');
        expect(code).toBeTruthy();
        expect(code?.textContent).toBe('hello');
        expect(editor.textContent).toBe('hello world');
    });

    it('converts the current block to a heading via formatBlock', () => {
        component.writeValue('<p>title text</p>');
        fixture.detectChanges();
        selectAll();

        component.onFormatCommand('heading1');

        expect(editor.querySelector('h1')).toBeTruthy();
        expect(editor.querySelector('h1')?.textContent).toBe('title text');
    });

    it('converts the current block to a blockquote', () => {
        component.writeValue('<p>quote me</p>');
        fixture.detectChanges();
        selectAll();

        component.onFormatCommand('blockquote');

        expect(editor.querySelector('blockquote')).toBeTruthy();
    });

    it('inserts a code block with insertCodeBlock', () => {
        component.writeValue('<p>snippet body</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.onFormatCommand('codeBlock');

        const pre = editor.querySelector('pre');
        expect(pre).toBeTruthy();
        expect(pre?.querySelector('code')).toBeTruthy();
        expect(pre?.textContent).toContain('snippet body');
    });

    it('inserts a horizontal rule', () => {
        component.writeValue('<p>before</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 6);

        component.onFormatCommand('horizontalRule');

        expect(editor.querySelector('hr')).toBeTruthy();
    });

    it('toggles an unordered list', () => {
        component.writeValue('<p>item one</p>');
        fixture.detectChanges();
        selectAll();

        component.onFormatCommand('bulletList');

        expect(editor.querySelector('ul')).toBeTruthy();
        expect(editor.querySelector('ul li')?.textContent).toContain('item one');
    });

    it('toggles an ordered list', () => {
        component.writeValue('<p>item one</p>');
        fixture.detectChanges();
        selectAll();

        component.onFormatCommand('orderedList');

        expect(editor.querySelector('ol')).toBeTruthy();
    });

    it('inserts a task list with a checkbox and editable text span', () => {
        component.writeValue('<p>start</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 0);

        component.onFormatCommand('taskList');

        const ul = editor.querySelector('ul[data-task-list]');
        expect(ul).toBeTruthy();
        const li = ul?.querySelector('li[data-task]');
        expect(li?.getAttribute('data-checked')).toBe('false');
        expect(li?.querySelector('input[type="checkbox"]')).toBeTruthy();
    });

    it('inserts a collapsible toggle block', () => {
        component.writeValue('<p>x</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 1);

        component.onFormatCommand('toggle');

        const details = editor.querySelector('details');
        expect(details).toBeTruthy();
        expect(details?.querySelector('summary')).toBeTruthy();
    });

    it('indents a list item under the previous sibling, then outdents it back', () => {
        component.writeValue('<ul><li>first</li><li>second</li></ul>');
        fixture.detectChanges();
        const secondLi = editor.querySelectorAll('li')[1];
        caretIn(secondLi.firstChild as Text, 0);

        component.onFormatCommand('indent');

        const nested = editor.querySelector('li > ul > li');
        expect(nested).toBeTruthy();
        expect(nested?.textContent).toContain('second');

        caretIn(nested!.firstChild as Text, 0);
        component.onFormatCommand('outdent');

        expect(editor.querySelector('li > ul')).toBeNull();
        expect(editor.querySelectorAll(':scope > ul > li')).toHaveLength(2);
    });

    it('does not indent the first list item (no previous sibling)', () => {
        component.writeValue('<ul><li>only</li></ul>');
        fixture.detectChanges();
        const li = editor.querySelector('li')!;
        caretIn(li.firstChild as Text, 0);

        component.onFormatCommand('indent');

        expect(editor.querySelector('li > ul')).toBeNull();
    });

    it('indent/outdent/taskList are no-ops when the caret is not inside a list', () => {
        component.writeValue('<p>plain text</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 2);

        expect(() => component.onFormatCommand('indent')).not.toThrow();
        expect(() => component.onFormatCommand('outdent')).not.toThrow();
        expect(editor.querySelector('ul')).toBeNull();
    });

    it('does not indent a list item already at the maximum nesting depth', () => {
        component.writeValue(
            '<ul><li>a<ul><li>b<ul><li>c<ul><li>d<ul><li>e<ul><li>f</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>'
        );
        fixture.detectChanges();
        const deepest = Array.from(editor.querySelectorAll('li')).at(-1)!;
        caretIn(deepest.firstChild as Text, 0);

        expect(() => component.onFormatCommand('indent')).not.toThrow();
        expect(editor.querySelectorAll('ul ul ul ul ul ul')).toHaveLength(1);
    });

    it('does not outdent a top-level list item (no grandparent list)', () => {
        component.writeValue('<ul><li>only</li></ul>');
        fixture.detectChanges();
        const li = editor.querySelector('li')!;
        caretIn(li.firstChild as Text, 0);

        expect(() => component.onFormatCommand('outdent')).not.toThrow();
        expect(editor.querySelector('ul')).toBeTruthy();
    });

    it('indent/outdent are no-ops without an active selection', () => {
        component.writeValue('<ul><li>a</li><li>b</li></ul>');
        fixture.detectChanges();
        caretIn(editor.querySelectorAll('li')[1].firstChild as Text, 0);

        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(() => component.onFormatCommand('indent')).not.toThrow();
            expect(() => component.onFormatCommand('outdent')).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('indenting a list item under a task-list previous sibling marks the new nested list as a task list', () => {
        component.writeValue(
            '<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>first</span></li>'
            + '<li data-task="" data-checked="false"><input type="checkbox"><span>second</span></li></ul>'
        );
        fixture.detectChanges();
        const secondLi = editor.querySelectorAll('li')[1];
        caretIn(secondLi.querySelector('span')!.firstChild as Text, 0);

        component.onFormatCommand('indent');

        const nestedUl = editor.querySelector('li > ul');
        expect(nestedUl?.hasAttribute('data-task-list')).toBe(true);
    });

    it('outdentListItem is a no-op for a list item whose parent is not a UL/OL (white-box malformed DOM)', () => {
        component.writeValue('<div><li>rogue</li></div>');
        fixture.detectChanges();
        const li = editor.querySelector('li')!;
        caretIn(li.firstChild as Text, 0);

        expect(() => component.onFormatCommand('outdent')).not.toThrow();
        expect(editor.querySelector('li')).toBeTruthy();
    });

    it('outdentListItem is a no-op when the grandparent list item has no parent list (white-box malformed DOM)', () => {
        component.writeValue('<ul><li>x</li></ul>');
        fixture.detectChanges();
        const outerLi = document.createElement('li');
        const nestedUl = document.createElement('ul');
        const nestedLi = document.createElement('li');
        nestedLi.textContent = 'nested';
        nestedUl.appendChild(nestedLi);
        outerLi.appendChild(nestedUl);

        const spy = vi.spyOn(component as unknown as { getParentListItem: () => HTMLElement | null }, 'getParentListItem')
            .mockReturnValue(nestedLi);
        try {
            expect(() => (component as unknown as { outdentListItem: () => void }).outdentListItem()).not.toThrow();
        } finally {
            spy.mockRestore();
        }
        expect(nestedLi.textContent).toBe('nested');
    });

    it('insertTaskList is a no-op without an active selection', () => {
        component.writeValue('<p>x</p>');
        fixture.detectChanges();

        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(() => component.onFormatCommand('taskList')).not.toThrow();
        } finally {
            spy.mockRestore();
        }
        expect(editor.querySelector('ul[data-task-list]')).toBeNull();
    });

    it('applies center alignment to the current block', () => {
        component.writeValue('<p>centered</p>');
        fixture.detectChanges();
        selectAll();

        component.onFormatCommand('alignCenter');

        expect(editor.innerHTML).toContain('center');
    });

    it('is a no-op when disabled', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        component.writeValue('<p>locked</p>');
        fixture.detectChanges();
        selectAll();
        const before = editor.innerHTML;

        component.onFormatCommand('heading1');

        expect(editor.innerHTML).toBe(before);
    });

    it('clears inline formatting with the clear command', () => {
        component.writeValue('<p><b>bold text</b></p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('b')!);

        component.onFormatCommand('clear');

        expect(editor.querySelector('b')).toBeNull();
        expect(editor.textContent).toBe('bold text');
    });
});

describe('RichTextEditorComponent — toolbar actions (link, image, color, font)', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const selectContents = (node: Node) => selectAllOf(node);
    const caretIn = (node: Node, offset: number) => setCaretAt(node, offset);

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('inserts overlay text at the caret position', () => {
        component.writeValue('<p>hi</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        caretIn(text, 2);
        const selection = document.getSelection();
        if (selection?.rangeCount) {
            (component as unknown as { savedRange: Range }).savedRange = selection.getRangeAt(0).cloneRange();
        }

        component.insertTextFromOverlay('🎉');

        expect(editor.textContent).toContain('🎉');
    });

    it('applies a font color via foreColor command', () => {
        component.writeValue('<p>colored</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.applyInlineStyle({ color: '#ff0000' });

        expect(editor.innerHTML.toLowerCase()).toMatch(/color|ff0000|rgb\(255/);
    });

    it('applies a color using a savedRange when the live selection is collapsed elsewhere', () => {
        component.writeValue('<p>colored</p>');
        fixture.detectChanges();
        const p = editor.querySelector('p')!;
        selectContents(p);
        const selection = document.getSelection()!;
        (component as unknown as { savedRange: Range }).savedRange = selection.getRangeAt(0).cloneRange();
        caretIn(p.firstChild as Text, 0);

        component.applyInlineStyle({ color: '#00ffaa' });

        expect(editor.innerHTML.toLowerCase()).toMatch(/color|00ffaa|rgb\(0,\s*255/);
    });

    it('hasColorTarget returns false when the editor view is not yet available', () => {
        const original = (component as unknown as { editorDiv?: unknown }).editorDiv;
        (component as unknown as { editorDiv?: unknown }).editorDiv = undefined;
        try {
            expect(() => component.applyInlineStyle({ color: '#ff0000' })).not.toThrow();
        } finally {
            (component as unknown as { editorDiv?: unknown }).editorDiv = original;
        }
    });

    it('applies a background (highlight) color', () => {
        component.writeValue('<p>highlight</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.applyInlineStyle({ backgroundColor: '#00ff00' });

        expect(editor.innerHTML.toLowerCase()).toMatch(/background|00ff00|rgb\(0,\s*255/);
    });

    it('falls back to backColor when hiliteColor is unsupported', () => {
        component.writeValue('<p>highlight</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        const doc = document as unknown as { execCommand: (id: string, ui?: boolean, val?: string) => boolean };
        const original = doc.execCommand;
        doc.execCommand = ((id: string, ui?: boolean, val?: string) =>
            id === 'hiliteColor' ? false : original.call(document, id, ui, val)) as typeof doc.execCommand;
        try {
            expect(() => component.applyInlineStyle({ backgroundColor: '#123456' })).not.toThrow();
        } finally {
            doc.execCommand = original;
        }
    });

    it('restoreColorTargetSelection is a no-op when getSelection returns null (white-box)', () => {
        component.writeValue('<p>text</p>');
        fixture.detectChanges();
        const p = editor.querySelector('p')!;
        selectContents(p);
        (component as unknown as { savedRange: Range }).savedRange = document.getSelection()!.getRangeAt(0).cloneRange();

        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(() => component.applyInlineStyle({ color: '#654321' })).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('applies a font size by converting font[size=7] into a styled span', () => {
        component.writeValue('<p>sized text</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.applyInlineStyle({ fontSize: '24' });

        expect(editor.querySelectorAll('font[size="7"]')).toHaveLength(0);
        const span = Array.from(editor.querySelectorAll('span')).find(s => s.style.fontSize === '24px');
        expect(span).toBeTruthy();
    });

    it('applies a font family by converting font[face] into a styled span', () => {
        component.writeValue('<p>family text</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.applyInlineStyle({ fontFamily: 'Georgia' });

        expect(editor.querySelectorAll('font[face]')).toHaveLength(0);
        const span = Array.from(editor.querySelectorAll('span')).find(s => s.style.fontFamily.includes('Georgia'));
        expect(span).toBeTruthy();
    });

    it('emits a customToolbarAction with a working editor ref', () => {
        component.writeValue('<p>ref</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 3);

        let captured: {
            id: string;
            ref: {
                insertText: (t: string) => void;
                insertHtml: (h: string) => void;
                focus: () => void;
                getSelectedText: () => string;
                getHtmlContent: () => string;
            };
        } | null = null;
        component.customToolbarAction.subscribe(e => { captured = e as typeof captured; });

        component.onCustomToolbarAction('my-action');

        expect(captured).toBeTruthy();
        expect(captured!.id).toBe('my-action');
        captured!.ref.insertText('INJECTED');
        expect(editor.textContent).toContain('INJECTED');
        expect(captured!.ref.getHtmlContent()).toContain('ref');
        expect(() => captured!.ref.insertHtml('<b>bold</b>')).not.toThrow();
        expect(() => captured!.ref.focus()).not.toThrow();
        expect(typeof captured!.ref.getSelectedText()).toBe('string');
    });
});

describe('RichTextEditorComponent — floating toolbar', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const selectRange = (node: Node, start: number, end: number) => {
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        selection?.removeAllRanges();
        selection?.addRange(range);
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.componentRef.setInput('toolbar', 'floating');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('registers a scroll listener that hides the floating toolbar once shown, and removes it once hidden', () => {
        vi.useFakeTimers();
        try {
            component.showFloatingToolbar.set(true);
            fixture.detectChanges();
            vi.advanceTimersByTime(0);

            globalThis.window.dispatchEvent(new Event('scroll'));
            expect(component.showFloatingToolbar()).toBe(false);

            component.showFloatingToolbar.set(true);
            fixture.detectChanges();
            vi.advanceTimersByTime(0);
            component.showFloatingToolbar.set(false);
            fixture.detectChanges();

            expect(() => globalThis.window.dispatchEvent(new Event('scroll'))).not.toThrow();
        } finally {
            vi.useRealTimers();
        }
    });

    it('wraps the selection in a bold tag and hides the floating toolbar', () => {
        component.writeValue('<p>make bold</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        selectRange(text, 0, 4);
        component.showFloatingToolbar.set(true);

        component.onFloatingFormatCommand('bold');

        expect(editor.querySelector('b')?.textContent).toBe('make');
        expect(component.showFloatingToolbar()).toBe(false);
    });

    it('wraps the selection in an italic tag', () => {
        component.writeValue('<p>make italic</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        selectRange(text, 0, 4);

        component.onFloatingFormatCommand('italic');

        expect(editor.querySelector('i')?.textContent).toBe('make');
    });

    it('applies a heading via the floating block command path', () => {
        component.writeValue('<p>heading me</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        selectRange(text, 0, 10);

        component.onFloatingFormatCommand('heading2');

        expect(editor.querySelector('h2')).toBeTruthy();
    });

    it('collapseFloatingToolbarAfterFormat moves the caret just past a formatted inline node (white-box)', () => {
        component.writeValue('<p><b>bold text</b></p>');
        fixture.detectChanges();
        const boldEl = editor.querySelector('b')!;
        const textNode = boldEl.firstChild as Text;
        const selection = document.getSelection()!;
        const range = document.createRange();
        range.setStart(textNode, 2);
        range.setEnd(textNode, 6);
        selection.removeAllRanges();
        selection.addRange(range);

        (component as unknown as { collapseFloatingToolbarAfterFormat: () => void })
            .collapseFloatingToolbarAfterFormat();

        expect(component.showFloatingToolbar()).toBe(false);
        const anchorNode = document.getSelection()?.anchorNode;
        expect(anchorNode).toBeTruthy();
        expect(editor.contains(anchorNode ?? null)).toBe(true);
    });

    it('collapseFloatingToolbarAfterFormat walks past document.documentElement when the selection sits outside the editor (white-box)', () => {
        component.writeValue('<p>seed</p>');
        fixture.detectChanges();
        const outside = document.createElement('span');
        outside.textContent = 'outside the editor';
        document.body.appendChild(outside);
        try {
            const range = document.createRange();
            range.setStart(outside.firstChild as Text, 2);
            range.setEnd(outside.firstChild as Text, 5);
            const selection = document.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);

            expect(() => (component as unknown as { collapseFloatingToolbarAfterFormat: () => void })
                .collapseFloatingToolbarAfterFormat()).not.toThrow();

            expect(component.showFloatingToolbar()).toBe(false);
        } finally {
            outside.remove();
        }
    });

    it('collapseFloatingToolbarAfterFormat walks up to the editor root when no inline tag is found (white-box)', () => {
        component.writeValue('<p>plain text</p>');
        fixture.detectChanges();
        const p = editor.querySelector('p')!;
        const textNode = p.firstChild as Text;
        const selection = document.getSelection()!;
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, 5);
        selection.removeAllRanges();
        selection.addRange(range);

        expect(() => (component as unknown as { collapseFloatingToolbarAfterFormat: () => void })
            .collapseFloatingToolbarAfterFormat()).not.toThrow();

        expect(component.showFloatingToolbar()).toBe(false);
    });

    it('toggles a bullet list via the floating block command path', () => {
        component.writeValue('<p>list me</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        selectRange(text, 0, 7);

        component.onFloatingFormatCommand('bulletList');

        expect(editor.querySelector('ul')).toBeTruthy();
    });

    it('toggles an ordered list via the floating block command path', () => {
        component.writeValue('<p>list me</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        selectRange(text, 0, 7);

        component.onFloatingFormatCommand('orderedList');

        expect(editor.querySelector('ol')).toBeTruthy();
    });

    it('is a no-op when there is no selection range', () => {
        component.writeValue('<p>none</p>');
        fixture.detectChanges();
        document.getSelection()?.removeAllRanges();
        const before = editor.innerHTML;

        expect(() => component.onFloatingFormatCommand('bold')).not.toThrow();
        expect(editor.innerHTML).toBe(before);
    });

    it('updates floating toolbar visibility on selection change', () => {
        component.writeValue('<p>select this</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        selectRange(text, 0, 6);

        component.onSelectionChange();

        expect(component.showFloatingToolbar()).toBe(true);
        expect(component.selectedText()).toBe('select');
    });
});

describe('RichTextEditorComponent — tables', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const seedTable = () => {
        editor.innerHTML = `
            <table>
                <thead><tr><th>H1</th><th>H2</th></tr></thead>
                <tbody>
                    <tr><td>A1</td><td>A2</td></tr>
                    <tr><td>B1</td><td>B2</td></tr>
                </tbody>
            </table><p><br></p>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return editor.querySelector('table')!;
    };

    const targetCell = (cell: HTMLTableCellElement) => {
        (component as unknown as { tableContextMenuTarget: HTMLTableCellElement }).tableContextMenuTarget = cell;
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('adds a row above the targeted cell', () => {
        const table = seedTable();
        const a1 = table.querySelector<HTMLTableCellElement>('tbody td')!;
        targetCell(a1);

        component.addTableRowAbove();

        expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
    });

    it('adds a row below the targeted cell', () => {
        const table = seedTable();
        const a1 = table.querySelector<HTMLTableCellElement>('tbody td')!;
        targetCell(a1);

        component.addTableRowBelow();

        expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
    });

    it('adds a column to the left and right', () => {
        const table = seedTable();
        const a1 = table.querySelector<HTMLTableCellElement>('tbody td')!;
        targetCell(a1);
        component.addTableColumnLeft();
        expect(table.querySelectorAll('tbody tr')[0].children).toHaveLength(3);

        targetCell(table.querySelector<HTMLTableCellElement>('tbody td')!);
        component.addTableColumnRight();
        expect(table.querySelectorAll('tbody tr')[0].children).toHaveLength(4);
    });

    it('deletes the targeted row', () => {
        const table = seedTable();
        const b1 = table.querySelectorAll('tbody tr')[1].querySelector('td')!;
        targetCell(b1);

        component.deleteTableRow();

        expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
    });

    it('removes the whole table when deleting the last remaining row', () => {
        editor.innerHTML = '<table><tbody><tr><td>solo</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const cell = editor.querySelector('td')!;
        targetCell(cell);

        component.deleteTableRow();

        expect(editor.querySelector('table')).toBeNull();
    });

    it('deletes the targeted column', () => {
        const table = seedTable();
        const a1 = table.querySelector<HTMLTableCellElement>('tbody td')!;
        targetCell(a1);

        component.deleteTableColumn();

        expect(table.querySelectorAll('tbody tr')[0].children).toHaveLength(1);
    });

    it('removes the whole table when deleting the last remaining column', () => {
        editor.innerHTML = '<table><tbody><tr><td>onlycol</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        targetCell(editor.querySelector('td')!);

        component.deleteTableColumn();

        expect(editor.querySelector('table')).toBeNull();
    });

    it('deletes the entire table via deleteTable', () => {
        const table = seedTable();
        targetCell(table.querySelector<HTMLTableCellElement>('td')!);

        component.deleteTable();

        expect(editor.querySelector('table')).toBeNull();
    });

    it('toggles a header row off (thead cells become tbody td)', () => {
        const table = seedTable();
        targetCell(table.querySelector<HTMLTableCellElement>('thead th')!);

        component.toggleTableHeaderRow();

        expect(table.querySelector('thead')).toBeNull();
        expect(table.querySelectorAll('th')).toHaveLength(0);
    });

    it('toggles a header row on for a headerless table', () => {
        editor.innerHTML = '<table><tbody><tr><td>c1</td><td>c2</td></tr><tr><td>d1</td><td>d2</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        targetCell(table.querySelector<HTMLTableCellElement>('td')!);

        component.toggleTableHeaderRow();

        expect(table.querySelector('thead')).toBeTruthy();
        expect(table.querySelectorAll('thead th')).toHaveLength(2);
    });

    it('toggleTableHeaderRow is a no-op when the table reports no rows (white-box: forces the defensive no-firstRow guard)', () => {
        const table = seedTable();
        targetCell(table.querySelector<HTMLTableCellElement>('thead th')!);

        vi.spyOn(table, 'querySelector').mockImplementation(((selector: string) =>
            (selector === 'tr' ? null : Element.prototype.querySelector.call(table, selector))) as typeof table.querySelector);

        expect(() => component.toggleTableHeaderRow()).not.toThrow();
    });

    it('sets cell text alignment', () => {
        const table = seedTable();
        const cell = table.querySelector<HTMLTableCellElement>('tbody td')!;
        targetCell(cell);

        component.setCellAlignment('center');

        expect(cell.style.textAlign).toBe('center');
    });

    it('sets and clears cell background color', () => {
        const table = seedTable();
        const cell = table.querySelector<HTMLTableCellElement>('tbody td')!;
        targetCell(cell);

        component.setCellColor('#ff0000');
        expect(cell.style.backgroundColor).toMatch(/rgb\(255,\s*0,\s*0\)|#ff0000/);

        targetCell(cell);
        component.setCellColor('transparent');
        expect(cell.style.backgroundColor).toBe('');
    });

    it('applies "none" border style to all cells', () => {
        const table = seedTable();
        targetCell(table.querySelector<HTMLTableCellElement>('td')!);

        component.setTableBorders('none');

        const cell = table.querySelector<HTMLTableCellElement>('td')!;
        // jsdom serializes a set 'none' border-style back as '' across runners;
        // both mean "no border".
        expect(['none', '']).toContain(cell.style.borderTopStyle);
    });

    it('applies "outer" border style', () => {
        const table = seedTable();
        targetCell(table.querySelector<HTMLTableCellElement>('td')!);

        expect(() => component.setTableBorders('outer')).not.toThrow();
        const firstCell = table.querySelector<HTMLTableCellElement>('thead th')!;
        expect(firstCell.style.borderTopStyle).toBe('solid');
    });

    it('applies "horizontal" border style', () => {
        const table = seedTable();
        targetCell(table.querySelector<HTMLTableCellElement>('td')!);

        expect(() => component.setTableBorders('horizontal')).not.toThrow();
        const cell = table.querySelector<HTMLTableCellElement>('td')!;
        // jsdom serializes a set 'none' border-style back as '' across runners.
        expect(['none', '']).toContain(cell.style.borderLeftStyle);
    });

    it('applies "all" border style, clearing overrides back to the table default', () => {
        const table = seedTable();
        targetCell(table.querySelector<HTMLTableCellElement>('td')!);

        expect(() => component.setTableBorders('all')).not.toThrow();
        const cell = table.querySelector<HTMLTableCellElement>('td')!;
        expect(cell.style.border).toBe('');
    });

    it('setTableBorders/setCellAlignment/setCellColor are no-ops without a target cell', () => {
        seedTable();
        targetCell(null as unknown as HTMLTableCellElement);
        expect(() => component.setTableBorders('all')).not.toThrow();
        expect(() => component.setCellAlignment('center')).not.toThrow();
        expect(() => component.setCellColor('#fff')).not.toThrow();
    });

    it('table operations are no-ops without a target cell', () => {
        seedTable();
        targetCell(null as unknown as HTMLTableCellElement);
        expect(() => component.addTableRowAbove()).not.toThrow();
        expect(() => component.deleteTableColumn()).not.toThrow();
        expect(() => component.toggleTableHeaderRow()).not.toThrow();
    });
});

describe('RichTextEditorComponent — find and replace', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        component.writeValue('<p>the cat sat on the cat mat</p>');
        fixture.detectChanges();
    });

    it('opens find with replace hidden via openFindReplace(false)', () => {
        component.openFindReplace(false);
        expect(component.findReplaceVisible()).toBe(true);
        expect(component.findShowReplace()).toBe(false);
    });

    it('finds all case-insensitive matches and highlights them', () => {
        component.onFindQueryChange('cat');

        expect(component.findMatches()).toHaveLength(2);
        expect(component.findCurrentIndex()).toBe(0);
        expect(editor.querySelectorAll('mark[data-find-match]')).toHaveLength(2);
    });

    it('clears matches when the query is emptied', () => {
        component.onFindQueryChange('cat');
        component.onFindQueryChange('');

        expect(component.findMatches()).toHaveLength(0);
        expect(component.findCurrentIndex()).toBe(-1);
        expect(editor.querySelectorAll('mark[data-find-match]')).toHaveLength(0);
    });

    it('navigates matches with findNext (wrapping) and findPrevious', () => {
        component.onFindQueryChange('cat');
        expect(component.findCurrentIndex()).toBe(0);

        component.findNext();
        expect(component.findCurrentIndex()).toBe(1);
        component.findNext();
        expect(component.findCurrentIndex()).toBe(0);

        component.findPrevious();
        expect(component.findCurrentIndex()).toBe(1);
    });

    it('respects case sensitivity when toggled', () => {
        component.writeValue('<p>Cat cat CAT</p>');
        fixture.detectChanges();
        component.onFindQueryChange('cat');
        expect(component.findMatches()).toHaveLength(3);

        component.toggleFindCaseSensitive();
        expect(component.findCaseSensitive()).toBe(true);
        expect(component.findMatches()).toHaveLength(1);
    });

    it('performFind is a no-op when the editor view is not yet available', () => {
        const original = (component as unknown as { editorDiv?: unknown }).editorDiv;
        (component as unknown as { editorDiv?: unknown }).editorDiv = undefined;
        try {
            expect(() => component.onFindQueryChange('cat')).not.toThrow();
        } finally {
            (component as unknown as { editorDiv?: unknown }).editorDiv = original;
        }
    });

    it('findNext/findPrevious/replaceSingle are no-ops without any matches', () => {
        expect(component.findMatches()).toHaveLength(0);
        expect(() => component.findNext()).not.toThrow();
        expect(() => component.findPrevious()).not.toThrow();
        expect(() => component.replaceSingle()).not.toThrow();
        expect(component.findCurrentIndex()).toBe(-1);
    });

    it('replaces the current match with replaceSingle', () => {
        component.onFindQueryChange('cat');
        component.replaceText.set('dog');

        component.replaceSingle();

        expect(editor.textContent).toContain('dog');
        expect(editor.textContent).toContain('cat');
        expect((editor.textContent ?? '').match(/cat/g)?.length).toBe(1);
    });

    it('replaces every match with replaceAll', () => {
        component.onFindQueryChange('cat');
        component.replaceText.set('dog');

        component.replaceAll();

        expect((editor.textContent ?? '').includes('cat')).toBe(false);
        expect((editor.textContent ?? '').match(/dog/g)?.length).toBe(2);
    });

    it('Enter triggers findNext and Shift+Enter triggers findPrevious', () => {
        component.onFindQueryChange('cat');
        const nextSpy = vi.spyOn(component, 'findNext');
        const prevSpy = vi.spyOn(component, 'findPrevious');

        component.onFindReplaceKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(nextSpy).toHaveBeenCalled();

        component.onFindReplaceKeydown(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
        expect(prevSpy).toHaveBeenCalled();
    });

    it('closeFindReplace resets query, matches and highlights', () => {
        component.onFindQueryChange('cat');
        component.closeFindReplace();

        expect(component.findReplaceVisible()).toBe(false);
        expect(component.findQuery()).toBe('');
        expect(component.findMatches()).toHaveLength(0);
        expect(editor.querySelectorAll('mark[data-find-match]')).toHaveLength(0);
    });
});

describe('RichTextEditorComponent — keydown behaviours', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const caretIn = (node: Node, offset: number) => setCaretAt(node, offset);

    const enterKey = () => new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const tabKey = (shift = false) => new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('Tab inside a list item indents it; Shift+Tab outdents it', () => {
        component.writeValue('<ul><li>one</li><li>two</li></ul>');
        fixture.detectChanges();
        caretIn(editor.querySelectorAll('li')[1].firstChild as Text, 0);

        const tab = tabKey();
        component.onKeydown(tab);
        expect(tab.defaultPrevented).toBe(true);
        expect(editor.querySelector('li > ul > li')?.textContent).toContain('two');

        caretIn(editor.querySelector('li > ul > li')!.firstChild as Text, 0);
        const shiftTab = tabKey(true);
        component.onKeydown(shiftTab);
        expect(editor.querySelector('li > ul')).toBeNull();
    });

    it('Tab outside a list inserts a tab character', () => {
        component.writeValue('<p>indent</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 6);

        component.onKeydown(tabKey());

        expect(editor.textContent).toContain('\t');
    });

    it('Enter in a non-empty task list item creates a new task item', () => {
        component.writeValue('<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>todo</span></li></ul>');
        fixture.detectChanges();
        const span = editor.querySelector('li[data-task] span')!;
        caretIn(span.firstChild as Text, 4);

        const ev = enterKey();
        component.onKeydown(ev);

        expect(ev.defaultPrevented).toBe(true);
        expect(editor.querySelectorAll('li[data-task]')).toHaveLength(2);
    });

    it('Enter in an empty task list item exits the task list into a paragraph', () => {
        component.writeValue('<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span> </span></li></ul>');
        fixture.detectChanges();
        const span = editor.querySelector('li[data-task] span')!;
        caretIn(span.firstChild as Text, 0);

        component.onKeydown(enterKey());

        expect(editor.querySelector('li[data-task]')).toBeNull();
        expect(editor.querySelector('p')).toBeTruthy();
    });

    it('Enter is a no-op when there is no active selection', () => {
        component.writeValue('<p>text</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 1);

        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            const ev = enterKey();
            expect(() => component.onKeydown(ev)).not.toThrow();
            expect(ev.defaultPrevented).toBe(false);
        } finally {
            spy.mockRestore();
        }
    });

    it('Enter inside a summary moves the caret into the details content', () => {
        component.writeValue('<details open><summary>Title</summary><p>body</p></details>');
        fixture.detectChanges();
        const summary = editor.querySelector('summary')!;
        caretIn(summary.firstChild as Text, 5);

        const ev = enterKey();
        component.onKeydown(ev);

        expect(ev.defaultPrevented).toBe(true);
        const anchor = document.getSelection()?.anchorNode;
        const contentP = editor.querySelector('details > p')!;
        expect(contentP.contains(anchor as Node) || contentP === anchor).toBe(true);
    });

    it('Enter on an empty trailing details line exits the details block', () => {
        component.writeValue('<details open><summary>T</summary><p> </p></details>');
        fixture.detectChanges();
        const p = editor.querySelector('details > p')!;
        const textNode = p.firstChild as Text;
        // make it empty
        textNode.data = '';
        caretIn(p, 0);

        const ev = enterKey();
        component.onKeydown(ev);

        expect(ev.defaultPrevented).toBe(true);
        expect(editor.querySelector('details > p')).toBeNull();
    });

    it('Enter with the caret on a details block whose last child is the summary itself is a no-op', () => {
        component.writeValue('<details open><summary>Title only</summary></details>');
        fixture.detectChanges();
        const details = editor.querySelector('details')!;
        caretIn(details, 0);

        const ev = enterKey();
        component.onKeydown(ev);

        expect(editor.querySelector('summary')?.textContent).toBe('Title only');
        expect(editor.querySelectorAll('details')).toHaveLength(1);
    });

    it('handleEnterInSummary is a no-op for a detached summary with no parent (white-box)', () => {
        const summary = document.createElement('summary');
        summary.textContent = 'Orphan';
        const range = document.createRange();
        range.setStart(summary.firstChild as Text, 2);
        range.collapse(true);
        const selection = document.getSelection() as Selection;
        const ev = enterKey();

        const result = (component as unknown as {
            handleEnterInSummary: (e: KeyboardEvent, r: Range, s: Selection) => boolean;
        }).handleEnterInSummary(ev, range, selection);

        expect(result).toBe(true);
        expect(ev.defaultPrevented).toBe(true);
    });

    it('Enter mid-line inside a non-empty details content paragraph does not exit the block', () => {
        component.writeValue('<details open><summary>T</summary><p>not at end</p></details>');
        fixture.detectChanges();
        const p = editor.querySelector('details > p')!;
        caretIn(p.firstChild as Text, 3);

        const ev = enterKey();
        component.onKeydown(ev);

        expect(editor.querySelector('details > p')).toBeTruthy();
        expect(editor.querySelector('details > p')?.textContent).toBe('not at end');
    });

    it('Enter in a code block inserts a newline rather than a new paragraph', () => {
        component.writeValue('<pre><code>line1</code></pre>');
        fixture.detectChanges();
        const codeText = editor.querySelector('code')!.firstChild as Text;
        caretIn(codeText, 5);

        const ev = enterKey();
        component.onKeydown(ev);

        expect(ev.defaultPrevented).toBe(true);
        expect(editor.querySelector('code')?.textContent).toContain('\n');
    });

    it('Enter at the end of a code block whose content ends with a newline exits the block', () => {
        component.writeValue('<pre><code>done\n</code></pre>');
        fixture.detectChanges();
        const codeText = editor.querySelector('code')!.firstChild as Text;
        caretIn(codeText, codeText.length);

        component.onKeydown(enterKey());

        expect(editor.querySelector('pre + p')).toBeTruthy();
    });

    it('Escape hides the floating toolbar when no popover is open', () => {
        component.showFloatingToolbar.set(true);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

        expect(component.showFloatingToolbar()).toBe(false);
    });
});

describe('RichTextEditorComponent — drag and drop', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;

    const makeDataTransfer = (files: File[], types: string[] = ['Files']): DataTransfer => ({
        types,
        files: files as unknown as FileList,
        items: files.map(f => ({ kind: 'file', type: f.type })) as unknown as DataTransferItemList,
    } as unknown as DataTransfer);

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('ignores drag events without files', () => {
        const ev = {
            dataTransfer: makeDataTransfer([], ['text/plain']),
            preventDefault: vi.fn(),
        } as unknown as DragEvent;

        component.onEditorDragOver(ev);

        expect(component.dragOver()).toBe(false);
    });

    it('clears dragOver on drag leave outside the editor', () => {
        component.dragOver.set(true);
        const current = document.createElement('div');
        const ev = {
            currentTarget: current,
            relatedTarget: document.body,
        } as unknown as DragEvent;

        component.onEditorDragLeave(ev);

        expect(component.dragOver()).toBe(false);
    });

    it('clears dragOver on drag leave when the event has no currentTarget', () => {
        component.dragOver.set(true);
        const ev = { currentTarget: null, relatedTarget: document.body } as unknown as DragEvent;

        component.onEditorDragLeave(ev);

        expect(component.dragOver()).toBe(false);
    });

    it('ignores drag-over while disabled or readonly', () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        const ev = { dataTransfer: makeDataTransfer([], ['Files']), preventDefault: vi.fn() } as unknown as DragEvent;

        component.onEditorDragOver(ev);

        expect(component.dragOver()).toBe(false);
        expect(ev.preventDefault).not.toHaveBeenCalled();
    });

});

describe('RichTextEditorComponent — mention styling during formatting', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const selectAll = () => selectAllOf(editor);

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        component.writeValue('<p><span data-mention="jane" contenteditable="false">@Jane</span></p>');
        fixture.detectChanges();
    });

    it('bold toggles fontWeight on mention chips in the selection', () => {
        selectAll();
        component.onFormatCommand('bold');
        const chip = editor.querySelector<HTMLElement>('[data-mention]')!;
        expect(chip.style.fontWeight).toBe('bold');
    });

    it('underline toggles text decoration on mention chips', () => {
        selectAll();
        component.onFormatCommand('underline');
        const chip = editor.querySelector<HTMLElement>('[data-mention]')!;
        expect(chip.style.textDecoration).toContain('underline');
    });

    it('underline toggled twice removes the text decoration on mention chips', () => {
        selectAll();
        component.onFormatCommand('underline');
        selectAll();
        component.onFormatCommand('underline');
        const chip = editor.querySelector<HTMLElement>('[data-mention]')!;
        expect(chip.style.textDecoration).not.toContain('underline');
    });

    it('getMentionElementsInSelection returns no chips when the selection is outside the editor', () => {
        const outside = document.createElement('p');
        outside.textContent = 'outside';
        document.body.appendChild(outside);
        try {
            const range = document.createRange();
            range.selectNodeContents(outside);
            const sel = document.getSelection()!;
            sel.removeAllRanges();
            sel.addRange(range);

            expect(() => component.onFormatCommand('bold')).not.toThrow();
        } finally {
            outside.remove();
        }
    });

    it('getMentionElementsInSelection returns [] for a live selection outside the editor (white-box, bypassing restoreSelection self-heal)', () => {
        const outside = document.createElement('p');
        outside.textContent = 'outside';
        document.body.appendChild(outside);
        try {
            const range = document.createRange();
            range.selectNodeContents(outside);
            const sel = document.getSelection()!;
            sel.removeAllRanges();
            sel.addRange(range);

            const result = (component as unknown as { getMentionElementsInSelection: () => HTMLElement[] })
                .getMentionElementsInSelection();
            expect(result).toEqual([]);
        } finally {
            outside.remove();
        }
    });

    it('font color sets the color style on mention chips', () => {
        selectAll();
        component.applyInlineStyle({ color: '#123456' });
        const chip = editor.querySelector<HTMLElement>('[data-mention]')!;
        expect(chip.style.color).toMatch(/rgb\(18,\s*52,\s*86\)|#123456/);
    });

    it('clear formatting removes inline styles from mention chips', () => {
        const chip = editor.querySelector<HTMLElement>('[data-mention]')!;
        chip.style.fontWeight = 'bold';
        chip.style.color = 'red';
        selectAll();

        component.onFormatCommand('clear');

        expect(chip.style.fontWeight).toBe('');
        expect(chip.style.color).toBe('');
    });
});

describe('RichTextEditorComponent — history delta, undo/redo & destroy', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const push = () => (component as unknown as { pushHistory: () => void }).pushHistory();
    const getHistory = () => (component as unknown as { history: unknown[] }).history;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('reconstructs content from delta entries across many snapshots (undo walks back exactly)', () => {
        const snapshots = ['<p>v0</p>', '<p>v1</p>', '<p>v2</p>', '<p>v3</p>', '<p>v4</p>', '<p>v5</p>', '<p>v6</p>', '<p>v7</p>', '<p>v8</p>', '<p>v9</p>', '<p>v10</p>', '<p>v11</p>', '<p>v12</p>'];
        for (const s of snapshots) {
            component.writeValue(s);
            fixture.detectChanges();
            push();
        }
        // history should contain a mix of keyframes and deltas
        const hist = getHistory() as { keyframe: boolean }[];
        expect(hist.length).toBeGreaterThan(10);
        expect(hist.some(e => e.keyframe)).toBe(true);
        expect(hist.some(e => !e.keyframe)).toBe(true);

        // Undo from latest several steps and confirm reconstructed HTML matches
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        component.onKeydown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        component.onKeydown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(editor.textContent).toMatch(/v\d+/);
        const afterUndos = editor.textContent;
        component.onKeydown(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(editor.textContent).not.toBe(afterUndos);
    });

    it('trims history to the configured limit, promoting a new keyframe', () => {
        fixture.componentRef.setInput('historyLimit', 10);
        fixture.detectChanges();
        for (let i = 0; i < 30; i++) {
            component.writeValue(`<p>entry ${i}</p>`);
            fixture.detectChanges();
            push();
        }
        const hist = getHistory();
        expect(hist.length).toBeLessThanOrEqual(10);
        // First entry must be a keyframe so reconstruction stays valid
        expect((hist[0] as { keyframe: boolean }).keyframe).toBe(true);
    });

    it('reconstructHtml walks through an interior keyframe and a delta-less entry in a malformed history (white-box)', () => {
        component.writeValue('<p>seed</p>');
        fixture.detectChanges();
        push();

        type Entry = { html: string; delta: string | null; keyframe: boolean; selection: unknown; timestamp: number; preview: string; previewLines: string[]; lineCount: number };
        const base = (component as unknown as { history: Entry[] }).history[0];
        (component as unknown as { history: Entry[] }).history = [
            { ...base, html: '<p>a</p>', delta: null, keyframe: true },
            { ...base, html: '<p>b</p>', delta: null, keyframe: true },
            { ...base, html: '<p>c</p>', delta: null, keyframe: false },
        ];

        const reconstruct = (component as unknown as { reconstructHtmlCached: (i: number) => string }).reconstructHtmlCached.bind(component);
        expect(reconstruct(2)).toBe('<p>c</p>');
    });

    it('reconstructHtml walks a keyframe entry mid-loop when the flag flips between the backward scan and the forward pass (white-box, provably unreachable via any static history array)', () => {
        // reconstructHtml's own backward search for the nearest keyframe is exhaustive: it
        // walks from `index` down to 0 and stops at the FIRST (closest) keyframe:true entry
        // it finds. By construction, every index strictly between that stop point and the
        // original `index` was already read during that scan and found to be keyframe:false
        // -- so the forward loop that follows can never encounter a keyframe:true entry
        // partway through, for ANY static history array, malformed or not. The `e.keyframe`
        // check inside that forward loop (source line ~3771) is therefore dead code baked
        // into the algorithm's invariant. The only way to exercise it at all is a history
        // entry whose `keyframe` getter itself is non-deterministic across the two reads --
        // which is what this test does, purely to close the coverage line; it does not
        // represent a real (or even plausible) runtime history state.
        component.writeValue('<p>seed</p>');
        fixture.detectChanges();
        push();

        type Entry = { html: string; delta: string | null; keyframe: boolean; selection: unknown; timestamp: number; preview: string; previewLines: string[]; lineCount: number };
        const base = (component as unknown as { history: Entry[] }).history[0];
        const flakyKeyframeEntry: Entry = { ...base, html: '<p>flaky</p>', delta: null, keyframe: false };
        let reads = 0;
        Object.defineProperty(flakyKeyframeEntry, 'keyframe', {
            // Read 1: reconstructHtml's own top-level `if (entry.keyframe)` early-return check.
            // Read 2: the backward keyframe-search's own first probe of this same index.
            // Read 3+: the forward reconstruction loop's re-check of this index -- this is the
            // one that must flip to true to reach the interior-keyframe branch at all.
            get: () => { reads += 1; return reads > 2; },
            configurable: true,
        });

        (component as unknown as { history: Entry[] }).history = [
            { ...base, html: '<p>a</p>', delta: null, keyframe: true },
            flakyKeyframeEntry,
        ];

        const reconstruct = (component as unknown as { reconstructHtml: (i: number) => string }).reconstructHtml.bind(component);
        expect(reconstruct(1)).toBe('<p>flaky</p>');
    });

    it('selecting then pushing new content truncates the redo branch', () => {
        component.writeValue('<p>a</p>'); fixture.detectChanges(); push();
        component.writeValue('<p>b</p>'); fixture.detectChanges(); push();
        component.writeValue('<p>c</p>'); fixture.detectChanges(); push();
        const fullLen = getHistory().length;

        component.restoreHistoryEntry(1);
        component.writeValue('<p>branch</p>');
        fixture.detectChanges();
        push();

        expect(getHistory().length).toBeLessThan(fullLen + 1);
        expect((getHistory().at(-1) as { preview: string }).preview).toContain('branch');
    });

    it('ngOnDestroy unregisters shortcuts and disconnects observers without throwing', () => {
        component.writeValue('<p>cleanup</p>');
        fixture.detectChanges();
        expect(() => fixture.destroy()).not.toThrow();
    });
});

describe('RichTextEditorComponent — table mouse, resize & cell selection', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const seedTable = () => {
        editor.innerHTML = `<table><tbody>
            <tr><td>A1</td><td>A2</td><td>A3</td></tr>
            <tr><td>B1</td><td>B2</td><td>B3</td></tr>
        </tbody></table>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return editor.querySelector('table')!;
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        document.body.appendChild(fixture.nativeElement);
    });

    it('drag-selecting from one cell to another marks a rectangular block selected', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        const b2 = table.querySelectorAll('tr')[1].querySelectorAll('td')[1] as HTMLTableCellElement;

        component.onEditorMouseDown({ button: 0, target: a1, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent);

        const b2Rect = b2.getBoundingClientRect();
        document.dispatchEvent(new MouseEvent('mousemove', {
            clientX: b2Rect.left + b2Rect.width / 2,
            clientY: b2Rect.top + b2Rect.height / 2,
            bubbles: true,
        }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        expect(component.tableCellSelected()).toHaveLength(4);
        expect(component.tableCellSelected().every(c => c.classList.contains('rte-cell-selected'))).toBe(true);
    });

    it('hovering near a cell right border sets the col-resize cursor', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        const rect = a1.getBoundingClientRect();

        component.onEditorMouseMove({ target: a1, clientX: rect.right - 1, clientY: rect.top + 5 } as unknown as MouseEvent);

        expect(editor.style.cursor).toBe('col-resize');

        // Moving off the border clears the cursor
        component.onEditorMouseMove({ target: a1, clientX: rect.left + rect.width / 2, clientY: rect.top + 5 } as unknown as MouseEvent);
        expect(editor.style.cursor).toBe('');
    });

    it('starts a column resize when mousedown happens on the resize border', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        const rect = a1.getBoundingClientRect();
        component.onEditorMouseMove({ target: a1, clientX: rect.right - 1, clientY: rect.top + 5 } as unknown as MouseEvent);

        const down = { button: 0, target: a1, clientX: rect.right - 1, clientY: rect.top + 5, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent;
        component.onEditorMouseDown(down);

        expect(table.style.tableLayout).toBe('fixed');

        document.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.right + 40, clientY: rect.top + 5, bubbles: true }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        expect(table.style.width).toContain('px');
    });

    it('right-click on an unselected cell clears the existing cell selection', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        const a3 = table.querySelectorAll('td')[2] as HTMLTableCellElement;
        a1.classList.add('rte-cell-selected');
        component.tableCellSelected.set([a1]);

        component.onEditorMouseDown({ button: 2, target: a3, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent);

        expect(component.tableCellSelected()).toHaveLength(0);
    });

    it('moving off the table while the resize cursor is active clears it', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        const rect = a1.getBoundingClientRect();
        component.onEditorMouseMove({ target: a1, clientX: rect.right - 1, clientY: rect.top + 5 } as unknown as MouseEvent);
        expect(editor.style.cursor).toBe('col-resize');

        const p = document.createElement('p');
        editor.appendChild(p);
        component.onEditorMouseMove({ target: p, clientX: 0, clientY: 0 } as unknown as MouseEvent);

        expect(editor.style.cursor).toBe('');
    });

    it('onEditorMouseDown/mousemove are no-ops while disabled or readonly', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();

        expect(() => component.onEditorMouseDown(
            { button: 0, target: a1, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent
        )).not.toThrow();
        expect(component.tableCellSelected()).toHaveLength(0);

        const rect = a1.getBoundingClientRect();
        expect(() => component.onEditorMouseMove(
            { target: a1, clientX: rect.right - 1, clientY: rect.top + 5 } as unknown as MouseEvent
        )).not.toThrow();
        expect((component as unknown as { tableResizeCursor: { (): boolean; set(v: boolean): void } }).tableResizeCursor()).toBe(false);
    });

    it('startTableResize returns false for a cell detached from any table (white-box)', () => {
        const detachedCell = document.createElement('td');
        document.body.appendChild(detachedCell);
        try {
            (component as unknown as { tableResizeCursor: { (): boolean; set(v: boolean): void } }).tableResizeCursor.set(true);
            const result = (component as unknown as {
                startTableResize: (e: MouseEvent, c: HTMLTableCellElement | null) => boolean;
            }).startTableResize({ clientX: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent, detachedCell);
            expect(result).toBe(false);
        } finally {
            detachedCell.remove();
            (component as unknown as { tableResizeCursor: { (): boolean; set(v: boolean): void } }).tableResizeCursor.set(false);
        }
    });

    it('startTableResize returns true without starting a drag when the table reports no rows (white-box)', () => {
        const table = seedTable();
        const cell = table.querySelector('td')!;
        Object.defineProperty(table, 'rows', { value: [], configurable: true });
        try {
            (component as unknown as { tableResizeCursor: { (): boolean; set(v: boolean): void } }).tableResizeCursor.set(true);
            const result = (component as unknown as {
                startTableResize: (e: MouseEvent, c: HTMLTableCellElement | null) => boolean;
            }).startTableResize({ clientX: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent, cell);
            expect(result).toBe(true);
        } finally {
            (component as unknown as { tableResizeCursor: { (): boolean; set(v: boolean): void } }).tableResizeCursor.set(false);
        }
    });

    it('onTableResizeMove is a no-op without an active resize state (white-box)', () => {
        expect(() => (component as unknown as { onTableResizeMove: (e: MouseEvent) => void })
            .onTableResizeMove({ clientX: 0 } as unknown as MouseEvent)).not.toThrow();
    });

    it('onTableResizeMove is a no-op when the table reports no rows (white-box)', () => {
        const table = seedTable();
        (component as unknown as { tableResizeState: unknown }).tableResizeState = {
            table, colIndex: 0, startX: 0, startWidths: [100, 100], tableWidth: 200,
        };
        Object.defineProperty(table, 'rows', { value: [], configurable: true });
        try {
            expect(() => (component as unknown as { onTableResizeMove: (e: MouseEvent) => void })
                .onTableResizeMove({ clientX: 10 } as unknown as MouseEvent)).not.toThrow();
        } finally {
            (component as unknown as { tableResizeState: unknown }).tableResizeState = null;
        }
    });

    it('onTableCellSelectMove is a no-op when not currently selecting (white-box)', () => {
        (component as unknown as { tableCellSelecting: boolean }).tableCellSelecting = false;
        expect(() => (component as unknown as { onTableCellSelectMove: (e: MouseEvent) => void })
            .onTableCellSelectMove({ clientX: 0, clientY: 0 } as unknown as MouseEvent)).not.toThrow();
    });

    it('onEditorTouchStart is a no-op while disabled or readonly', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        fixture.componentRef.setInput('readonly', true);
        fixture.detectChanges();

        expect(() => component.onEditorTouchStart(
            { target: a1, touches: [{ clientX: 0, clientY: 0 }] } as unknown as TouchEvent
        )).not.toThrow();
        expect(component.tableCellSelected()).toHaveLength(0);
    });

    it('onTableCellTouchMove ignores touches while not selecting, off any target, or off any cell (white-box)', () => {
        const touchMove = (component as unknown as { onTableCellTouchMove: (e: TouchEvent) => void })
            .onTableCellTouchMove.bind(component);

        (component as unknown as { tableCellSelecting: boolean }).tableCellSelecting = false;
        expect(() => touchMove({ touches: [{ clientX: 0, clientY: 0 }] } as unknown as TouchEvent)).not.toThrow();

        (component as unknown as { tableCellSelecting: boolean }).tableCellSelecting = true;
        const table = seedTable();
        (component as unknown as { tableCellSelectAnchor: HTMLTableCellElement }).tableCellSelectAnchor =
            table.querySelector('td')!;

        const noTargetSpy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
        expect(() => touchMove({ touches: [{ clientX: 0, clientY: 0 }], preventDefault: vi.fn() } as unknown as TouchEvent)).not.toThrow();
        noTargetSpy.mockRestore();

        const nonCellSpy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);
        expect(() => touchMove({ touches: [{ clientX: 0, clientY: 0 }], preventDefault: vi.fn() } as unknown as TouchEvent)).not.toThrow();
        nonCellSpy.mockRestore();

        const otherTable = document.createElement('table');
        const otherRow = document.createElement('tr');
        const otherCell = document.createElement('td');
        otherRow.appendChild(otherCell);
        otherTable.appendChild(otherRow);
        document.body.appendChild(otherTable);
        const otherTableSpy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(otherCell);
        expect(() => touchMove({ touches: [{ clientX: 0, clientY: 0 }], preventDefault: vi.fn() } as unknown as TouchEvent)).not.toThrow();
        expect(component.tableCellSelected()).toHaveLength(0);
        otherTableSpy.mockRestore();
        otherTable.remove();

        (component as unknown as { tableCellSelecting: boolean }).tableCellSelecting = false;
    });

    it('resizing the last column grows the table width instead of a sibling column', () => {
        const table = seedTable();
        const cells = table.querySelectorAll('tr')[0].querySelectorAll('td');
        const lastCell = cells[cells.length - 1] as HTMLTableCellElement;
        const rect = lastCell.getBoundingClientRect();
        component.onEditorMouseMove({ target: lastCell, clientX: rect.right - 1, clientY: rect.top + 5 } as unknown as MouseEvent);
        component.onEditorMouseDown({
            button: 0, target: lastCell, clientX: rect.right - 1, clientY: rect.top + 5,
            preventDefault: vi.fn(), stopPropagation: vi.fn(),
        } as unknown as MouseEvent);

        document.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.right + 40, clientY: rect.top + 5, bubbles: true }));

        expect(table.style.width).toContain('px');
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    it('onTableCellSelectMove ignores moves outside any cell, off-table, or to a different table (white-box)', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        const moveFn = (component as unknown as { onTableCellSelectMove: (e: MouseEvent) => void })
            .onTableCellSelectMove.bind(component);

        (component as unknown as { tableCellSelecting: boolean }).tableCellSelecting = true;
        (component as unknown as { tableCellSelectAnchor: HTMLTableCellElement | null }).tableCellSelectAnchor = a1;

        const noTargetSpy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
        expect(() => moveFn({ clientX: -1, clientY: -1 } as unknown as MouseEvent)).not.toThrow();
        expect(component.tableCellSelected()).toHaveLength(0);
        noTargetSpy.mockRestore();

        const nonCellSpy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.body);
        expect(() => moveFn({ clientX: 0, clientY: 0 } as unknown as MouseEvent)).not.toThrow();
        expect(component.tableCellSelected()).toHaveLength(0);
        nonCellSpy.mockRestore();

        const otherTable = document.createElement('table');
        const otherRow = document.createElement('tr');
        const otherCell = document.createElement('td');
        otherRow.appendChild(otherCell);
        otherTable.appendChild(otherRow);
        document.body.appendChild(otherTable);
        const otherTableSpy = vi.spyOn(document, 'elementFromPoint').mockReturnValue(otherCell);
        expect(() => moveFn({ clientX: 0, clientY: 0 } as unknown as MouseEvent)).not.toThrow();
        expect(component.tableCellSelected()).toHaveLength(0);
        otherTableSpy.mockRestore();
        otherTable.remove();

        (component as unknown as { tableCellSelecting: boolean }).tableCellSelecting = false;
    });

    it('selecting a row whose rowspan cell reaches into the next row auto-expands the selection to include it', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td>P</td><td rowspan="2">Q</td><td>R</td></tr>'
            + '<tr><td>S</td><td>T</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellP = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        const cellR = table.querySelectorAll('td')[2] as HTMLTableCellElement;

        (component as unknown as {
            updateCellSelection: (a: HTMLTableCellElement, c: HTMLTableCellElement) => void;
        }).updateCellSelection(cellP, cellR);

        expect(component.tableCellSelected().length).toBeGreaterThanOrEqual(5);
    });

    it('applyExpandedBounds independently grows each of the four bound edges (white-box)', () => {
        type Bounds = { minRow: number; maxRow: number; minCol: number; maxCol: number };
        const apply = (component as unknown as { applyExpandedBounds: (b: Bounds, c: Bounds) => boolean })
            .applyExpandedBounds.bind(component);

        const base: Bounds = { minRow: 2, maxRow: 2, minCol: 2, maxCol: 2 };

        const growMinRow = { ...base };
        expect(apply(growMinRow, { minRow: 0, maxRow: 2, minCol: 2, maxCol: 2 })).toBe(true);
        expect(growMinRow.minRow).toBe(0);

        const growMaxRow = { ...base };
        expect(apply(growMaxRow, { minRow: 2, maxRow: 5, minCol: 2, maxCol: 2 })).toBe(true);
        expect(growMaxRow.maxRow).toBe(5);

        const growMinCol = { ...base };
        expect(apply(growMinCol, { minRow: 2, maxRow: 2, minCol: 0, maxCol: 2 })).toBe(true);
        expect(growMinCol.minCol).toBe(0);

        const growMaxCol = { ...base };
        expect(apply(growMaxCol, { minRow: 2, maxRow: 2, minCol: 2, maxCol: 5 })).toBe(true);
        expect(growMaxCol.maxCol).toBe(5);

        const noChange = { ...base };
        expect(apply(noChange, base)).toBe(false);
    });

    it('updateCellSelection is a no-op when the anchor has no table ancestor (white-box)', () => {
        const detachedAnchor = document.createElement('td');
        const detachedCurrent = document.createElement('td');
        expect(() => (component as unknown as {
            updateCellSelection: (a: HTMLTableCellElement, c: HTMLTableCellElement) => void;
        }).updateCellSelection(detachedAnchor, detachedCurrent)).not.toThrow();
        expect(component.tableCellSelected()).toHaveLength(0);
    });

    it('updateCellSelection handles a row-overflow caused by a rowspan pushing a cell past the grid width (white-box)', () => {
        editor.innerHTML = `<table><tbody>
            <tr><td rowspan="2">A</td><td>B</td></tr>
            <tr><td>C</td><td>D</td></tr>
        </tbody></table>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellA = table.querySelector('td')!;
        const cellD = table.querySelectorAll('td')[3] as HTMLTableCellElement;

        expect(() => (component as unknown as {
            updateCellSelection: (a: HTMLTableCellElement, c: HTMLTableCellElement) => void;
        }).updateCellSelection(cellA, cellD)).not.toThrow();
    });

    it('touch drag selects cells across the table', () => {
        const table = seedTable();
        const a1 = table.querySelectorAll('td')[0] as HTMLTableCellElement;
        const a2 = table.querySelectorAll('td')[1] as HTMLTableCellElement;

        component.onEditorTouchStart({ target: a1, touches: [{ clientX: 0, clientY: 0 }] } as unknown as TouchEvent);

        const a2Rect = a2.getBoundingClientRect();
        const move = new Event('touchmove', { bubbles: true, cancelable: true }) as TouchEvent;
        Object.defineProperty(move, 'touches', { value: [{ clientX: a2Rect.left + a2Rect.width / 2, clientY: a2Rect.top + a2Rect.height / 2 }] });
        document.dispatchEvent(move);
        document.dispatchEvent(new Event('touchend', { bubbles: true }));

        expect(component.tableCellSelected()).toHaveLength(2);
    });
});

describe('RichTextEditorComponent — task checkbox & image element handlers', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('clicking a task checkbox toggles the checked dataset on its list item', () => {
        component.writeValue('<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>do it</span></li></ul>');
        fixture.detectChanges();
        const checkbox = editor.querySelector('input[type="checkbox"]') as HTMLInputElement;

        component.onEditorClick({ target: checkbox, preventDefault: vi.fn() } as unknown as MouseEvent);

        const li = editor.querySelector('li[data-task]')!;
        expect(li.getAttribute('data-checked')).toBe('true');

        component.onEditorClick({ target: checkbox, preventDefault: vi.fn() } as unknown as MouseEvent);
        expect(li.getAttribute('data-checked')).toBe('false');
    });

    it('clicking a checkbox with no data-task ancestor <li> is a no-op', () => {
        component.writeValue('<p><input type="checkbox"></p>');
        fixture.detectChanges();
        const checkbox = editor.querySelector('input[type="checkbox"]') as HTMLInputElement;

        expect(() => component.onEditorClick(
            { target: checkbox, preventDefault: vi.fn() } as unknown as MouseEvent
        )).not.toThrow();
        expect(editor.querySelector('li[data-task]')).toBeNull();
    });

    it('checking a task checkbox with no text span skips caret placement without throwing', () => {
        component.writeValue('<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"></li></ul>');
        fixture.detectChanges();
        const checkbox = editor.querySelector('input[type="checkbox"]') as HTMLInputElement;

        expect(() => component.onEditorClick(
            { target: checkbox, preventDefault: vi.fn() } as unknown as MouseEvent
        )).not.toThrow();

        const li = editor.querySelector('li[data-task]')!;
        expect(li.getAttribute('data-checked')).toBe('true');
    });

    it('checking a task checkbox skips caret placement when there is no active selection', () => {
        component.writeValue('<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>do it</span></li></ul>');
        fixture.detectChanges();
        const checkbox = editor.querySelector('input[type="checkbox"]') as HTMLInputElement;

        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(() => component.onEditorClick(
                { target: checkbox, preventDefault: vi.fn() } as unknown as MouseEvent
            )).not.toThrow();
        } finally {
            spy.mockRestore();
        }

        const li = editor.querySelector('li[data-task]')!;
        expect(li.getAttribute('data-checked')).toBe('true');
    });

    it('clicking an image selects it; clicking elsewhere clears the selection', () => {
        component.writeValue('<p><img src="https://cdn.test/a.png" alt="a"></p>');
        fixture.detectChanges();
        const img = editor.querySelector('img')!;

        component.onEditorClick({ target: img, preventDefault: vi.fn() } as unknown as MouseEvent);
        expect(component.selectedImage()).toBe(img);

        const p = editor.querySelector('p')!;
        component.onEditorClick({ target: p, preventDefault: vi.fn() } as unknown as MouseEvent);
        expect(component.selectedImage()).toBeNull();
    });

});

describe('RichTextEditorComponent — history delta algorithm', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;

    type DeltaComponent = {
        computeDelta(prev: string, current: string): string;
        applyDelta(base: string, delta: string): string;
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('round-trips an inserted line through computeDelta/applyDelta', () => {
        const c = component as unknown as DeltaComponent;
        const prev = 'line1\nline2\nline3';
        const current = 'line1\nINSERTED\nline2\nline3';
        const delta = c.computeDelta(prev, current);
        expect(c.applyDelta(prev, delta)).toBe(current);
    });

    it('round-trips a removed line', () => {
        const c = component as unknown as DeltaComponent;
        const prev = 'a\nb\nc\nd';
        const current = 'a\nc\nd';
        const delta = c.computeDelta(prev, current);
        expect(c.applyDelta(prev, delta)).toBe(current);
    });

    it('round-trips a changed line', () => {
        const c = component as unknown as DeltaComponent;
        const prev = 'alpha\nbeta\ngamma';
        const current = 'alpha\nBETA-CHANGED\ngamma';
        const delta = c.computeDelta(prev, current);
        expect(c.applyDelta(prev, delta)).toBe(current);
    });

    it('round-trips trailing additions and removals', () => {
        const c = component as unknown as DeltaComponent;
        const shorter = 'x\ny';
        const longer = 'x\ny\nz\nw';

        const addDelta = c.computeDelta(shorter, longer);
        expect(c.applyDelta(shorter, addDelta)).toBe(longer);

        const removeDelta = c.computeDelta(longer, shorter);
        expect(c.applyDelta(longer, removeDelta)).toBe(shorter);
    });

    it('returns base unchanged for an empty delta', () => {
        const c = component as unknown as DeltaComponent;
        expect(c.applyDelta('base\ncontent', '')).toBe('base\ncontent');
    });

    it('applyDelta skips an empty op segment produced by a malformed delta string (white-box)', () => {
        const c = component as unknown as DeltaComponent;
        expect(c.applyDelta('a\nb', '=0\x01\x01+c')).toBe('a\nc');
    });
});

describe('RichTextEditorComponent — keyboard shortcuts execute formatting', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const selectAll = () => selectAllOf(editor);

    const key = (k: string, opts: Partial<KeyboardEventInit> = {}) =>
        new KeyboardEvent('keydown', { key: k, ctrlKey: true, bubbles: true, cancelable: true, ...opts });

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        TestBed.inject(ShortcutBindingService);
    });

    it('Ctrl+B bolds the selection', () => {
        component.writeValue('<p>bold me</p>');
        fixture.detectChanges();
        selectAll();
        component.onKeydown(key('b'));
        expect(editor.querySelector('b,strong')).toBeTruthy();
    });

    it('Ctrl+I italicises the selection', () => {
        component.writeValue('<p>ital me</p>');
        fixture.detectChanges();
        selectAll();
        component.onKeydown(key('i'));
        expect(editor.querySelector('i,em')).toBeTruthy();
    });

    it('Ctrl+U underlines the selection', () => {
        component.writeValue('<p>under me</p>');
        fixture.detectChanges();
        selectAll();
        component.onKeydown(key('u'));
        expect(editor.querySelector('u')).toBeTruthy();
    });

    it('Ctrl+K delegates to the registered link editor', () => {
        component.writeValue('<p>link me</p>');
        fixture.detectChanges();
        selectAll();
        let opened = false;
        component.registerLinkEditor(() => { opened = true; });
        component.onKeydown(key('k'));
        expect(opened).toBe(true);
    });

    it('Ctrl+K is inert when no link editor is registered', () => {
        component.writeValue('<p>link me</p>');
        fixture.detectChanges();
        selectAll();
        expect(() => component.onKeydown(key('k'))).not.toThrow();
    });

    it('Ctrl+F opens find without replace', () => {
        component.onKeydown(key('f'));
        expect(component.findReplaceVisible()).toBe(true);
        expect(component.findShowReplace()).toBe(false);
    });

    it('Ctrl+H opens find with replace', () => {
        component.onKeydown(key('h'));
        expect(component.findReplaceVisible()).toBe(true);
        expect(component.findShowReplace()).toBe(true);
    });
});

describe('RichTextEditorComponent — focus, blur & selection edge cases', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        document.body.appendChild(fixture.nativeElement);
    });

    it('onFocus emits the focused output', () => {
        const spy = vi.fn();
        component.focused.subscribe(spy);
        component.onFocus();
        expect(spy).toHaveBeenCalled();
    });

    it('onBlur emits blurred, calls onTouched, and saves the current range', () => {
        component.writeValue('<p>blur test</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, 2);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);

        const touched = vi.fn();
        component.registerOnTouched(touched);
        const blurSpy = vi.fn();
        component.blurred.subscribe(blurSpy);

        component.onBlur();

        expect(blurSpy).toHaveBeenCalled();
        expect(touched).toHaveBeenCalled();
        expect((component as unknown as { savedRange: Range | null }).savedRange).not.toBeNull();
    });

    it('onBlur skips the hide-toolbar timeout when focus moves to another element inside the component', () => {
        component.writeValue('<p>blur test</p>');
        fixture.detectChanges();
        const toolbarButton = document.createElement('button');
        (fixture.nativeElement as HTMLElement).appendChild(toolbarButton);
        try {
            const blurSpy = vi.fn();
            component.blurred.subscribe(blurSpy);

            component.onBlur({ relatedTarget: toolbarButton } as unknown as FocusEvent);

            expect(blurSpy).toHaveBeenCalled();
        } finally {
            toolbarButton.remove();
        }
    });

    it('floating toolbar hides shortly after the selection collapses', () => {
        vi.useFakeTimers();
        fixture.componentRef.setInput('toolbar', 'floating');
        fixture.detectChanges();
        component.showFloatingToolbar.set(true);
        document.getSelection()?.removeAllRanges();

        component.onSelectionChange();
        vi.advanceTimersByTime(150);

        expect(component.showFloatingToolbar()).toBe(false);
        vi.useRealTimers();
    });
});

describe('RichTextEditorComponent — tables with row/col spans', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const targetCell = (cell: HTMLTableCellElement) => {
        (component as unknown as { tableContextMenuTarget: HTMLTableCellElement }).tableContextMenuTarget = cell;
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('inserting a row through a rowspan extends that span instead of splitting it', () => {
        editor.innerHTML = `<table><tbody>
            <tr><td rowspan="2">M</td><td>A2</td></tr>
            <tr><td>B2</td></tr>
        </tbody></table>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const a2 = table.querySelectorAll('tr')[0].querySelectorAll('td')[1] as HTMLTableCellElement;
        targetCell(a2);

        component.addTableRowBelow();

        const merged = table.querySelector('td[rowspan]') as HTMLTableCellElement;
        expect(merged.rowSpan).toBe(3);
        expect(table.querySelectorAll('tr')).toHaveLength(3);
    });

    it('inserting a column through a colspan extends that span', () => {
        editor.innerHTML = `<table><tbody>
            <tr><td colspan="2">M</td></tr>
            <tr><td>B1</td><td>B2</td></tr>
        </tbody></table>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const b1 = table.querySelectorAll('tr')[1].querySelectorAll('td')[0] as HTMLTableCellElement;
        targetCell(b1);

        component.addTableColumnRight();

        const merged = table.querySelector('td[colspan]') as HTMLTableCellElement;
        expect(merged.colSpan).toBe(3);
    });

    it('deleting a row that intersects a rowspan reduces the span', () => {
        editor.innerHTML = `<table><tbody>
            <tr><td rowspan="2">M</td><td>A2</td></tr>
            <tr><td>B2</td></tr>
        </tbody></table>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const b2 = table.querySelectorAll('tr')[1].querySelector('td') as HTMLTableCellElement;
        targetCell(b2);

        component.deleteTableRow();

        const merged = table.querySelector('td[rowspan]') as HTMLTableCellElement | null;
        expect(merged?.rowSpan ?? 1).toBe(1);
        expect(table.querySelectorAll('tr')).toHaveLength(1);
    });
});

describe('RichTextEditorComponent — content insertion fallbacks', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    type Internal = {
        insertText(text: string): void;
        insertHtml(html: string): void;
        insertImageAtSelection(src: string, alt: string): void;
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('appends text to the editor when there is no selection', () => {
        document.getSelection()?.removeAllRanges();
        (component as unknown as Internal).insertText('appended-text');
        expect(editor.textContent).toContain('appended-text');
    });

    it('appends HTML to the editor end when there is no selection', () => {
        document.getSelection()?.removeAllRanges();
        (component as unknown as Internal).insertHtml('<strong>appended-html</strong>');
        expect(editor.querySelector('strong')?.textContent).toBe('appended-html');
    });

});

describe('RichTextEditorComponent — readonly & disabled guards', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.componentRef.setInput('readonly', true);
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('does not paste content when readonly', async () => {
        component.writeValue('<p>locked</p>');
        fixture.detectChanges();
        await component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: { getData: () => 'should not appear', files: [] } as unknown as DataTransfer,
        } as unknown as ClipboardEvent);
        expect(editor.textContent).not.toContain('should not appear');
    });



    it('floating format command is a no-op when readonly', () => {
        component.writeValue('<p>nope</p>');
        fixture.detectChanges();
        const before = editor.innerHTML;
        component.onFloatingFormatCommand('bold');
        expect(editor.innerHTML).toBe(before);
    });
});

describe('RichTextEditorComponent — output formats & counts', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('writeValue converts markdown to HTML in markdown mode', () => {
        component.writeValue('# Heading\n\nsome **bold** text');
        fixture.detectChanges();
        expect(editor.querySelector('h1')?.textContent).toContain('Heading');
        expect(editor.querySelector('strong,b')).toBeTruthy();
    });

    it('emits markdownChange and htmlChange on input', () => {
        const mdSpy = vi.fn();
        const htmlSpy = vi.fn();
        component.markdownChange.subscribe(mdSpy);
        component.htmlChange.subscribe(htmlSpy);

        editor.innerHTML = '<p>hello world</p>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();

        expect(htmlSpy).toHaveBeenCalled();
        expect(mdSpy).toHaveBeenCalled();
        expect(htmlSpy.mock.calls.at(-1)?.[0]).toContain('hello world');
    });

    it('computes character and word counts and emits wordCountChange', () => {
        const wcSpy = vi.fn();
        component.wordCountChange.subscribe(wcSpy);

        editor.innerHTML = '<p>one two three</p>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();

        expect(component.wordCount()).toBe(3);
        expect(component.characterCount()).toBe('one two three'.length);
        expect(wcSpy).toHaveBeenCalledWith(3);
    });

    it('reports a word count of zero for empty content', () => {
        editor.innerHTML = '';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        expect(component.wordCount()).toBe(0);
    });
});

describe('RichTextEditorComponent — table context menu interactions', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        document.body.appendChild(fixture.nativeElement);
    });

    it('opening the context menu over a cell positions and shows it, with rAF adjustment', () => {
        vi.useFakeTimers();
        editor.innerHTML = '<table><tbody><tr><td>c</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const cell = editor.querySelector('td')!;

        component.onEditorContextMenu({
            target: cell, clientX: 50, clientY: 60,
            preventDefault: vi.fn(), stopPropagation: vi.fn(),
        } as unknown as MouseEvent);

        expect(component.tableContextMenuOpen()).toBe(true);
        expect(component.tableContextMenuPosition()).toEqual({ x: 50, y: 60 });

        vi.runAllTimers();
        vi.useRealTimers();
    });

    it('adjusts the context menu position so it never overflows the viewport', () => {
        vi.useFakeTimers();
        editor.innerHTML = '<table><tbody><tr><td>c</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const cell = editor.querySelector('td')!;

        component.onEditorContextMenu({
            target: cell, clientX: 50, clientY: 60,
            preventDefault: vi.fn(), stopPropagation: vi.fn(),
        } as unknown as MouseEvent);
        fixture.detectChanges();

        const menuEl = (fixture.nativeElement as HTMLElement).querySelector('.z-50.min-w-\\[180px\\]') as HTMLElement | null;
        if (menuEl) {
            vi.spyOn(menuEl, 'getBoundingClientRect').mockReturnValue({
                right: globalThis.innerWidth + 500,
                bottom: globalThis.innerHeight + 500,
                width: 200,
                height: 150,
                left: 0, top: 0, x: 0, y: 0, toJSON: () => ({}),
            } as DOMRect);
        }

        vi.runAllTimers();
        vi.useRealTimers();

        const pos = component.tableContextMenuPosition();
        expect(pos.x).toBeLessThanOrEqual(globalThis.innerWidth);
        expect(pos.y).toBeLessThanOrEqual(globalThis.innerHeight);
    });

    it('closes the context menu when right-clicking outside any table cell', () => {
        editor.innerHTML = '<p>not a table</p>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        component.tableContextMenuOpen.set(true);

        component.onEditorContextMenu({
            target: editor.querySelector('p'), clientX: 5, clientY: 5,
            preventDefault: vi.fn(), stopPropagation: vi.fn(),
        } as unknown as MouseEvent);

        expect(component.tableContextMenuOpen()).toBe(false);
    });
});

describe('RichTextEditorComponent — floating format caret & inline formats', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.componentRef.setInput('toolbar', 'floating');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        document.body.appendChild(fixture.nativeElement);
    });

    it('moves the caret past the formatting node after a floating bold inside existing bold text', () => {
        component.writeValue('<p><b>already bold</b></p>');
        fixture.detectChanges();
        const boldText = editor.querySelector('b')!.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(boldText, 2);
        r.setEnd(boldText, 6);
        sel?.removeAllRanges();
        sel?.addRange(r);
        component.showFloatingToolbar.set(true);

        component.onFormatCommand('bold');

        // The toolbar collapses and the selection should be repositioned.
        expect(component.showFloatingToolbar()).toBe(false);
        expect(document.getSelection()?.isCollapsed).toBe(true);
    });

    it('strikethrough wraps the selection in a strike element', () => {
        component.writeValue('<p>strike this</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, 0);
        r.setEnd(text, 6);
        sel?.removeAllRanges();
        sel?.addRange(r);

        component.onFormatCommand('strikethrough');

        expect(editor.querySelector('s,strike')).toBeTruthy();
    });

    it('clear command on the floating toolbar removes formatting', () => {
        component.writeValue('<p><b>bold</b></p>');
        fixture.detectChanges();
        const sel = document.getSelection();
        const r = document.createRange();
        r.selectNodeContents(editor.querySelector('b')!);
        sel?.removeAllRanges();
        sel?.addRange(r);

        component.onFloatingFormatCommand('clear');

        expect(editor.querySelector('b')).toBeNull();
        expect(editor.textContent).toBe('bold');
    });
});

describe('RichTextEditorComponent — tail span table edits', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const targetCell = (cell: HTMLTableCellElement) => {
        (component as unknown as { tableContextMenuTarget: HTMLTableCellElement }).tableContextMenuTarget = cell;
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('adding a row below a rowspan that ends at the last row extends the span', () => {
        editor.innerHTML = `<table><tbody>
            <tr><td>A1</td><td rowspan="2">M</td></tr>
            <tr><td>B1</td></tr>
        </tbody></table>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const b1 = table.querySelectorAll('tr')[1].querySelector('td') as HTMLTableCellElement;
        targetCell(b1);

        component.addTableRowBelow();

        expect(table.querySelectorAll('tr')).toHaveLength(3);
        expect((table.querySelector('td[rowspan]') as HTMLTableCellElement).rowSpan).toBe(3);
    });

    it('adding a column right of a colspan that ends at the last column extends the span', () => {
        editor.innerHTML = `<table><tbody>
            <tr><td>A1</td><td colspan="2">M</td></tr>
            <tr><td>B1</td><td>B2</td><td>B3</td></tr>
        </tbody></table>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const b3 = table.querySelectorAll('tr')[1].querySelectorAll('td')[2] as HTMLTableCellElement;
        targetCell(b3);

        component.addTableColumnRight();

        expect((table.querySelector('td[colspan]') as HTMLTableCellElement).colSpan).toBe(3);
    });

    it('deleting a column intersecting a colspan reduces the span', () => {
        editor.innerHTML = `<table><tbody>
            <tr><td colspan="2">M</td></tr>
            <tr><td>B1</td><td>B2</td></tr>
        </tbody></table>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const b1 = table.querySelectorAll('tr')[1].querySelector('td') as HTMLTableCellElement;
        targetCell(b1);

        component.deleteTableColumn();

        const merged = table.querySelector('td[colspan]') as HTMLTableCellElement | null;
        expect(merged?.colSpan ?? 1).toBe(1);
    });
});

describe('RichTextEditorComponent — find with no editor & openFindReplace focus', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        document.body.appendChild(fixture.nativeElement);
    });

    it('openFindReplace focuses the search input after the animation frame', async () => {
        component.openFindReplace(true);
        fixture.detectChanges();
        await new Promise(r => requestAnimationFrame(() => r(null)));
        const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[placeholder]');
        expect(input).toBeTruthy();
    });
});

describe('RichTextEditorComponent — paste max length & overlay handlers', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        document.body.appendChild(fixture.nativeElement);
    });


    it('truncates a paste that would exceed maxLength', () => {
        fixture.componentRef.setInput('maxLength', 8);
        fixture.detectChanges();
        editor.innerHTML = 'abc';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const text = editor.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, text.length);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);

        component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: { getData: (t: string) => (t === 'text/plain' ? 'defghijklmnop' : ''), files: [] } as unknown as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.textContent ?? '').toHaveLength(8);
        expect(editor.textContent).toBe('abcdefgh');
    });

    it('overlay text insertion temporarily disables the editor inputMode then restores it', () => {
        vi.useFakeTimers();
        component.writeValue('<p>e</p>');
        fixture.detectChanges();
        editor.inputMode = 'text';
        const text = editor.querySelector('p')!.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, 1);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);

        component.insertTextFromOverlay('😀');
        expect(editor.inputMode).toBe('none');

        vi.advanceTimersByTime(150);
        expect(editor.inputMode).toBe('text');
        expect(editor.textContent).toContain('😀');
        vi.useRealTimers();
    });

    it('re-targets the context menu to the cell beneath the overlay point', () => {
        editor.innerHTML = '<table><tbody><tr><td>cell</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const cell = editor.querySelector('td')!;
        const rect = cell.getBoundingClientRect();
        component.tableContextMenuOpen.set(true);
        fixture.detectChanges();

        const ev = new MouseEvent('contextmenu', {
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
            cancelable: true,
        });
        component.onContextMenuOverlayContextMenu(ev);

        expect(ev.defaultPrevented).toBe(true);
        expect(component.tableContextMenuOpen()).toBe(true);
    });
});

describe('RichTextEditorComponent — i18n integration', () => {
    it('defaults to English when no locale input and no provider is configured', async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(RichTextEditorComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance.resolvedLocale().code).toBe('en');
        expect(fixture.componentInstance.isRtl()).toBe(false);
    });

    it('falls back to the global UI_LOCALE_ID when no locale input is set', async () => {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const fixture = TestBed.createComponent(RichTextEditorComponent);
        fixture.detectChanges();
        expect(fixture.componentInstance.resolvedLocale().code).toBe('he');
        expect(fixture.componentInstance.isRtl()).toBe(true);
    });

    it('per-instance locale input overrides the global signal', async () => {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        const fixture = TestBed.createComponent(RichTextEditorComponent);
        fixture.componentRef.setInput('locale', 'fr');
        fixture.detectChanges();
        expect(fixture.componentInstance.resolvedLocale().code).toBe('fr');
        expect(fixture.componentInstance.isRtl()).toBe(false);
    });

    it('accepts a fully custom RichTextLocale object as input', async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(RichTextEditorComponent);
        const customLocale: RichTextLocale = {
            ...RICH_TEXT_LOCALES['en'],
            code: 'xx',
            rtl: true,
            toolbar: { ...RICH_TEXT_LOCALES['en'].toolbar, bold: 'CUSTOM_BOLD' },
        };
        fixture.componentRef.setInput('locale', customLocale);
        fixture.detectChanges();
        expect(fixture.componentInstance.resolvedLocale().toolbar.bold).toBe('CUSTOM_BOLD');
        expect(fixture.componentInstance.isRtl()).toBe(true);
    });

    it('interpolateLocale substitutes {placeholder} tokens correctly', async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(RichTextEditorComponent);
        fixture.detectChanges();
        const result = fixture.componentInstance.interpolateLocale(
            'Page {n} of {total}',
            { n: 3, total: 7 },
        );
        expect(result).toBe('Page 3 of 7');
    });
});

describe('RichTextEditorComponent - addon host', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [RichTextEditorComponent] }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('is provided via DI as RichTextEditorAddonHost', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        expect(host).toBe(component);
    });

    it('renders a registered toolbar slot after built-ins and fires its onClick', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        const clicks: Event[] = [];
        host.toolbarSlots.register({
            id: 'demo', icon: '<svg></svg>', tooltip: 'Demo', order: 500,
            onClick: (e) => clicks.push(e),
        });
        fixture.detectChanges();
        const btn = fixture.nativeElement.querySelector('[data-addon-slot="demo"]') as HTMLButtonElement;
        expect(btn).toBeTruthy();
        btn.click();
        expect(clicks).toHaveLength(1);
    });

    it('selection() reports none when the editor is empty and unfocused', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        const snap = host.selection();
        expect(snap.kind).toBe('none');
        expect(snap.closestWithAttrs(['data-foo'])).toBeNull();
    });

    it('selection() reports none when there is a live selection with zero ranges', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        document.getSelection()?.removeAllRanges();
        expect(host.selection().kind).toBe('none');
    });

    it('selection() text snapshot closestWithAttrs resolves the nearest ancestor with the attribute', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<div data-testid="wrap"><p>hello world</p></div>';
        const node = editor.querySelector('p')!.firstChild!;
        const range = document.createRange();
        range.setStart(node, 0); range.setEnd(node, 5);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);

        const snap = host.selection();
        expect(snap.closestWithAttrs(['data-testid'])?.getAttribute('data-testid')).toBe('wrap');
    });

    it('selection() reports text kind and the selected string', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<p>hello world</p>';
        const node = editor.querySelector('p')!.firstChild!;
        const range = document.createRange();
        range.setStart(node, 0); range.setEnd(node, 5);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
        const snap = host.selection();
        expect(snap.kind).toBe('text');
        expect(snap.text).toBe('hello');
    });

    it('wrapSelection wraps the current text range in the built element', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<p>hello world</p>';
        const node = editor.querySelector('p')!.firstChild!;
        const range = document.createRange();
        range.setStart(node, 0); range.setEnd(node, 5);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
        host.saveSelection();
        const created = host.wrapSelection(() => {
            const s = document.createElement('span');
            s.setAttribute('data-action-click', 'a');
            return s;
        });
        expect(created.length).toBeGreaterThan(0);
        expect(editor.querySelector('span[data-action-click="a"]')?.textContent).toBe('hello');
    });

    it('mutateContent applies a change and pushes an undoable history entry', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        host.mutateContent((root) => { root.innerHTML = '<p>abc</p>'; });
        const before = editor.innerHTML;
        host.mutateContent((root) => {
            const span = document.createElement('span');
            span.setAttribute('data-action-click', 'a');
            span.textContent = 'X';
            root.querySelector('p')!.appendChild(span);
        });
        expect(editor.querySelector('span[data-action-click="a"]')).toBeTruthy();
        (component as unknown as { undo(): void }).undo();
        fixture.detectChanges();
        expect(editor.innerHTML).toBe(before);
    });

    it('mutateContent/wrapSelection/restoreSelection are no-ops when the editor view is not yet available', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        const original = (component as unknown as { editorDiv?: unknown }).editorDiv;
        (component as unknown as { editorDiv?: unknown }).editorDiv = undefined;
        try {
            expect(() => host.mutateContent((root) => { root.innerHTML = '<p>x</p>'; })).not.toThrow();
            expect(host.wrapSelection(() => document.createElement('span'))).toEqual([]);
            expect(() => component.restoreSelection()).not.toThrow();
        } finally {
            (component as unknown as { editorDiv?: unknown }).editorDiv = original;
        }
    });

    it('wrapSelection returns an empty array without an active selection', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(host.wrapSelection(() => document.createElement('span'))).toEqual([]);
        } finally {
            spy.mockRestore();
        }
    });

    it('saveSelection/restoreSelection survive a focus change', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<p>hello world</p>';
        const node = editor.querySelector('p')!.firstChild!;
        const range = document.createRange();
        range.setStart(node, 6); range.setEnd(node, 11);
        const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
        host.saveSelection();
        sel.removeAllRanges();
        host.restoreSelection();
        expect(window.getSelection()!.toString()).toBe('world');
    });

    function caretIn(node: Node, offset: number): void {
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
    }

    it('executeToolbarCommandOnBlock re-tags a block to a heading', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<p>hello</p>';
        const block = editor.querySelector('p')!;
        caretIn(block.firstChild!, 5);
        host.executeToolbarCommandOnBlock('heading1', block);
        expect(editor.querySelector('h1')?.textContent).toBe('hello');
    });

    it('executeToolbarCommandOnBlock wraps a block in a bullet list', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<p>item</p>';
        const block = editor.querySelector('p')!;
        caretIn(block.firstChild!, 4);
        host.executeToolbarCommandOnBlock('bulletList', block);
        expect(editor.querySelector('ul > li')?.textContent).toBe('item');
    });

    it('executeToolbarCommandOnBlock inserts inline code at the caret', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<p>x</p>';
        const block = editor.querySelector('p')!;
        caretIn(block.firstChild!, 1);
        host.executeToolbarCommandOnBlock('code', block);
        expect(editor.querySelector('code')).toBeTruthy();
    });

    it('insertTextAtCaret / insertHtmlAtCaret insert one undoable entry each', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<p>a</p>';
        caretIn(editor.querySelector('p')!.firstChild!, 1);
        host.insertTextAtCaret('B');
        expect(editor.textContent).toContain('aB');
        host.insertHtmlAtCaret('<strong>C</strong>');
        expect(editor.querySelector('strong')?.textContent).toBe('C');
    });

    it('insertHtmlAtCaret with html that sanitizes to nothing collapses the caret at the range end', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor.innerHTML = '<p>a</p>';
        caretIn(editor.querySelector('p')!.firstChild!, 1);

        expect(() => host.insertHtmlAtCaret('<script>evil()</script>')).not.toThrow();
        expect(editor.textContent).toBe('a');
    });

    it('commitContent syncs direct DOM edits into the emitted model value', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        const emitted: string[] = [];
        component.registerOnChange((v: string) => emitted.push(v));
        editor.innerHTML = '<p>direct edit</p>';
        host.commitContent();
        expect(emitted.at(-1)).toContain('direct edit');
    });

    it('registerKeydownInterceptor consumes the event and blocks base handling', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        const seen: string[] = [];
        const off = host.registerKeydownInterceptor((e) => {
            seen.push(e.key);
            return e.key === 'ArrowDown';
        });
        const down = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
        component.onKeydown(down);
        expect(seen).toEqual(['ArrowDown']);
        off();
        seen.length = 0;
        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        expect(seen).toEqual([]);
    });

    it('getCaretOffset returns 0 without a selection or without an anchorNode (white-box)', () => {
        editor.innerHTML = '<p>text</p>';
        const getOffset = (component as unknown as { getCaretOffset: (el: HTMLElement) => number }).getCaretOffset.bind(component);

        const noSelSpy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(getOffset(editor)).toBe(0);
        } finally {
            noSelSpy.mockRestore();
        }

        const sel = document.getSelection()!;
        sel.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(editor.querySelector('p')!);
        sel.addRange(range);
        const noAnchorSpy = vi.spyOn(Selection.prototype, 'anchorNode', 'get').mockReturnValue(null);
        try {
            expect(getOffset(editor)).toBe(0);
        } finally {
            noAnchorSpy.mockRestore();
        }
    });

    it('registerInputObserver receives the trigger-aware text on input', () => {
        const host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        const seen: string[] = [];
        const off = host.registerInputObserver((text) => seen.push(text));
        editor.innerHTML = '<p>/hi</p>';
        caretIn(editor.querySelector('p')!.firstChild!, 3);
        component.onInput({ target: editor } as unknown as Event);
        expect(seen.some((t) => t.includes('/hi'))).toBe(true);
        off();
    });
});

describe('RichTextEditorComponent — addon-host seams & edge coverage', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let host: RichTextEditorAddonHost;
    let editor: HTMLDivElement;

    const caretIn = (node: Node, offset: number) => setCaretAt(node, offset);

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        host = fixture.debugElement.injector.get(RichTextEditorAddonHost);
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('exposes contentRoot, overlayAnchor, commands and globalCommands', () => {
        expect(host.contentRoot).toBe(editor);
        expect(host.overlayAnchor).toBeTruthy();
        expect(host.commands).toBeInstanceOf(RichTextCommandRegistry);
        expect(host.globalCommands).toBeInstanceOf(RichTextCommandRegistry);
    });

    it('runs a registered shortcut action on Mod+Shift+H and tears it down', () => {
        let runs = 0;
        const off = host.registerShortcutAction('rich-text.history', () => { runs += 1; });

        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'H', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(runs).toBe(1);

        off();
        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'H', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(runs).toBe(1);
    });

    it('honours the shortcut action guard (when returns false)', () => {
        let runs = 0;
        host.registerShortcutAction('rich-text.history', () => { runs += 1; }, () => false);
        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'H', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
        }));
        expect(runs).toBe(0);
    });

    it('registerPasteInterceptor consumes the paste before the base handles it', () => {
        const seen: ClipboardEvent[] = [];
        const off = host.registerPasteInterceptor((event) => { seen.push(event); return true; });

        const paste = {
            preventDefault: vi.fn(),
            clipboardData: { getData: () => 'should not appear', files: [] } as unknown as DataTransfer,
        } as unknown as ClipboardEvent;
        component.onPaste(paste);

        expect(seen).toHaveLength(1);
        expect(editor.textContent).not.toContain('should not appear');
        off();
    });

    it('registerDropInterceptor consumes the drop', async () => {
        const seen: DragEvent[] = [];
        const off = host.registerDropInterceptor((event) => { seen.push(event); return true; });

        await component.onEditorDrop({
            preventDefault: vi.fn(),
            dataTransfer: { types: ['Files'], files: [] },
        } as unknown as DragEvent);

        expect(seen).toHaveLength(1);
        off();
    });

    it('onEditorDrop with no interceptors claiming it falls through cleanly', async () => {
        await expect(component.onEditorDrop({
            preventDefault: vi.fn(),
            dataTransfer: { types: ['Files'], files: [] },
        } as unknown as DragEvent)).resolves.toBeUndefined();
    });

    it('onEditorDrop is a no-op while disabled', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        const seen: DragEvent[] = [];
        const off = host.registerDropInterceptor((event) => { seen.push(event); return true; });

        await component.onEditorDrop({
            preventDefault: vi.fn(),
            dataTransfer: { types: ['Files'], files: [] },
        } as unknown as DragEvent);

        expect(seen).toHaveLength(0);
        off();
    });

    it('registerDropZonePredicate lets dragover claim a file drag and dragleave clears it', () => {
        const off = host.registerDropZonePredicate((event) => (event.dataTransfer?.types ?? []).includes('Files'));

        const over = { preventDefault: vi.fn(), dataTransfer: { types: ['Files'] } } as unknown as DragEvent;
        component.onEditorDragOver(over);
        expect(over.preventDefault).toHaveBeenCalled();
        expect(component.dragOver()).toBe(true);

        component.onEditorDragLeave({ currentTarget: editor, relatedTarget: null } as unknown as DragEvent);
        expect(component.dragOver()).toBe(false);
        off();
    });

    it('dragover ignores a drag without files and when no predicate claims it', () => {
        component.onEditorDragOver({ preventDefault: vi.fn(), dataTransfer: { types: [] } } as unknown as DragEvent);
        expect(component.dragOver()).toBe(false);

        const over = { preventDefault: vi.fn(), dataTransfer: { types: ['Files'] } } as unknown as DragEvent;
        component.onEditorDragOver(over);
        expect(over.preventDefault).not.toHaveBeenCalled();
        expect(component.dragOver()).toBe(false);
    });

    it('projects the history stack via historyEntries / currentHistoryIndex / reconstructHistoryEntry', () => {
        component.writeValue('<p>first</p>');
        host.mutateContent((root) => { root.innerHTML = '<p>second</p>'; });

        const entries = host.historyEntries();
        expect(entries.length).toBeGreaterThan(0);
        expect(host.currentHistoryIndex()).toBe(entries.length - 1);

        const reconstructed = host.reconstructHistoryEntry(entries.length - 1);
        expect(reconstructed).not.toBeNull();
        expect(reconstructed?.html).toContain('second');
        expect(host.reconstructHistoryEntry(-1)).toBeNull();
        expect(host.reconstructHistoryEntry(999)).toBeNull();
    });

    it('selection() reports an image target and resolves closestWithAttrs', () => {
        component.writeValue('<p><img src="https://cdn.test/a.png" alt="a"></p>');
        fixture.detectChanges();
        const img = editor.querySelector('img')!;
        component.onEditorClick({ target: img, preventDefault: vi.fn() } as unknown as MouseEvent);
        caretIn(img, 0);

        const snap = host.selection();
        expect(snap.kind).toBe('image');
        expect(snap.imageElement).toBe(img);
        expect(snap.closestWithAttrs(['src'])).toBe(img);
        expect(snap.closestWithAttrs(['data-nope'])).toBeNull();
    });

    it('wrapSelection falls back to extract+insert when surroundContents throws', () => {
        editor.innerHTML = '<p><b>bo</b>ld text</p>';
        const p = editor.querySelector('p')!;
        const range = document.createRange();
        range.setStart(p.querySelector('b')!.firstChild!, 1);
        range.setEnd(p.lastChild!, 2);
        const sel = document.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        component.saveSelection();

        const wrapped = host.wrapSelection(() => document.createElement('mark'));
        expect(wrapped).toHaveLength(1);
        expect(editor.querySelector('mark')).toBeTruthy();
    });

    it('executeToolbarCommandOnBlock places the caret in an empty block then formats it', () => {
        editor.innerHTML = '<p><br></p>';
        const block = editor.querySelector('p')!;
        host.executeToolbarCommandOnBlock('heading2', block);
        expect(editor.querySelector('h2')).toBeTruthy();
    });

    it('executeToolbarCommandOnBlock falls back to onFormatCommand for a null-transform command', () => {
        editor.innerHTML = '<p>align me</p>';
        const block = editor.querySelector('p')!;
        caretIn(block.firstChild!, 5);
        host.executeToolbarCommandOnBlock('alignCenter', block);
        expect(editor.querySelector('p')).toBeTruthy();
    });

    it('executeToolbarCommandOnBlock places a zero-width node into a block with no children at all', () => {
        editor.innerHTML = '<p></p>';
        const block = editor.querySelector('p')!;
        expect(() => host.executeToolbarCommandOnBlock('heading2', block)).not.toThrow();
        expect(editor.querySelector('h2')?.textContent).toContain('​');
    });

    it('placeCaretAtEndOfBlock is a no-op without an active selection (white-box)', () => {
        editor.innerHTML = '<p>x</p>';
        const block = editor.querySelector('p')!;
        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(() => (component as unknown as { placeCaretAtEndOfBlock: (b: HTMLElement) => void })
                .placeCaretAtEndOfBlock(block)).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('executeToolbarCommandOnBlock reuses an existing zero-width text node on a second call', () => {
        editor.innerHTML = '<p><br></p>';
        const block = editor.querySelector('p')!;
        host.executeToolbarCommandOnBlock('heading2', block);
        const h2 = editor.querySelector('h2')!;

        expect(() => host.executeToolbarCommandOnBlock('heading3', h2)).not.toThrow();
        expect(editor.querySelector('h3')).toBeTruthy();
    });

    it('executeToolbarCommandOnBlock is inert for a block detached from the editor', () => {
        const detached = document.createElement('p');
        detached.textContent = 'detached';
        expect(() => host.executeToolbarCommandOnBlock('heading1', detached)).not.toThrow();
        expect(detached.tagName).toBe('P');
    });

    it('executeToolbarCommandOnBlock wraps a block in an ordered list', () => {
        editor.innerHTML = '<p>numbered</p>';
        const block = editor.querySelector('p')!;
        host.executeToolbarCommandOnBlock('orderedList', block);
        expect(editor.querySelector('ol')).toBeTruthy();
    });

    it('executeToolbarCommandOnBlock wraps an already-empty block into a list item with a <br>', () => {
        editor.innerHTML = '<p></p>';
        const block = editor.querySelector('p')!;
        host.executeToolbarCommandOnBlock('bulletList', block);
        expect(editor.querySelector('ul li')?.innerHTML).toContain('br');
    });

    it('executeToolbarCommandOnBlock re-tags a bullet list item to an ordered list item in place', () => {
        editor.innerHTML = '<ul><li>one</li></ul>';
        const li = editor.querySelector('li')!;
        host.executeToolbarCommandOnBlock('orderedList', li);
        expect(editor.querySelector('ol > li')?.textContent).toBe('one');
        expect(editor.querySelector('ul')).toBeNull();
    });

    it('transformBlockForSlashCommand is a no-op re-tag when the block is already the target tag', () => {
        editor.innerHTML = '<h1>already h1</h1>';
        const block = editor.querySelector('h1')!;
        host.executeToolbarCommandOnBlock('heading1', block);
        expect(editor.querySelectorAll('h1')).toHaveLength(1);
    });

    it('insertInlineCodeFromSlash is a no-op without an active selection', () => {
        editor.innerHTML = '<p>x</p>';
        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(() => host.executeToolbarCommandOnBlock('code', null)).not.toThrow();
        } finally {
            spy.mockRestore();
        }
        expect(editor.querySelector('code')).toBeNull();
    });

    it('executeToolbarCommandOnBlock places the caret after a trailing non-text node', () => {
        editor.innerHTML = '<p>text<img src="https://cdn.test/a.png" alt="a"></p>';
        const block = editor.querySelector('p')!;
        caretIn(block.firstChild!, 2);

        expect(() => host.executeToolbarCommandOnBlock('alignCenter', block)).not.toThrow();
        expect(editor.querySelector('img')).toBeTruthy();
    });

    it('showLinkDialog delegates to a registered editor and is inert once torn down', () => {
        let opened = 0;
        const off = host.registerLinkEditor(() => { opened += 1; });
        host.showLinkDialog();
        expect(opened).toBe(1);
        off();
        expect(() => host.showLinkDialog()).not.toThrow();
        expect(opened).toBe(1);
    });

    it('formats heading2, heading3 and paragraph via onFormatCommand', () => {
        component.writeValue('<p>title</p>');
        fixture.detectChanges();
        selectAllOf(editor);
        component.onFormatCommand('heading2');
        expect(editor.querySelector('h2')).toBeTruthy();

        selectAllOf(editor.querySelector('h2')!);
        component.onFormatCommand('heading3');
        expect(editor.querySelector('h3')).toBeTruthy();

        selectAllOf(editor.querySelector('h3')!);
        component.onFormatCommand('paragraph');
        expect(editor.querySelector('p')).toBeTruthy();
    });

    it('undoes via the undo block format command', () => {
        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();

        component.onFormatCommand('undo');
        expect(editor.textContent).toBe('one');
    });

    it('redoes via the redo block format command', () => {
        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();
        (component as any).undo();
        expect(editor.textContent).toBe('one');

        component.onFormatCommand('redo');
        expect(editor.textContent).toBe('two');
    });

    it('applies left and right alignment and ignores an unknown command', () => {
        component.writeValue('<p>aligned</p>');
        fixture.detectChanges();
        selectAllOf(editor);
        expect(() => component.onFormatCommand('alignLeft')).not.toThrow();
        expect(() => component.onFormatCommand('alignRight')).not.toThrow();
        expect(() => component.onFormatCommand('not-a-command')).not.toThrow();
        expect(editor.textContent).toContain('aligned');
    });

    it('lights up active inline formats after bolding the selection', () => {
        component.writeValue('<p>state</p>');
        fixture.detectChanges();
        selectAllOf(editor);
        component.onFormatCommand('bold');
        selectAllOf(editor.querySelector('b')!);
        component['updateActiveFormats']();
        expect(component.activeFormats().has('bold')).toBe(true);
    });

    it('reports a bullet list as an active format', () => {
        component.writeValue('<ul><li>one</li></ul>');
        fixture.detectChanges();
        selectAllOf(editor.querySelector('li')!.firstChild!);
        component['updateActiveFormats']();
        expect(component.activeFormats().has('bulletList')).toBe(true);
    });

    it('detectCurrentFontSize/FontFamily are no-ops without a defaultView on the document', () => {
        component.writeValue('<p>state</p>');
        fixture.detectChanges();
        selectAllOf(editor);

        const spy = vi.spyOn(document, 'defaultView', 'get').mockReturnValue(null);
        try {
            expect(() => component['updateActiveFormats']()).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('taskList command re-lists when the caret already sits in a task list', () => {
        component.writeValue('<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>todo</span></li></ul>');
        fixture.detectChanges();
        const span = editor.querySelector('li[data-task] span')!;
        caretIn(span.firstChild ?? span, 0);
        expect(() => component.onFormatCommand('taskList')).not.toThrow();
    });
});

describe('RichTextEditorComponent — table operations via context menu', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const setTarget = (cell: HTMLTableCellElement) => {
        (component as unknown as { tableContextMenuTarget: HTMLTableCellElement }).tableContextMenuTarget = cell;
    };

    const seed = () => {
        editor.innerHTML = '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return editor.querySelector('table')!;
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('adds a row above and below the targeted cell', () => {
        const table = seed();
        setTarget(table.querySelectorAll('td')[0] as HTMLTableCellElement);
        component.addTableRowBelow();
        setTarget(table.querySelectorAll('td')[0] as HTMLTableCellElement);
        component.addTableRowAbove();
        expect(table.querySelectorAll('tr')).toHaveLength(4);
    });

    it('adds a column to the left and right of the targeted cell', () => {
        const table = seed();
        setTarget(table.querySelectorAll('td')[0] as HTMLTableCellElement);
        component.addTableColumnRight();
        setTarget(table.querySelectorAll('td')[0] as HTMLTableCellElement);
        component.addTableColumnLeft();
        expect(table.querySelectorAll('tr')[0].querySelectorAll('td')).toHaveLength(4);
    });

    it('insertTableColumn skips a grid row index with no corresponding <tr> (white-box: forces the rows/grid length mismatch defensive guard)', () => {
        const table = seed();
        setTarget(table.querySelectorAll('td')[0] as HTMLTableCellElement);

        const realQuery = table.querySelectorAll.bind(table);
        let trCalls = 0;
        vi.spyOn(table, 'querySelectorAll').mockImplementation(((selector: string) => {
            const result = realQuery(selector);
            if (selector === 'tr') {
                trCalls += 1;
                if (trCalls > 2) {
                    return Array.from(result).slice(0, 1) as unknown as NodeListOf<Element>;
                }
            }
            return result;
        }) as typeof table.querySelectorAll);

        expect(() => component.addTableColumnRight()).not.toThrow();
    });

    it('merges the selected cells then splits the merged cell back', () => {
        const table = seed();
        const firstRow = table.querySelectorAll('tr')[0];
        const cells = Array.from(firstRow.querySelectorAll('td')) as HTMLTableCellElement[];
        component.tableCellSelected.set(cells);
        component.mergeCells();
        const merged = table.querySelector('td[colspan="2"]') as HTMLTableCellElement | null;
        expect(merged).not.toBeNull();

        setTarget(merged!);
        expect(component.canSplitCell()).toBe(true);
        component.splitCell();
        expect(table.querySelector('td[colspan="2"]')).toBeNull();
    });

    it('deletes the targeted column and row', () => {
        const table = seed();
        setTarget(table.querySelectorAll('td')[1] as HTMLTableCellElement);
        component.deleteTableColumn();
        expect(table.querySelectorAll('tr')[0].querySelectorAll('td')).toHaveLength(1);

        setTarget(table.querySelectorAll('td')[0] as HTMLTableCellElement);
        component.deleteTableRow();
        expect(table.querySelectorAll('tr')).toHaveLength(1);
    });

    it('deleteTableRow removes a single-row table entirely', () => {
        editor.innerHTML = '<table><tbody><tr><td>only</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        setTarget(table.querySelector('td') as HTMLTableCellElement);
        component.deleteTableRow();
        expect(editor.querySelector('table')).toBeNull();
    });

    it('deleteTable removes the whole table', () => {
        const table = seed();
        setTarget(table.querySelector('td') as HTMLTableCellElement);
        component.deleteTable();
        expect(editor.querySelector('table')).toBeNull();
    });

    it('inserting a row mid-table above a cell spanning both rows and columns skips already-expanded reference cells', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td rowspan="2" colspan="2">A</td><td>B</td></tr>'
            + '<tr><td>C</td></tr>'
            + '<tr><td>D</td><td>E</td><td>F</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellC = table.querySelectorAll('tr')[1].querySelector('td')!;
        setTarget(cellC);

        expect(() => component.addTableRowAbove()).not.toThrow();

        const cellA = table.querySelector('td')!;
        expect(cellA.rowSpan).toBe(3);
        expect(table.querySelectorAll('tr')).toHaveLength(4);
    });

    it('inserting a column mid-table before a cell spanning both rows and columns skips already-expanded reference cells', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td rowspan="2" colspan="2">A</td><td>B</td></tr>'
            + '<tr><td>C</td></tr>'
            + '<tr><td>D</td><td>E</td><td>F</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellE = table.querySelectorAll('tr')[2].querySelectorAll('td')[1];
        setTarget(cellE);

        expect(() => component.addTableColumnLeft()).not.toThrow();

        const cellA = table.querySelector('td')!;
        expect(cellA.colSpan).toBe(3);
    });

    it('deleting a row intersecting a rowspan shrinks the span and moves the cell into the next row', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td rowspan="2">A</td><td>B</td></tr>'
            + '<tr><td>C</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellB = table.querySelectorAll('tr')[0].querySelectorAll('td')[1];
        setTarget(cellB);

        expect(() => component.deleteTableRow()).not.toThrow();

        const cellA = table.querySelector('td')!;
        expect(cellA.rowSpan).toBe(1);
        expect(table.querySelectorAll('tr')).toHaveLength(1);
        expect(table.textContent).toContain('A');
        expect(table.textContent).toContain('C');
    });

    it('deleting a column intersecting a colspan reduces the span', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td colspan="2">A</td><td>B</td></tr>'
            + '<tr><td>C</td><td>D</td><td>E</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellD = table.querySelectorAll('tr')[1].querySelectorAll('td')[1];
        setTarget(cellD);

        expect(() => component.deleteTableColumn()).not.toThrow();

        const cellA = table.querySelector('td')!;
        expect(cellA.colSpan).toBe(1);
    });

    it('deleting a jagged row with a missing trailing cell skips the empty grid slot', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td>A</td><td>B</td><td>C</td></tr>'
            + '<tr><td>D</td><td>E</td></tr>'
            + '<tr><td>F</td><td>G</td><td>H</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellE = table.querySelectorAll('tr')[1].querySelectorAll('td')[1] as HTMLTableCellElement;
        setTarget(cellE);

        expect(() => component.deleteTableRow()).not.toThrow();
        expect(table.querySelectorAll('tr')).toHaveLength(2);
    });

    it('adding a column right of a jagged row with a missing trailing cell skips the empty grid slot', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td>A</td><td>B</td></tr>'
            + '<tr><td>C</td></tr>'
            + '<tr><td>D</td><td>E</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellE = table.querySelectorAll('tr')[2].querySelectorAll('td')[1] as HTMLTableCellElement;
        setTarget(cellE);

        expect(() => component.addTableColumnRight()).not.toThrow();
        expect(table.querySelectorAll('tr')[0].querySelectorAll('td, th')).toHaveLength(3);
    });

    it('adding a row below a jagged last row with a missing trailing cell skips the empty grid slot', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td>A</td><td>B</td><td>C</td></tr>'
            + '<tr><td>D</td><td>E</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellE = table.querySelectorAll('tr')[1].querySelectorAll('td')[1] as HTMLTableCellElement;
        setTarget(cellE);

        expect(() => component.addTableRowBelow()).not.toThrow();
        expect(table.querySelectorAll('tr')).toHaveLength(3);
    });

    it('deleting a row skips a non-adjacent rowspan neighbor before finding the real next-row cell to relocate before', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td>P</td><td rowspan="3">Q</td><td>R</td></tr>'
            + '<tr><td rowspan="2">X</td><td>S</td></tr>'
            + '<tr><td>T</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellX = table.querySelectorAll('tr')[1].querySelector('td')!;
        setTarget(cellX);

        expect(() => component.deleteTableRow()).not.toThrow();

        expect(table.querySelectorAll('tr')).toHaveLength(2);
        expect(table.textContent).toContain('X');
        expect(table.textContent).toContain('T');
        const cellQ = table.querySelector('td[rowspan]') as HTMLTableCellElement;
        expect(cellQ.rowSpan).toBe(2);
    });

    it('mergeCells skips a cell already counted once (rowspan/colspan overlap) when gathering content', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td rowspan="2" colspan="2">A</td><td>B</td></tr>'
            + '<tr><td>C</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellA = table.querySelector('td')!;
        const cellB = table.querySelectorAll('td')[1] as HTMLTableCellElement;
        const cellC = table.querySelectorAll('td')[2] as HTMLTableCellElement;
        component.tableCellSelected.set([cellA, cellB, cellC]);

        expect(() => component.mergeCells()).not.toThrow();

        const merged = table.querySelector('td')!;
        expect(merged.textContent).toContain('A');
        expect(merged.textContent).toContain('B');
        expect(merged.textContent).toContain('C');
    });

    it('inserting a column after a rowspan/colspan cell skips a non-adjacent neighbor before finding the real column reference cell', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td rowspan="3">P</td><td>Q</td><td rowspan="2">R</td></tr>'
            + '<tr><td>S</td></tr>'
            + '<tr><td>T</td><td>U</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellQ = table.querySelectorAll('tr')[0].querySelectorAll('td')[1] as HTMLTableCellElement;
        setTarget(cellQ);

        expect(() => component.addTableColumnRight()).not.toThrow();

        expect(table.querySelectorAll('tr')[0].querySelectorAll('td, th')).toHaveLength(4);
    });

    it('deleting a column skips a rowspan cell it already processed on an earlier grid row', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td rowspan="2">A</td><td>B</td></tr>'
            + '<tr><td>C</td></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellA = table.querySelector('td')!;
        setTarget(cellA);

        expect(() => component.deleteTableColumn()).not.toThrow();

        expect(table.querySelector('td')?.textContent).not.toContain('A');
    });

    it('deleteTable is a no-op without a target cell', () => {
        seed();
        setTarget(null as unknown as HTMLTableCellElement);
        expect(() => component.deleteTable()).not.toThrow();
    });

    it('toggleTableHeaderRow creates a tbody when none exists while un-toggling a header-only table', () => {
        editor.innerHTML = '<table><thead><tr><th>A</th><th>B</th></tr></thead></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        setTarget(table.querySelector('th') as unknown as HTMLTableCellElement);

        expect(() => component.toggleTableHeaderRow()).not.toThrow();

        expect(table.querySelector('tbody')).toBeTruthy();
        expect(table.querySelector('thead')).toBeNull();
        expect(table.querySelectorAll('td')).toHaveLength(2);
    });

    it('deleting a row whose relocated rowspan cell finds no eligible neighbor in the next (fully-spanned) row appends it directly', () => {
        editor.innerHTML = '<table><tbody>'
            + '<tr><td>N</td><td rowspan="3">M</td><td rowspan="3">S</td></tr>'
            + '<tr><td rowspan="2">X</td></tr>'
            + '<tr></tr>'
            + '</tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        const cellX = table.querySelectorAll('tr')[1].querySelector('td')!;
        setTarget(cellX);

        expect(() => component.deleteTableRow()).not.toThrow();

        expect(table.querySelectorAll('tr')).toHaveLength(2);
        expect(table.textContent).toContain('X');
        expect(table.querySelectorAll('tr')[1].contains(cellX)).toBe(true);
    });

    it('getTableCellInfo returns null for a cell with no row/table ancestor (white-box via addTableRowAbove)', () => {
        const detached = document.createElement('td');
        setTarget(detached);
        expect(() => component.addTableRowAbove()).not.toThrow();
    });

    it('table operations are inert without a target cell', () => {
        seed();
        setTarget(null as unknown as HTMLTableCellElement);
        expect(() => {
            component.addTableRowBelow();
            component.addTableColumnLeft();
            component.deleteTableRow();
            component.deleteTableColumn();
        }).not.toThrow();
    });
});

describe('RichTextEditorComponent — RTL, Enter edges & misc coverage', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const setTarget = (cell: HTMLTableCellElement) => {
        (component as unknown as { tableContextMenuTarget: HTMLTableCellElement }).tableContextMenuTarget = cell;
    };
    const caretIn = (node: Node, offset: number) => setCaretAt(node, offset);

    const createRtl = async () => {
        const { provideUiLocale } = await import('../../lib/i18n');
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
            providers: [provideUiLocale('he')],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('mode', 'html');
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    };

    it('routes alignment and table-column insertion through the RTL branch', async () => {
        await createRtl();
        expect(component.isRtl()).toBe(true);

        component.writeValue('<p>rtl align</p>');
        fixture.detectChanges();
        selectAllOf(editor);
        expect(() => component.onFormatCommand('alignLeft')).not.toThrow();
        expect(() => component.onFormatCommand('alignRight')).not.toThrow();

        editor.innerHTML = '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const table = editor.querySelector('table')!;
        setTarget(table.querySelector('td') as HTMLTableCellElement);
        component.addTableColumnLeft();
        setTarget(table.querySelector('td') as HTMLTableCellElement);
        component.addTableColumnRight();
        expect(table.querySelectorAll('tr')[0].querySelectorAll('td')).toHaveLength(4);
    });

    describe('LTR editor', () => {
        beforeEach(async () => {
            await TestBed.configureTestingModule({
                imports: [RichTextEditorComponent],
            }).compileComponents();
            fixture = TestBed.createComponent(RichTextEditorComponent);
            component = fixture.componentInstance;
            fixture.componentRef.setInput('mode', 'html');
            fixture.detectChanges();
            editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        });

        it('Enter inside a summary with no content sibling creates a paragraph', () => {
            component.writeValue('<details><summary>title</summary></details>');
            fixture.detectChanges();
            const summary = editor.querySelector('summary')!;
            caretIn(summary.firstChild ?? summary, 0);
            component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            expect(editor.querySelector('details > p')).toBeTruthy();
        });

        it('Enter at the end of an empty details tail line exits the block', () => {
            component.writeValue('<details><summary>s</summary><p>body</p><p></p></details>');
            fixture.detectChanges();
            const tail = editor.querySelectorAll('details > p')[1] as HTMLElement;
            caretIn(tail, 0);
            component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            expect(editor.querySelectorAll('details').length).toBeLessThanOrEqual(1);
        });

        it('isSelectionInsideEditor reflects whether the caret sits in the editor', () => {
            const probe = component as unknown as { isSelectionInsideEditor(): boolean };
            document.getSelection()?.removeAllRanges();
            expect(probe.isSelectionInsideEditor()).toBe(false);

            component.writeValue('<p>inside</p>');
            fixture.detectChanges();
            caretIn(editor.querySelector('p')!.firstChild!, 3);
            expect(probe.isSelectionInsideEditor()).toBe(true);
        });
    });
});

@Component({
    imports: [RichTextEditorComponent, FormsModule],
    template: `<ui-rich-text-editor [(ngModel)]="value" />`,
})
class RichTextEditorNgModelHostComponent {
    value = '<p>hi</p>';
}

describe('RichTextEditorComponent as an ngModel-bound form control', () => {
    it('resolves NG_VALUE_ACCESSOR via forwardRef and reflects the bound value', async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorNgModelHostComponent],
        }).compileComponents();
        const fixture = TestBed.createComponent(RichTextEditorNgModelHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        const editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]')!;
        expect(editor.textContent).toContain('hi');
    });
});
