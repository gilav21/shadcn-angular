import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { InputGroupComponent } from './input-group.component';
import { InputGroupAddonComponent } from './sub/input-group-addon.component';
import { InputGroupTextComponent } from './sub/input-group-text.component';
import { InputGroupInputComponent } from './sub/input-group-input.component';
import { InputComponent } from '../input';

const meta: Meta<InputGroupComponent> = {
    title: 'UI/InputGroup',
    component: InputGroupComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                InputGroupComponent,
                InputComponent,
                InputGroupAddonComponent,
                InputGroupTextComponent,
                InputGroupInputComponent,
            ],
        }),
    ],
    argTypes: {
        disabled: { control: 'boolean', description: 'Disables the group and dims it.' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
            description: 'Visual style of the group.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the host.' },
    },
    args: {
        disabled: false,
        variant: 'outline',
        class: '',
    },
};

export default meta;
type Story = StoryObj<InputGroupComponent>;

const TEMPLATE = `
    <div class="flex flex-col gap-4 w-full sm:w-[300px]">
        <ui-input-group [disabled]="disabled" [variant]="variant" [class]="class">
            <ui-input-group-addon>@</ui-input-group-addon>
            <ui-input placeholder="Username" />
        </ui-input-group>

        <ui-input-group [disabled]="disabled" [variant]="variant" [class]="class">
            <ui-input placeholder="Recipient's username" />
            <ui-input-group-addon align="inline-end">@example.com</ui-input-group-addon>
        </ui-input-group>

        <ui-input-group [disabled]="disabled" [variant]="variant" [class]="class">
            <ui-input-group-addon>$</ui-input-group-addon>
            <ui-input placeholder="Amount" type="number" />
            <ui-input-group-addon align="inline-end">.00</ui-input-group-addon>
        </ui-input-group>

        <ui-input-group [disabled]="disabled" [variant]="variant" [class]="class">
            <ui-input-group-addon>https://</ui-input-group-addon>
            <ui-input placeholder="example.com/users/" />
        </ui-input-group>
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = { render };

export const Variants: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col gap-4 w-full sm:w-[300px]">
                <ui-input-group variant="outline">
                    <ui-input-group-addon>@</ui-input-group-addon>
                    <ui-input placeholder="Outline (default)" />
                </ui-input-group>
                <ui-input-group variant="underline">
                    <ui-input-group-addon>@</ui-input-group-addon>
                    <ui-input placeholder="Underline" />
                </ui-input-group>
                <ui-input-group variant="ghost">
                    <ui-input-group-addon>@</ui-input-group-addon>
                    <ui-input placeholder="Ghost" />
                </ui-input-group>
            </div>`,
    }),
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const AddonAlignment: Story = {
    render: () => ({
        template: `
            <div class="flex flex-col gap-4 w-full sm:w-[300px]">
                <ui-input-group>
                    <ui-input-group-addon align="inline-start">Start</ui-input-group-addon>
                    <ui-input placeholder="Addon before" />
                </ui-input-group>
                <ui-input-group>
                    <ui-input placeholder="Addon after" />
                    <ui-input-group-addon align="inline-end">End</ui-input-group-addon>
                </ui-input-group>
            </div>`,
    }),
};

export const AddonText: Story = {
    render: () => ({
        template: `
            <ui-input-group class="w-full sm:w-[300px]">
                <ui-input-group-addon>
                    <ui-input-group-text>USD</ui-input-group-text>
                </ui-input-group-addon>
                <ui-input placeholder="Amount" type="number" />
            </ui-input-group>`,
    }),
};

export const LegacyInputGroupInput: Story = {
    render: () => ({
        template: `
            <ui-input-group class="w-full sm:w-[300px]">
                <ui-input-group-addon>@</ui-input-group-addon>
                <ui-input-group-input placeholder="Legacy input-group-input" />
            </ui-input-group>`,
    }),
};
