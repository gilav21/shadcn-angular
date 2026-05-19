import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SwitchComponent } from './switch.component';
import { FormsModule } from '@angular/forms';
import { LabelComponent } from './label';

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
        },
        label: {
            control: 'text',
        },
    },
    args: {
        disabled: false,
        label: '',
    },
};

export default meta;
type Story = StoryObj<SwitchComponent>;

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
