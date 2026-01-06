import { Meta, StoryObj } from '@storybook/angular';
import { CalendarComponent } from './calendar.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<CalendarComponent> = {
    title: 'UI/Calendar',
    component: CalendarComponent,
    tags: ['autodocs'],
    argTypes: {
        mode: {
            control: 'select',
            options: ['single', 'range', 'multi'],
        },
        showMonthSelect: { control: 'boolean' },
        showYearSelect: { control: 'boolean' },
        showTimeSelect: { control: 'boolean' },
        weekStartsOn: {
            control: 'radio',
            options: [0, 1],
        },
    },
    args: {
        mode: 'single',
        showMonthSelect: false,
        showYearSelect: false,
        showTimeSelect: false,
        weekStartsOn: 0,
    },
};

export default meta;
type Story = StoryObj<CalendarComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" [showTimeSelect]="showTimeSelect" [weekStartsOn]="weekStartsOn" class="rounded-md border shadow"></ui-calendar>`,
    }),
};

export const RangeMode: Story = {
    args: {
        mode: 'range',
    },
    render: (args) => ({
        props: args,
        template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" class="rounded-md border shadow"></ui-calendar>`,
    }),
};
