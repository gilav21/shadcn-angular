import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  AlertDialogActionComponent,
  AlertDialogCancelComponent,
  AlertDialogComponent,
  AlertDialogContentComponent,
  AlertDialogDescriptionComponent,
  AlertDialogFooterComponent,
  AlertDialogHeaderComponent,
  AlertDialogTitleComponent,
  AlertDialogTriggerComponent,
  ButtonComponent,
} from '../../../../../packages/components/ui';

@Component({
  selector: 'app-alert-dialog-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertDialogActionComponent,
    AlertDialogCancelComponent,
    AlertDialogComponent,
    AlertDialogContentComponent,
    AlertDialogDescriptionComponent,
    AlertDialogFooterComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogTriggerComponent,
    ButtonComponent,
  ],
  template: `
    <section class="space-y-4">
      <h2 id="alert-dialog" class="text-2xl font-semibold scroll-m-20">Alert Dialog</h2>
      <p class="text-muted-foreground">
        A modal dialog that interrupts the user with important content.
      </p>

      <ui-alert-dialog #alertDialog>
        <ui-alert-dialog-trigger>
          <ui-button variant="outline">Show Alert Dialog</ui-button>
        </ui-alert-dialog-trigger>
        <ui-alert-dialog-content>
          <ui-alert-dialog-header>
            <ui-alert-dialog-title>Are you absolutely sure?</ui-alert-dialog-title>
            <ui-alert-dialog-description>
              This action cannot be undone. This will permanently delete your account and remove
              your data from our servers.
            </ui-alert-dialog-description>
          </ui-alert-dialog-header>
          <ui-alert-dialog-footer>
            <ui-alert-dialog-cancel>Cancel</ui-alert-dialog-cancel>
            <ui-alert-dialog-action>Continue</ui-alert-dialog-action>
          </ui-alert-dialog-footer>
        </ui-alert-dialog-content>
      </ui-alert-dialog>
    </section>
  `,
})
export class AlertDialogDemoComponent {}
