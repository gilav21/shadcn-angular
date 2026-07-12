import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DateRangePickerComponent } from './date-picker';
import { CalendarComponent } from './calendar';
import { FormsModule } from '@angular/forms';

const meta: Meta<DateRangePickerComponent> = {
    title: 'UI/DateRangePicker',
    component: DateRangePickerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [DateRangePickerComponent, CalendarComponent, FormsModule],
        }),
    ],
    argTypes: {
        placeholder: { control: 'text', description: 'Placeholder text shown in the trigger button when no range is selected.' },
        disabled: { control: 'boolean', description: 'Disables the trigger button and popup interaction.' },
        showTime: { control: 'boolean', description: 'Adds hour/minute range selection to the calendar popup and keeps it open after picking a range.' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale used to format the selected date/time range label.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the trigger button.' },
    },
    args: {
        placeholder: 'Pick a date range',
        disabled: false,
        showTime: false,
        locale: 'en',
        class: '',
    },
};

export default meta;
type Story = StoryObj<DateRangePickerComponent>;

const TEMPLATE = `
    <ui-date-range-picker
        [placeholder]="placeholder"
        [disabled]="disabled"
        [showTime]="showTime"
        [locale]="locale"
        [class]="class">
    </ui-date-range-picker>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

export const Playground: Story = { render };

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-date-range-picker [placeholder]="placeholder" [disabled]="disabled"></ui-date-range-picker>`,
    }),
};

export const showTime: Story = {
    args: {
        showTime: true,
        placeholder: 'Pick date & time range',
    },
    render,
};

export const HebrewRTL: Story = {
    args: {
        showTime: true,
        placeholder: 'בחר טווח תאריכים ושעה',
        locale: 'he',
    },
    render: (args) => ({
        props: args,
        template: `
    <ui-date-range-picker
        [placeholder]="placeholder"
        [disabled]="disabled"
        [showTime]="showTime"
        [locale]="locale"
        [class]="class"
        dir="rtl">
    </ui-date-range-picker>`,
    }),
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};
