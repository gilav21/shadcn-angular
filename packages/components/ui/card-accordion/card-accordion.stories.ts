import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from '../button';
import {
    CardAccordionComponent,
    CardAccordionItemComponent,
    CardAccordionTriggerComponent,
    CardAccordionActionsComponent,
    CardAccordionContentComponent,
} from './index';

// `rtl` is a story-only flag that sets `dir` on a wrapper — the component
// itself inherits direction from the DOM. Every real input is exposed as an
// interactive control; the Playground binds them so the Controls panel drives
// the live component. Both simple (inputs) and template (projection) modes
// are covered below.
type CardAccordionArgs = CardAccordionComponent & { rtl: boolean };

const meta: Meta<CardAccordionArgs> = {
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
        type: {
            control: 'radio',
            options: ['single', 'multiple'],
            description: 'Single keeps one panel open; multiple allows many.',
        },
        collapsible: { control: 'boolean', description: 'In single mode, allows closing the open panel.' },
        openValues: { control: 'object', description: 'Item values open by default (first only honored in single mode).' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        rtl: { control: 'boolean', description: 'Story-only: wraps the demo in a right-to-left container.' },
    },
    args: {
        type: 'single',
        collapsible: true,
        openValues: null,
        class: '',
        rtl: false,
    },
};

export default meta;
type Story = StoryObj<CardAccordionArgs>;

const SIMPLE_ITEMS = `
    <ui-card-accordion-item
        value="item-1"
        title="What is shadcn-angular?"
        description="The basics"
        content="A copy-paste component library you fully own in your own project." />
    <ui-card-accordion-item
        value="item-2"
        title="Is it customizable?"
        description="Yes, completely"
        content="Every component exposes a class input and supports content projection." />
    <ui-card-accordion-item
        value="item-3"
        title="Is it animated?"
        content="Yes — panels expand and collapse with a smooth height transition." />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: `
        <div [dir]="rtl ? 'rtl' : 'ltr'" class="mx-auto max-w-xl">
            <ui-card-accordion [type]="type" [collapsible]="collapsible" [openValues]="openValues" [class]="class">
                ${SIMPLE_ITEMS}
            </ui-card-accordion>
        </div>`,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

/** Simple mode: each panel is generated from title/description/content inputs. */
export const SimpleMode: Story = { render };

export const Multiple: Story = {
    args: { type: 'multiple', openValues: ['item-1', 'item-2'] },
    render,
};

export const NonCollapsible: Story = {
    args: { collapsible: false, openValues: ['item-1'] },
    render,
};

/** Template mode: projected trigger, actions and content for full control. */
export const CustomWithActions: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div [dir]="rtl ? 'rtl' : 'ltr'" class="mx-auto max-w-xl">
                <ui-card-accordion [type]="type" [collapsible]="collapsible">
                    <ui-card-accordion-item value="billing">
                        <ui-card-accordion-trigger>
                            Billing settings
                            <ui-card-accordion-actions>
                                <ui-button variant="ghost" size="icon-sm" ariaLabel="Edit">✎</ui-button>
                            </ui-card-accordion-actions>
                        </ui-card-accordion-trigger>
                        <ui-card-accordion-content>
                            Manage your subscription, payment methods and invoices here.
                        </ui-card-accordion-content>
                    </ui-card-accordion-item>
                    <ui-card-accordion-item value="team">
                        <ui-card-accordion-trigger>
                            Team members
                            <ui-card-accordion-actions>
                                <ui-button variant="outline" size="sm">Invite</ui-button>
                            </ui-card-accordion-actions>
                        </ui-card-accordion-trigger>
                        <ui-card-accordion-content>
                            Invite teammates and manage their roles and permissions.
                        </ui-card-accordion-content>
                    </ui-card-accordion-item>
                </ui-card-accordion>
            </div>`,
    }),
};

/** Skeleton loading state on an item. */
export const Skeleton: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div [dir]="rtl ? 'rtl' : 'ltr'" class="mx-auto max-w-xl">
                <ui-card-accordion [type]="type" [collapsible]="collapsible">
                    <ui-card-accordion-item value="item-1" skeleton title="Loading…" />
                    <ui-card-accordion-item value="item-2" skeleton title="Loading…" />
                </ui-card-accordion>
            </div>`,
    }),
};

export const Rtl: Story = {
    args: { rtl: true },
    render,
};
