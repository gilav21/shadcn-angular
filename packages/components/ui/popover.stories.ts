import { Meta, StoryObj } from '@storybook/angular';
import {
  PopoverComponent,
  PopoverTriggerComponent,
  PopoverContentComponent,
  PopoverCloseComponent,
} from './popover.component';
import { ButtonComponent } from './button.component';
import { InputComponent } from './input.component';
import { LabelComponent } from './label.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<PopoverComponent> = {
  title: 'UI/Popover',
  component: PopoverComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        PopoverCloseComponent,
        ButtonComponent,
        InputComponent,
        LabelComponent
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<PopoverComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <ui-popover>
        <ui-popover-trigger>
          <button shButton variant="outline">Open Popover</button>
        </ui-popover-trigger>
        <ui-popover-content class="w-80">
          <div class="grid gap-4">
            <div class="space-y-2">
              <h4 class="font-medium leading-none">Dimensions</h4>
              <p class="text-sm text-muted-foreground">
                Set the dimensions for the layer.
              </p>
            </div>
            <div class="grid gap-2">
              <div class="grid grid-cols-3 items-center gap-4">
                <ui-label for="width">Width</ui-label>
                <ui-input id="width" value="100%" class="col-span-2 h-8" />
              </div>
              <div class="grid grid-cols-3 items-center gap-4">
                <ui-label for="maxWidth">Max. width</ui-label>
                <ui-input id="maxWidth" value="300px" class="col-span-2 h-8" />
              </div>
              <div class="grid grid-cols-3 items-center gap-4">
                <ui-label for="height">Height</ui-label>
                <ui-input id="height" value="25px" class="col-span-2 h-8" />
              </div>
              <div class="grid grid-cols-3 items-center gap-4">
                <ui-label for="maxHeight">Max. height</ui-label>
                <ui-input id="maxHeight" value="none" class="col-span-2 h-8" />
              </div>
            </div>
          </div>
        </ui-popover-content>
      </ui-popover>
    `,
  }),
};
