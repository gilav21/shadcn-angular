import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SplitButtonComponent } from './split-button.component';
import { SplitButtonPrimaryComponent } from './sub/split-button-primary.component';
import { SplitButtonMenuComponent } from './sub/split-button-menu.component';
import { SplitButtonItemComponent } from './sub/split-button-item.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<SplitButtonComponent> = {
    title: 'Components/SplitButton',
    component: SplitButtonComponent,
    tags: ['autodocs'],
    argTypes: {
        label: {
            control: 'text',
            description: 'Text for the primary action button. Empty string switches to the projected `ui-split-button-primary` slot.',
        },
        items: {
            control: 'object',
            description: 'Dropdown menu items (`{ label, value?, icon?, disabled?, click? }[]`). Empty array switches to the projected `ui-split-button-menu` slot.',
        },
        variant: {
            control: 'select',
            options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
            description: 'Visual style shared by the primary and dropdown-toggle buttons.',
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'],
            description: 'Sizing preset shared by the primary and dropdown-toggle buttons.',
        },
        disabled: { control: 'boolean', description: 'Disables both the primary and dropdown-toggle buttons.' },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
        primaryClick: { control: false, description: 'Emits the `MouseEvent` when the primary action button is clicked.' },
        itemClick: { control: false, description: 'Emits the `SplitButtonItem` when a dropdown item is clicked.' },
    },
    args: {
        label: 'Save',
        items: [
            { label: 'Edit', value: 'edit' },
            { label: 'Duplicate', value: 'duplicate' },
            { label: 'Delete', value: 'delete', disabled: true },
        ],
        variant: 'default',
        size: 'default',
        disabled: false,
        class: '',
    },
};

export default meta;
type Story = StoryObj<SplitButtonComponent>;

const TEMPLATE = `
    <ui-split-button
        [label]="label" [items]="items" [variant]="variant"
        [size]="size" [disabled]="disabled" [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Variants: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-wrap items-center gap-3">
                <ui-split-button label="Default" [items]="items" variant="default" />
                <ui-split-button label="Destructive" [items]="items" variant="destructive" />
                <ui-split-button label="Outline" [items]="items" variant="outline" />
                <ui-split-button label="Secondary" [items]="items" variant="secondary" />
                <ui-split-button label="Ghost" [items]="items" variant="ghost" />
            </div>`,
    }),
};

export const Sizes: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-wrap items-center gap-3">
                <ui-split-button label="Small" [items]="items" size="sm" />
                <ui-split-button label="Default" [items]="items" size="default" />
                <ui-split-button label="Large" [items]="items" size="lg" />
            </div>`,
    }),
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const DataDriven: Story = {
    name: 'Data-Driven Items',
    args: {
        label: 'Publish',
        items: [
            { label: 'Publish Now', value: 'now' },
            { label: 'Schedule…', value: 'schedule' },
            { label: 'Save as Draft', value: 'draft' },
            { label: 'Archive', value: 'archive', disabled: true },
        ],
    },
    render,
};

export const ContentProjection: Story = {
    name: 'Content Projection (Custom Mode)',
    decorators: [
        moduleMetadata({
            imports: [SplitButtonPrimaryComponent, SplitButtonMenuComponent, SplitButtonItemComponent],
        }),
    ],
    render: (args) => ({
        props: args,
        template: `
        <ui-split-button [variant]="variant" [size]="size" [disabled]="disabled">
            <ui-split-button-primary>Custom Primary</ui-split-button-primary>
            <ui-split-button-menu>
                <ui-split-button-item value="item-1">Item 1</ui-split-button-item>
                <ui-split-button-item value="item-2">Item 2</ui-split-button-item>
                <ui-split-button-item value="item-3" [disabled]="true">Disabled Item</ui-split-button-item>
            </ui-split-button-menu>
        </ui-split-button>
        `,
    }),
};
