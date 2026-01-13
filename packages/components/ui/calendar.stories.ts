import { Meta, StoryObj } from '@storybook/angular';
import { CalendarComponent } from './calendar.component';
import { CALENDAR_LOCALES } from './calendar-locales';

const meta: Meta<CalendarComponent> = {
    title: 'UI/Calendar',
    component: CalendarComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'Calendar component with RTL and localization support. RTL is automatically set based on the selected locale.',
            },
        },
    },
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
        rtl: {
            control: 'boolean',
            description: 'Auto-set by locale. Override manually if needed.',
        },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Sets the locale and automatically applies RTL for needed languages.',
        },
    },
    args: {
        mode: 'single',
        showMonthSelect: true,
        showYearSelect: true,
        showTimeSelect: false,
        weekStartsOn: 0,
        locale: 'en',
    },
};

export default meta;
type Story = StoryObj<CalendarComponent>;

export const Default: Story = {
    render: (args) => {
        // Get RTL from locale if not explicitly set
        const localeData = CALENDAR_LOCALES[args.locale ?? 'en'];
        const rtl = localeData?.rtl ?? false;

        return {
            props: { ...args, rtl },
            template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" [showTimeSelect]="showTimeSelect" [weekStartsOn]="weekStartsOn" [locale]="locale" class="rounded-md border shadow"></ui-calendar>`,
        };
    },
};

export const RangeMode: Story = {
    args: {
        mode: 'range',
    },
    render: (args) => {
        const localeData = CALENDAR_LOCALES[args.locale ?? 'en'];
        const rtl = localeData?.rtl ?? false;

        return {
            props: { ...args, rtl },
            template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" [showTimeSelect]="showTimeSelect" [weekStartsOn]="weekStartsOn" [locale]="locale" class="rounded-md border shadow"></ui-calendar>`,
        };
    },
};

export const MultiMode: Story = {
    args: {
        mode: 'multi',
    },
    render: (args) => {
        const localeData = CALENDAR_LOCALES[args.locale ?? 'en'];
        const rtl = localeData?.rtl ?? false;

        return {
            props: { ...args, rtl },
            template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" [showTimeSelect]="showTimeSelect" [weekStartsOn]="weekStartsOn" [locale]="locale" class="rounded-md border shadow"></ui-calendar>`,
        };
    },
};

export const WithTimeSelect: Story = {
    args: {
        showTimeSelect: true,
    },
    render: (args) => {
        const localeData = CALENDAR_LOCALES[args.locale ?? 'en'];
        const rtl = localeData?.rtl ?? false;

        return {
            props: { ...args, rtl },
            template: `<ui-calendar [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect" [showTimeSelect]="showTimeSelect" [weekStartsOn]="weekStartsOn" [locale]="locale" class="rounded-md border shadow"></ui-calendar>`,
        };
    },
};
