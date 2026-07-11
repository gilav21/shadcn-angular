import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    AccordionComponent,
    AccordionItemComponent,
    AccordionTriggerComponent,
    AccordionContentComponent,
} from './index';

interface AccordionStoryArgs {
    type: 'single' | 'multiple';
    class: string;
    openValues: string[] | null;
    collapsible: boolean;
    itemTitle: string;
    itemContent: string;
    itemSkeleton: boolean;
}

// Every AccordionComponent input is exposed as an interactive control
// (argTypes) with a sensible default (args); AccordionItem's simple-mode
// inputs (title/content/skeleton) are also surfaced so both usage modes are
// live-drivable from the Controls panel. Dedicated stories below capture
// each distinct visual/behavioral mode.
const meta: Meta<AccordionStoryArgs> = {
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
            control: 'select',
            options: ['single', 'multiple'],
            description: 'Whether one panel or several panels may be open at once.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the accordion host.' },
        openValues: {
            control: 'object',
            description: 'Controlled list of open item values (or `null` for uncontrolled).',
        },
        collapsible: {
            control: 'boolean',
            description: '`type="single"` only: whether the open panel can be closed by clicking it again.',
        },
        itemTitle: {
            control: 'text',
            description: 'Simple mode: `ui-accordion-item` title input (renders a built-in trigger).',
        },
        itemContent: {
            control: 'text',
            description: 'Simple mode: `ui-accordion-item` content input (renders a built-in panel).',
        },
        itemSkeleton: {
            control: 'boolean',
            description: '`ui-accordion-item` skeleton input: shows a loading placeholder instead of the item.',
        },
    },
    args: {
        type: 'single',
        class: '',
        openValues: null,
        collapsible: true,
        itemTitle: 'Is it accessible?',
        itemContent: 'Yes. It adheres to the WAI-ARIA design pattern.',
        itemSkeleton: false,
    },
};

export default meta;
type Story = StoryObj<AccordionStoryArgs>;

const PLAYGROUND_TEMPLATE = `
    <ui-accordion [type]="type" [openValues]="openValues" [collapsible]="collapsible" [class]="class">
        <ui-accordion-item value="item-1" [title]="itemTitle" [content]="itemContent" [skeleton]="itemSkeleton" />
        <ui-accordion-item value="item-2" title="Is it styled?" content="Yes. It comes with default styles that match the other components' aesthetic." />
        <ui-accordion-item value="item-3" title="Is it animated?" content="Yes. It's animated by default, but you can disable it if you prefer." />
    </ui-accordion>`;

const render = (args: Partial<AccordionStoryArgs>): { props: Partial<AccordionStoryArgs>; template: string } => ({
    props: args,
    template: PLAYGROUND_TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const TemplateMode: Story = {
    render: (args) => ({
        props: args,
        template: `
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
            </ui-accordion>`,
    }),
};

export const SimpleMode: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-accordion [type]="type" class="w-full">
                <ui-accordion-item value="item-1" title="Is it accessible?" content="Yes. It adheres to the WAI-ARIA design pattern." />
                <ui-accordion-item value="item-2" title="Is it styled?" content="Yes. It comes with default styles that match the other components." />
                <ui-accordion-item value="item-3" title="Is it animated?" content="Yes. It's animated by default, but you can disable it if you prefer." />
            </ui-accordion>`,
    }),
};

export const Multiple: Story = {
    args: { type: 'multiple', openValues: ['item-1', 'item-2'] },
    render: (args) => ({
        props: args,
        template: `
            <ui-accordion type="multiple" [openValues]="openValues" class="w-full">
                <ui-accordion-item value="item-1" title="First section" content="Multiple panels can stay open at the same time." />
                <ui-accordion-item value="item-2" title="Second section" content="This one starts open too, via the openValues input." />
                <ui-accordion-item value="item-3" title="Third section" content="Open and close any of these independently." />
            </ui-accordion>`,
    }),
};

export const NotCollapsible: Story = {
    args: { collapsible: false, openValues: ['item-1'] },
    render: (args) => ({
        props: args,
        template: `
            <ui-accordion type="single" [collapsible]="collapsible" [openValues]="openValues" class="w-full">
                <ui-accordion-item value="item-1" title="Always one open" content="With collapsible=false the active panel cannot be closed by clicking it again." />
                <ui-accordion-item value="item-2" title="Switch sections" content="Selecting another panel moves the open state here." />
                <ui-accordion-item value="item-3" title="One at a time" content="Exactly one panel stays open at all times." />
            </ui-accordion>`,
    }),
};

export const Skeleton: Story = {
    args: { itemSkeleton: true },
    render: (args) => ({
        props: args,
        template: `
            <ui-accordion [type]="type" class="w-full">
                <ui-accordion-item value="item-1" [skeleton]="itemSkeleton" />
                <ui-accordion-item value="item-2" [skeleton]="itemSkeleton" />
                <ui-accordion-item value="item-3" title="Loaded item" content="Skeleton items sit alongside a resolved one while data streams in." />
            </ui-accordion>`,
    }),
};

export const RTL: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div dir="rtl">
                <ui-accordion [type]="type" class="w-full">
                    <ui-accordion-item value="item-1" title="האם זה נגיש?" content="כן. הוא עומד בתבנית העיצוב WAI-ARIA." />
                    <ui-accordion-item value="item-2" title="האם זה מעוצב?" content="כן. הוא מגיע עם עיצוב ברירת מחדל התואם את שאר הרכיבים." />
                    <ui-accordion-item value="item-3" title="האם זה מונפש?" content="כן. הוא מונפש כברירת מחדל, אך ניתן לבטל זאת." />
                </ui-accordion>
            </div>`,
    }),
};
