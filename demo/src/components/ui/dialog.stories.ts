import { Meta, StoryObj } from '@storybook/angular';
import {
  DialogComponent,
  DialogTriggerComponent,
  DialogContentComponent,
  DialogHeaderComponent,
  DialogTitleComponent,
  DialogDescriptionComponent,
  DialogFooterComponent,
} from './dialog.component';
import { ButtonComponent } from './button.component';
import { InputComponent } from './input.component';
import { LabelComponent } from './label.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<DialogComponent & { rtl: boolean }> = {
  title: 'UI/Dialog',
  component: DialogComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        DialogComponent,
        DialogTriggerComponent,
        DialogContentComponent,
        DialogHeaderComponent,
        DialogTitleComponent,
        DialogDescriptionComponent,
        DialogFooterComponent,
        ButtonComponent,
        InputComponent,
        LabelComponent
      ],
    }),
  ],
  argTypes: {
    rtl: {
      control: 'boolean',
      description: 'Enable right-to-left layout',
    },
  },
  args: {
    rtl: false,
  },
};

export default meta;
type Story = StoryObj<DialogComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div [dir]="rtl ? 'rtl' : 'ltr'">
      <ui-dialog>
        <ui-dialog-trigger>
          <button shButton variant="outline">Edit Profile</button>
        </ui-dialog-trigger>
        <ui-dialog-content class="sm:max-w-[425px]">
          <ui-dialog-header>
            <ui-dialog-title>Edit profile</ui-dialog-title>
            <ui-dialog-description>
              Make changes to your profile here. Click save when you're done.
            </ui-dialog-description>
          </ui-dialog-header>
          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <ui-label for="name" class="text-right">Name</ui-label>
              <ui-input id="name" value="Pedro Duarte" class="col-span-3" />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <ui-label for="username" class="text-right">Username</ui-label>
              <ui-input id="username" value="@peduarte" class="col-span-3" />
            </div>
          </div>
          <ui-dialog-footer>
            <button shButton type="submit">Save changes</button>
          </ui-dialog-footer>
        </ui-dialog-content>
      </ui-dialog>
      </div>
    `,
  }),
};
