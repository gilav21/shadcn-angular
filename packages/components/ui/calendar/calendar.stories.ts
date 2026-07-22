import { Meta, StoryObj } from '@storybook/angular';
import { CalendarComponent, DateRange, TimeRange } from './calendar.component';
import { resolveLocale, type LocaleInput } from '../../lib/i18n';
import { CALENDAR_LOCALES, type CalendarLocale } from '../../lib/i18n/calendar.locales';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
function rtlFromLocale(localeArg: LocaleInput<CalendarLocale> | undefined): boolean {
    return resolveLocale<CalendarLocale>(localeArg, CALENDAR_LOCALES, 'en').rtl ?? false;
}

const meta: Meta<CalendarComponent> = {
    title: 'UI/Calendar',
    component: CalendarComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'Calendar with single/range/multi selection, month & year pickers, optional time selection, and full localization (RTL auto-set from locale).',
            },
        },
    },
    argTypes: {
        mode: {
            control: 'select',
            options: ['single', 'range', 'multi'],
            description: 'Selection mode: a single date, a start/end range, or multiple discrete dates.',
        },
        showMonthSelect: { control: 'boolean', description: 'Shows a month dropdown in the header instead of static text.' },
        showYearSelect: { control: 'boolean', description: 'Shows a year dropdown in the header instead of static text.' },
        showTimeSelect: { control: 'boolean', description: 'Shows time input(s) below the grid for attaching a time-of-day to the selection.' },
        timeMode: {
            control: 'select',
            options: ['single', 'range'],
            description: 'When `showTimeSelect` is on: one time input, or separate start/end time inputs.',
        },
        weekStartsOn: {
            control: 'select',
            options: [0, 1, 2, 3, 4, 5, 6],
            description: 'First day of the week: 0 = Sunday … 6 = Saturday.',
        },
        rtl: {
            control: 'boolean',
            description: 'Right-to-left layout. Auto-derived from `locale` when the locale has `rtl: true`; override manually if needed.',
        },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale key (or custom locale object) for month/day names and labels. Automatically applies RTL for `he`/`ar`.',
        },
        selected: {
            control: 'object',
            description: 'Current selection: a `Date`/ISO string in single mode, a `DateRange` in range mode, or an array in multi mode.',
        },
        selectedTimeRange: {
            control: 'object',
            description: 'Current `{ start, end }` time-of-day strings (`HH:mm`) used when `timeMode` is `range`.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host container.' },
    },
    args: {
        mode: 'single',
        showMonthSelect: true,
        showYearSelect: true,
        showTimeSelect: false,
        timeMode: 'single',
        weekStartsOn: 0,
        locale: 'en',
        selected: null,
        selectedTimeRange: { start: '', end: '' },
        class: '',
    },
};

export default meta;
type Story = StoryObj<CalendarComponent>;

const TEMPLATE = `
    <ui-calendar
        [mode]="mode" [showMonthSelect]="showMonthSelect" [showYearSelect]="showYearSelect"
        [showTimeSelect]="showTimeSelect" [timeMode]="timeMode" [weekStartsOn]="weekStartsOn"
        [locale]="locale" [rtl]="rtl" [(selected)]="selected" [(selectedTimeRange)]="selectedTimeRange"
        [class]="class || 'rounded-md border shadow'">
    </ui-calendar>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: { ...args, rtl: args.rtl ?? rtlFromLocale(args.locale) },
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const SingleDate: Story = {
    args: { mode: 'single' },
    render,
};

export const RangeMode: Story = {
    args: { mode: 'range', selected: { start: null, end: null } as DateRange },
    render,
};

export const MultiMode: Story = {
    args: { mode: 'multi', selected: [] },
    render,
};

export const WeekStartsMonday: Story = {
    args: { weekStartsOn: 1 },
    render,
};

export const WithTimeSelect: Story = {
    args: { showTimeSelect: true, timeMode: 'single' },
    render,
};

export const WithTimeRange: Story = {
    args: { showTimeSelect: true, timeMode: 'range', selectedTimeRange: { start: '09:00', end: '17:00' } as TimeRange },
    render,
};

export const RangeModeWithTimeRange: Story = {
    args: {
        mode: 'range',
        showTimeSelect: true,
        timeMode: 'range',
        selected: { start: null, end: null } as DateRange,
    },
    render,
};

export const WithoutMonthYearSelects: Story = {
    args: { showMonthSelect: false, showYearSelect: false },
    render,
};

export const RTLArabic: Story = {
    args: { locale: 'ar' },
    render,
};

export const RTLHebrew: Story = {
    args: { locale: 'he' },
    render,
};
