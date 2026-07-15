import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent } from '../../rich-text-editor.component';
import { RichTextSlashCommandsDirective } from '../slash-commands';
import { RichTextOutlineDirective } from './rich-text-outline.directive';

const SAMPLE_HTML =
    '<h1>Getting started</h1><p>An overview of the editor.</p>' +
    '<h2>Installation</h2><p>Add the component to your app.</p>' +
    '<h3>Prerequisites</h3><p>Node and Angular.</p>' +
    '<h2>Usage</h2><p>Type away.</p><h2>Troubleshooting</h2><p>Common issues.</p>';

const meta: Meta = {
    title: 'Editor/Rich Text Editor/Addons/Outline',
    decorators: [
        moduleMetadata({
            imports: [FormsModule, RichTextEditorComponent, RichTextSlashCommandsDirective, RichTextOutlineDirective],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component:
                    'Opt-in document-outline addon: `apply rich-text-editor/outline`, then add `uiRteOutline` to ' +
                    'the editor. It contributes a toolbar button and a `/outline` slash command that open a docked, ' +
                    'read-only table-of-contents panel listing every heading in document order. Click a heading (or ' +
                    'press Enter/Space) to scroll the editor to it. The panel refreshes as you type. Pass ' +
                    '`[uiRteOutlineButton]="false"` to hide the toolbar button and drive it from the slash command ' +
                    'only. The base editor ships no outline UI and no scroll-area dependency.',
            },
        },
    },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
    render: () => ({
        props: { content: SAMPLE_HTML },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteOutline
                [ngModel]="content"
                minHeight="320px"
            />
        `,
    }),
};

export const SlashCommandOnly: Story = {
    render: () => ({
        props: { content: SAMPLE_HTML },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteOutline
                uiRteSlashCommands
                [uiRteOutlineButton]="false"
                [ngModel]="content"
                minHeight="320px"
            />
        `,
    }),
};

export const RtlAndLocale: Story = {
    render: () => ({
        props: { content: '<h1>מבוא</h1><p>סקירה כללית.</p><h2>התקנה</h2><p>הוספת הרכיב.</p><h2>שימוש</h2><p>כתיבה חופשית.</p>' },
        template: `
            <ui-rich-text-editor
                mode="html"
                uiRteOutline
                uiRteOutlineLocale="he"
                locale="he"
                [ngModel]="content"
                minHeight="320px"
            />
        `,
    }),
};
