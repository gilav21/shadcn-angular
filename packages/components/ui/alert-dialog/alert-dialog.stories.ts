import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    AlertDialogComponent,
    AlertDialogTriggerComponent,
    AlertDialogContentComponent,
    AlertDialogHeaderComponent,
    AlertDialogFooterComponent,
    AlertDialogTitleComponent,
    AlertDialogDescriptionComponent,
    AlertDialogActionComponent,
    AlertDialogCancelComponent,
} from './index';
import { ButtonComponent } from '../button';

type AlertDialogStoryProps = AlertDialogComponent & {
    title: string;
    description: string;
    actionText: string;
    cancelText: string;
    contentClass: string;
    locale: string;
};

// Every input across the alert-dialog + its content sub-component is exposed
// as an interactive control (argTypes) with a sensible default (args); the
// Playground binds all of them so the Controls panel drives the live
// component. Dedicated stories below capture each distinct behavioral mode.
const meta: Meta<AlertDialogStoryProps> = {
    title: 'UI/AlertDialog',
    component: AlertDialogComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                AlertDialogComponent,
                AlertDialogTriggerComponent,
                AlertDialogContentComponent,
                AlertDialogHeaderComponent,
                AlertDialogFooterComponent,
                AlertDialogTitleComponent,
                AlertDialogDescriptionComponent,
                AlertDialogActionComponent,
                AlertDialogCancelComponent,
                ButtonComponent,
            ],
        }),
    ],
    argTypes: {
        open: { control: 'boolean', description: 'Whether the dialog is currently open (two-way bound `model`).' },
        title: { control: 'text', description: 'Title text rendered in the content header (simple/data-driven mode).' },
        description: { control: 'text', description: 'Description text rendered under the title (simple/data-driven mode).' },
        actionText: {
            control: 'text',
            description: "Override for the auto-rendered action button text; falls back to the locale's `continue` string.",
        },
        cancelText: {
            control: 'text',
            description: "Override for the auto-rendered cancel button text; falls back to the locale's `cancel` string.",
        },
        contentClass: { control: 'text', description: 'Extra classes merged onto the content panel.' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale registry key used for the auto-generated action/cancel labels and text direction.',
        },
    },
    args: {
        open: false,
        title: 'Are you absolutely sure?',
        description: 'This action cannot be undone.',
        actionText: '',
        cancelText: '',
        contentClass: '',
        locale: 'en',
    },
};

export default meta;
type Story = StoryObj<AlertDialogStoryProps>;

const TEMPLATE = `
    <ui-alert-dialog [(open)]="open">
        <ui-alert-dialog-trigger>
            <ui-button variant="outline">Show Dialog</ui-button>
        </ui-alert-dialog-trigger>
        <ui-alert-dialog-content
            [title]="title"
            [description]="description"
            [actionText]="actionText || undefined"
            [cancelText]="cancelText || undefined"
            [class]="contentClass"
            [locale]="locale">
        </ui-alert-dialog-content>
    </ui-alert-dialog>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const TemplateComposition: Story = {
    render: () => ({
        template: `
            <ui-alert-dialog>
                <ui-alert-dialog-trigger>
                    <ui-button variant="outline">Show Dialog</ui-button>
                </ui-alert-dialog-trigger>
                <ui-alert-dialog-content>
                    <ui-alert-dialog-header>
                        <ui-alert-dialog-title>Are you absolutely sure?</ui-alert-dialog-title>
                        <ui-alert-dialog-description>
                            This action cannot be undone. This will permanently delete your account and remove
                            your data from our servers.
                        </ui-alert-dialog-description>
                    </ui-alert-dialog-header>
                    <ui-alert-dialog-footer>
                        <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
                        <ui-alert-dialog-action>Continue</ui-alert-dialog-action>
                    </ui-alert-dialog-footer>
                </ui-alert-dialog-content>
            </ui-alert-dialog>`,
    }),
};

export const SimpleMode: Story = {
    args: {
        title: 'Delete your account?',
        description: 'This will permanently delete your account and remove your data from our servers.',
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-alert-dialog [(open)]="open">
                <ui-alert-dialog-trigger>
                    <ui-button variant="destructive">Delete Account</ui-button>
                </ui-alert-dialog-trigger>
                <ui-alert-dialog-content
                    [title]="title"
                    [description]="description"
                    [actionText]="actionText || undefined"
                    [cancelText]="cancelText || undefined">
                </ui-alert-dialog-content>
            </ui-alert-dialog>`,
    }),
};

export const OpenByDefault: Story = {
    args: { open: true },
    render,
};

export const CustomActionCancelText: Story = {
    args: { actionText: 'Yes, delete it', cancelText: 'No, keep it', open: true },
    render,
};

export const CustomContentStyling: Story = {
    args: { contentClass: 'border-destructive sm:max-w-md', open: true },
    render,
};

export const RightToLeft: Story = {
    args: {
        open: true,
        locale: 'he',
        title: 'האם אתה בטוח לחלוטין?',
        description: 'לא ניתן לבטל פעולה זו.',
    },
    render,
};
