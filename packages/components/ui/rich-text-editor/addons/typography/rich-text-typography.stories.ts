import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextTypographyDirective } from './rich-text-typography.directive';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Typography',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextTypographyDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in typography addon: `apply rich-text-editor/typography`, then add `uiRteTypography` to ' +
                    'the editor element. Contributes the font-size and font-family toolbar buttons; the base ' +
                    'editor ships no font-size/font-family toolbar code and no `autocomplete` dependency. Content ' +
                    'sized/styled with these buttons still renders with the base alone — only the picker UI is opt-in.',
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
                uiRteTypography
                placeholder="Select text, then use the font buttons in the toolbar…"
                minHeight="150px"
            />
        `,
    }),
};

export const MinimalToolbarWithTypography: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteTypography
                [toolbarItems]="['bold', 'italic', 'separator']"
                placeholder="Font buttons render after the built-in items…"
                minHeight="150px"
            />
        `,
    }),
};

export const CustomFontsAndLocale: Story = {
    render: () => ({
        props: {
            families: ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins'],
        },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteTypography
                uiRteTypographyLocale="he"
                locale="he"
                [uiRteTypographyFamilies]="families"
                uiRteTypographyFamiliesStrategy="replace"
                minHeight="150px"
            />
        `,
    }),
};
