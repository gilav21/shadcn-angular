import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
    InputGroupComponent,
    InputGroupAddonComponent,
    InputGroupTextComponent,
} from './input-group.component';
import { InputComponent } from './input.component';

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
                InputGroupTextComponent
            ],
        }),
    ],
    argTypes: {
        disabled: { control: 'boolean' },
        variant: {
            control: 'select',
            options: ['outline', 'underline', 'ghost'],
        },
    },
    args: {
        disabled: false,
        variant: 'outline',
    },
};

export default meta;
type Story = StoryObj<InputGroupComponent>;

export const Default: Story = {
    render: (args) => ({
        props: args,
        template: `
      <div class="flex flex-col gap-4 w-[300px]">
        <ui-input-group [disabled]="disabled" [variant]="variant">
          <ui-input-group-addon>@</ui-input-group-addon>
          <ui-input placeholder="Username" />
        </ui-input-group>

        <ui-input-group [disabled]="disabled" [variant]="variant">
          <ui-input placeholder="Recipient's username" />
          <ui-input-group-addon>@example.com</ui-input-group-addon>
        </ui-input-group>

        <ui-input-group [disabled]="disabled" [variant]="variant">
          <ui-input-group-addon>$</ui-input-group-addon>
          <ui-input placeholder="Amount" type="number" />
          <ui-input-group-addon>.00</ui-input-group-addon>
        </ui-input-group>

         <ui-input-group [disabled]="disabled" [variant]="variant">
          <ui-input-group-addon>https://</ui-input-group-addon>
          <ui-input placeholder="example.com/users/" />
        </ui-input-group>
      </div>
    `,
    }),
};
