import { Meta, StoryObj } from '@storybook/angular';
import { SpinnerComponent, PageSpinnerComponent } from './spinner.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<SpinnerComponent> = {
    title: 'UI/Spinner',
    component: SpinnerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [SpinnerComponent, PageSpinnerComponent]
        })
    ],
    argTypes: {
        size: {
            control: 'select',
            options: ['xs', 'sm', 'default', 'lg', 'xl', 'page'],
        },
        customSize: {
            control: 'number',
        },
    },
    args: {
        size: 'default',
        customSize: null,
    },
};

export default meta;
type Story = StoryObj<SpinnerComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-spinner [size]="size" [customSize]="customSize"></ui-spinner>`,
    }),
};

export const Sizes: Story = {
    render: () => ({
        template: `
        <div class="flex items-end gap-4">
            <ui-spinner size="xs" />
            <ui-spinner size="sm" />
            <ui-spinner size="default" />
            <ui-spinner size="lg" />
            <ui-spinner size="xl" />
        </div>
        `
    })
}
