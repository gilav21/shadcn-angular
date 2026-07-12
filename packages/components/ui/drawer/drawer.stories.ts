import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    DrawerComponent,
    DrawerTriggerComponent,
    DrawerContentComponent,
    DrawerHeaderComponent,
    DrawerTitleComponent,
    DrawerDescriptionComponent,
    DrawerFooterComponent,
    DrawerCloseComponent,
} from './index';
import { ButtonComponent } from '../button';

interface DrawerStoryArgs {
    direction: 'top' | 'right' | 'bottom' | 'left';
    open: boolean;
    title: string;
    description: string;
    class: string;
}

const meta: Meta<DrawerStoryArgs> = {
    title: 'UI/Drawer',
    component: DrawerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                DrawerComponent,
                DrawerTriggerComponent,
                DrawerContentComponent,
                DrawerHeaderComponent,
                DrawerTitleComponent,
                DrawerDescriptionComponent,
                DrawerFooterComponent,
                DrawerCloseComponent,
                ButtonComponent,
            ],
        }),
    ],
    argTypes: {
        direction: {
            control: 'select',
            options: ['top', 'right', 'bottom', 'left'],
            description: 'Edge of the viewport the drawer slides in from.',
        },
        open: {
            control: 'boolean',
            description: 'Whether the drawer is currently open (two-way bindable).',
        },
        title: {
            control: 'text',
            description: 'Simple-mode title rendered in the drawer header (ui-drawer-content input).',
        },
        description: {
            control: 'text',
            description: 'Simple-mode description rendered under the title (ui-drawer-content input).',
        },
        class: {
            control: 'text',
            description: 'Extra classes merged onto the drawer content (ui-drawer-content input).',
        },
    },
    args: {
        direction: 'bottom',
        open: false,
        title: 'Move Goal',
        description: 'Set your daily activity goal.',
        class: '',
    },
};

export default meta;
type Story = StoryObj<DrawerStoryArgs>;

const TEMPLATE = `
    <ui-drawer [direction]="direction" [(open)]="open">
        <ui-drawer-trigger>
            <ui-button variant="outline">Open Drawer</ui-button>
        </ui-drawer-trigger>
        <ui-drawer-content [title]="title" [description]="description" [class]="class">
            <div class="mx-auto w-full max-w-sm">
                <div class="p-4 pb-0">
                    <div class="flex items-center justify-center space-x-2">
                        <div class="flex-1 text-center">
                            <div class="text-7xl font-bold tracking-tighter">350</div>
                            <div class="text-[0.70rem] uppercase text-muted-foreground">Calories/day</div>
                        </div>
                    </div>
                </div>
                <ui-drawer-footer>
                    <ui-button variant="outline">Submit</ui-button>
                    <ui-drawer-close>
                        <ui-button variant="outline">Cancel</ui-button>
                    </ui-drawer-close>
                </ui-drawer-footer>
            </div>
        </ui-drawer-content>
    </ui-drawer>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Top: Story = {
    args: { direction: 'top' },
    render,
};

export const Right: Story = {
    args: { direction: 'right' },
    render,
};

export const Bottom: Story = {
    args: { direction: 'bottom' },
    render,
};

export const Left: Story = {
    args: { direction: 'left' },
    render,
};

export const CustomContent: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-drawer [direction]="direction" [(open)]="open">
                <ui-drawer-trigger>
                    <ui-button variant="outline">Open Drawer</ui-button>
                </ui-drawer-trigger>
                <ui-drawer-content>
                    <div class="mx-auto w-full max-w-sm">
                        <ui-drawer-header>
                            <ui-drawer-title>Move Goal</ui-drawer-title>
                            <ui-drawer-description>Set your daily activity goal.</ui-drawer-description>
                        </ui-drawer-header>
                        <div class="p-4 pb-0">
                            <div class="flex items-center justify-center space-x-2">
                                <div class="flex-1 text-center">
                                    <div class="text-7xl font-bold tracking-tighter">
                                        350
                                    </div>
                                    <div class="text-[0.70rem] uppercase text-muted-foreground">
                                        Calories/day
                                    </div>
                                </div>
                            </div>
                        </div>
                        <ui-drawer-footer>
                            <ui-button variant="outline">Submit</ui-button>
                            <ui-drawer-close>
                                <ui-button variant="outline">Cancel</ui-button>
                            </ui-drawer-close>
                        </ui-drawer-footer>
                    </div>
                </ui-drawer-content>
            </ui-drawer>`,
    }),
};

export const SimpleMode: Story = {
    render,
};

export const WithoutTitle: Story = {
    args: { title: '', description: '' },
    render,
};
