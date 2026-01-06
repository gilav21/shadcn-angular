import { Meta, StoryObj } from '@storybook/angular';
import { DateRangePickerComponent } from './date-picker.component';
import { CalendarComponent } from './calendar.component';
import { moduleMetadata } from '@storybook/angular';
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
        placeholder: { control: 'text' },
        disabled: { control: 'boolean' },
    },
    args: {
        placeholder: 'Pick a date range',
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<DateRangePickerComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `<ui-date-range-picker [placeholder]="placeholder" [disabled]="disabled"></ui-date-range-picker>`,
    }),
};
