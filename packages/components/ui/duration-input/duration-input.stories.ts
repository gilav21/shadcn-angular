import { Meta, StoryObj } from '@storybook/angular';
import { DurationInputComponent } from './duration-input.component';

const meta: Meta<DurationInputComponent> = {
    title: 'UI/DurationInput',
    component: DurationInputComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: [
                    'A length of time, edited one unit at a time.',
                    '',
                    'The value is **seconds** — not milliseconds, which nobody types, and not an',
                    'ISO-8601 string, because the point of a duration is arithmetic and a number',
                    'does it directly. `formatIso8601` and `parseIso8601` ship alongside for APIs',
                    'that speak it.',
                    '',
                    'Segments rather than one text field: a single field has to guess what `130`',
                    'means and every guess is wrong for somebody. The caret is in the minutes box,',
                    'so the digits are minutes.',
                ].join('\n'),
            },
        },
    },
    argTypes: {
        value: { control: 'number', description: 'Duration in seconds, or `null` when empty.' },
        units: {
            control: 'object',
            description: 'Units to show, largest first. The largest absorbs everything above it.',
        },
        disabled: { control: 'boolean', description: 'Disables every segment.' },
        ariaLabel: { control: 'text', description: 'Accessible name for the group.' },
        class: { control: 'text', description: 'Extra classes merged onto the wrapper.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the wrapper.',
        },
    },
    args: {
        value: 5400,
        units: ['hours', 'minutes'],
        disabled: false,
        ariaLabel: 'Duration',
        variant: 'outline',
        class: '',
    },
};

export default meta;
type Story = StoryObj<DurationInputComponent>;

export const Default: Story = {};

export const Empty: Story = { args: { value: null } };

export const WithSeconds: Story = {
    args: { value: 5445, units: ['hours', 'minutes', 'seconds'] },
};

/**
 * The same 90 minutes, shown three ways. The leading segment absorbs whatever
 * the units cannot express, so nothing is silently dropped.
 */
export const LeadingUnitAbsorbs: Story = {
    render: () => ({
        template: `
      <div class="flex flex-col gap-3">
        <ui-duration-input [value]="5400" [units]="['hours','minutes']" ariaLabel="Hours and minutes" />
        <ui-duration-input [value]="5400" [units]="['minutes','seconds']" ariaLabel="Minutes and seconds" />
        <ui-duration-input [value]="5400" [units]="['seconds']" ariaLabel="Seconds" />
      </div>
    `,
    }),
};

export const Variants: Story = {
    render: () => ({
        template: `
      <div class="flex flex-col gap-3">
        <ui-duration-input [value]="5400" variant="outline" />
        <ui-duration-input [value]="5400" variant="underline" />
        <ui-duration-input [value]="5400" variant="ghost" />
      </div>
    `,
    }),
};

export const Disabled: Story = { args: { disabled: true } };
