import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextColorsDirective } from './rich-text-colors.directive';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Colors',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextColorsDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in colours addon: `apply rich-text-editor/colors`, then add `uiRteColors` to the ' +
                    'editor element. Contributes the text-colour and highlight-colour toolbar buttons; the ' +
                    'base editor ships no colour code and no `color-picker` dependency. Coloured content ' +
                    'still renders with the base alone — only the picker UI is opt-in.',
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
                uiRteColors
                placeholder="Select text, then use the colour buttons in the toolbar…"
                minHeight="150px"
            />
        `,
    }),
};

export const MinimalToolbarWithColors: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteColors
                [toolbarItems]="['bold', 'italic', 'separator']"
                placeholder="Colour buttons render after the built-in items…"
                minHeight="150px"
            />
        `,
    }),
};

export const CustomPalettesAndLocale: Story = {
    render: () => ({
        props: {
            palette: ['#0f172a', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed'],
            highlight: ['transparent', '#fee2e2', '#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff'],
        },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteColors
                uiRteColorsLocale="he"
                locale="he"
                [uiRteColorsPalette]="palette"
                [uiRteColorsHighlightPalette]="highlight"
                minHeight="150px"
            />
        `,
    }),
};
