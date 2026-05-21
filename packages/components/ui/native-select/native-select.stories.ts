import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { NativeSelectComponent } from './native-select.component';

const meta: Meta<NativeSelectComponent> = {
    title: 'UI/NativeSelect',
    component: NativeSelectComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [NativeSelectComponent],
        }),
    ],
    argTypes: {
        size: {
            control: 'select',
            options: ['default', 'sm'],
        },
        disabled: {
            control: 'boolean',
        },
        invalid: {
            control: 'boolean',
        },
    },
    args: {
        size: 'default',
        disabled: false,
        invalid: false,
    },
};

export default meta;
type Story = StoryObj<NativeSelectComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
            <ui-native-select [size]="size" [disabled]="disabled" [invalid]="invalid">
                <option value="">Select a fruit</option>
                <option value="apple">Apple</option>
                <option value="banana">Banana</option>
                <option value="cherry">Cherry</option>
                <option value="grape">Grape</option>
            </ui-native-select>
        `,
    }),
};

export const SmallSize: Story = {
    args: {
        size: 'sm',
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-native-select [size]="size">
                <option value="">Select a size</option>
                <option value="xs">Extra Small</option>
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
            </ui-native-select>
        `,
    }),
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-native-select [disabled]="disabled">
                <option value="">Disabled select</option>
                <option value="1">Option 1</option>
                <option value="2">Option 2</option>
            </ui-native-select>
        `,
    }),
};

export const Invalid: Story = {
    args: {
        invalid: true,
    },
    render: (args) => ({
        props: args,
        template: `
            <ui-native-select [invalid]="invalid">
                <option value="">Select a required field</option>
                <option value="1">Option 1</option>
                <option value="2">Option 2</option>
            </ui-native-select>
        `,
    }),
};

export const AllVariants: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col gap-4 max-w-xs">
                <div>
                    <label class="text-sm font-medium mb-1 block">Default</label>
                    <ui-native-select>
                        <option value="">Choose...</option>
                        <option value="1">Option 1</option>
                        <option value="2">Option 2</option>
                    </ui-native-select>
                </div>
                <div>
                    <label class="text-sm font-medium mb-1 block">Small</label>
                    <ui-native-select size="sm">
                        <option value="">Choose...</option>
                        <option value="1">Option 1</option>
                        <option value="2">Option 2</option>
                    </ui-native-select>
                </div>
                <div>
                    <label class="text-sm font-medium mb-1 block">Disabled</label>
                    <ui-native-select [disabled]="true">
                        <option value="">Disabled</option>
                    </ui-native-select>
                </div>
                <div>
                    <label class="text-sm font-medium mb-1 block">Invalid</label>
                    <ui-native-select [invalid]="true">
                        <option value="">Select required</option>
                        <option value="1">Option 1</option>
                    </ui-native-select>
                </div>
            </div>
        `,
    }),
};
