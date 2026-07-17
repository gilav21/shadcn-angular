import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextTablesDirective } from './rich-text-tables.directive';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Tables',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextTablesDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in tables addon: `apply rich-text-editor/tables`, then add `uiRteTables` to the editor ' +
                    'element. Contributes the table toolbar button + 8×8 grid picker; selecting a size inserts an ' +
                    'empty table at the caret. The base editor ships no table-insert UI, but editing an existing ' +
                    'table (add/delete rows and columns, merge cells, borders, cell colour) stays in the base — so ' +
                    'table content still renders and edits with the base alone.',
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
                uiRteTables
                placeholder="Use the table button to insert a grid…"
                minHeight="150px"
            />
        `,
    }),
};

export const MinimalToolbarWithTables: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteTables
                [toolbarItems]="['bold', 'italic', 'separator']"
                placeholder="The table button renders after the built-in items…"
                minHeight="150px"
            />
        `,
    }),
};

export const EditExistingTable: Story = {
    render: () => ({
        props: {
            content:
                '<table><thead><tr><th>Name</th><th>Role</th></tr></thead>' +
                '<tbody><tr><td>Ada</td><td>Engineer</td></tr></tbody></table><p><br></p>',
        },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteTables
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
                uiRteTables
                uiRteTablesLocale="he"
                locale="he"
                minHeight="150px"
            />
        `,
    }),
};
