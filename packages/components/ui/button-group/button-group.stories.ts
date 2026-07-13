import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ButtonGroupComponent, ButtonGroupTextComponent, ButtonGroupSeparatorComponent } from './index';
import { ButtonComponent } from '../button';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<ButtonGroupComponent> = {
    title: 'UI/ButtonGroup',
    component: ButtonGroupComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [ButtonComponent, ButtonGroupTextComponent, ButtonGroupSeparatorComponent],
        }),
    ],
    parameters: {
        docs: {
            description: {
                component: 'Group buttons together with seamless borders. Supports horizontal and vertical orientations.',
            },
        },
    },
    argTypes: {
        orientation: {
            control: 'radio',
            options: ['horizontal', 'vertical'],
            description: 'The orientation of the button group.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        orientation: 'horizontal',
        class: '',
    },
};

export default meta;
type Story = StoryObj<ButtonGroupComponent>;

const TEMPLATE = `
    <ui-button-group [orientation]="orientation" [class]="class">
        <ui-button variant="outline">Left</ui-button>
        <ui-button variant="outline">Center</ui-button>
        <ui-button variant="outline">Right</ui-button>
    </ui-button-group>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Horizontal: Story = {
    args: { orientation: 'horizontal' },
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation" [class]="class">
                <ui-button variant="outline">Left</ui-button>
                <ui-button variant="outline">Center</ui-button>
                <ui-button variant="outline">Right</ui-button>
            </ui-button-group>`,
    }),
};

export const Vertical: Story = {
    args: { orientation: 'vertical' },
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation" [class]="class">
                <ui-button variant="outline">Top</ui-button>
                <ui-button variant="outline">Middle</ui-button>
                <ui-button variant="outline">Bottom</ui-button>
            </ui-button-group>`,
    }),
};

export const PrimaryVariant: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation" [class]="class">
                <ui-button>Save</ui-button>
                <ui-button>Edit</ui-button>
                <ui-button>Delete</ui-button>
            </ui-button-group>`,
    }),
};

export const WithIcons: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation" [class]="class">
                <ui-button variant="outline" size="icon" aria-label="Increase">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
                </ui-button>
                <ui-button variant="outline" size="icon" aria-label="Decrease">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                </ui-button>
            </ui-button-group>`,
    }),
};

export const WithText: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation" [class]="class">
                <ui-button-group-text>https://</ui-button-group-text>
                <ui-button variant="outline">example.com</ui-button>
            </ui-button-group>`,
    }),
};

export const WithSeparator: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation" [class]="class">
                <ui-button variant="outline">View</ui-button>
                <ui-button-group-separator [orientation]="orientation === 'vertical' ? 'horizontal' : 'vertical'" />
                <ui-button variant="outline">Edit</ui-button>
                <ui-button-group-separator [orientation]="orientation === 'vertical' ? 'horizontal' : 'vertical'" />
                <ui-button variant="outline">Delete</ui-button>
            </ui-button-group>`,
    }),
};

export const MixedVariants: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation" [class]="class">
                <ui-button variant="outline">Cancel</ui-button>
                <ui-button>Save</ui-button>
            </ui-button-group>`,
    }),
};

export const Sizes: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div class="flex flex-wrap items-center gap-4">
                <ui-button-group [orientation]="orientation" [class]="class">
                    <ui-button variant="outline" size="sm">Small</ui-button>
                    <ui-button variant="outline" size="sm">Group</ui-button>
                </ui-button-group>
                <ui-button-group [orientation]="orientation" [class]="class">
                    <ui-button variant="outline" size="default">Default</ui-button>
                    <ui-button variant="outline" size="default">Group</ui-button>
                </ui-button-group>
                <ui-button-group [orientation]="orientation" [class]="class">
                    <ui-button variant="outline" size="lg">Large</ui-button>
                    <ui-button variant="outline" size="lg">Group</ui-button>
                </ui-button-group>
            </div>`,
    }),
};

export const DisabledButtons: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation" [class]="class">
                <ui-button variant="outline">Left</ui-button>
                <ui-button variant="outline" [disabled]="true">Center</ui-button>
                <ui-button variant="outline">Right</ui-button>
            </ui-button-group>`,
    }),
};
