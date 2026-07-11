import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from './date-picker.component';
import { CalendarComponent } from '../calendar';

const meta: Meta<DatePickerComponent> = {
    title: 'UI/DatePicker',
    component: DatePickerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [DatePickerComponent, CalendarComponent, FormsModule],
        }),
    ],
    argTypes: {
        placeholder: { control: 'text', description: 'Placeholder text shown in the trigger button when no date is selected.' },
        disabled: { control: 'boolean', description: 'Disables the trigger button and popup interaction.' },
        showTime: { control: 'boolean', description: 'Adds hour/minute selection to the calendar popup and keeps it open after picking a date.' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
            description: 'Locale used to format the selected date/time label.',
        },
        date: { control: 'object', description: 'Current selected `Date`, or `null` when empty. Two-way bindable via `dateChange`/`ngModel`.' },
        class: { control: 'text', description: 'Extra classes merged onto the trigger button.' },
    },
    args: {
        placeholder: 'Pick a date',
        disabled: false,
        showTime: false,
        locale: 'en',
        date: null,
        class: '',
    },
};

export default meta;
type Story = StoryObj<DatePickerComponent>;

const TEMPLATE = `
    <ui-date-picker
        [placeholder]="placeholder"
        [disabled]="disabled"
        [showTime]="showTime"
        [locale]="locale"
        [date]="date"
        [class]="class">
    </ui-date-picker>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

export const Playground: Story = { render };

export const WithTime: Story = {
    args: {
        showTime: true,
        placeholder: 'Pick date & time',
    },
    render,
};

export const HebrewRTL: Story = {
    args: {
        showTime: true,
        placeholder: 'בחר תאריך ושעה',
        locale: 'he',
    },
    render: (args) => ({
        props: args,
        template: `
    <ui-date-picker
        [placeholder]="placeholder"
        [disabled]="disabled"
        [showTime]="showTime"
        [locale]="locale"
        [date]="date"
        [class]="class"
        dir="rtl">
    </ui-date-picker>`,
    }),
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const Preselected: Story = {
    args: { date: new Date() },
    render,
};
