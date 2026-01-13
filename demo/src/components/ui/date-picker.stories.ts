import { Meta, StoryObj } from '@storybook/angular';
import { DatePickerComponent, DateRangePickerComponent } from './date-picker.component';
import { CalendarComponent } from './calendar.component';
import { moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';

// DatePicker Story
const datePickerMeta: Meta<DatePickerComponent> = {
    title: 'UI/DatePicker',
    component: DatePickerComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [DatePickerComponent, CalendarComponent, FormsModule],
        }),
    ],
    argTypes: {
        placeholder: { control: 'text' },
        disabled: { control: 'boolean' },
        showTime: { control: 'boolean' },
        locale: {
            control: 'select',
            options: ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'],
        },
    },
    args: {
        placeholder: 'Pick a date',
        disabled: false,
        showTime: false,
        locale: 'en',
    },
};

export default datePickerMeta;
type DatePickerStory = StoryObj<DatePickerComponent>;

export const Default: DatePickerStory = {
    render: (args) => ({
        props: args,
        template: `<ui-date-picker [placeholder]="placeholder" [disabled]="disabled" [showTime]="showTime" [locale]="locale"></ui-date-picker>`,
    }),
};

export const WithTime: DatePickerStory = {
    args: {
        showTime: true,
        placeholder: 'Pick date & time',
    },
    render: (args) => ({
        props: args,
        template: `<ui-date-picker [placeholder]="placeholder" [disabled]="disabled" [showTime]="showTime" [locale]="locale"></ui-date-picker>`,
    }),
};

export const HebrewRTL: DatePickerStory = {
    args: {
        showTime: true,
        placeholder: 'בחר תאריך ושעה',
        locale: 'he',
    },
    render: (args) => ({
        props: args,
        template: `<ui-date-picker [placeholder]="placeholder" [disabled]="disabled" [showTime]="showTime" [locale]="locale" dir="rtl"></ui-date-picker>`,
    }),
};
