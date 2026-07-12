import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { RadioGroupComponent, RadioGroupItemComponent } from './radio-group.component';
import { LabelComponent } from '../label';

interface DensityOption {
    id: string;
    label: string;
    value: string;
}

// Every input is exposed as an interactive control (argTypes) with a sensible
// default (args); the Playground binds all of them so the Controls panel drives
// the live component. Dedicated stories below capture each distinct visual mode
// — including both the template-composition (projected items) and data-driven
// (`options`) usage modes.
const meta: Meta<RadioGroupComponent> = {
    title: 'UI/RadioGroup',
    component: RadioGroupComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [RadioGroupComponent, RadioGroupItemComponent, LabelComponent, FormsModule],
        }),
    ],
    argTypes: {
        orientation: { control: 'radio', options: ['horizontal', 'vertical'], description: 'Layout direction of the group.' },
        disabled: { control: 'boolean', description: 'Disables all items in the group.' },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
        options: { control: 'object', description: 'Data-driven mode: renders one item per option. Leave empty to use projected `ui-radio-group-item` content instead.' },
        displayWith: { control: false, description: 'Data-driven mode: maps an option to its display label. Defaults to `String(option)`.' },
        valueAttribute: { control: 'text', description: 'Data-driven mode: key read off each option object to derive its radio value. Omit when options are plain strings.' },
        disabledWith: { control: false, description: 'Data-driven mode: maps an option to whether it is disabled.' },
        value: { control: 'text', description: 'External value for one-way binding without forms.' },
    },
    args: {
        orientation: 'vertical',
        disabled: false,
        class: '',
        options: [],
        value: undefined,
    },
};

export default meta;
type Story = StoryObj<RadioGroupComponent>;

/** Interactive playground — template-composition mode with projected items. */
export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-radio-group [orientation]="orientation" [disabled]="disabled" [options]="options" [valueAttribute]="valueAttribute" [value]="value" [class]="class">
                <div class="flex items-center gap-2">
                    <ui-radio-group-item value="default" id="r1" ariaLabel="Default"></ui-radio-group-item>
                    <ui-label for="r1">Default</ui-label>
                </div>
                <div class="flex items-center gap-2">
                    <ui-radio-group-item value="comfortable" id="r2" ariaLabel="Comfortable"></ui-radio-group-item>
                    <ui-label for="r2">Comfortable</ui-label>
                </div>
                <div class="flex items-center gap-2">
                    <ui-radio-group-item value="compact" id="r3" ariaLabel="Compact"></ui-radio-group-item>
                    <ui-label for="r3">Compact</ui-label>
                </div>
            </ui-radio-group>`,
    }),
};

export const Horizontal: Story = {
    args: { orientation: 'horizontal' },
    render: (args) => ({
        props: args,
        template: `
            <ui-radio-group [orientation]="orientation" [disabled]="disabled">
                <div class="flex items-center gap-2">
                    <ui-radio-group-item value="default" id="h1" ariaLabel="Default"></ui-radio-group-item>
                    <ui-label for="h1">Default</ui-label>
                </div>
                <div class="flex items-center gap-2">
                    <ui-radio-group-item value="comfortable" id="h2" ariaLabel="Comfortable"></ui-radio-group-item>
                    <ui-label for="h2">Comfortable</ui-label>
                </div>
            </ui-radio-group>`,
    }),
};

export const Disabled: Story = {
    args: { disabled: true },
    render: (args) => ({
        props: args,
        template: `
            <ui-radio-group [orientation]="orientation" [disabled]="disabled">
                <div class="flex items-center gap-2">
                    <ui-radio-group-item value="default" id="d1" ariaLabel="Default"></ui-radio-group-item>
                    <ui-label for="d1">Default</ui-label>
                </div>
                <div class="flex items-center gap-2">
                    <ui-radio-group-item value="comfortable" id="d2" ariaLabel="Comfortable"></ui-radio-group-item>
                    <ui-label for="d2">Comfortable</ui-label>
                </div>
            </ui-radio-group>`,
    }),
};

export const DataDriven: Story = {
    args: {
        options: ['Default', 'Comfortable', 'Compact'],
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-radio-group
                [orientation]="orientation"
                [disabled]="disabled"
                [options]="options"
            />`,
    }),
};

const objectOptions: DensityOption[] = [
    { id: '1', label: 'Default', value: 'default' },
    { id: '2', label: 'Comfortable', value: 'comfortable' },
    { id: '3', label: 'Compact', value: 'compact' },
];

export const DataDrivenObjects: Story = {
    args: {
        options: objectOptions,
        valueAttribute: 'value',
        displayWith: (opt: unknown) => (opt as DensityOption).label,
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-radio-group
                [orientation]="orientation"
                [disabled]="disabled"
                [options]="options"
                [valueAttribute]="valueAttribute"
                [displayWith]="displayWith"
            />`,
    }),
};

export const DataDrivenWithDisabledOption: Story = {
    args: {
        options: objectOptions,
        valueAttribute: 'value',
        displayWith: (opt: unknown) => (opt as DensityOption).label,
        disabledWith: (opt: unknown) => (opt as DensityOption).value === 'compact',
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-radio-group
                [orientation]="orientation"
                [options]="options"
                [valueAttribute]="valueAttribute"
                [displayWith]="displayWith"
                [disabledWith]="disabledWith"
            />`,
    }),
};

export const PreselectedValue: Story = {
    args: { options: ['Default', 'Comfortable', 'Compact'], value: 'Comfortable' },
    render: (args) => ({
        props: args,
        template: `
            <ui-radio-group
                [orientation]="orientation"
                [disabled]="disabled"
                [options]="options"
                [value]="value"
            />`,
    }),
};
