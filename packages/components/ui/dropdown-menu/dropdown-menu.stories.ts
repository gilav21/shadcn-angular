import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    DropdownMenuComponent,
    DropdownMenuTriggerComponent,
    DropdownMenuContentComponent,
    DropdownMenuItemComponent,
    DropdownMenuSeparatorComponent,
    DropdownMenuLabelComponent,
    DropdownMenuSubComponent,
    DropdownMenuSubTriggerComponent,
    DropdownMenuSubContentComponent,
    DropdownItem,
} from './index';
import { ButtonComponent } from '../button';

type DropdownMenuStoryProps = DropdownMenuComponent & {
    align: 'start' | 'center' | 'end';
    contentClass: string;
    itemDisabled: boolean;
    itemInset: boolean;
    itemShortcut: string;
};

const meta: Meta<DropdownMenuStoryProps> = {
    title: 'UI/DropdownMenu',
    component: DropdownMenuComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                DropdownMenuComponent,
                DropdownMenuTriggerComponent,
                DropdownMenuContentComponent,
                DropdownMenuItemComponent,
                DropdownMenuSeparatorComponent,
                DropdownMenuLabelComponent,
                DropdownMenuSubComponent,
                DropdownMenuSubTriggerComponent,
                DropdownMenuSubContentComponent,
                ButtonComponent,
            ],
        }),
    ],
    argTypes: {
        items: {
            control: 'object',
            description: 'Data-driven array of DropdownItem entries; when non-empty, auto-renders content (items/labels/separators/sub-menus) alongside any projected content.',
        },
        open: {
            control: 'boolean',
            description: 'Two-way bound open state of the menu (model).',
        },
        align: {
            control: 'select',
            options: ['start', 'center', 'end'],
            description: 'Alignment of the dropdown content relative to the trigger (ui-dropdown-menu-content input).',
        },
        contentClass: {
            control: 'text',
            description: 'Extra classes merged onto the content container (ui-dropdown-menu-content `class` input).',
        },
        itemDisabled: {
            control: 'boolean',
            description: 'Disables interaction on the demo item (ui-dropdown-menu-item `disabled` input).',
        },
        itemInset: {
            control: 'boolean',
            description: 'Adds inset spacing so the item aligns with icon-bearing items (ui-dropdown-menu-item `inset` input).',
        },
        itemShortcut: {
            control: 'text',
            description: 'Keyboard shortcut hint text rendered at the end of the demo item (ui-dropdown-menu-item `shortcut` input).',
        },
    },
    args: {
        items: [],
        open: false,
        align: 'start',
        contentClass: 'w-56',
        itemDisabled: false,
        itemInset: false,
        itemShortcut: '⌘K',
    },
};

export default meta;
type Story = StoryObj<DropdownMenuStoryProps>;

const TEMPLATE = `
    <ui-dropdown-menu [items]="items" [(open)]="open">
        <ui-dropdown-menu-trigger>
            <ui-button variant="outline">Open Menu</ui-button>
        </ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content [align]="align" [class]="contentClass">
            <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item [disabled]="itemDisabled" [inset]="itemInset" [shortcut]="itemShortcut">
                Profile
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-item>
                <span>Billing</span>
                <span class="ml-auto text-xs tracking-widest opacity-60">⌘B</span>
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-item>
                <span>Settings</span>
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item>
                <span>Log out</span>
            </ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
    </ui-dropdown-menu>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

export const Playground: Story = { render };

export const WithSubmenu: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Template-driven menu with a nested `ui-dropdown-menu-sub` submenu, labels, separators, and a disabled item.',
            },
        },
    },
    render: (args) => ({
        props: args,
        template: `
    <ui-dropdown-menu [(open)]="open">
        <ui-dropdown-menu-trigger>
            <ui-button variant="outline">Open Menu</ui-button>
        </ui-dropdown-menu-trigger>
        <ui-dropdown-menu-content [align]="align" class="w-56">
            <ui-dropdown-menu-label>My Account</ui-dropdown-menu-label>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item>
                <span>Profile</span>
                <span class="ml-auto text-xs tracking-widest opacity-60">⇧⌘P</span>
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-item>
                <span>Team</span>
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-sub>
                <ui-dropdown-menu-sub-trigger>
                    <span>Invite users</span>
                </ui-dropdown-menu-sub-trigger>
                <ui-dropdown-menu-sub-content>
                    <ui-dropdown-menu-item>
                        <span>Email</span>
                    </ui-dropdown-menu-item>
                    <ui-dropdown-menu-item>
                        <span>Message</span>
                    </ui-dropdown-menu-item>
                    <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
                    <ui-dropdown-menu-item>
                        <span>More...</span>
                    </ui-dropdown-menu-item>
                </ui-dropdown-menu-sub-content>
            </ui-dropdown-menu-sub>
            <ui-dropdown-menu-item [disabled]="true">
                <span>New Team</span>
                <span class="ml-auto text-xs tracking-widest opacity-60">⌘+T</span>
            </ui-dropdown-menu-item>
            <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
            <ui-dropdown-menu-item>
                <span>Log out</span>
                <span class="ml-auto text-xs tracking-widest opacity-60">⇧⌘Q</span>
            </ui-dropdown-menu-item>
        </ui-dropdown-menu-content>
    </ui-dropdown-menu>`,
    }),
};

export const DisabledItem: Story = {
    args: { itemDisabled: true },
    parameters: {
        docs: {
            description: {
                story: 'The `disabled` input on `ui-dropdown-menu-item` prevents selection and dims the item.',
            },
        },
    },
    render,
};

export const RTL: Story = {
    parameters: {
        docs: {
            description: {
                story: 'The menu mirrors alignment, submenu direction, and arrow-key navigation when the host is rendered inside an RTL ancestor.',
            },
        },
    },
    render: (args) => ({
        props: args,
        template: `<div dir="rtl">${TEMPLATE}</div>`,
    }),
};

const itemsDrivenMenuItems: DropdownItem[] = [
    { label: 'Profile', shortcut: '⇧⌘P' },
    { label: 'Billing', shortcut: '⌘B' },
    { label: 'Settings', shortcut: '⌘S' },
    { type: 'separator' },
    {
        label: 'Invite users',
        type: 'sub',
        children: [
            { label: 'Email' },
            { label: 'Message' },
            { type: 'separator' },
            { label: 'More...' },
        ],
    },
    { label: 'New Team', shortcut: '⌘+T', disabled: true },
    { type: 'separator' },
    { label: 'Log out', shortcut: '⇧⌘Q' },
];

export const ItemsDriven: Story = {
    args: {
        items: itemsDrivenMenuItems,
    },
    parameters: {
        docs: {
            description: {
                story: 'Use the `[items]` input for a simple data-driven mode. Pass an array of `DropdownItem` objects to auto-render the menu content, including sub-menus, separators, labels, and shortcuts.',
            },
        },
    },
    render: (args) => ({
        props: args,
        template: `
    <ui-dropdown-menu [items]="items" [(open)]="open">
        <ui-dropdown-menu-trigger>
            <ui-button variant="outline">Open Menu (items-driven)</ui-button>
        </ui-dropdown-menu-trigger>
    </ui-dropdown-menu>`,
    }),
};
