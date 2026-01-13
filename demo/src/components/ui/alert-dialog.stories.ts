import { Meta, StoryObj } from '@storybook/angular';
import {
  AlertDialogComponent,
  AlertDialogTriggerComponent,
  AlertDialogContentComponent,
  AlertDialogHeaderComponent,
  AlertDialogFooterComponent,
  AlertDialogTitleComponent,
  AlertDialogDescriptionComponent,
  AlertDialogActionComponent,
  AlertDialogCancelComponent,
} from './alert-dialog.component';
import { ButtonComponent } from './button.component';
import { moduleMetadata } from '@storybook/angular';

const meta: Meta<AlertDialogComponent> = {
  title: 'UI/AlertDialog',
  component: AlertDialogComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [
        AlertDialogComponent,
        AlertDialogTriggerComponent,
        AlertDialogContentComponent,
        AlertDialogHeaderComponent,
        AlertDialogFooterComponent,
        AlertDialogTitleComponent,
        AlertDialogDescriptionComponent,
        AlertDialogActionComponent,
        AlertDialogCancelComponent,
        ButtonComponent
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<AlertDialogComponent>;

export const Default: Story = {
  render: () => ({
    template: `
      <ui-alert-dialog>
        <ui-alert-dialog-trigger>
          <ui-button variant="outline">Show Dialog</ui-button>
        </ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-header>
            <ui-alert-dialog-title>Are you absolutely sure?</ui-alert-dialog-title>
            <ui-alert-dialog-description>
              This action cannot be undone. This will permanently delete your account and remove your data from our servers.
            </ui-alert-dialog-description>
          </ui-alert-dialog-header>
          <ui-alert-dialog-footer>
            <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
            <ui-alert-dialog-action>Continue</ui-alert-dialog-action>
          </ui-alert-dialog-footer>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    `,
  }),
};
