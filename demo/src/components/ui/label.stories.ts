import { Meta, StoryObj } from '@storybook/angular';
import { LabelComponent } from './label.component';
// Import Checkbox for one of the examples
import { CheckboxComponent } from './checkbox.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<LabelComponent> = {
    title: 'UI/Label',
    component: LabelComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [CheckboxComponent]
        })
    ],
    argTypes: {
        for: { control: 'text' },
    },
    args: {
        for: 'terms',
    },
};

export default meta;
type Story = StoryObj<LabelComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-label [for]="for">Accept terms</ui-label>`,
    }),
};

export const WithControl: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="flex items-center space-x-2">
        <ui-checkbox id="terms"></ui-checkbox>
        <ui-label htmlFor="terms">Accept terms and conditions</ui-label>
      </div>
    `,
    }),
};
