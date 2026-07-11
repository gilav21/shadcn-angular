import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { InputComponent } from './input.component';
import { FormsModule } from '@angular/forms';

const meta: Meta<InputComponent> = {
    title: 'UI/Input',
    component: InputComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [FormsModule, InputComponent],
        }),
    ],
    argTypes: {
        type: { control: 'text', description: 'Native `<input>` type (text, email, password, number, ...).' },
        placeholder: { control: 'text', description: 'Placeholder text.' },
        disabled: { control: 'boolean', description: 'Disables the input.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the input.',
        },
        loading: { control: 'boolean', description: 'Shows a trailing spinner (forces the addon-container layout).' },
        skeleton: { control: 'boolean', description: 'Renders a skeleton placeholder instead of the input.' },
        autofocus: { control: 'boolean', description: 'Focuses the input on init.' },
        clearable: { control: 'boolean', description: 'Shows a clear (x) button while the input has a value.' },
        floating: { control: 'boolean', description: 'Enables floating-label mode (requires `label`).' },
        label: { control: 'text', description: 'Floating label text; only used when `floating` is true.' },
        labelClass: { control: 'text', description: 'Extra classes applied to the floating label once it animates up.' },
        prefix: { control: 'text', description: 'Text shown before the value (forces the addon-container layout).' },
        suffix: { control: 'text', description: 'Text shown after the value, hidden while loading.' },
        elementId: { control: 'text', description: 'Forwarded to the inner `<input>` id (for external `<label for>`).' },
        name: { control: 'text', description: 'Forwarded to the inner `<input>` name.' },
        ariaLabel: { control: 'text', description: 'Forwarded to the inner `<input>` aria-label.' },
        ariaLabelledby: { control: 'text', description: 'Forwarded to the inner `<input>` aria-labelledby.' },
        ariaDescribedby: { control: 'text', description: 'Forwarded to the inner `<input>` aria-describedby.' },
        class: { control: 'text', description: 'Extra classes merged onto the input/container.' },
    },
    args: {
        type: 'text',
        placeholder: 'Enter text...',
        disabled: false,
        variant: 'outline',
        loading: false,
        skeleton: false,
        autofocus: false,
        clearable: false,
        floating: false,
        label: '',
        labelClass: '',
        prefix: '',
        suffix: '',
        elementId: undefined,
        name: undefined,
        ariaLabel: undefined,
        ariaLabelledby: undefined,
        ariaDescribedby: undefined,
        class: '',
    },
};

export default meta;
type Story = StoryObj<InputComponent>;

const TEMPLATE = `
    <ui-input
        [type]="type" [placeholder]="placeholder" [disabled]="disabled" [variant]="variant"
        [loading]="loading" [skeleton]="skeleton" [autofocus]="autofocus"
        [clearable]="clearable" [floating]="floating" [label]="label" [labelClass]="labelClass"
        [prefix]="prefix" [suffix]="suffix" [elementId]="elementId" [name]="name"
        [ariaLabel]="ariaLabel" [ariaLabelledby]="ariaLabelledby" [ariaDescribedby]="ariaDescribedby"
        [class]="class">
    </ui-input>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const Disabled: Story = {
    args: { disabled: true, placeholder: 'Disabled input' },
    render,
};

export const Email: Story = {
    args: { type: 'email', placeholder: 'Email' },
    render,
};

export const Variants: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col gap-4 w-[300px]">
                <ui-input variant="outline" placeholder="Outline (default)" />
                <ui-input variant="underline" placeholder="Underline" />
                <ui-input variant="ghost" placeholder="Ghost" />
            </div>`,
    }),
};

export const Clearable: Story = {
    args: { clearable: true, placeholder: 'Type to see the clear button' },
    render,
};

export const Loading: Story = {
    args: { loading: true, placeholder: 'Loading...' },
    render,
};

export const Skeleton: Story = {
    args: { skeleton: true },
    render,
};

export const WithPrefixAndSuffix: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col gap-4 w-[300px]">
                <ui-input prefix="$" placeholder="0.00" />
                <ui-input suffix=".00" placeholder="Amount" />
                <ui-input prefix="https://" suffix=".com" placeholder="example" />
            </div>`,
    }),
};

export const FloatingLabel: Story = {
    args: { floating: true, label: 'Email address' },
    render,
};

export const FloatingLabelCustomStyle: Story = {
    args: {
        floating: true,
        label: 'Full name',
        labelClass: 'text-base font-semibold text-foreground',
    },
    render,
};
