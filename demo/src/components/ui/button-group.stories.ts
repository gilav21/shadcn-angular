import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ButtonGroupComponent, ButtonGroupTextComponent, ButtonGroupSeparatorComponent } from './button-group.component';
import { ButtonComponent } from './button.component';

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
    },
    args: {
        orientation: 'horizontal',
    },
};

export default meta;
type Story = StoryObj<ButtonGroupComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation">
                <ui-button variant="outline">Left</ui-button>
                <ui-button variant="outline">Center</ui-button>
                <ui-button variant="outline">Right</ui-button>
            </ui-button-group>
        `,
    }),
};

export const Vertical: Story = {
    args: {
        orientation: 'vertical',
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation">
                <ui-button variant="outline">Top</ui-button>
                <ui-button variant="outline">Middle</ui-button>
                <ui-button variant="outline">Bottom</ui-button>
            </ui-button-group>
        `,
    }),
};

export const PrimaryVariant: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation">
                <ui-button>Save</ui-button>
                <ui-button>Edit</ui-button>
                <ui-button>Delete</ui-button>
            </ui-button-group>
        `,
    }),
};

export const WithIcons: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation">
                <ui-button variant="outline" size="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                </ui-button>
                <ui-button variant="outline" size="icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </ui-button>
            </ui-button-group>
        `,
    }),
};

export const WithText: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation">
                <ui-button-group-text>https://</ui-button-group-text>
                <ui-button variant="outline">example.com</ui-button>
            </ui-button-group>
        `,
    }),
};

export const WithSeparator: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation">
                <ui-button variant="outline">View</ui-button>
                <ui-button-group-separator />
                <ui-button variant="outline">Edit</ui-button>
                <ui-button-group-separator />
                <ui-button variant="outline">Delete</ui-button>
            </ui-button-group>
        `,
    }),
};

export const MixedVariants: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-button-group [orientation]="orientation">
                <ui-button variant="outline">Cancel</ui-button>
                <ui-button>Save</ui-button>
            </ui-button-group>
        `,
    }),
};
