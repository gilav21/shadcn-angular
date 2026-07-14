import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextMentionsDirective } from './rich-text-mentions.directive';
import type { MentionItem, TagItem, RichTextEntityRenderOptions } from './rich-text-mentions.types';

const USERS: MentionItem[] = [
    { id: '1', value: 'john-doe', label: 'John Doe', description: 'john.doe@example.com' },
    { id: '2', value: 'jane.smith', label: 'Jane Smith', description: 'jane.smith@example.com' },
    { id: '3', value: 'team_ops', label: 'Team Ops', description: 'ops@example.com' },
];
const TAGS: TagItem[] = [
    { id: '1', value: 'angular.ui', label: 'Angular UI', color: '#dd0031' },
    { id: '2', value: 'typescript-5', label: 'TypeScript 5', color: '#3178c6' },
    { id: '3', value: 'release_2026', label: 'Release 2026', color: '#06b6d4' },
];

function filterBy<T extends { label: string; value: string }>(items: T[], query: string): T[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q));
}

const searchUsers = (query: string): MentionItem[] => filterBy(USERS, query);
const searchTags = (query: string): TagItem[] => filterBy(TAGS, query);
const linkRender: RichTextEntityRenderOptions = { mode: 'link', urlTemplate: '/users/@@userId@@' };

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Mentions',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextMentionsDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in mentions/tags addon: `apply rich-text-editor/mentions`, then add `uiRteMentions` to the ' +
                    'editor element. Owns the whole `@mention` / `#tag` authoring feature — trigger detection at the ' +
                    'caret, the async search popover, keyboard navigation, and inserting the styled entity chip or ' +
                    'link. The base editor keeps only content-level entity support (the sanitizer keeps allowing ' +
                    '`data-mention`/`data-tag` chips, and the colour/typography addons still style them), so existing ' +
                    'content renders with the base alone; only the authoring UI is opt-in.',
            },
        },
    },
};

export default meta;
type Story = StoryObj;

export const Mentions: Story = {
    render: () => ({
        props: { searchUsers },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteMentions
                [uiRteMentionsSearch]="searchUsers"
                placeholder="Type @ to mention someone (try @john, @jane, @team)…"
                minHeight="180px"
            />
        `,
    }),
};

export const MentionsAndTags: Story = {
    render: () => ({
        props: { searchUsers, searchTags },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteMentions
                [uiRteMentionsSearch]="searchUsers"
                [uiRteTags]="true"
                [uiRteTagsSearch]="searchTags"
                placeholder="Type @ for people or # for tags…"
                minHeight="180px"
            />
        `,
    }),
};

export const MentionsAsLinks: Story = {
    render: () => ({
        props: { searchUsers, linkRender },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteMentions
                [uiRteMentionsSearch]="searchUsers"
                [uiRteMentionsRender]="linkRender"
                placeholder="Mentions insert as profile links (/users/:id)…"
                minHeight="180px"
            />
        `,
    }),
};

export const RtlAndLocale: Story = {
    render: () => ({
        props: { searchUsers },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteMentions
                [uiRteMentionsSearch]="searchUsers"
                uiRteMentionsLocale="he"
                locale="he"
                minHeight="180px"
            />
        `,
    }),
};
