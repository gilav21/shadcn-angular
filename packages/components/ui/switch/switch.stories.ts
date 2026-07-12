import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SwitchComponent } from './switch.component';
import { FormsModule } from '@angular/forms';
import { LabelComponent } from '../label';

const meta: Meta<SwitchComponent> = {
    title: 'UI/Switch',
    component: SwitchComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [FormsModule, SwitchComponent, LabelComponent],
        }),
    ],
    argTypes: {
        disabled: {
            control: 'boolean',
            description: 'Disables interaction.',
        },
        label: {
            control: 'text',
            description: 'Inline label rendered next to the switch (simple mode).',
        },
        skeleton: {
            control: 'boolean',
            description: 'Renders a skeleton placeholder instead of the switch.',
        },
        checked: {
            control: 'boolean',
            description: 'Whether the switch is on.',
        },
        elementId: {
            control: 'text',
            description: 'Element id for the underlying button, used with a projected label.',
        },
        ariaLabel: {
            control: 'text',
            description: 'Accessible label when no visible label is present.',
        },
        ariaLabelledby: {
            control: 'text',
            description: 'Id of an element that labels the switch.',
        },
        class: { control: 'text', description: 'Extra classes merged onto the track.' },
    },
    args: {
        disabled: false,
        label: '',
        skeleton: false,
        checked: false,
        elementId: 'airplane-mode',
        ariaLabel: 'Airplane Mode',
        ariaLabelledby: undefined,
        class: '',
    },
};

export default meta;
type Story = StoryObj<SwitchComponent>;

const TEMPLATE = `
    <div class="flex items-center gap-2">
        <ui-switch
            [elementId]="elementId" [disabled]="disabled" [label]="label"
            [skeleton]="skeleton" [checked]="checked" [ariaLabel]="ariaLabel"
            [ariaLabelledby]="ariaLabelledby" [class]="class">
        </ui-switch>
        @if (!label) {
            <ui-label [for]="elementId">Airplane Mode</ui-label>
        }
    </div>`;

const render: NonNullable<Story['render']> = (args) => ({
    props: args,
    template: TEMPLATE,
});

/** Interactive playground — every input is wired to the Controls panel. */
export const Playground: Story = { render };

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="flex items-center gap-2">
        <ui-switch id="airplane-mode" [elementId]="'airplane-mode'" [disabled]="disabled" [label]="label" ariaLabel="Airplane Mode"></ui-switch>
        <ui-label for="airplane-mode">Airplane Mode</ui-label>
      </div>
    `,
    }),
};

export const WithInlineLabel: Story = {
    args: { label: 'Airplane Mode' },
    render,
};

export const Checked: Story = {
    args: { checked: true },
    render,
};

export const Disabled: Story = {
    args: { disabled: true },
    render,
};

export const Skeleton: Story = {
    args: { skeleton: true },
    render,
};
