import { Meta, StoryObj } from '@storybook/angular';
import {
    TooltipComponent,
    TooltipTriggerComponent,
    TooltipContentComponent,
    TooltipDirective,
} from './tooltip.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';

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
          <button shButton variant="outline">Hover me</button>
        </ui-tooltip-trigger>
        <ui-tooltip-content>
          <p>Add to library</p>
        </ui-tooltip-content>
      </ui-tooltip>
    `,
    }),
};

export const DirectiveUsage: Story = {
    render: () => ({
        template: `
      <div class="flex gap-4">
        <button shButton variant="outline" uiTooltip="Top Tooltip" tooltipSide="top">Top</button>
        <button shButton variant="outline" uiTooltip="Right Tooltip" tooltipSide="right">Right</button>
        <button shButton variant="outline" uiTooltip="Bottom Tooltip" tooltipSide="bottom">Bottom</button>
        <button shButton variant="outline" uiTooltip="Left Tooltip" tooltipSide="left">Left</button>
      </div>
    `,
    }),
};
