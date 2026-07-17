import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextLinksDirective } from './rich-text-links.directive';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Links',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextLinksDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in links addon: `apply rich-text-editor/links`, then add `uiRteLinks` to the editor ' +
                    'element. Owns the whole link feature — the toolbar link button + popover, the `Ctrl/Cmd+K` ' +
                    'shortcut and `/link` slash command, and a click-to-edit popover on existing links. The base ' +
                    'editor ships no link UI (its `showLinkDialog` is inert without this addon). Existing link ' +
                    'content still renders with the base alone; only the editing UI is opt-in.',
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
                uiRteLinks
                placeholder="Select text, then use the link button — or press Ctrl/Cmd+K…"
                minHeight="150px"
            />
        `,
    }),
};

export const MinimalToolbarWithLinks: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteLinks
                [toolbarItems]="['bold', 'italic', 'separator']"
                placeholder="The link button renders after the built-in items…"
                minHeight="150px"
            />
        `,
    }),
};

export const EditExistingLinks: Story = {
    render: () => ({
        props: {
            content: '<p>Click the <a href="https://angular.dev">Angular</a> link to edit or remove it.</p>',
        },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteLinks
                [value]="content"
                minHeight="150px"
            />
        `,
    }),
};

export const RtlAndLocale: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteLinks
                uiRteLinksLocale="he"
                locale="he"
                minHeight="150px"
            />
        `,
    }),
};
