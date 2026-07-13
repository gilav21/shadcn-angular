import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextEmojiDirective } from './rich-text-emoji.directive';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Emoji',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextEmojiDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in emoji addon: `apply rich-text-editor/emoji`, then add `uiRteEmoji` to the ' +
                    'editor element. Contributes the emoji picker toolbar button; the base editor ships ' +
                    'no emoji code.',
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
                uiRteEmoji
                placeholder="Click the emoji button in the toolbar…"
                minHeight="150px"
            />
        `,
    }),
};

export const CustomOrderAndLocale: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteEmoji
                [uiRteEmojiOrder]="100"
                uiRteEmojiLocale="he"
                locale="he"
                minHeight="150px"
            />
        `,
    }),
};

export const MinimalToolbarWithEmoji: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteEmoji
                [toolbarItems]="['bold', 'italic', 'separator', 'link']"
                placeholder="Addon buttons render after the built-in items…"
                minHeight="150px"
            />
        `,
    }),
};
