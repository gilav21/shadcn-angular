/**
 * @title Confirm before you destroy
 * @summary A destructive action that asks first, keeps focus, and reports the outcome with a toast.
 * @components button, alert-dialog, toast
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonComponent } from '@/components/ui/button';
import {
    AlertDialogComponent,
    AlertDialogActionComponent,
    AlertDialogCancelComponent,
    AlertDialogContentComponent,
    AlertDialogDescriptionComponent,
    AlertDialogFooterComponent,
    AlertDialogHeaderComponent,
    AlertDialogTitleComponent,
    AlertDialogTriggerComponent,
} from '@/components/ui/alert-dialog';
import { ToastService, ToasterComponent } from '@/components/ui/toast';

/**
 * The pattern behind every "Delete" button worth shipping.
 *
 * `ui-alert-dialog` is deliberately not a confirm() replacement: it traps
 * focus, restores it to the trigger on dismiss, and gives the destructive
 * action its own button so screen readers announce it. Pair it with a toast so
 * the outcome is visible without a page change.
 */
@Component({
    selector: 'app-confirm-before-destroy',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ButtonComponent,
        AlertDialogComponent,
        AlertDialogActionComponent,
        AlertDialogCancelComponent,
        AlertDialogContentComponent,
        AlertDialogDescriptionComponent,
        AlertDialogFooterComponent,
        AlertDialogHeaderComponent,
        AlertDialogTitleComponent,
        AlertDialogTriggerComponent,
        ToasterComponent,
    ],
    template: `
    <ui-toaster />
    <ui-alert-dialog>
      <ui-alert-dialog-trigger>
        <ui-button variant="destructive" data-testid="delete">Delete project</ui-button>
      </ui-alert-dialog-trigger>
      <ui-alert-dialog-content>
        <ui-alert-dialog-header>
          <ui-alert-dialog-title>Delete this project?</ui-alert-dialog-title>
          <ui-alert-dialog-description>
            This removes the project and its {{ fileCount() }} files. It cannot be undone.
          </ui-alert-dialog-description>
        </ui-alert-dialog-header>
        <ui-alert-dialog-footer>
          <ui-alert-dialog-cancel>Keep it</ui-alert-dialog-cancel>
          <ui-alert-dialog-action (click)="destroy()" data-testid="confirm">
            Delete
          </ui-alert-dialog-action>
        </ui-alert-dialog-footer>
      </ui-alert-dialog-content>
    </ui-alert-dialog>
  `,
})
export class ConfirmBeforeDestroyComponent {
    protected readonly fileCount = signal(128);
    private readonly toast = inject(ToastService);

    protected destroy(): void {
        this.toast.success('Project deleted', 'You can restore it for 30 days.');
    }
}
