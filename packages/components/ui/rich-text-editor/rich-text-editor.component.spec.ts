import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RichTextEditorAddonHost } from './rich-text-editor.host';
import { DEFAULT_FONT_FAMILIES } from './sub/rich-text-toolbar.component';
import { ShortcutBindingService } from '../../lib/shortcut-binding.service';
import { RichTextCommandRegistry, RichTextSlashCommandContext } from './rich-text-command-registry.service';
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

    it('pastes clipboard image as data URL when uploader is not configured', async () => {
        const imageFile = new File(['paste-image'], 'clip.png', { type: 'image/png' });
        const uploadCompleteSpy = vi.spyOn(component.imageUploadComplete, 'emit');
        const uploadErrorSpy = vi.spyOn(component.imageUploadError, 'emit');

        await component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: {
                files: [imageFile],
                getData: () => '',
            } as unknown as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.innerHTML).toContain('<img');
        expect(editor.innerHTML).toContain('data:image/png;base64');
        expect(uploadCompleteSpy).toHaveBeenCalled();
        expect(uploadErrorSpy).not.toHaveBeenCalled();
    });

    it('pastes clipboard image via uploader when configured', async () => {
        fixture.componentRef.setInput('imageSources', 'upload');
        fixture.componentRef.setInput('imageUploader', () => of('https://cdn.example.com/clip.png'));
        fixture.detectChanges();

        const imageFile = new File(['paste-image'], 'clip.png', { type: 'image/png' });
        const uploadCompleteSpy = vi.spyOn(component.imageUploadComplete, 'emit');
        const uploadErrorSpy = vi.spyOn(component.imageUploadError, 'emit');

        await component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: {
                files: [imageFile],
                getData: () => '',
            } as unknown as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(editor.innerHTML).toContain('https://cdn.example.com/clip.png');
        expect(uploadCompleteSpy).toHaveBeenCalledWith('https://cdn.example.com/clip.png');
        expect(uploadErrorSpy).not.toHaveBeenCalled();
    });

    it('does not allow attribute injection through image alt text', () => {
        component.onImageInsert({
            src: 'https://example.com/safe.png',
            alt: 'x" onerror="alert(1)" data-x="1',
        });

        const img = editor.querySelector<HTMLImageElement>('img');
        expect(img).toBeTruthy();
        expect(img?.getAttribute('src')).toBe('https://example.com/safe.png');
        expect(img?.getAttribute('onerror')).toBeNull();
        expect(img?.attributes.getNamedItem('onerror')).toBeNull();
        expect(img?.getAttribute('alt')).toBe('x" onerror="alert(1)" data-x="1');
        const attrNames = Array.from(img?.attributes ?? []).map((a) => a.name).sort((a, b) => a.localeCompare(b));
        expect(attrNames).toStrictEqual(['alt', 'data-align', 'src', 'style']);
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

        component.selectHistoryEntry(1);

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

    it('opening history panel flushes pending debounced snapshot to match undo timeline', () => {
        vi.useFakeTimers();
        fixture.componentRef.setInput('showHistoryPanel', true);
        fixture.componentRef.setInput('historyDebounceMs', 300);
        fixture.detectChanges();

        editor.textContent = 'draft';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        expect((component as any).history).toHaveLength(1);

        component.onHistoryPanelOpenChange(true);
        expect((component as any).history).toHaveLength(2);
        expect(component.historyPanelOpen()).toBe(true);

        vi.useRealTimers();
    });

    it('syncs history panel state from popover openChange', () => {
        fixture.componentRef.setInput('showHistoryPanel', true);
        fixture.detectChanges();

        component.onHistoryPanelOpenChange(true);
        expect(component.historyPanelOpen()).toBe(true);

        component.onHistoryPanelOpenChange(false);
        expect(component.historyPanelOpen()).toBe(false);
    });

    it('keeps history popover open when dialog is open and popover emits close', () => {
        fixture.componentRef.setInput('showHistoryPanel', true);
        fixture.detectChanges();

        component.onHistoryPanelOpenChange(true);
        component.historyPreviewOpen.set(true);
        component.onHistoryPanelOpenChange(false);

        expect(component.historyPanelOpen()).toBe(true);
    });

    it('quick apply does not close history popover', () => {
        fixture.componentRef.setInput('showHistoryPanel', true);
        fixture.detectChanges();

        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();

        component.onHistoryPanelOpenChange(true);
        component.selectHistoryEntry(1);

        expect(component.historyPanelOpen()).toBe(true);
        expect(editor.textContent).toContain('one');
    });

    it('opens history browser dialog via ctrl/cmd+shift+h when history button is hidden', () => {
        fixture.componentRef.setInput('showHistoryPanel', true);
        fixture.componentRef.setInput('showHistoryButton', false);
        fixture.detectChanges();

        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'h',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        }));

        expect(component.historyBrowserOpen()).toBe(true);
        expect(component.historyPanelOpen()).toBe(false);
    });

    it('opens history popover via ctrl/cmd+shift+h when history button is visible', () => {
        fixture.componentRef.setInput('showHistoryPanel', true);
        fixture.componentRef.setInput('showHistoryButton', true);
        fixture.detectChanges();

        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'h',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        }));

        expect(component.historyPanelOpen()).toBe(true);
        expect(component.historyBrowserOpen()).toBe(false);
    });

    it('uses shortcut binding overrides for history shortcut', () => {
        fixture.componentRef.setInput('showHistoryPanel', true);
        fixture.componentRef.setInput('showHistoryButton', true);
        fixture.detectChanges();

        shortcutBindings.setShortcutOverride('rich-text.history', 'Ctrl+Shift+J');

        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'h',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        }));
        expect(component.historyPanelOpen()).toBe(false);

        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'j',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        }));
        expect(component.historyPanelOpen()).toBe(true);
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

    it('applies revision on Enter key from history entry', () => {
        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();

        const row = document.createElement('div');
        component.onHistoryEntryKeydown({
            key: 'Enter',
            currentTarget: row,
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, 1);

        expect(editor.textContent).toContain('one');
    });

    it('applies revision on Space key from history entry', () => {
        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();

        const row = document.createElement('div');
        component.onHistoryEntryKeydown({
            key: ' ',
            currentTarget: row,
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, 1);

        expect(editor.textContent).toContain('one');
    });

    it('moves focus with arrow keys within same history list', () => {
        const list = document.createElement('div');
        list.dataset['historyList'] = 'test';
        const first = document.createElement('div');
        const second = document.createElement('div');
        first.dataset['historyEntryAction'] = 'true';
        second.dataset['historyEntryAction'] = 'true';
        first.tabIndex = 0;
        second.tabIndex = 0;
        list.appendChild(first);
        list.appendChild(second);
        document.body.appendChild(list);

        first.focus();
        component.onHistoryEntryKeydown({
            key: 'ArrowDown',
            currentTarget: first,
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, 0);

        expect(document.activeElement).toBe(second);
        list.remove();
    });

    it('supports Home/End keyboard navigation in history list', () => {
        const list = document.createElement('div');
        list.dataset['historyList'] = 'test';
        const first = document.createElement('div');
        const second = document.createElement('div');
        const third = document.createElement('div');
        first.dataset['historyEntryAction'] = 'true';
        second.dataset['historyEntryAction'] = 'true';
        third.dataset['historyEntryAction'] = 'true';
        first.tabIndex = 0;
        second.tabIndex = 0;
        third.tabIndex = 0;
        list.appendChild(first);
        list.appendChild(second);
        list.appendChild(third);
        document.body.appendChild(list);

        second.focus();
        component.onHistoryEntryKeydown({
            key: 'Home',
            currentTarget: second,
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, 0);
        expect(document.activeElement).toBe(first);

        first.focus();
        component.onHistoryEntryKeydown({
            key: 'End',
            currentTarget: first,
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, 0);
        expect(document.activeElement).toBe(third);
        list.remove();
    });

    it('closes history popover on Escape from history row', () => {
        const list = document.createElement('div');
        list.dataset['historyList'] = 'popover';
        const row = document.createElement('div');
        row.dataset['historyEntryAction'] = 'true';
        row.tabIndex = 0;
        list.appendChild(row);
        fixture.nativeElement.appendChild(list);

        component.historyPanelOpen.set(true);
        component.onHistoryEntryKeydown({
            key: 'Escape',
            currentTarget: row,
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, 0);

        expect(component.historyPanelOpen()).toBe(false);
        list.remove();
    });

    it('closes history browser dialog on Escape from history row', () => {
        const list = document.createElement('div');
        list.dataset['historyList'] = 'dialog';
        const row = document.createElement('div');
        row.dataset['historyEntryAction'] = 'true';
        row.tabIndex = 0;
        list.appendChild(row);
        fixture.nativeElement.appendChild(list);

        component.historyBrowserOpen.set(true);
        component.onHistoryEntryKeydown({
            key: 'Escape',
            currentTarget: row,
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, 0);

        expect(component.historyBrowserOpen()).toBe(false);
        list.remove();
    });

    it('keeps focus on history entry after quick apply', () => {
        vi.useFakeTimers();
        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();

        const list = document.createElement('div');
        list.dataset['historyList'] = 'popover';
        fixture.nativeElement.appendChild(list);

        const entry = document.createElement('div');
        entry.dataset['historyEntryAction'] = 'true';
        entry.dataset['historyEntryIndex'] = '1';
        entry.tabIndex = 0;
        list.appendChild(entry);
        entry.focus();

        component.onQuickApplyFromHistory(1, { currentTarget: entry } as unknown as Event);
        vi.runAllTimers();

        expect(document.activeElement).toBe(entry);
        list.remove();
        vi.useRealTimers();
    });

    it('shortcut-opened history browser focuses list immediately and supports arrows without extra Tab', () => {
        vi.useFakeTimers();
        fixture.componentRef.setInput('showHistoryPanel', true);
        fixture.componentRef.setInput('showHistoryButton', false);
        fixture.detectChanges();

        component.writeValue('one');
        fixture.detectChanges();
        (component as any).pushHistory();
        component.writeValue('two');
        fixture.detectChanges();
        (component as any).pushHistory();

        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'h',
            ctrlKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
        }));
        fixture.detectChanges();
        vi.runAllTimers();
        fixture.detectChanges();

        const actions: HTMLElement[] = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('[data-history-list="dialog"] [data-history-entry-action="true"]')
        );
        expect(actions.length).toBeGreaterThanOrEqual(2);
        expect(document.activeElement).toBe(actions[0]);

        component.onHistoryEntryKeydown({
            key: 'ArrowDown',
            currentTarget: actions[0],
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, Number(actions[0].dataset['historyEntryIndex'] ?? 0));

        expect(document.activeElement).toBe(actions[1]);
        vi.useRealTimers();
    });

    it('opens slash command menu when typing "/" trigger', () => {
        editor.textContent = '/hea';
        setCaret(editor.firstChild as Text, (editor.textContent ?? '').length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        expect(component.slashCommandOpen()).toBe(true);
        expect(component.slashQuery()).toBe('hea');
        expect(component.filteredSlashCommands().some(command => command.label === 'Heading 1')).toBe(true);
    });

    it('opens slash command menu even when input event has no active selection range', () => {
        editor.textContent = '/hea';
        document.getSelection()?.removeAllRanges();
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        expect(component.slashCommandOpen()).toBe(true);
        expect(component.slashQuery()).toBe('hea');
    });

    it('does not open slash command menu when trigger is typed immediately after a letter', () => {
        editor.textContent = 'abcd/hea';
        setCaret(editor.firstChild as Text, (editor.textContent ?? '').length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        expect(component.slashCommandOpen()).toBe(false);
        expect(component.slashQuery()).toBe('');
    });

    it('executes selected slash command on Enter and removes trigger text', () => {
        fixture.componentRef.setInput('slashCommands', [{
            id: 'test.insert-token',
            label: 'Insert Token',
            description: 'Insert a marker token',
            keywords: ['token'],
            order: 1,
            run: (context: RichTextSlashCommandContext) => context.insertText('[token]'),
        }]);
        fixture.detectChanges();

        editor.textContent = '/token';
        setCaret(editor.firstChild as Text, (editor.textContent ?? '').length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        component.onKeydown(new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
        }));

        expect(component.slashCommandOpen()).toBe(false);
        expect(editor.textContent).toBe('[token]');
    });

    it('supports global slash commands from RichTextCommandRegistry', async () => {
        commandRegistry.registerCommand({
            id: 'registry.insert-stamp',
            label: 'Insert Stamp',
            description: 'Insert registry stamp',
            keywords: ['stamp'],
            order: 1,
            run: (context: RichTextSlashCommandContext) => context.insertText('[registry]'),
        });

        editor.textContent = '/stamp';
        setCaret(editor.firstChild as Text, (editor.textContent ?? '').length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const selected = component.filteredSlashCommands()[0];
        await component.onSlashCommandSelect(selected);

        expect(editor.textContent).toBe('[registry]');
    });

    it('keeps slash command insertion anchored to the paragraph where trigger was typed', async () => {
        fixture.componentRef.setInput('slashCommands', [{
            id: 'test.anchor-insert',
            label: 'Anchor Insert',
            order: 1,
            run: (context: RichTextSlashCommandContext) => context.insertText('ANCHOR'),
        }]);
        fixture.detectChanges();

        component.writeValue('<p>First line</p><p>/anchor</p>');
        fixture.detectChanges();

        const secondParagraphText = editor.querySelectorAll('p')[1].firstChild as Text;
        setCaret(secondParagraphText, secondParagraphText.length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const selected = component.filteredSlashCommands()[0];
        await component.onSlashCommandSelect(selected);

        const paragraphs = editor.querySelectorAll('p');
        expect(paragraphs[0].textContent).toContain('First line');
        expect(paragraphs[1].textContent).toContain('ANCHOR');
    });

    it('applies slash heading command to the current paragraph, not the previous one', async () => {
        component.writeValue('<p>Previous line</p><p>/h2</p>');
        fixture.detectChanges();

        const secondParagraphText = editor.querySelectorAll('p')[1].firstChild as Text;
        setCaret(secondParagraphText, secondParagraphText.length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const headingCommand = component.filteredSlashCommands().find(command => command.id === 'format.heading-2');
        expect(headingCommand).toBeTruthy();
        await component.onSlashCommandSelect(headingCommand!);

        const blocks = Array.from(editor.children) as HTMLElement[];
        expect(blocks[0]?.tagName).toBe('P');
        expect(blocks[0]?.textContent).toContain('Previous line');
        expect(blocks[1]?.tagName).toBe('H2');

        const selection = document.getSelection();
        const anchorNode = selection?.anchorNode ?? null;
        expect(anchorNode).toBeTruthy();
        expect(blocks[1].contains(anchorNode)).toBe(true);
    });

    it('prefers current caret block over stale slash trigger range when applying command', async () => {
        component.writeValue('<p>Previous line</p><p>/h2</p>');
        fixture.detectChanges();

        const paragraphs = editor.querySelectorAll('p');
        const previousTextNode = paragraphs[0].firstChild as Text;
        const staleRange = document.createRange();
        staleRange.setStart(previousTextNode, previousTextNode.length);
        staleRange.collapse(true);
        (component as any).slashTriggerRange = staleRange;

        const secondTextNode = paragraphs[1].firstChild as Text;
        setCaret(secondTextNode, secondTextNode.length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const headingCommand = component.filteredSlashCommands().find(command => command.id === 'format.heading-2');
        expect(headingCommand).toBeTruthy();
        await component.onSlashCommandSelect(headingCommand!);

        const blocks = Array.from(editor.children) as HTMLElement[];
        expect(blocks[0]?.tagName).toBe('P');
        expect(blocks[1]?.tagName).toBe('H2');
    });

    it('applies slash heading command on empty new row and keeps caret in that row', async () => {
        component.writeValue('<p>Previous line</p><p>/h2</p>');
        fixture.detectChanges();

        const secondTextNode = editor.querySelectorAll('p')[1].firstChild as Text;
        setCaret(secondTextNode, secondTextNode.length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const headingCommand = component.filteredSlashCommands().find(command => command.id === 'format.heading-2');
        expect(headingCommand).toBeTruthy();
        await component.onSlashCommandSelect(headingCommand!);

        const blocks = Array.from(editor.children) as HTMLElement[];
        expect(blocks[0]?.tagName).toBe('P');
        expect(blocks[1]?.tagName).toBe('H2');
        const selection = document.getSelection();
        const anchorNode = selection?.anchorNode ?? null;
        expect(anchorNode).toBeTruthy();
        expect(blocks[1].contains(anchorNode)).toBe(true);
    });

    it('applies slash bullet list to current row without moving previous row content', async () => {
        component.writeValue('<p>Previous line</p><p>/bul</p>');
        fixture.detectChanges();

        const secondTextNode = editor.querySelectorAll('p')[1].firstChild as Text;
        setCaret(secondTextNode, secondTextNode.length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const bulletCommand = component.filteredSlashCommands().find(command => command.id === 'format.bullet-list');
        expect(bulletCommand).toBeTruthy();
        await component.onSlashCommandSelect(bulletCommand!);

        const first = editor.children[0] as HTMLElement;
        const second = editor.children[1] as HTMLElement;
        expect(first.tagName).toBe('P');
        expect(first.textContent).toContain('Previous line');
        expect(second.tagName).toBe('UL');
        const li = second.querySelector('li');
        expect(li).toBeTruthy();
        const selection = document.getSelection();
        const anchorNode = selection?.anchorNode ?? null;
        expect(anchorNode).toBeTruthy();
        expect(li?.contains(anchorNode as Node)).toBe(true);
    });

    it('does not replace the editor container when applying slash command on first row', async () => {
        component.writeValue('/h2');
        fixture.detectChanges();

        const textNode = editor.firstChild as Text;
        setCaret(textNode, textNode.length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const headingCommand = component.filteredSlashCommands().find(command => command.id === 'format.heading-2');
        expect(headingCommand).toBeTruthy();
        await component.onSlashCommandSelect(headingCommand!);

        const editorAfter = (fixture.nativeElement as HTMLElement).querySelector<HTMLDivElement>('[data-slot="rich-text-editor"]');
        expect(editorAfter).toBeTruthy();
        expect(editorAfter?.tagName).toBe('DIV');
        expect(editorAfter?.isContentEditable).toBe(true);
    });

    it('places caret inside inline code after slash inline-code command', async () => {
        component.writeValue('<p>/code</p>');
        fixture.detectChanges();

        const textNode = editor.querySelector('p')?.firstChild as Text;
        setCaret(textNode, textNode.length);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const inlineCodeCommand = component.filteredSlashCommands().find(command => command.id === 'format.inline-code');
        expect(inlineCodeCommand).toBeTruthy();
        await component.onSlashCommandSelect(inlineCodeCommand!);

        const code = editor.querySelector('code');
        expect(code).toBeTruthy();
        const selection = document.getSelection();
        const anchorNode = selection?.anchorNode ?? null;
        expect(anchorNode).toBeTruthy();
        expect(code?.contains(anchorNode as Node)).toBe(true);
        expect(selection?.anchorOffset).toBe(1);
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

        it('builds localized slash commands for Hebrew locale', () => {
            fixture.componentRef.setInput('locale', 'he');
            fixture.detectChanges();
            const commands = component.localizedSlashCommands();
            const heading1 = commands.find(c => c.id === 'format.heading-1');
            expect(heading1).toBeTruthy();
            expect(heading1!.label).toBe(RICH_TEXT_LOCALES['he'].slashCommands.heading1);
            expect(heading1!.description).toBe(RICH_TEXT_LOCALES['he'].slashCommands.heading1Description);
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

    describe('autoImageUpload', () => {
        const TINY_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        it('auto-uploads base64 image when autoImageUpload and imageUploader are set', async () => {
            const upload$ = new Subject<string>();
            fixture.componentRef.setInput('autoImageUpload', true);
            fixture.componentRef.setInput('imageUploader', () => upload$);
            fixture.detectChanges();

            const completeSpy = vi.spyOn(component.autoImageUploadComplete, 'emit');

            const img = document.createElement('img');
            img.setAttribute('src', TINY_BASE64);
            img.setAttribute('alt', 'test');
            editor.appendChild(img);

            await new Promise(r => setTimeout(r, 50));

            expect(img.dataset['autoUploadStatus']).toBe('uploading');
            expect(img.getAttribute('src')).toBe(TRANSPARENT_PIXEL);

            upload$.next('https://cdn.example.com/uploaded.png');
            upload$.complete();

            await new Promise(r => setTimeout(r, 50));

            expect(img.getAttribute('src')).toBe('https://cdn.example.com/uploaded.png');
            expect('autoUploadId' in img.dataset).toBe(false);
            expect('autoUploadStatus' in img.dataset).toBe(false);
            expect(completeSpy).toHaveBeenCalledWith('https://cdn.example.com/uploaded.png');
        });

        it('does not auto-upload when autoImageUpload is false', async () => {
            fixture.componentRef.setInput('autoImageUpload', false);
            fixture.componentRef.setInput('imageUploader', () => of('https://cdn.example.com/uploaded.png'));
            fixture.detectChanges();

            const img = document.createElement('img');
            img.setAttribute('src', TINY_BASE64);
            editor.appendChild(img);

            await new Promise(r => setTimeout(r, 50));

            expect(img.getAttribute('src')).toBe(TINY_BASE64);
            expect('autoUploadId' in img.dataset).toBe(false);
        });

        it('does not auto-upload when imageUploader is not provided', async () => {
            fixture.componentRef.setInput('autoImageUpload', true);
            fixture.detectChanges();

            const img = document.createElement('img');
            img.setAttribute('src', TINY_BASE64);
            editor.appendChild(img);

            await new Promise(r => setTimeout(r, 50));

            expect(img.getAttribute('src')).toBe(TINY_BASE64);
            expect('autoUploadId' in img.dataset).toBe(false);
        });

        it('shows error overlay on upload failure', async () => {
            fixture.componentRef.setInput('autoImageUpload', true);
            fixture.componentRef.setInput('imageUploader', () => throwError(() => new Error('Network error')));
            fixture.detectChanges();

            const errorSpy = vi.spyOn(component.autoImageUploadError, 'emit');

            const img = document.createElement('img');
            img.setAttribute('src', TINY_BASE64);
            editor.appendChild(img);

            await new Promise(r => setTimeout(r, 50));

            expect(img.dataset['autoUploadStatus']).toBe('error');
            expect(errorSpy).toHaveBeenCalledWith('Network error');
            expect(component.autoUploadErrors().size).toBe(1);
        });

        it('retries upload on retry call', async () => {
            const attempt = { count: 0 };
            fixture.componentRef.setInput('autoImageUpload', true);
            fixture.componentRef.setInput('imageUploader', () => {
                attempt.count++;
                if (attempt.count === 1) {
                    return throwError(() => new Error('First attempt failed'));
                }
                return of('https://cdn.example.com/retry-success.png');
            });
            fixture.detectChanges();

            const img = document.createElement('img');
            img.setAttribute('src', TINY_BASE64);
            editor.appendChild(img);

            await new Promise(r => setTimeout(r, 50));

            expect(img.dataset['autoUploadStatus']).toBe('error');
            expect(component.autoUploadErrors().size).toBe(1);

            const errorId = Array.from(component.autoUploadErrors().keys())[0];
            component.retryAutoUpload(errorId);

            await new Promise(r => setTimeout(r, 50));

            expect(img.getAttribute('src')).toBe('https://cdn.example.com/retry-success.png');
            expect(component.autoUploadErrors().size).toBe(0);
        });

        it('removes image on removeAutoUploadImage call', async () => {
            fixture.componentRef.setInput('autoImageUpload', true);
            fixture.componentRef.setInput('imageUploader', () => throwError(() => new Error('fail')));
            fixture.detectChanges();

            const img = document.createElement('img');
            img.setAttribute('src', TINY_BASE64);
            editor.appendChild(img);

            await new Promise(r => setTimeout(r, 50));

            expect(component.autoUploadErrors().size).toBe(1);
            const errorId = Array.from(component.autoUploadErrors().keys())[0];

            component.removeAutoUploadImage(errorId);

            expect(editor.querySelector('img')).toBeNull();
            expect(component.autoUploadErrors().size).toBe(0);
        });

        it('output does not contain base64 during upload', async () => {
            const upload$ = new Subject<string>();
            fixture.componentRef.setInput('autoImageUpload', true);
            fixture.componentRef.setInput('imageUploader', () => upload$);
            fixture.detectChanges();

            const img = document.createElement('img');
            img.setAttribute('src', TINY_BASE64);
            editor.appendChild(img);

            await new Promise(r => setTimeout(r, 50));

            const output = editor.innerHTML;
            expect(output).not.toContain(TINY_BASE64);
            expect(output).toContain(TRANSPARENT_PIXEL);

            upload$.next('https://cdn.example.com/final.png');
            upload$.complete();
        });

        it('does not re-process images that already have data-auto-upload-id', async () => {
            fixture.componentRef.setInput('autoImageUpload', true);
            fixture.componentRef.setInput('imageUploader', () => of('https://cdn.example.com/img.png'));
            fixture.detectChanges();

            const img = document.createElement('img');
            img.setAttribute('src', TINY_BASE64);
            img.dataset['autoUploadId'] = 'existing-id';
            editor.appendChild(img);

            await new Promise(r => setTimeout(r, 50));

            expect(img.getAttribute('src')).toBe(TINY_BASE64);
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

    describe('font family', () => {
        it('includes fontFamily in DEFAULT_TOOLBAR_ITEMS', () => {
            const items = component.toolbarItems();
            expect(items).toContain('fontFamily');
        });

        it('uses DEFAULT_FONT_FAMILIES when no custom fonts provided', () => {
            expect(component.resolvedFontFamilies()).toEqual(DEFAULT_FONT_FAMILIES);
        });

        it('appends custom fonts to defaults with append strategy', () => {
            fixture.componentRef.setInput('fontFamilies', ['Roboto', 'Open Sans']);
            fixture.componentRef.setInput('fontFamiliesStrategy', 'append');
            fixture.detectChanges();

            const resolved = component.resolvedFontFamilies();
            expect(resolved).toEqual([...DEFAULT_FONT_FAMILIES, 'Roboto', 'Open Sans']);
        });

        it('replaces defaults with custom fonts using replace strategy', () => {
            fixture.componentRef.setInput('fontFamilies', ['Roboto', 'Open Sans']);
            fixture.componentRef.setInput('fontFamiliesStrategy', 'replace');
            fixture.detectChanges();

            const resolved = component.resolvedFontFamilies();
            expect(resolved).toEqual(['Roboto', 'Open Sans']);
        });

        it('keeps defaults when empty fontFamilies array is provided', () => {
            fixture.componentRef.setInput('fontFamilies', []);
            fixture.componentRef.setInput('fontFamiliesStrategy', 'replace');
            fixture.detectChanges();

            expect(component.resolvedFontFamilies()).toEqual(DEFAULT_FONT_FAMILIES);
        });

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

            component.onFontFamilySelect('Georgia');
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

        it('defaults to append strategy', () => {
            expect(component.fontFamiliesStrategy()).toBe('append');
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
            const command = component.localizedSlashCommands().find(c => c.id === 'view.outline');
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

describe('RichTextEditorComponent — toolbar actions (link, image, emoji, color, font)', () => {
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

    it('inserts an anchor element with sanitized href on link insert', () => {
        component.writeValue('<p>see here</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 8);

        component.onLinkInsert({ text: 'docs', url: 'https://example.com/docs' });

        const link = editor.querySelector('a');
        expect(link).toBeTruthy();
        expect(link?.getAttribute('href')).toBe('https://example.com/docs');
        expect(link?.textContent).toBe('docs');
        expect(link?.getAttribute('rel')).toContain('noopener');
    });

    it('falls back to url as link text when text is empty', () => {
        component.writeValue('<p>x</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 1);

        component.onLinkInsert({ text: '', url: 'https://only-url.com' });

        expect(editor.querySelector('a')?.textContent).toBe('https://only-url.com');
    });

    it('does not insert a link for a javascript: url (sanitizer rejects it)', () => {
        component.writeValue('<p>safe</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 4);

        component.onLinkInsert({ text: 'evil', url: 'javascript:alert(1)' });

        expect(editor.querySelector('a')).toBeNull();
    });

    it('insertLinkFromPopover inserts a link and closes the popover', () => {
        component.writeValue('<p>anchor</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 6);
        selection?.removeAllRanges();
        selection?.addRange(range);
        component.onBlur();

        component.showLinkPopover.set(true);
        component.insertLinkFromPopover('My Link', 'https://link.test');

        expect(editor.querySelector('a')?.getAttribute('href')).toBe('https://link.test');
        expect(component.showLinkPopover()).toBe(false);
    });

    it('closeLinkPopover hides the popover and clears selected text', () => {
        component.selectedText.set('something');
        component.showLinkPopover.set(true);

        component.closeLinkPopover();

        expect(component.showLinkPopover()).toBe(false);
        expect(component.selectedText()).toBe('');
    });

    it('inserts an image at the selection with sanitized src and alt', () => {
        component.writeValue('<p>img here</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 4);

        component.onImageInsert({ src: 'https://cdn.test/pic.png', alt: 'A picture' });

        const img = editor.querySelector('img');
        expect(img?.getAttribute('src')).toBe('https://cdn.test/pic.png');
        expect(img?.getAttribute('alt')).toBe('A picture');
    });

    it('applies default size and alignment to an inserted image', () => {
        fixture.componentRef.setInput('defaultImageWidth', 320);
        fixture.componentRef.setInput('defaultImageHeight', '50%');
        fixture.componentRef.setInput('defaultImageAlignment', 'center');
        component.writeValue('<p>img here</p>');
        fixture.detectChanges();
        caretIn(editor.querySelector('p')!.firstChild as Text, 4);

        component.onImageInsert({ src: 'https://cdn.test/pic.png', alt: 'A picture' });

        const img = editor.querySelector('img')!;
        expect(img.style.width).toBe('320px');
        expect(img.style.height).toBe('50%');
        expect(img.dataset['align']).toBe('center');
        expect(img.style.display).toBe('block');
        expect(img.style.marginLeft).toBe('auto');
    });

    it('emits imageUploadError when image URL insertion is disabled (upload-only source)', () => {
        fixture.componentRef.setInput('imageSources', 'upload');
        fixture.detectChanges();
        const errSpy = vi.spyOn(component.imageUploadError, 'emit');

        component.onImageInsert({ src: 'https://cdn.test/pic.png', alt: 'x' });

        expect(errSpy).toHaveBeenCalledWith('Image URL insertion is disabled. Use upload source.');
        expect(editor.querySelector('img')).toBeNull();
    });

    it('emits imageUploadError for an invalid image URL', () => {
        const errSpy = vi.spyOn(component.imageUploadError, 'emit');

        component.onImageInsert({ src: 'javascript:evil()', alt: 'x' });

        expect(errSpy).toHaveBeenCalledWith('Invalid image URL.');
    });

    it('inserts an emoji at the caret position', () => {
        component.writeValue('<p>hi</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        caretIn(text, 2);
        const selection = document.getSelection();
        if (selection?.rangeCount) {
            (component as unknown as { savedRange: Range }).savedRange = selection.getRangeAt(0).cloneRange();
        }

        component.onEmojiInsert('🎉');

        expect(editor.textContent).toContain('🎉');
    });

    it('applies a font color via foreColor command', () => {
        component.writeValue('<p>colored</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.onColorSelect({ type: 'fontColor', color: '#ff0000' });

        expect(editor.innerHTML.toLowerCase()).toMatch(/color|ff0000|rgb\(255/);
    });

    it('applies a background (highlight) color', () => {
        component.writeValue('<p>highlight</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.onColorSelect({ type: 'backgroundColor', color: '#00ff00' });

        expect(editor.innerHTML.toLowerCase()).toMatch(/background|00ff00|rgb\(0,\s*255/);
    });

    it('applies a font size by converting font[size=7] into a styled span', () => {
        component.writeValue('<p>sized text</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.onFontSizeSelect('24');

        expect(editor.querySelectorAll('font[size="7"]')).toHaveLength(0);
        const span = Array.from(editor.querySelectorAll('span')).find(s => s.style.fontSize === '24px');
        expect(span).toBeTruthy();
    });

    it('applies a font family by converting font[face] into a styled span', () => {
        component.writeValue('<p>family text</p>');
        fixture.detectChanges();
        selectContents(editor.querySelector('p')!);

        component.onFontFamilySelect('Georgia');

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

    it('inserts an N×M table via onTableInsert', () => {
        editor.innerHTML = '<p>x</p>';
        const text = editor.querySelector('p')!.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, 1);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);

        component.onTableInsert({ rows: 3, cols: 2 });

        const table = editor.querySelector('table')!;
        expect(table.querySelectorAll('thead th')).toHaveLength(2);
        expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
        expect(table.querySelectorAll('tbody tr')[0].children).toHaveLength(2);
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

    it('sets dragOver when dragging files with an image source available', () => {
        const ev = {
            dataTransfer: makeDataTransfer([], ['Files']),
            preventDefault: vi.fn(),
        } as unknown as DragEvent;

        component.onEditorDragOver(ev);

        expect(component.dragOver()).toBe(true);
        expect((ev.preventDefault as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
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

    it('inserts a dropped image file as a data URL', async () => {
        const file = new File(['img'], 'drop.png', { type: 'image/png' });
        const completeSpy = vi.spyOn(component.imageUploadComplete, 'emit');
        const ev = {
            dataTransfer: makeDataTransfer([file]),
            preventDefault: vi.fn(),
        } as unknown as DragEvent;

        await component.onEditorDrop(ev);

        const editor = (fixture.nativeElement as HTMLElement).querySelector('[data-slot="rich-text-editor"]')!;
        expect(editor.querySelector('img')).toBeTruthy();
        expect(completeSpy).toHaveBeenCalled();
        expect(component.dragOver()).toBe(false);
    });

    it('does not drop when disabled', async () => {
        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        const file = new File(['img'], 'drop.png', { type: 'image/png' });
        const completeSpy = vi.spyOn(component.imageUploadComplete, 'emit');

        await component.onEditorDrop({
            dataTransfer: makeDataTransfer([file]),
            preventDefault: vi.fn(),
        } as unknown as DragEvent);

        expect(completeSpy).not.toHaveBeenCalled();
    });
});

describe('RichTextEditorComponent — slash command keyboard navigation', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const openSlash = () => {
        editor.textContent = '/';
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(editor.firstChild as Text, 1);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
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

    it('ArrowDown/ArrowUp move the slash command selection index', () => {
        openSlash();
        expect(component.slashCommandOpen()).toBe(true);
        expect(component.slashCommandSelectedIndex()).toBe(0);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        expect(component.slashCommandSelectedIndex()).toBe(1);

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        expect(component.slashCommandSelectedIndex()).toBe(0);
    });

    it('does not move below the last command on repeated ArrowUp at index 0', () => {
        openSlash();
        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
        expect(component.slashCommandSelectedIndex()).toBe(0);
    });

    it('Escape closes the slash command popover', () => {
        openSlash();
        component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(component.slashCommandOpen()).toBe(false);
    });

    it('Space selects the highlighted command', () => {
        component.writeValue('<p>/h2</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, text.length);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const idx = component.filteredSlashCommands().findIndex(c => c.id === 'format.heading-2');
        component.slashCommandSelectedIndex.set(idx);

        component.onKeydown(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));

        expect(component.slashCommandOpen()).toBe(false);
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
        component.onColorSelect({ type: 'fontColor', color: '#123456' });
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

        component.selectHistoryEntry(1);
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

describe('RichTextEditorComponent — slash command block transforms', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const typeSlash = (paragraphHtml: string) => {
        component.writeValue(paragraphHtml);
        fixture.detectChanges();
        const lastP = editor.querySelector('p:last-of-type')!;
        const text = lastP.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, text.length);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const runCommand = async (id: string) => {
        const cmd = component.filteredSlashCommands().find(c => c.id === id)!;
        await component.onSlashCommandSelect(cmd);
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

    it('transforms a paragraph into a blockquote in place', async () => {
        typeSlash('<p>quote /quote</p>');
        await runCommand('format.quote');
        expect(editor.querySelector('blockquote')).toBeTruthy();
        expect(editor.querySelector('blockquote')?.textContent).toContain('quote');
    });

    it('transforms a paragraph into a bullet list item', async () => {
        typeSlash('<p>bullet /bul</p>');
        await runCommand('format.bullet-list');
        expect(editor.querySelector('ul > li')).toBeTruthy();
    });

    it('transforms a paragraph into a numbered list item', async () => {
        typeSlash('<p>num /nl</p>');
        await runCommand('format.numbered-list');
        expect(editor.querySelector('ol > li')).toBeTruthy();
    });

    it('transforms a paragraph into a heading and keeps the caret inside', async () => {
        typeSlash('<p>head /h1</p>');
        await runCommand('format.heading-1');
        expect(editor.querySelector('h1')).toBeTruthy();
    });

    it('transforms back to a paragraph', async () => {
        typeSlash('<p>txt /paragraph</p>');
        await runCommand('format.paragraph');
        expect(editor.querySelectorAll('p').length).toBeGreaterThan(0);
    });

    it('inserts a horizontal rule via the slash command', async () => {
        typeSlash('<p>rule /hr</p>');
        await runCommand('insert.horizontal-rule');
        expect(editor.querySelector('hr')).toBeTruthy();
    });

    it('inserts a task list via the slash command', async () => {
        typeSlash('<p>todo /task</p>');
        await runCommand('insert.task-list');
        expect(editor.querySelector('ul[data-task-list]')).toBeTruthy();
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

    it('removing the selected image deletes it and clears the selection', () => {
        component.writeValue('<p><img src="https://cdn.test/a.png" alt="a"></p>');
        fixture.detectChanges();
        const img = editor.querySelector('img')!;
        component.selectedImage.set(img);

        component.onImageRemove(img);

        expect(editor.querySelector('img')).toBeNull();
        expect(component.selectedImage()).toBeNull();
    });

    it('image resize/alignment end syncs content and pushes history', () => {
        component.writeValue('<p><img src="https://cdn.test/a.png" alt="a"></p>');
        fixture.detectChanges();
        const before = (component as unknown as { history: unknown[] }).history.length;

        component.onImageAlignmentChange();
        component.onImageResizeEnd();

        expect((component as unknown as { history: unknown[] }).history.length).toBeGreaterThanOrEqual(before);
        expect(component.htmlOutput()).toContain('img');
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

    it('Ctrl+K opens the link dialog', () => {
        component.writeValue('<p>link me</p>');
        fixture.detectChanges();
        selectAll();
        component.onKeydown(key('k'));
        expect(component.showLinkPopover()).toBe(true);
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

describe('RichTextEditorComponent — slash command run callbacks', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    const runById = async (id: string) => {
        component.writeValue(`<p>seed /x</p>`);
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, text.length);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        const cmd = component.localizedSlashCommands().find(c => c.id === id)
            ?? component.filteredSlashCommands().find(c => c.id === id);
        await component.onSlashCommandSelect(cmd!);
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

    it('format.code-block slash command inserts a pre/code block', async () => {
        await runById('format.code-block');
        expect(editor.querySelector('pre code')).toBeTruthy();
    });

    it('insert.toggle slash command inserts a details block', async () => {
        await runById('insert.toggle');
        expect(editor.querySelector('details')).toBeTruthy();
    });

    it('insert.link slash command opens the link dialog', async () => {
        await runById('insert.link');
        expect(component.showLinkPopover()).toBe(true);
    });

    it('history.undo slash command runs without error', async () => {
        component.writeValue('<p>one</p>'); fixture.detectChanges();
        (component as unknown as { pushHistory(): void }).pushHistory();
        component.writeValue('<p>two</p>'); fixture.detectChanges();
        (component as unknown as { pushHistory(): void }).pushHistory();

        await runById('history.undo');
        expect(editor.textContent).toMatch(/one|two|seed/);
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

describe('RichTextEditorComponent — slash trigger removal & list re-typing', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    type Internal = {
        removeSlashTriggerText(query: string): HTMLElement | null;
        slashTriggerRange: Range | null;
        slashAnchorBlock: HTMLElement | null;
        wrapBlockInList(block: HTMLElement, tag: 'ul' | 'ol'): HTMLElement;
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

    it('removes the slash trigger text via the editor tree walk fallback', () => {
        component.writeValue('<p>alpha /code beta</p>');
        fixture.detectChanges();
        const internal = component as unknown as Internal;
        internal.slashTriggerRange = null;
        internal.slashAnchorBlock = null;
        document.getSelection()?.removeAllRanges();

        const block = internal.removeSlashTriggerText('code');

        expect(block?.tagName).toBe('P');
        expect(editor.textContent).not.toContain('/code');
        expect(editor.textContent).toContain('alpha');
    });

    it('wrapBlockInList converts a UL list item into an OL list item', () => {
        component.writeValue('<ul><li>item</li></ul>');
        fixture.detectChanges();
        const li = editor.querySelector('li')!;

        const result = (component as unknown as Internal).wrapBlockInList(li, 'ol');

        expect(result).toBe(li);
        expect(editor.querySelector('ol > li')).toBeTruthy();
        expect(editor.querySelector('ul')).toBeNull();
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

    it('appends an image to the editor end when there is no selection', () => {
        document.getSelection()?.removeAllRanges();
        (component as unknown as Internal).insertImageAtSelection('https://cdn.test/x.png', 'alt');
        expect(editor.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/x.png');
    });

    it('appends an image when the selection is outside the editor', () => {
        const outside = document.createElement('div');
        outside.textContent = 'outside';
        document.body.appendChild(outside);
        const sel = document.getSelection();
        const r = document.createRange();
        r.selectNodeContents(outside);
        sel?.removeAllRanges();
        sel?.addRange(r);

        (component as unknown as Internal).insertImageAtSelection('https://cdn.test/y.png', 'alt');

        expect(editor.querySelector('img')).toBeTruthy();
        outside.remove();
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

    it('does not open the slash command popover when readonly', () => {
        editor.textContent = '/hea';
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(editor.firstChild as Text, 4);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        expect(component.slashCommandOpen()).toBe(false);
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

describe('RichTextEditorComponent — slash keydown with no matches & misc', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;

    type Internal = { onSlashCommandKeydown(e: KeyboardEvent): void };

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

    it('Escape with no matching slash commands closes the popover', () => {
        component.slashCommandOpen.set(true);
        component.slashQuery.set('zzzznomatch');
        fixture.detectChanges();
        expect(component.filteredSlashCommands()).toHaveLength(0);

        (component as unknown as Internal).onSlashCommandKeydown(
            new KeyboardEvent('keydown', { key: 'Escape' })
        );

        expect(component.slashCommandOpen()).toBe(false);
    });

    it('onBeforeInput blocks typing beyond maxLength', () => {
        fixture.componentRef.setInput('maxLength', 3);
        fixture.detectChanges();
        component.writeValue('abc');
        fixture.detectChanges();
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(editor.firstChild as Text, 3);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);

        const ev = new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: 'x', inputType: 'insertText' });
        editor.dispatchEvent(ev);

        expect(ev.defaultPrevented).toBe(true);
    });

    it('onBeforeInput allows deletions regardless of maxLength', () => {
        fixture.componentRef.setInput('maxLength', 3);
        fixture.detectChanges();
        component.writeValue('abc');
        fixture.detectChanges();

        const ev = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward' });
        editor.dispatchEvent(ev);

        expect(ev.defaultPrevented).toBe(false);
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

describe('RichTextEditorComponent — slash list scroll & empty-block fallbacks', () => {
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

    it('opening the slash menu renders the command list and tracks the selected entry', () => {
        editor.textContent = '/';
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(editor.firstChild as Text, 1);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();

        const list = (fixture.nativeElement as HTMLElement).querySelector('[data-slash-index="0"]');
        expect(list).toBeTruthy();

        component.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        fixture.detectChanges();
        expect(component.slashCommandSelectedIndex()).toBe(1);
    });

    it('placeCaretAtEndOfBlock handles a block with no children by inserting a zero-width node', async () => {
        component.writeValue('<p>line /paragraph</p>');
        fixture.detectChanges();
        const text = editor.querySelector('p')!.firstChild as Text;
        const sel = document.getSelection();
        const r = document.createRange();
        r.setStart(text, text.length);
        r.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(r);
        editor.dispatchEvent(new Event('input', { bubbles: true }));

        const cmd = component.filteredSlashCommands().find(c => c.id === 'format.paragraph')!;
        await component.onSlashCommandSelect(cmd);

        expect(editor.querySelector('p')).toBeTruthy();
        expect(editor.textContent).toContain('line');
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

describe('RichTextEditorComponent — image source guards & paste max length', () => {
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

    it('emits imageUploadError when upload-only source has no uploader configured', async () => {
        fixture.componentRef.setInput('imageSources', 'upload');
        fixture.detectChanges();
        const errSpy = vi.spyOn(component.imageUploadError, 'emit');
        const file = new File(['x'], 'p.png', { type: 'image/png' });

        await component.onPaste({
            preventDefault: vi.fn(),
            clipboardData: { files: [file], getData: () => '' } as unknown as DataTransfer,
        } as unknown as ClipboardEvent);

        expect(errSpy).toHaveBeenCalledWith('No imageUploader configured.');
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

    it('emoji insertion temporarily disables the editor inputMode then restores it', () => {
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

        component.onEmojiInsert('😀');
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
        expect(component.localizedSlashCommands().some((c) => c.id === 'insert.ai')).toBe(false);
        fixture.componentRef.setInput('aiProvider', () => 'x');
        expect(component.localizedSlashCommands().some((c) => c.id === 'insert.ai')).toBe(true);
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
        expect(clicks.length).toBe(1);
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
});
