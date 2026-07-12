import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  TooltipComponent,
  TooltipTriggerComponent,
  TooltipContentComponent,
  TooltipDirective,
} from './index';
import { ButtonComponent } from '../button';

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
    content: {
      control: 'text',
      description: 'Simple-mode tooltip text. When set, an internal `ui-tooltip-content` is rendered automatically.',
    },
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: 'Preferred side the tooltip content is anchored to.',
    },
    delayDuration: {
      control: 'number',
      description: 'Milliseconds of hover before the tooltip opens.',
    },
  },
  args: {
    content: '',
    side: 'top',
    delayDuration: 200,
  },
};

export default meta;
type Story = StoryObj<TooltipComponent>;

const TEMPLATE = `
      <ui-tooltip [content]="content" [side]="side" [delayDuration]="delayDuration">
        <ui-tooltip-trigger>
          <ui-button variant="outline">Hover me</ui-button>
        </ui-tooltip-trigger>
        @if (!content) {
          <ui-tooltip-content class="w-max">
            <span>text in hover</span>
          </ui-tooltip-content>
        }
      </ui-tooltip>`;

const render: NonNullable<Story['render']> = (args) => ({
  props: args,
  template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

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

export const SimpleContentMode: Story = {
  args: { content: 'Add to library' },
  render: (args) => ({
    props: args,
    template: `
      <ui-tooltip [content]="content" [side]="side" [delayDuration]="delayDuration">
        <ui-tooltip-trigger>
          <ui-button variant="outline">Hover me (Simple)</ui-button>
        </ui-tooltip-trigger>
      </ui-tooltip>
    `,
  }),
};

export const Sides: Story = {
  render: () => ({
    template: `
      <div class="flex flex-wrap gap-8 pl-20 pt-20">
        <ui-tooltip content="Top" side="top">
          <ui-tooltip-trigger><ui-button variant="outline">Top</ui-button></ui-tooltip-trigger>
        </ui-tooltip>
        <ui-tooltip content="Right" side="right">
          <ui-tooltip-trigger><ui-button variant="outline">Right</ui-button></ui-tooltip-trigger>
        </ui-tooltip>
        <ui-tooltip content="Bottom" side="bottom">
          <ui-tooltip-trigger><ui-button variant="outline">Bottom</ui-button></ui-tooltip-trigger>
        </ui-tooltip>
        <ui-tooltip content="Left" side="left">
          <ui-tooltip-trigger><ui-button variant="outline">Left</ui-button></ui-tooltip-trigger>
        </ui-tooltip>
      </div>
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
