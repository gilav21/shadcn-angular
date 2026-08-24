import { Meta, StoryObj } from '@storybook/angular';
import { TimePickerComponent } from './time-picker.component';

const meta: Meta<TimePickerComponent> = {
    title: 'UI/TimePicker',
    component: TimePickerComponent,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: [
                    'A time of day, edited one segment at a time.',
                    '',
                    'The value is a `"HH:mm"` string and is **always 24-hour**, whatever the field',
                    'shows. It is not a `Date`: a `Date` is an instant, and a time of day has no',
                    'date and no time zone, so storing `14:30` as one forces a `1970-01-01` date',
                    'part that shifts across midnight the moment anything converts zones.',
                    '',
                    'Everything about the *rendering* comes from the locale — segment order, the',
                    'separator, whether there is a meridiem at all, what that meridiem is called,',
                    'and the digits themselves. `en-US` shows `9:05 PM`, `de-DE` shows `21:05`,',
                    '`ar-EG` shows `٩:٠٥ م`, and `zh-TW` puts the meridiem **first**: `下午9:05`.',
                    'All four store the same string.',
                    '',
                    'An hour with no minute is not a time, so the value stays `null` until both',
                    'segments are filled — the same rule `<input type="time">` follows.',
                ].join('\n'),
            },
        },
    },
    argTypes: {
        value: { control: 'text', description: '`"HH:mm"` (or `"HH:mm:ss"`), 24-hour, or `null` when empty.' },
        locale: { control: 'text', description: 'BCP-47 tag. Falls back to the app-wide locale.' },
        withSeconds: { control: 'boolean', description: 'Adds a seconds segment and widens the value.' },
        disabled: { control: 'boolean', description: 'Disables every segment.' },
        ariaLabel: { control: 'text', description: 'Accessible name for the group.' },
        class: { control: 'text', description: 'Extra classes merged onto the wrapper.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the wrapper.',
        },
    },
};

export default meta;
type Story = StoryObj<TimePickerComponent>;

export const Default: Story = {
    args: { value: '09:05', locale: 'en-US' },
};

/** The same stored value, rendered by four locales that disagree about everything. */
export const AcrossLocales: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center gap-4">
                <ui-time-picker value="21:05" locale="en-US" ariaLabel="US English" />
                <ui-time-picker value="21:05" locale="de-DE" ariaLabel="German" />
                <ui-time-picker value="21:05" locale="ar-EG" ariaLabel="Egyptian Arabic" />
                <ui-time-picker value="21:05" locale="zh-TW" ariaLabel="Traditional Chinese" />
            </div>
        `,
    }),
};

/** 24-hour locales simply have no meridiem segment to render. */
export const TwentyFourHour: Story = {
    args: { value: '21:05', locale: 'en-GB' },
};

export const WithSeconds: Story = {
    args: { value: '09:05:09', locale: 'en-GB', withSeconds: true },
};

export const Empty: Story = {
    args: { value: null, locale: 'en-US' },
};

export const Disabled: Story = {
    args: { value: '09:05', locale: 'en-US', disabled: true },
};

export const Variants: Story = {
    render: () => ({
        template: `
            <div class="flex flex-wrap items-center gap-4">
                <ui-time-picker value="09:05" variant="outline" ariaLabel="Outline" />
                <ui-time-picker value="09:05" variant="underline" ariaLabel="Underline" />
                <ui-time-picker value="09:05" variant="ghost" ariaLabel="Ghost" />
            </div>
        `,
    }),
};
