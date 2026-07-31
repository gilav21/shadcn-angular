import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextFileImportDirective } from './rich-text-file-import.directive';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/File Import',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextFileImportDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in file-import addon: `apply rich-text-editor/file-import`, then add `uiRteFileImport` to ' +
                    'the editor element. Contributes the import toolbar button (a hidden `.pdf,.docx` picker), ' +
                    'document drag-and-drop, the lazy-loaded DOCX/PDF parsers, and a busy/error overlay. The parsed ' +
                    'document lands at the caret as one history entry. Alongside the images addon the picker also ' +
                    'offers PNG/JPEG/GIF/WEBP and hands a picked image to that addon\'s pipeline — same uploader, ' +
                    'insert defaults and outputs as a pasted or dropped image — so there is never a second way an ' +
                    'image can enter the document. The base editor ships no import UI or parser code, so a plain ' +
                    'install no longer pulls the docx/pdf parser lib files.',
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
                uiRteFileImport
                placeholder="Use the import button, or drop a .docx / .pdf here…"
                minHeight="200px"
            />
        `,
    }),
};

export const MinimalToolbarWithImport: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteFileImport
                [toolbarItems]="['bold', 'italic', 'separator']"
                placeholder="The import button renders after the built-in items…"
                minHeight="200px"
            />
        `,
    }),
};

export const RtlAndLocale: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteFileImport
                uiRteFileImportLocale="he"
                locale="he"
                minHeight="200px"
            />
        `,
    }),
};
