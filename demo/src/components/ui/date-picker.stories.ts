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
    },
    args: {
        placeholder: 'Pick a date',
        disabled: false,
        showTime: false,
    },
};

export default datePickerMeta;
type DatePickerStory = StoryObj<DatePickerComponent>;

export const Default: DatePickerStory = {
    render: (args) => ({
        props: args,
        template: `<ui-date-picker [placeholder]="placeholder" [disabled]="disabled" [showTime]="showTime"></ui-date-picker>`,
    }),
};

export const WithTime: DatePickerStory = {
    args: {
        showTime: true,
        placeholder: 'Pick date & time',
    },
    render: (args) => ({
        props: args,
        template: `<ui-date-picker [placeholder]="placeholder" [disabled]="disabled" [showTime]="showTime"></ui-date-picker>`,
    }),
};

// We can also create a separate file or export for Range Picker, but putting it here as a variant or separate story is fine.
// Since it's a different component, it's better to have a separate Meta if we want full controls, or just show it as a variant if we force it.
// However, Storybook prefers one component per default export usually. I'll create a second file for RangePicker or just rely on this one if they were the same component.
// They are different components. I'll create a separate file `date-range-picker.stories.ts` for clarity.
