import { Meta, StoryObj } from '@storybook/angular';
import { CheckboxComponent } from './checkbox.component';
import { moduleMetadata } from '@storybook/angular';
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
  },
  args: {
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<CheckboxComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="flex items-center space-x-2">
        <ui-checkbox id="terms" [elementId]="'terms'" [disabled]="disabled"></ui-checkbox>
        <label
          for="terms"
          class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Accept terms and conditions
        </label>
      </div>
    `,
  }),
};
