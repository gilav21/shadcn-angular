import { Meta, StoryObj } from '@storybook/angular';
import {
    InputGroupComponent,
    InputGroupInputComponent,
    InputGroupAddonComponent,
    InputGroupTextComponent,
} from './input-group.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<InputGroupComponent> = {
    title: 'UI/InputGroup',
    component: InputGroupComponent,
    tags: ['autodocs'],
    decorators: [
        moduleMetadata({
            imports: [
                InputGroupComponent,
                InputGroupInputComponent,
                InputGroupAddonComponent,
                InputGroupTextComponent
            ],
        }),
    ],
    argTypes: {
        disabled: { control: 'boolean' },
    },
    args: {
        disabled: false,
    },
};

export default meta;
type Story = StoryObj<InputGroupComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="flex flex-col gap-4 w-[300px]">
        <ui-input-group [disabled]="disabled">
          <ui-input-group-addon>@</ui-input-group-addon>
          <ui-input-group-input placeholder="Username" />
        </ui-input-group>

        <ui-input-group [disabled]="disabled">
          <ui-input-group-input placeholder="Recipient's username" />
          <ui-input-group-addon>@example.com</ui-input-group-addon>
        </ui-input-group>

        <ui-input-group [disabled]="disabled">
          <ui-input-group-addon>$</ui-input-group-addon>
          <ui-input-group-input placeholder="Amount" type="number" />
          <ui-input-group-addon>.00</ui-input-group-addon>
        </ui-input-group>

         <ui-input-group [disabled]="disabled">
          <ui-input-group-addon>https://</ui-input-group-addon>
          <ui-input-group-input placeholder="example.com/users/" />
        </ui-input-group>
      </div>
    `,
    }),
};
