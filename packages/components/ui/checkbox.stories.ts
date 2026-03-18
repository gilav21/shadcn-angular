import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { CheckboxComponent } from './checkbox.component';
import { FormsModule } from '@angular/forms';

const meta: Meta<CheckboxComponent> = {
  title: 'UI/Checkbox',
  component: CheckboxComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [FormsModule, CheckboxComponent],
    }),
  ],
  argTypes: {
    disabled: {
      control: 'boolean',
    },
    indeterminate: {
      control: 'boolean',
    },
    label: {
      control: 'text',
    },
  },
  args: {
    disabled: false,
    indeterminate: false,
    label: '',
  },
};

export default meta;
type Story = StoryObj<CheckboxComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="flex items-center space-x-2">
        <ui-checkbox id="terms" [elementId]="'terms'" [disabled]="disabled" [indeterminate]="indeterminate" [label]="label"></ui-checkbox>
        <label
          for="terms"
          class="pl-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Accept terms and conditions
        </label>
      </div>
    `,
  }),
};
