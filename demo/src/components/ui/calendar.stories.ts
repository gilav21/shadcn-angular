import { Meta, StoryObj } from '@storybook/angular';
import { CalendarComponent } from './calendar.component';

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
            control: 'select',
            options: [0, 1, 2, 3, 4, 5, 6],
        },
        rtl: { control: 'boolean' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
        },
    },
    args: {
        mode: 'single',
        showMonthSelect: false,
        showYearSelect: false,
        showTimeSelect: false,
        weekStartsOn: 0,
        rtl: false,
        locale: 'en',
    },
};

export default meta;
type Story = StoryObj<CalendarComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" [showTimeSelect]="showTimeSelect" [weekStartsOn]="weekStartsOn" [rtl]="rtl" [locale]="locale" class="rounded-md border shadow"></ui-calendar>`,
    }),
};

export const RangeMode: Story = {
    args: {
        mode: 'range',
    },
    render: (args) => ({
        props: args,
        template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" [showTimeSelect]="showTimeSelect" [weekStartsOn]="weekStartsOn" [rtl]="rtl" [locale]="locale" class="rounded-md border shadow"></ui-calendar>`,
    }),
};

export const MultiMode: Story = {
    args: {
        mode: 'multi',
    },
    render: (args) => ({
        props: args,
        template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" [showTimeSelect]="showTimeSelect" [weekStartsOn]="weekStartsOn" [rtl]="rtl" [locale]="locale" class="rounded-md border shadow"></ui-calendar>`,
    }),
};
