import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { PopoverComponent } from './popover.component';
import { PopoverTriggerComponent } from './sub/popover-trigger.component';
import { PopoverContentComponent } from './sub/popover-content.component';
import { PopoverCloseComponent } from './sub/popover-close.component';
import { ButtonComponent } from '../button';
import { InputComponent } from '../input';
import { LabelComponent } from '../label';

const meta: Meta<PopoverComponent & { align: string; side: string; sideOffset: number }> = {
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
  argTypes: {
    align: { control: 'select', options: ['start', 'center', 'end'] },
    side: { control: 'select', options: ['top', 'bottom', 'left', 'right'] },
    sideOffset: { control: 'number' },
  },
  args: {
    align: 'center',
    side: 'bottom',
    sideOffset: 4,
  },
};

export default meta;
type Story = StoryObj<PopoverComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-popover>
        <ui-popover-trigger>
          <ui-button variant="outline">Open Popover</ui-button>
        </ui-popover-trigger>
        <ui-popover-content class="w-80" [align]="align" [side]="side" [sideOffset]="sideOffset">
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
