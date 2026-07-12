import { Meta, StoryObj } from '@storybook/angular';
import { ProgressComponent } from './progress.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode.
const meta: Meta<ProgressComponent> = {
    title: 'UI/Progress',
    component: ProgressComponent,
    tags: ['autodocs'],
    argTypes: {
        value: { control: { type: 'range', min: 0, max: 100 }, description: 'Current progress value.' },
        max: { control: 'number', description: 'Value that represents 100%.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        ariaLabel: { control: 'text', description: 'Accessible label for the progress bar.' },
        ariaLabelledby: { control: 'text', description: 'Id of an element that labels the progress bar.' },
        locale: { control: 'text', description: "BCP-47 locale tag used to format `aria-valuetext` (e.g. `'45%'` in en, `'45 %'` in fr). Falls back to the app-wide locale." },
    },
    args: {
        value: 60,
        max: 100,
        class: '',
        ariaLabel: 'Progress',
        ariaLabelledby: undefined,
        locale: undefined,
    },
};

export default meta;
type Story = StoryObj<ProgressComponent>;

const TEMPLATE = `
    <ui-progress
        [value]="value" [max]="max" [class]="class"
        [ariaLabel]="ariaLabel" [ariaLabelledby]="ariaLabelledby" [locale]="locale" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Empty: Story = {
    args: { value: 0 },
    render,
};

export const HalfWay: Story = {
    args: { value: 50 },
    render,
};

export const Complete: Story = {
    args: { value: 100 },
    render,
};

export const CustomMax: Story = {
    args: { value: 30, max: 40 },
    render,
};

export const CustomLocale: Story = {
    args: { value: 45, locale: 'fr-FR', ariaLabel: 'Progression' },
    render,
};
