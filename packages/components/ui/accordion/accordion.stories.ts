import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  AccordionComponent,
  AccordionItemComponent,
  AccordionTriggerComponent,
  AccordionContentComponent,
} from './index';

const meta: Meta<AccordionComponent & { rtl: boolean }> = {
  title: 'UI/Accordion',
  component: AccordionComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        AccordionComponent,
        AccordionItemComponent,
        AccordionTriggerComponent,
        AccordionContentComponent,
      ],
    }),
  ],
  argTypes: {
    type: {
      control: 'radio',
      options: ['single', 'multiple'],
    },
    rtl: {
      control: 'boolean',
      description: 'Enable right-to-left layout',
    },
  },
  args: {
    type: 'single',
    rtl: false,
  },
};

export default meta;
type Story = StoryObj<AccordionComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div [dir]="rtl ? 'rtl' : 'ltr'">
      <ui-accordion [type]="type" class="w-full">
        <ui-accordion-item value="item-1">
          <ui-accordion-trigger>Is it accessible?</ui-accordion-trigger>
          <ui-accordion-content>
            Yes. It adheres to the WAI-ARIA design pattern.
          </ui-accordion-content>
        </ui-accordion-item>
        <ui-accordion-item value="item-2">
          <ui-accordion-trigger>Is it styled?</ui-accordion-trigger>
          <ui-accordion-content>
            Yes. It comes with default styles that matches the other components' aesthetic.
          </ui-accordion-content>
        </ui-accordion-item>
        <ui-accordion-item value="item-3">
          <ui-accordion-trigger>Is it animated?</ui-accordion-trigger>
          <ui-accordion-content>
            Yes. It's animated by default, but you can disable it if you prefer.
          </ui-accordion-content>
        </ui-accordion-item>
      </ui-accordion>
      </div>
    `,
  }),
};

export const SimpleMode: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div [dir]="rtl ? 'rtl' : 'ltr'">
      <ui-accordion [type]="type" class="w-full">
        <ui-accordion-item value="item-1" title="Is it accessible?" content="Yes. It adheres to the WAI-ARIA design pattern." />
        <ui-accordion-item value="item-2" title="Is it styled?" content="Yes. It comes with default styles that match the other components." />
        <ui-accordion-item value="item-3" title="Is it animated?" content="Yes. It's animated by default, but you can disable it if you prefer." />
      </ui-accordion>
      </div>
    `,
  }),
};
