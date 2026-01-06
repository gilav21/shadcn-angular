import { Meta, StoryObj } from '@storybook/angular';
import { RadioGroupComponent, RadioGroupItemComponent } from './radio-group.component';
import { LabelComponent } from './label.component';
import { moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';

const meta: Meta<RadioGroupComponent> = {
    title: 'UI/RadioGroup',
    component: RadioGroupComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [RadioGroupComponent, RadioGroupItemComponent, LabelComponent, FormsModule],
        }),
    ],
    argTypes: {
        orientation: {
            control: 'radio',
            options: ['horizontal', 'vertical'],
        },
        disabled: {
            control: 'boolean',
        },
    },
    args: {
        orientation: 'vertical',
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<RadioGroupComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <ui-radio-group [orientation]="orientation" [disabled]="disabled">
        <div class="flex items-center space-x-2">
          <ui-radio-group-item value="default" id="r1"></ui-radio-group-item>
          <ui-label htmlFor="r1">Default</ui-label>
        </div>
        <div class="flex items-center space-x-2">
          <ui-radio-group-item value="comfortable" id="r2"></ui-radio-group-item>
          <ui-label htmlFor="r2">Comfortable</ui-label>
        </div>
        <div class="flex items-center space-x-2">
          <ui-radio-group-item value="compact" id="r3"></ui-radio-group-item>
          <ui-label htmlFor="r3">Compact</ui-label>
        </div>
      </ui-radio-group>
    `,
    }),
};
