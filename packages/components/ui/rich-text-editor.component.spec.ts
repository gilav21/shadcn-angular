import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { DEFAULT_FONT_FAMILIES } from './rich-text-toolbar.component';
import { ShortcutBindingService } from '../lib/shortcut-binding.service';
import { RichTextCommandRegistry, RichTextSlashCommandContext } from './rich-text-command-registry.service';
import { RICH_TEXT_LOCALES, RichTextLocale } from './rich-text-locales';

describe('RichTextEditorComponent', () => {
    let fixture: ComponentFixture<RichTextEditorComponent>;
    let component: RichTextEditorComponent;
    let editor: HTMLDivElement;
    let shortcutBindings: ShortcutBindingService;
    let commandRegistry: RichTextCommandRegistry;

    const setCaret = (node: Text, offset: number) => {
        const selection = document.getSelection();
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
    };

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
        expect(img?.attributes.length).toBe(2);
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

        expect((component as any).history.length).toBe(1);

        vi.advanceTimersByTime(199);
        expect((component as any).history.length).toBe(1);

        vi.advanceTimersByTime(1);
        expect((component as any).history.length).toBe(2);
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
        expect((component as any).history.length).toBe(baselineLength);
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
        expect((component as any).history.length).toBe(1);

        component.onHistoryPanelOpenChange(true);
        expect((component as any).history.length).toBe(2);
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
        expect(viewsAfterDestroy.length).toBe(0);
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
            expect(row.cells.length).toBe(2);
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
            expect((rows[0] as HTMLTableRowElement).cells.length).toBe(2);
            expect((rows[1] as HTMLTableRowElement).cells.length).toBe(1);
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
            expect(row.cells.length).toBe(1);
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
            expect(row.cells.length).toBe(3);
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
            expect((rows[0] as HTMLTableRowElement).cells.length).toBe(3);
            expect((rows[1] as HTMLTableRowElement).cells.length).toBe(3);
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

            expect(headerRow.cells.length).toBe(3);
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
            expect((rows[0] as HTMLTableRowElement).cells.length).toBe(3);
            expect((rows[1] as HTMLTableRowElement).cells.length).toBe(3);
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

            expect(component.tableCellSelected().length).toBe(2);
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

            expect(component.tableCellSelected().length).toBe(0);
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
            expect(fontElements.length).toBe(0);

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

        it('editableClasses insets the content past the docked panel only while it is open', () => {
            expect(component.editableClasses()).not.toContain('ps-[calc(16rem+3px)]');

            component.outlinePanelOpen.set(true);
            expect(component.editableClasses()).toContain('ps-[calc(16rem+3px)]');

            component.outlinePanelOpen.set(false);
            expect(component.editableClasses()).not.toContain('ps-[calc(16rem+3px)]');
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
