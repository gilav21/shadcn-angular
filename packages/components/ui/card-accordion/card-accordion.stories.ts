import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from '../button';
import {
  CardAccordionComponent,
  CardAccordionItemComponent,
  CardAccordionTriggerComponent,
  CardAccordionActionsComponent,
  CardAccordionContentComponent,
} from './index';

const meta: Meta<CardAccordionComponent & { rtl: boolean }> = {
  title: 'UI/Card Accordion',
  component: CardAccordionComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        CardAccordionComponent,
        CardAccordionItemComponent,
        CardAccordionTriggerComponent,
        CardAccordionActionsComponent,
        CardAccordionContentComponent,
        ButtonComponent,
      ],
    }),
  ],
  argTypes: {
    type: { control: 'radio', options: ['single', 'multiple'] },
    collapsible: { control: 'boolean' },
    rtl: { control: 'boolean', description: 'Enable right-to-left layout' },
  },
  args: { type: 'single', collapsible: true, rtl: false },
};

export default meta;
type Story = StoryObj<CardAccordionComponent>;

export const SimpleMode: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div [dir]="rtl ? 'rtl' : 'ltr'" class="mx-auto max-w-xl">
        <ui-card-accordion [type]="type" [collapsible]="collapsible">
          <ui-card-accordion-item
            value="item-1"
            title="What is shadcn-angular?"
            description="The basics"
            content="A copy-paste component library you fully own in your own project."
          />
          <ui-card-accordion-item
            value="item-2"
            title="Is it customizable?"
            description="Yes, completely"
            content="Every component exposes a class input and supports content projection."
          />
          <ui-card-accordion-item
            value="item-3"
            title="Is it animated?"
            content="Yes — panels expand and collapse with a smooth height transition."
          />
        </ui-card-accordion>
      </div>
    `,
  }),
};

export const CustomWithActions: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div [dir]="rtl ? 'rtl' : 'ltr'" class="mx-auto max-w-xl">
        <ui-card-accordion [type]="type" [collapsible]="collapsible">
          <ui-card-accordion-item value="billing">
            <ui-card-accordion-trigger>Billing settings</ui-card-accordion-trigger>
            <ui-card-accordion-actions>
              <ui-button variant="ghost" size="icon-sm" ariaLabel="Edit">✎</ui-button>
            </ui-card-accordion-actions>
            <ui-card-accordion-content>
              Manage your subscription, payment methods and invoices here.
            </ui-card-accordion-content>
          </ui-card-accordion-item>
          <ui-card-accordion-item value="team">
            <ui-card-accordion-trigger>Team members</ui-card-accordion-trigger>
            <ui-card-accordion-actions>
              <ui-button variant="outline" size="sm">Invite</ui-button>
            </ui-card-accordion-actions>
            <ui-card-accordion-content>
              Invite teammates and manage their roles and permissions.
            </ui-card-accordion-content>
          </ui-card-accordion-item>
        </ui-card-accordion>
      </div>
    `,
  }),
};

export const Multiple: Story = {
  args: { type: 'multiple' },
  render: (args) => ({
    props: args,
    template: `
      <div [dir]="rtl ? 'rtl' : 'ltr'" class="mx-auto max-w-xl">
        <ui-card-accordion type="multiple" [openValues]="['item-1', 'item-2']">
          <ui-card-accordion-item value="item-1" title="First panel" content="Several panels can stay open at once." />
          <ui-card-accordion-item value="item-2" title="Second panel" content="This one starts open too." />
          <ui-card-accordion-item value="item-3" title="Third panel" content="Toggle each independently." />
        </ui-card-accordion>
      </div>
    `,
  }),
};
