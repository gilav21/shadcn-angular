import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    DialogComponent,
    DialogTriggerComponent,
    DialogContentComponent,
    DialogHeaderComponent,
    DialogTitleComponent,
    DialogDescriptionComponent,
    DialogFooterComponent,
} from './index';
import { ButtonComponent } from '../button';
import { InputComponent } from '../input';
import { LabelComponent } from '../label';

interface DialogStoryArgs {
    open: boolean;
    class: string;
    title: string;
    description: string;
    locale: string;
}

const meta: Meta<DialogStoryArgs> = {
    title: 'UI/Dialog',
    component: DialogContentComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                DialogComponent,
                DialogTriggerComponent,
                DialogContentComponent,
                DialogHeaderComponent,
                DialogTitleComponent,
                DialogDescriptionComponent,
                DialogFooterComponent,
                ButtonComponent,
                InputComponent,
                LabelComponent,
            ],
        }),
    ],
    argTypes: {
        open: { control: 'boolean', description: 'Whether the dialog panel is visible. Two-way bindable via the ui-dialog model.' },
        class: { control: 'text', description: 'Extra classes merged onto the dialog content panel.' },
        title: { control: 'text', description: 'Simple-mode header title rendered above the projected content.' },
        description: { control: 'text', description: 'Simple-mode header description rendered under the title.' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale registry key for the close/action labels (falls back to UI_LOCALE_ID); a full custom locale dictionary object is also accepted.',
        },
    },
    args: {
        open: false,
        class: 'sm:max-w-[425px]',
        title: 'Edit profile',
        description: "Make changes to your profile here. Click save when you're done.",
        locale: 'en',
    },
};

export default meta;
type Story = StoryObj<DialogStoryArgs>;

const TEMPLATE = `
    <ui-dialog [open]="open">
        <ui-dialog-trigger>
            <ui-button variant="outline">Edit Profile</ui-button>
        </ui-dialog-trigger>
        <ui-dialog-content [title]="title" [description]="description" [class]="class" [locale]="locale">
            <div class="grid gap-4 py-4">
                <div class="grid grid-cols-4 items-center gap-4">
                    <ui-label for="name" class="text-right">Name</ui-label>
                    <ui-input id="name" value="Pedro Duarte" class="col-span-3" />
                </div>
                <div class="grid grid-cols-4 items-center gap-4">
                    <ui-label for="username" class="text-right">Username</ui-label>
                    <ui-input id="username" value="@peduarte" class="col-span-3" />
                </div>
            </div>
            <ui-dialog-footer>
                <ui-button type="submit" variant="outline">Save changes</ui-button>
            </ui-dialog-footer>
        </ui-dialog-content>
    </ui-dialog>`;

const render = (args: Partial<DialogStoryArgs>): { props: Partial<DialogStoryArgs>; template: string } => ({
    props: args,
    template: TEMPLATE,
});

export const Playground: Story = { render };

export const CustomContent: Story = {
    render: () => ({
        template: `
            <ui-dialog>
                <ui-dialog-trigger>
                    <ui-button variant="outline">Edit Profile (Custom)</ui-button>
                </ui-dialog-trigger>
                <ui-dialog-content class="sm:max-w-[425px]">
                    <ui-dialog-header>
                        <ui-dialog-title>Edit profile</ui-dialog-title>
                        <ui-dialog-description>
                            Make changes to your profile here. Click save when you're done.
                        </ui-dialog-description>
                    </ui-dialog-header>
                    <div class="grid gap-4 py-4">
                        <div class="grid grid-cols-4 items-center gap-4">
                            <ui-label for="name-c" class="text-right">Name</ui-label>
                            <ui-input id="name-c" value="Pedro Duarte" class="col-span-3" />
                        </div>
                        <div class="grid grid-cols-4 items-center gap-4">
                            <ui-label for="username-c" class="text-right">Username</ui-label>
                            <ui-input id="username-c" value="@peduarte" class="col-span-3" />
                        </div>
                    </div>
                    <ui-dialog-footer>
                        <ui-button type="submit" variant="outline">Save changes</ui-button>
                    </ui-dialog-footer>
                </ui-dialog-content>
            </ui-dialog>
        `,
    }),
};

export const RightToLeft: Story = {
    args: {
        title: 'האם אתה בטוח לחלוטין?',
        description: 'לא ניתן לבטל פעולה זו.',
    },
    render: (args) => ({
        props: args,
        template: `
            <div dir="rtl">
                <ui-dialog>
                    <ui-dialog-trigger>
                        <ui-button variant="outline">פתח תיבת דו-שיח</ui-button>
                    </ui-dialog-trigger>
                    <ui-dialog-content [title]="title" [description]="description" class="sm:max-w-[425px]">
                        <ui-dialog-footer>
                            <ui-button variant="outline">ביטול</ui-button>
                            <ui-button>אישור</ui-button>
                        </ui-dialog-footer>
                    </ui-dialog-content>
                </ui-dialog>
            </div>
        `,
    }),
};

export const ScrollableContent: Story = {
    render: () => ({
        template: `
            <ui-dialog>
                <ui-dialog-trigger>
                    <ui-button variant="outline">Open Terms</ui-button>
                </ui-dialog-trigger>
                <ui-dialog-content title="Terms of Service" class="sm:max-w-[500px]">
                    <div class="max-h-[300px] overflow-y-auto py-4 pr-2 text-sm text-muted-foreground">
                        @for (i of [1,2,3,4,5,6,7,8,9,10]; track i) {
                            <p class="mb-3">
                                Paragraph {{ i }}: This is placeholder legal copy used to demonstrate that the
                                dialog content area scrolls independently of the page while the header and
                                footer remain fixed in place.
                            </p>
                        }
                    </div>
                    <ui-dialog-footer>
                        <ui-button variant="outline">Decline</ui-button>
                        <ui-button>Accept</ui-button>
                    </ui-dialog-footer>
                </ui-dialog-content>
            </ui-dialog>
        `,
    }),
};

export const NestedDialog: Story = {
    render: () => ({
        template: `
            <ui-dialog>
                <ui-dialog-trigger>
                    <ui-button variant="outline">Open Parent</ui-button>
                </ui-dialog-trigger>
                <ui-dialog-content title="Parent dialog" class="sm:max-w-[425px]">
                    <p class="text-sm text-muted-foreground py-2">
                        Opening the confirmation below stacks a second dialog on top of this one.
                    </p>
                    <ui-dialog>
                        <ui-dialog-trigger>
                            <ui-button variant="destructive">Delete...</ui-button>
                        </ui-dialog-trigger>
                        <ui-dialog-content title="Are you sure?" description="This action cannot be undone." class="sm:max-w-[380px]">
                            <ui-dialog-footer>
                                <ui-button variant="outline">Cancel</ui-button>
                                <ui-button variant="destructive">Delete</ui-button>
                            </ui-dialog-footer>
                        </ui-dialog-content>
                    </ui-dialog>
                </ui-dialog-content>
            </ui-dialog>
        `,
    }),
};
