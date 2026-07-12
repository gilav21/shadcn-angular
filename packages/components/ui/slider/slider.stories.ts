import { Meta, StoryObj } from '@storybook/angular';
import { SliderComponent } from './slider.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<SliderComponent> = {
    title: 'UI/Slider',
    component: SliderComponent,
    tags: ['autodocs'],
    argTypes: {
        min: { control: 'number', description: 'Minimum value of the range.' },
        max: { control: 'number', description: 'Maximum value of the range.' },
        step: { control: 'number', min: 0.1, step: 0.1, description: 'Increment between selectable values.' },
        disabled: { control: 'boolean', description: 'Disables dragging, clicking, and keyboard interaction.' },
        defaultValue: { control: 'number', description: 'Initial value the thumb starts at.' },
        ariaLabel: { control: 'text', description: 'Accessible name for the underlying range input.' },
        ariaLabelledby: { control: 'text', description: 'Id of an element that labels the slider (alternative to ariaLabel).' },
        locale: {
            control: 'select',
            options: ['en-US', 'de-DE', 'fr-FR', 'ar-EG'],
            description: 'BCP-47 locale used to format the aria-valuetext announcement via Intl.NumberFormat. Falls back to the app-wide UI_LOCALE_ID token.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host, e.g. to control width.' },
    },
    args: {
        min: 0,
        max: 100,
        step: 1,
        disabled: false,
        defaultValue: 50,
        ariaLabel: 'Slider',
        ariaLabelledby: undefined,
        locale: 'en-US',
        class: 'w-[60%]',
    },
};

export default meta;
type Story = StoryObj<SliderComponent>;

const TEMPLATE = `
    <ui-slider
        [min]="min" [max]="max" [step]="step" [disabled]="disabled"
        [defaultValue]="defaultValue" [ariaLabel]="ariaLabel" [ariaLabelledby]="ariaLabelledby"
        [locale]="locale" [class]="class">
    </ui-slider>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const Stepped: Story = {
    args: { min: 0, max: 10, step: 2, defaultValue: 4 },
    render,
};

export const LocaleFormatting: Story = {
    args: { min: 0, max: 50, step: 0.5, defaultValue: 12.5, locale: 'de-DE', ariaLabel: 'Betrag' },
    render,
};

export const Rtl: Story = {
    render: (args) => ({
        props: args,
        template: `<div dir="rtl">${TEMPLATE}</div>`,
    }),
};
