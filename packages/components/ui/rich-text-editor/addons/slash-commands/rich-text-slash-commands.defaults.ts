import type { RichTextSlashCommand } from '../..';
import type { RichTextSlashCommandsLocale } from './rich-text-slash-commands.locales';

/**
 * Builds the addon's built-in slash commands (paragraph, headings, lists,
 * quote, inline/code block, link, task list, toggle, horizontal rule, undo,
 * redo) from the addon locale. These feed the menu alongside the host's
 * base-owned `builtinCommands` (outline / AI), the shared command registry,
 * and any custom commands passed to `[uiRteSlashCommands]`.
 */
export function buildDefaultSlashCommands(l: RichTextSlashCommandsLocale): RichTextSlashCommand[] {
    return [
        ...buildFormatSlashCommands(l),
        ...buildInsertAndHistorySlashCommands(l),
    ];
}

function buildHeadingSlashCommands(l: RichTextSlashCommandsLocale): RichTextSlashCommand[] {
    return [
        {
            id: 'format.paragraph',
            label: l.paragraph,
            description: l.paragraphDescription,
            keywords: ['text', 'normal'],
            order: 10,
            run: context => context.executeToolbarCommand('paragraph'),
        },
        {
            id: 'format.heading-1',
            label: l.heading1,
            description: l.heading1Description,
            keywords: ['h1', 'title'],
            order: 20,
            run: context => context.executeToolbarCommand('heading1'),
        },
        {
            id: 'format.heading-2',
            label: l.heading2,
            description: l.heading2Description,
            keywords: ['h2', 'subtitle'],
            order: 30,
            run: context => context.executeToolbarCommand('heading2'),
        },
        {
            id: 'format.heading-3',
            label: l.heading3,
            description: l.heading3Description,
            keywords: ['h3'],
            order: 40,
            run: context => context.executeToolbarCommand('heading3'),
        },
    ];
}

function buildListSlashCommands(l: RichTextSlashCommandsLocale): RichTextSlashCommand[] {
    return [
        {
            id: 'format.bullet-list',
            label: l.bulletList,
            description: l.bulletListDescription,
            keywords: ['list', 'ul', 'bl'],
            order: 50,
            run: context => context.executeToolbarCommand('bulletList'),
        },
        {
            id: 'format.numbered-list',
            label: l.numberedList,
            description: l.numberedListDescription,
            keywords: ['list', 'ol', 'nl'],
            order: 60,
            run: context => context.executeToolbarCommand('orderedList'),
        },
        {
            id: 'format.quote',
            label: l.blockQuote,
            description: l.blockQuoteDescription,
            keywords: ['blockquote', 'quote'],
            order: 70,
            run: context => context.executeToolbarCommand('blockquote'),
        },
        {
            id: 'format.inline-code',
            label: l.inlineCode,
            description: l.inlineCodeDescription,
            keywords: ['code'],
            order: 80,
            run: context => context.executeToolbarCommand('code'),
        },
        {
            id: 'format.code-block',
            label: l.codeBlock,
            description: l.codeBlockDescription,
            keywords: ['pre', 'snippet'],
            order: 90,
            run: context => context.executeToolbarCommand('codeBlock'),
        },
    ];
}

function buildFormatSlashCommands(l: RichTextSlashCommandsLocale): RichTextSlashCommand[] {
    return [
        ...buildHeadingSlashCommands(l),
        ...buildListSlashCommands(l),
    ];
}

function buildInsertSlashCommands(l: RichTextSlashCommandsLocale): RichTextSlashCommand[] {
    return [
        {
            id: 'insert.link',
            label: l.link,
            description: l.linkDescription,
            keywords: ['url', 'anchor'],
            order: 100,
            run: context => context.showLinkDialog(),
        },
        {
            id: 'insert.task-list',
            label: l.taskList,
            description: l.taskListDescription,
            keywords: ['checkbox', 'todo', 'task', 'checklist'],
            order: 65,
            run: context => context.executeToolbarCommand('taskList'),
        },
        {
            id: 'insert.toggle',
            label: l.toggle,
            description: l.toggleDescription,
            keywords: ['details', 'summary', 'collapse', 'expand', 'accordion'],
            order: 75,
            run: context => context.executeToolbarCommand('toggle'),
        },
        {
            id: 'insert.horizontal-rule',
            label: l.horizontalRule,
            description: l.horizontalRuleDescription,
            keywords: ['hr', 'divider', 'line', 'separator'],
            order: 95,
            run: context => context.executeToolbarCommand('horizontalRule'),
        },
    ];
}

function buildHistorySlashCommands(l: RichTextSlashCommandsLocale): RichTextSlashCommand[] {
    return [
        {
            id: 'history.undo',
            label: l.undo,
            description: l.undoDescription,
            keywords: ['ctrl+z', 'revert'],
            order: 110,
            run: context => context.executeToolbarCommand('undo'),
        },
        {
            id: 'history.redo',
            label: l.redo,
            description: l.redoDescription,
            keywords: ['ctrl+y', 'ctrl+shift+z'],
            order: 120,
            run: context => context.executeToolbarCommand('redo'),
        },
    ];
}

function buildInsertAndHistorySlashCommands(l: RichTextSlashCommandsLocale): RichTextSlashCommand[] {
    return [
        ...buildInsertSlashCommands(l),
        ...buildHistorySlashCommands(l),
    ];
}
