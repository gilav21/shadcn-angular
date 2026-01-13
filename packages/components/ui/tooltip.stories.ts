import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  TooltipComponent,
  TooltipTriggerComponent,
  TooltipContentComponent,
  TooltipDirective,
} from './tooltip.component';
import { ButtonComponent } from './button.component';

const meta: Meta<TooltipComponent> = {
  title: 'UI/Tooltip',
  component: TooltipComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        TooltipComponent,
        TooltipTriggerComponent,
        TooltipContentComponent,
        TooltipDirective,
        ButtonComponent
      ],
    }),
  ],
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
    },
    delayDuration: {
      control: 'number',
    },
  },
  args: {
    side: 'top',
    delayDuration: 200,
  },
};

export default meta;
type Story = StoryObj<TooltipComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <ui-tooltip [side]="side" [delayDuration]="delayDuration">
        <ui-tooltip-trigger>
          <ui-button variant="outline">Hover me</ui-button>
        </ui-tooltip-trigger>
        <ui-tooltip-content class="w-max">
          <span>text in hover</span>
        </ui-tooltip-content>
      </ui-tooltip> 
    `,
  }),
};

export const DirectiveUsage: Story = {
  render: () => ({
    template: `
      <div class="flex gap-4 pl-20 pt-20">
        <ui-button variant="outline" uiTooltip="Top Tooltip" tooltipSide="top">Top</ui-button>
        <ui-button variant="outline" uiTooltip="Right Tooltip" tooltipSide="right">Right</ui-button>
        <ui-button variant="outline" uiTooltip="Bottom Tooltip" tooltipSide="bottom">Bottom</ui-button>
        <ui-button variant="outline" uiTooltip="Left Tooltip" tooltipSide="left">Left</ui-button>
      </div>
    `,
  }),
};
