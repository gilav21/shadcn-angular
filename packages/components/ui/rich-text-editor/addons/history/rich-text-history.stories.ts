import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextHistoryDirective } from './rich-text-history.directive';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/History',
    decorators: [
        moduleMetadata({
            imports: [RichTextEditorComponent, RichTextHistoryDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in revision-history addon: `apply rich-text-editor/history`, then add ' +
                    '`uiRteHistory` to the editor element. Renders the "Revisions" corner button + panel, ' +
                    'the preview dialog, and the browser dialog (Ctrl/Cmd + Shift + H). The base editor keeps ' +
                    'the undo/redo stack but ships no revision-history UI and no `dialog` dependency. Set ' +
                    '`[uiRteHistoryButton]="false"` for a shortcut-only (browser-dialog) experience.',
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
                toolbar="top"
                uiRteHistory
                [historyDebounceMs]="400"
                placeholder="Type, pause, then open Revisions (top-right) to jump between snapshots…"
                minHeight="200px"
            />
        `,
    }),
};

export const ShortcutOnly: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                toolbar="top"
                uiRteHistory
                [uiRteHistoryButton]="false"
                placeholder="No corner button — press Ctrl/Cmd + Shift + H to open the history browser…"
                minHeight="200px"
            />
        `,
    }),
};

export const HebrewRtl: Story = {
    render: () => ({
        template: `
            <ui-rich-text-editor
                mode="html"
                toolbar="top"
                uiRteHistory
                uiRteHistoryLocale="he"
                locale="he"
                placeholder="הקלד, המתן, ואז פתח את הגרסאות…"
                minHeight="200px"
            />
        `,
    }),
};
