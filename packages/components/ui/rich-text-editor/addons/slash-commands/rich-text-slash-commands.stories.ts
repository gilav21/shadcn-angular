import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import type { RichTextSlashCommand } from '../../rich-text-command-registry.service';
import { RichTextSlashCommandsDirective } from './rich-text-slash-commands.directive';

const customSlashCommands: RichTextSlashCommand[] = [
    {
        id: 'custom.insert-callout',
        label: 'Insert Callout',
        description: 'Adds a callout block template',
        keywords: ['callout', 'tip'],
        order: 200,
        run: (context) => context.insertHtml('<blockquote><strong>Callout:</strong> Add details here.</blockquote>'),
    },
    {
        id: 'custom.insert-divider',
        label: 'Insert Divider',
        description: 'Adds a horizontal divider',
        keywords: ['divider', 'hr'],
        order: 210,
        run: (context) => context.insertHtml('<hr />'),
    },
];

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Slash Commands',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextSlashCommandsDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in slash-command addon: `apply rich-text-editor/slash-commands`, then add ' +
                    '`uiRteSlashCommands` to the editor element. Typing `/` opens a filterable command ' +
                    'menu at the caret. The base editor ships no slash-command code; custom commands are ' +
                    'passed via `[uiRteSlashCommands]`.',
            },
        },
    },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteSlashCommands
                placeholder="Type / to open the command menu…"
                minHeight="180px"
            />
        `,
    }),
};

export const WithCustomCommands: Story = {
    render: () => ({
        props: { commands: customSlashCommands },
        template: `
            <ui-rich-text-editor
                mode="html"
                [uiRteSlashCommands]="commands"
                placeholder="Type / and try /callout or /divider…"
                minHeight="180px"
            />
        `,
    }),
};

export const HebrewRtl: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteSlashCommands
                uiRteSlashCommandsLocale="he"
                locale="he"
                placeholder="הקלד / לפתיחת התפריט…"
                minHeight="180px"
            />
        `,
    }),
};
