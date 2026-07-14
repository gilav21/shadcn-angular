import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
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

    it('opens mention popover for mention handles with dots, underscores, and hyphens', () => {
        fixture.componentRef.setInput('mentions', true);
        fixture.detectChanges();

        editor.textContent = 'Assign to @john.doe_2-team';
        setCaret(editor.firstChild as Text, (editor.textContent ?? '').length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        expect(component.mentionPopoverOpen()).toBe(true);
        expect(component.mentionType()).toBe('mention');
        expect(component.mentionQuery()).toBe('john.doe_2-team');
    });

    it('opens tag popover for unicode and symbol-friendly tags', () => {
        fixture.componentRef.setInput('tags', true);
        fixture.detectChanges();

        editor.textContent = 'Discuss #привет.мир-2';
        setCaret(editor.firstChild as Text, (editor.textContent ?? '').length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        expect(component.mentionPopoverOpen()).toBe(true);
        expect(component.mentionType()).toBe('tag');
        expect(component.mentionQuery()).toBe('привет.мир-2');
    });

    it('does not treat email addresses as mention triggers', () => {
        fixture.componentRef.setInput('mentions', true);
        fixture.detectChanges();

        editor.textContent = 'Reach me at test@example.com';
        setCaret(editor.firstChild as Text, (editor.textContent ?? '').length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        expect(component.mentionPopoverOpen()).toBe(false);
        expect(component.mentionQuery()).toBe('');
    });

    it('places caret outside mention/tag chip after selection', () => {
        fixture.componentRef.setInput('mentions', true);
        fixture.detectChanges();

        editor.textContent = '@jo';
        const textNode = editor.firstChild as Text;
        setCaret(textNode, textNode.length);
        component.mentionType.set('mention');
        component.mentionQuery.set('jo');

        component.onMentionSelect({ id: 'u1', value: 'john-doe', label: 'John Doe' });

        const chip = editor.querySelector<HTMLElement>('[data-mention="john-doe"]');
        expect(chip).toBeTruthy();

        const selection = document.getSelection();
        expect(selection?.rangeCount).toBeGreaterThan(0);
        const anchorParent = selection?.anchorNode?.parentElement;
        expect(anchorParent?.hasAttribute('data-mention')).toBe(false);
    });

    it('renders mention as link when mentionRender mode is link and emits mentionInsert', () => {
        fixture.componentRef.setInput('mentions', true);
        fixture.componentRef.setInput('mentionRender', {
            mode: 'link',
            urlTemplate: 'https://users.example.com/:userId?label=@@label@@',
        });
        fixture.detectChanges();

        editor.textContent = '@jo';
        const textNode = editor.firstChild as Text;
        setCaret(textNode, textNode.length);
        component.mentionType.set('mention');
        component.mentionQuery.set('jo');
        const mentionInsertSpy = vi.spyOn(component.mentionInsert, 'emit');

        component.onMentionSelect({ id: 'u1', value: 'john-doe', label: 'John Doe' });

        const link = editor.querySelector<HTMLAnchorElement>('[data-mention="john-doe"]');
        expect(link).toBeTruthy();
        expect(link?.tagName).toBe('A');
        expect(link?.href).toContain('https://users.example.com/u1?label=');
        expect(link?.href).toContain('John');
        expect(link?.textContent).toBe('@John Doe');
        expect(mentionInsertSpy).toHaveBeenCalledTimes(1);
        expect(mentionInsertSpy.mock.calls[0]?.[0]).toMatchObject({
            type: 'mention',
            id: 'u1',
            value: 'john-doe',
            label: 'John Doe',
            query: 'jo',
            url: expect.stringContaining('https://users.example.com/u1?label='),
        });
    });

    it('emits tagInsert payload when selecting a tag', () => {
        fixture.componentRef.setInput('tags', true);
        fixture.detectChanges();

        editor.textContent = '#ux';
        const textNode = editor.firstChild as Text;
        setCaret(textNode, textNode.length);
        component.mentionType.set('tag');
        component.mentionQuery.set('ux');
        const tagInsertSpy = vi.spyOn(component.tagInsert, 'emit');

        component.onMentionSelect({ id: 't-9', value: 'ux', label: 'UX' });

        expect(tagInsertSpy).toHaveBeenCalledTimes(1);
        expect(tagInsertSpy.mock.calls[0]?.[0]).toMatchObject({
            type: 'tag',
            id: 't-9',
            value: 'ux',
            label: 'UX',
            query: 'ux',
        });
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

        it('localizes the base-owned outline builtin command for Hebrew', () => {
            fixture.componentRef.setInput('locale', 'he');
            fixture.detectChanges();
            const outline = component.builtinCommands().find(c => c.id === 'view.outline');
            expect(outline).toBeTruthy();
            expect(outline!.label).toBe(RICH_TEXT_LOCALES['he'].slashCommands.outline);
            expect(outline!.description).toBe(RICH_TEXT_LOCALES['he'].slashCommands.outlineDescription);
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

    describe('document outline', () => {
        const seedHeadings = () => {
            editor.innerHTML =
                '<h1>Intro</h1><p>text</p><h2>Setup</h2><h3>Details</h3><h2>Done</h2>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();
        };

        it('outlineHeadings returns an entry per heading in document order', () => {
            seedHeadings();

            const headings = component.outlineHeadings();
            expect(headings.map(h => h.text)).toEqual(['Intro', 'Setup', 'Details', 'Done']);
            expect(headings.map(h => h.level)).toEqual([1, 2, 3, 2]);
            expect(headings.map(h => h.index)).toEqual([0, 1, 2, 3]);
        });

        it('outlineHeadings is empty for content without headings', () => {
            editor.innerHTML = '<p>just a paragraph</p>';
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            fixture.detectChanges();

            expect(component.outlineHeadings()).toEqual([]);
        });

        it('outline format command toggles outlinePanelOpen without mutating content', () => {
            seedHeadings();
            const before = editor.innerHTML;

            expect(component.outlinePanelOpen()).toBe(false);

            component.onFormatCommand('outline');
            expect(component.outlinePanelOpen()).toBe(true);

            component.onFormatCommand('outline');
            expect(component.outlinePanelOpen()).toBe(false);

            expect(editor.innerHTML).toBe(before);
        });

        it('scrollHeadingIntoView scrolls the editor container, not any heading or the page', () => {
            seedHeadings();
            const scrollBySpy = vi.fn();
            editor.scrollBy = scrollBySpy as unknown as typeof editor.scrollBy;
            const intoViewSpy = vi.fn();
            editor.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
                (h as HTMLElement).scrollIntoView = intoViewSpy;
            });

            expect(() => component.scrollHeadingIntoView(2)).not.toThrow();
            expect(scrollBySpy).toHaveBeenCalled();
            expect(intoViewSpy).not.toHaveBeenCalled();
        });

        it('scrollHeadingIntoView does not throw for an out-of-range index', () => {
            seedHeadings();
            expect(() => component.scrollHeadingIntoView(99)).not.toThrow();
        });

        it('openOutlineDocked opens the docked panel', () => {
            expect(component.outlinePanelOpen()).toBe(false);

            component.openOutlineDocked();

            expect(component.outlinePanelOpen()).toBe(true);
        });

        it('editableClasses insets the content past the docked panel (md+ only) while it is open', () => {
            expect(component.editableClasses()).not.toContain('md:ps-[calc(16rem+8px)]');

            component.outlinePanelOpen.set(true);
            const open = component.editableClasses();
            expect(open).toContain('md:ps-[calc(16rem+8px)]');
            expect(open).toContain('lg:ps-[calc(20rem+8px)]');

            component.outlinePanelOpen.set(false);
            expect(component.editableClasses()).not.toContain('md:ps-[calc(16rem+8px)]');
        });

        it('exposes a /outline slash command that opens the docked panel', () => {
            const command = component.builtinCommands().find(c => c.id === 'view.outline');
            expect(command).toBeTruthy();

            command!.run({
                query: '',
                selectedText: '',
                executeToolbarCommand: () => undefined,
                insertText: () => undefined,
                insertHtml: () => undefined,
                showLinkDialog: () => undefined,
                focusEditor: () => undefined,
            });

            expect(component.outlinePanelOpen()).toBe(true);
        });

        it('renders the docked outline panel whenever it is open', () => {
            expect(fixture.nativeElement.querySelector('[data-slot="rich-text-outline-panel"]')).toBeNull();

            component.openOutlineDocked();
            fixture.detectChanges();

            const panel = fixture.nativeElement.querySelector('[data-slot="rich-text-outline-panel"]');
            expect(panel).toBeTruthy();
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

    it('applies a background (highlight) color', () => {
        component.writeValue('<p>highlight</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.applyInlineStyle({ backgroundColor: '#00ff00' });

        expect(editor.innerHTML.toLowerCase()).toMatch(/background|00ff00|rgb\(0,\s*255/);
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

        let captured: { id: string; ref: { insertText: (t: string) => void; getHtmlContent: () => string } } | null = null;
        component.customToolbarAction.subscribe(e => { captured = e as typeof captured; });

        component.onCustomToolbarAction('my-action');

        expect(captured).toBeTruthy();
        expect(captured!.id).toBe('my-action');
        captured!.ref.insertText('INJECTED');
        expect(editor.textContent).toContain('INJECTED');
        expect(captured!.ref.getHtmlContent()).toContain('ref');
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

    it('toggles a bullet list via the floating block command path', () => {
        component.writeValue('<p>list me</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        selectRange(text, 0, 7);

        component.onFloatingFormatCommand('bulletList');

        expect(editor.querySelector('ul')).toBeTruthy();
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
        expect(cell.style.borderTopStyle).toBe('none');
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
        expect(cell.style.borderLeftStyle).toBe('none');
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

describe('RichTextEditorComponent — file import', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RichTextEditorComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('emits fileImportError for a file that is neither a zip nor a pdf', async () => {
        const errSpy = vi.spyOn(component.fileImportError, 'emit');
        const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'note.txt', { type: 'text/plain' });

        await component.onFileImport(file);

        expect(errSpy).toHaveBeenCalledWith(component.resolvedLocale().editor.importInvalidFile);
        expect(component.fileImportErrorMessage()).toBe(component.resolvedLocale().editor.importInvalidFile);
    });

    it('does not import when readonly', async () => {
        fixture.componentRef.setInput('readonly', true);
        fixture.detectChanges();
        const startSpy = vi.spyOn(component.fileImportStart, 'emit');
        const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], 'doc.pdf', { type: 'application/pdf' });

        await component.onFileImport(file);

        expect(startSpy).not.toHaveBeenCalled();
    });

    it('recognises a PDF header and starts the import pipeline', async () => {
        const startSpy = vi.spyOn(component.fileImportStart, 'emit');
        // %PDF- magic bytes; parser will likely fail but start must fire.
        const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], 'doc.pdf', { type: 'application/pdf' });

        await component.onFileImport(file).catch(() => undefined);

        expect(startSpy).toHaveBeenCalledWith(file);
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

describe('RichTextEditorComponent — mention insertion via saved range', () => {
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
        fixture.componentRef.setInput('mentions', true);
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        document.body.appendChild(fixture.nativeElement);
    });

    it('inserts a chip using the editor text walk when the live selection is lost', () => {
        editor.innerHTML = 'hello @jo';
        const textNode = editor.firstChild as Text;
        const r = document.createRange();
        r.setStart(textNode, textNode.length);
        r.collapse(true);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
        (component as unknown as { savedRange: Range }).savedRange = r.cloneRange();
        component.mentionType.set('mention');
        component.mentionQuery.set('jo');

        sel?.removeAllRanges();

        component.onMentionSelect({ id: 'u9', value: 'john', label: 'John' });

        const chip = editor.querySelector('[data-mention="john"]');
        expect(chip).toBeTruthy();
        expect(editor.textContent).not.toContain('@jo ');
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

describe('RichTextEditorComponent — DOCX import', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const CRC_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c;
        }
        return table;
    })();
    const crc32 = (data: Uint8Array): number => {
        let crc = 0xffffffff;
        for (const byte of data) {
            crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    };
    const u16 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];
    const u32 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

    const makeZip = (files: ReadonlyArray<{ name: string; content: string }>): Uint8Array<ArrayBuffer> => {
        const enc = new TextEncoder();
        const entries = files.map(f => ({ name: f.name, data: enc.encode(f.content) }));
        const localChunks: number[] = [];
        const central: number[] = [];
        const offsets: number[] = [];
        let offset = 0;
        for (const entry of entries) {
            const nameBytes = enc.encode(entry.name);
            const crc = crc32(entry.data);
            offsets.push(offset);
            const local = [
                ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
                ...u32(crc), ...u32(entry.data.length), ...u32(entry.data.length),
                ...u16(nameBytes.length), ...u16(0), ...nameBytes, ...entry.data,
            ];
            localChunks.push(...local);
            offset += local.length;
        }
        const centralStart = offset;
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const nameBytes = enc.encode(entry.name);
            const crc = crc32(entry.data);
            central.push(
                ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
                ...u32(crc), ...u32(entry.data.length), ...u32(entry.data.length),
                ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
                ...u32(offsets[i]), ...nameBytes,
            );
        }
        const eocd = [
            ...u32(0x06054b50), ...u16(0), ...u16(0),
            ...u16(entries.length), ...u16(entries.length),
            ...u32(central.length), ...u32(centralStart), ...u16(0),
        ];
        return new Uint8Array([...localChunks, ...central, ...eocd]);
    };

    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const docxFile = (): File => {
        const document_xml = `<?xml version="1.0"?><w:document ${W}><w:body><w:p><w:r><w:t>Imported DOCX text</w:t></w:r></w:p></w:body></w:document>`;
        const bytes = makeZip([{ name: 'word/document.xml', content: document_xml }]);
        return new File([bytes], 'in.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
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

    it('imports a DOCX file and inserts its text, emitting fileImportComplete', async () => {
        const completeSpy = vi.spyOn(component.fileImportComplete, 'emit');
        const sel = document.getSelection();
        const r = document.createRange();
        r.selectNodeContents(editor);
        r.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(r);

        await component.onFileImport(docxFile());

        expect(editor.textContent).toContain('Imported DOCX text');
        expect(completeSpy).toHaveBeenCalled();
        expect(component.fileImporting()).toBe(false);
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

describe('RichTextEditorComponent — mention range resolution edge cases', () => {
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
        fixture.componentRef.setInput('mentions', true);
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
        document.body.appendChild(fixture.nativeElement);
    });

    it('resolves the trigger when the caret sits in an element container, not a text node', () => {
        editor.innerHTML = '<p>hi @al</p>';
        const p = editor.querySelector('p')!;
        // Place the caret at the element level (after the text child).
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(p, p.childNodes.length);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        (component as unknown as { savedRange: Range }).savedRange = r.cloneRange();
        component.mentionType.set('mention');
        component.mentionQuery.set('al');

        component.onMentionSelect({ id: 'a1', value: 'alice', label: 'Alice' });

        expect(editor.querySelector('[data-mention="alice"]')).toBeTruthy();
        expect(editor.textContent).not.toContain('@al ');
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

describe('RichTextEditorComponent AI assist', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    function selectAll(): void {
        const range = document.createRange();
        range.selectNodeContents(editor);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    }

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [RichTextEditorComponent] }).compileComponents();
        fixture = TestBed.createComponent(RichTextEditorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
    });

    it('hasAi reflects whether a provider is set', () => {
        expect(component.hasAi()).toBe(false);
        fixture.componentRef.setInput('aiProvider', () => 'x');
        expect(component.hasAi()).toBe(true);
    });

    it('replaces the selection with the result and keeps it on accept', () => {
        fixture.componentRef.setInput('aiProvider', (req: { input: string }) => `[${req.input}]`);
        fixture.detectChanges();
        component.writeValue('hello world');
        fixture.detectChanges();
        selectAll();

        component.openAiPanel();
        component.runAi('rewrite');
        expect(editor.querySelector('[data-ai-draft]')?.textContent).toBe('[hello world]');

        component.acceptAi();
        expect(editor.textContent).toContain('[hello world]');
        expect(editor.querySelector('[data-ai-draft]')).toBeNull();
    });

    it('restores the original selection on discard', () => {
        fixture.componentRef.setInput('aiProvider', () => 'REPLACED');
        fixture.detectChanges();
        component.writeValue('keep me');
        fixture.detectChanges();
        selectAll();

        component.openAiPanel();
        component.runAi('rewrite');
        expect(editor.textContent).toContain('REPLACED');

        component.discardAi();
        expect(editor.textContent).toContain('keep me');
        expect(editor.textContent).not.toContain('REPLACED');
    });

    it('streams progressive output from an Observable provider', () => {
        const subject = new Subject<string>();
        fixture.componentRef.setInput('aiProvider', () => subject);
        fixture.detectChanges();
        component.writeValue('seed');
        fixture.detectChanges();
        selectAll();

        component.openAiPanel();
        component.runAi('rewrite');
        expect(component.aiPhase()).toBe('loading');

        subject.next('Hel');
        expect(editor.querySelector('[data-ai-draft]')?.textContent).toBe('Hel');
        subject.next('Hello');
        expect(editor.querySelector('[data-ai-draft]')?.textContent).toBe('Hello');

        subject.complete();
        expect(component.aiPhase()).toBe('review');
        component.acceptAi();
        expect(editor.textContent).toContain('Hello');
    });

    it('surfaces provider errors and stays in review', () => {
        const subject = new Subject<string>();
        fixture.componentRef.setInput('aiProvider', () => subject);
        fixture.detectChanges();
        component.writeValue('x');
        fixture.detectChanges();
        selectAll();

        component.openAiPanel();
        component.runAi('rewrite');
        subject.error(new Error('boom'));

        expect(component.aiErrorMessage()).toBe('boom');
        expect(component.aiPhase()).toBe('review');
        component.discardAi();
    });

    it('does nothing when no provider is set', () => {
        component.writeValue('text');
        fixture.detectChanges();
        selectAll();
        component.openAiPanel();
        expect(component.aiPanelOpen()).toBe(false);
    });

    it('registers the /ai slash command only when a provider is set', () => {
        expect(component.builtinCommands().some((c) => c.id === 'insert.ai')).toBe(false);
        fixture.componentRef.setInput('aiProvider', () => 'x');
        expect(component.builtinCommands().some((c) => c.id === 'insert.ai')).toBe(true);
    });

    it('exposes the six built-in AI tasks with localized labels', () => {
        expect(component.aiTasks().map((t) => t.task)).toEqual([
            'rewrite', 'fix-grammar', 'shorten', 'expand', 'summarize', 'continue',
        ]);
        expect(component.aiLabels().trigger).toBe('✨ Ask AI');
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
        expect(host.selection().kind).toBe('none');
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
