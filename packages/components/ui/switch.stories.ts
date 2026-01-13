import { Meta, StoryObj } from '@storybook/angular';
import { SwitchComponent } from './switch.component';
import { moduleMetadata } from '@storybook/angular';
import { FormsModule } from '@angular/forms';
import { LabelComponent } from './label.component';

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
    },
    args: {
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<SwitchComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="flex items-center space-x-2">
        <ui-switch id="airplane-mode" [elementId]="'airplane-mode'" [disabled]="disabled" ariaLabel="Airplane Mode"></ui-switch>
        <ui-label for="airplane-mode">Airplane Mode</ui-label>
      </div>
    `,
    }),
};
