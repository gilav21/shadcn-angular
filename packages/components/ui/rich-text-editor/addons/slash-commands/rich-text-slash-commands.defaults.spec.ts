import { describe, it, expect, vi } from 'vitest';
import { buildDefaultSlashCommands } from './rich-text-slash-commands.defaults';
import { RICH_TEXT_SLASH_COMMANDS_LOCALES } from './rich-text-slash-commands.locales';
import { RichTextSlashCommandContext } from '../..';

const EN = RICH_TEXT_SLASH_COMMANDS_LOCALES.en;
const HE = RICH_TEXT_SLASH_COMMANDS_LOCALES.he;

/** id → the toolbar command each built-in slash command forwards to. */
const TOOLBAR_BY_ID: Record<string, string> = {
    'format.paragraph': 'paragraph',
    'format.heading-1': 'heading1',
    'format.heading-2': 'heading2',
    'format.heading-3': 'heading3',
    'format.bullet-list': 'bulletList',
    'format.numbered-list': 'orderedList',
    'format.quote': 'blockquote',
    'format.inline-code': 'code',
    'format.code-block': 'codeBlock',
    'insert.task-list': 'taskList',
    'insert.toggle': 'toggle',
    'insert.horizontal-rule': 'horizontalRule',
    'history.undo': 'undo',
    'history.redo': 'redo',
};

function stubContext(): { ctx: RichTextSlashCommandContext; executeToolbarCommand: ReturnType<typeof vi.fn> } {
    const executeToolbarCommand = vi.fn((_command: string) => undefined);
    const ctx: RichTextSlashCommandContext = {
        query: '',
        selectedText: '',
        executeToolbarCommand,
        insertText: vi.fn((_text: string) => undefined),
        insertHtml: vi.fn((_html: string) => undefined),
        showLinkDialog: vi.fn(() => undefined),
        focusEditor: vi.fn(() => undefined),
    };
    return { ctx, executeToolbarCommand };
}

describe('buildDefaultSlashCommands', () => {
    it('builds every built-in command exactly once with unique ids', () => {
        const commands = buildDefaultSlashCommands(EN);
        expect(commands).toHaveLength(Object.keys(TOOLBAR_BY_ID).length);
        const ids = commands.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        const cmp = (a: string, b: string): number => a.localeCompare(b);
        expect([...ids].sort(cmp)).toEqual(Object.keys(TOOLBAR_BY_ID).sort(cmp));
    });

    it('labels each command from the supplied locale', () => {
        const commands = buildDefaultSlashCommands(EN);
        const byId = new Map(commands.map((c) => [c.id, c]));
        expect(byId.get('format.paragraph')!.label).toBe(EN.paragraph);
        expect(byId.get('format.heading-1')!.label).toBe(EN.heading1);
        expect(byId.get('format.code-block')!.description).toBe(EN.codeBlockDescription);
        expect(byId.get('history.redo')!.label).toBe(EN.redo);
    });

    it('localizes labels when handed a different locale', () => {
        const commands = buildDefaultSlashCommands(HE);
        const paragraph = commands.find((c) => c.id === 'format.paragraph')!;
        expect(paragraph.label).toBe(HE.paragraph);
        expect(paragraph.description).toBe(HE.paragraphDescription);
    });

    it('gives every command keywords and a numeric order', () => {
        for (const command of buildDefaultSlashCommands(EN)) {
            expect(Array.isArray(command.keywords)).toBe(true);
            expect(command.keywords!.length).toBeGreaterThan(0);
            expect(typeof command.order).toBe('number');
        }
    });

    it('runs each command against the toolbar command it maps to', () => {
        for (const command of buildDefaultSlashCommands(EN)) {
            const { ctx, executeToolbarCommand } = stubContext();
            command.run(ctx);
            expect(executeToolbarCommand).toHaveBeenCalledTimes(1);
            expect(executeToolbarCommand).toHaveBeenCalledWith(TOOLBAR_BY_ID[command.id]);
        }
    });

    it('orders paragraph before headings before history in the built list', () => {
        const commands = buildDefaultSlashCommands(EN);
        const orderOf = (id: string): number => commands.find((c) => c.id === id)!.order ?? 0;
        expect(orderOf('format.paragraph')).toBeLessThan(orderOf('format.heading-1'));
        expect(orderOf('format.heading-1')).toBeLessThan(orderOf('history.undo'));
        expect(orderOf('history.undo')).toBeLessThan(orderOf('history.redo'));
    });
});
