import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { ShortcutBindingService } from '../lib/shortcut-binding.service';
import { RichTextCommandRegistry, RichTextSlashCommandContext } from './rich-text-command-registry.service';

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
        editor = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement;
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

        const p = editor.querySelector('p') as HTMLParagraphElement;
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

        const img = editor.querySelector('img') as HTMLImageElement | null;
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

        const chip = editor.querySelector('[data-mention="john-doe"]') as HTMLElement | null;
        expect(chip).toBeTruthy();

        const selection = document.getSelection();
        expect(selection?.rangeCount).toBeGreaterThan(0);
        const anchorParent = selection?.anchorNode?.parentElement;
        expect(anchorParent?.hasAttribute('data-mention')).toBe(false);
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
        expect((component as any).history[(component as any).history.length - 1].preview).toContain('abc');

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

        const latest = (component as any).history[(component as any).history.length - 1];
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
        list.setAttribute('data-history-list', 'test');
        const first = document.createElement('div');
        const second = document.createElement('div');
        first.setAttribute('data-history-entry-action', 'true');
        second.setAttribute('data-history-entry-action', 'true');
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
        list.setAttribute('data-history-list', 'test');
        const first = document.createElement('div');
        const second = document.createElement('div');
        const third = document.createElement('div');
        first.setAttribute('data-history-entry-action', 'true');
        second.setAttribute('data-history-entry-action', 'true');
        third.setAttribute('data-history-entry-action', 'true');
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
        list.setAttribute('data-history-list', 'popover');
        const row = document.createElement('div');
        row.setAttribute('data-history-entry-action', 'true');
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
        list.setAttribute('data-history-list', 'dialog');
        const row = document.createElement('div');
        row.setAttribute('data-history-entry-action', 'true');
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
        list.setAttribute('data-history-list', 'popover');
        fixture.nativeElement.appendChild(list);

        const entry = document.createElement('div');
        entry.setAttribute('data-history-entry-action', 'true');
        entry.setAttribute('data-history-entry-index', '1');
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

        const actions = Array.from(
            fixture.nativeElement.querySelectorAll('[data-history-list="dialog"] [data-history-entry-action="true"]')
        ) as HTMLElement[];
        expect(actions.length).toBeGreaterThanOrEqual(2);
        expect(document.activeElement).toBe(actions[0]);

        component.onHistoryEntryKeydown({
            key: 'ArrowDown',
            currentTarget: actions[0],
            preventDefault: vi.fn(),
        } as unknown as KeyboardEvent, Number(actions[0].getAttribute('data-history-entry-index') ?? 0));

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

        const editorAfter = fixture.nativeElement.querySelector('[data-slot="rich-text-editor"]') as HTMLDivElement | null;
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
});
