import { Meta, StoryObj } from '@storybook/angular';
import { SplitButtonPrimaryComponent, SplitButtonMenuComponent, SplitButtonItemComponent, SplitButtonComponent } from './split-button.component';

const meta: Meta<SplitButtonComponent> = {
    title: 'Components/SplitButton',
    component: SplitButtonComponent,
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
        },
        size: {
            control: 'select',
            options: ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'],
        },
        disabled: {
            control: 'boolean'
        },
        label: {
            control: 'text',
        },
    },
    args: {
        label: 'Save',
        items: [
            { label: 'Edit', value: 'edit' },
            { label: 'Duplicate', value: 'duplicate' },
            { label: 'Delete', value: 'delete', disabled: true },
        ]
    }
};

export default meta;
type Story = StoryObj<SplitButtonComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-split-button
        [label]="label"
        [items]="items"
        [variant]="variant"
        [size]="size"
        [disabled]="disabled"
      />
    `,
    }),
};

export const ContentProjection: Story = {
    render: (args) => ({
        props: args,
        template: `
        <ui-split-button [variant]="variant" [size]="size" [disabled]="disabled">
            <ui-split-button-primary>Custom Primary</ui-split-button-primary>
            <ui-split-button-menu>
                <ui-split-button-item>Item 1</ui-split-button-item>
                <ui-split-button-item>Item 2</ui-split-button-item>
                <ui-split-button-item [disabled]="true">Disabled Item</ui-split-button-item>
            </ui-split-button-menu>
        </ui-split-button>
        `,
        moduleMetadata: {
            imports: [SplitButtonPrimaryComponent, SplitButtonMenuComponent, SplitButtonItemComponent]
        }
    })
};
