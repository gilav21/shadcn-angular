import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from './checkbox.component';

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct mode.
const meta: Meta<CheckboxComponent> = {
    title: 'UI/Checkbox',
    component: CheckboxComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [FormsModule, CheckboxComponent],
        }),
    ],
    argTypes: {
        checked: { control: 'boolean', description: 'Checked state (two-way bindable model).' },
        indeterminate: { control: 'boolean', description: 'Renders the mixed/indeterminate dash.' },
        disabled: { control: 'boolean', description: 'Disables interaction.' },
        skeleton: { control: 'boolean', description: 'Renders a skeleton placeholder instead of the checkbox.' },
        label: { control: 'text', description: 'Simple-mode inline label rendered next to the box.' },
        elementId: { control: 'text', description: 'Explicit id for the native input (auto-generated when a label is set).' },
        ariaLabel: { control: 'text', description: 'aria-label for the native input.' },
        ariaLabelledby: { control: 'text', description: 'aria-labelledby for the native input.' },
        ariaDescribedby: { control: 'text', description: 'aria-describedby for the native input.' },
        ariaInvalid: { control: 'boolean', description: 'aria-invalid for the native input.' },
        class: { control: 'text', description: 'Extra classes merged onto the box element.' },
    },
    args: {
        checked: false,
        indeterminate: false,
        disabled: false,
        skeleton: false,
        label: 'Accept terms and conditions',
        elementId: undefined,
        ariaLabel: undefined,
        ariaLabelledby: undefined,
        ariaDescribedby: undefined,
        ariaInvalid: undefined,
        class: '',
    },
};

export default meta;
type Story = StoryObj<CheckboxComponent>;

const TEMPLATE = `
    <ui-checkbox
        [(checked)]="checked" [indeterminate]="indeterminate" [disabled]="disabled"
        [skeleton]="skeleton" [label]="label" [elementId]="elementId"
        [ariaLabel]="ariaLabel" [ariaLabelledby]="ariaLabelledby"
        [ariaDescribedby]="ariaDescribedby" [ariaInvalid]="ariaInvalid"
        [class]="class" />`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Checked: Story = {
    args: { checked: true },
    render,
};

export const Unchecked: Story = {
    args: { checked: false },
    render,
};

export const Indeterminate: Story = {
    args: { indeterminate: true },
    render,
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const DisabledChecked: Story = {
    args: { disabled: true, checked: true },
    render,
};

export const WithoutLabel: Story = {
    args: { label: undefined, ariaLabel: 'Standalone checkbox' },
    render,
};

export const Skeleton: Story = {
    args: { skeleton: true },
    render,
};
