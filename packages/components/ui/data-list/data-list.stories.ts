import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { BadgeComponent } from '../badge';
import { ButtonComponent } from '../button';
import { DataListComponent, DataListItemComponent } from './index';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<DataListComponent> = {
    title: 'UI/Data List',
    component: DataListComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [DataListComponent, DataListItemComponent, BadgeComponent, ButtonComponent],
        }),
    ],
    argTypes: {
        items: {
            control: 'object',
            description:
                'Simple-mode rows — `{ label, value }` pairs rendered as `<dt>`/`<dd>`. Rendered before any projected `ui-data-list-item`.',
        },
        orientation: {
            control: 'inline-radio',
            options: ['vertical', 'horizontal'],
            description:
                '`horizontal` puts labels beside values from the `sm` breakpoint up and collapses back to stacked below it.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the inner `<dl>`.' },
    },
    args: {
        items: [
            { label: 'Status', value: 'Active' },
            { label: 'Plan', value: 'Enterprise' },
            { label: 'Seats', value: '42' },
        ],
        orientation: 'vertical',
        class: '',
    },
};

export default meta;
type Story = StoryObj<DataListComponent>;

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-data-list [items]="items" [orientation]="orientation" [class]="class" />`,
    }),
};

/** Simple mode: hand it an array and get a description list. */
export const SimpleMode: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-data-list [items]="items" />`,
    }),
};

/** Labels beside values — collapses to stacked below 640px. */
export const Horizontal: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-data-list [items]="items" orientation="horizontal" />`,
    }),
};

/** Custom mode: project rows to put any content in the value cell. */
export const CustomMode: Story = {
    render: () => ({
        template: `
            <ui-data-list orientation="horizontal">
                <ui-data-list-item label="Status">
                    <ui-badge label="Active" />
                </ui-data-list-item>
                <ui-data-list-item label="Owner">Ada Lovelace</ui-data-list-item>
                <ui-data-list-item label="API key">
                    <span class="flex flex-wrap items-center gap-2">
                        <code class="rounded bg-muted px-1.5 py-0.5 text-xs">sk_live_5f2b…</code>
                        <ui-button size="sm" variant="outline" label="Rotate" />
                    </span>
                </ui-data-list-item>
            </ui-data-list>`,
    }),
};

/** Simple and custom rows in the same list — generated rows come first. */
export const MixedModes: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-data-list [items]="items" orientation="horizontal">
                <ui-data-list-item label="Owner">
                    <ui-badge variant="secondary" label="Ada Lovelace" />
                </ui-data-list-item>
            </ui-data-list>`,
    }),
};

/** Right-to-left layout. */
export const Rtl: Story = {
    render: () => ({
        template: `
            <div dir="rtl">
                <ui-data-list
                    orientation="horizontal"
                    [items]="[{ label: 'סטטוס', value: 'פעיל' }, { label: 'תוכנית', value: 'ארגונית' }]" />
            </div>`,
    }),
};
