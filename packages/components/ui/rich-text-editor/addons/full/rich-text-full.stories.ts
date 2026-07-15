import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RTE_FULL } from './index';
import type { AiProvider } from '../../../../lib/ai';
import type { MentionItem, RichTextEntitySearchFn } from '../mentions';
import type { RichTextActionDefinition } from '../actions';

const mockAi: AiProvider = (request) =>
    new Promise((resolve) => setTimeout(() => resolve(`AI on: ${request.input}`), 300));

const searchMentions: RichTextEntitySearchFn<MentionItem> = (query) =>
    [
        { id: '1', value: 'ada', label: 'Ada Lovelace' },
        { id: '2', value: 'alan', label: 'Alan Turing' },
    ].filter((m) => m.label.toLowerCase().includes(query.toLowerCase()));

const actionDefs: RichTextActionDefinition[] = [
    {
        id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
        fields: [{ key: 'dialogId', label: 'Dialog id', type: 'text', required: true }],
    },
];

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Full',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RTE_FULL],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'The composition bundle: `apply rich-text-editor/full`, import the generated `RTE_FULL` ' +
                    'array, and add the single `uiRteFull` attribute — every addon directive also matches on ' +
                    '`[uiRteFull]`, so one marker activates all thirteen at once. Each addon’s inputs and ' +
                    'outputs bind natively on the editor element, exactly as with the individual addons, and ' +
                    'features left unconfigured stay inert. For a subset, import and use the individual addon ' +
                    'directives instead.',
            },
        },
    },
};

export default meta;
type Story = StoryObj;

export const Everything: Story = {
    render: () => ({
        props: { mockAi, searchMentions, actionDefs },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteFull
                [uiRteAi]="mockAi"
                [uiRteActions]="actionDefs"
                [uiRteMentionsSearch]="searchMentions"
                uiRteTags
                [uiRteTagsSearch]="searchMentions"
                placeholder="Type / for commands, or use the full toolbar…"
                minHeight="240px"
            />
        `,
    }),
};
