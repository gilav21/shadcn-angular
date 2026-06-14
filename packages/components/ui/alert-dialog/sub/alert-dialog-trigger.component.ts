import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { ALERT_DIALOG } from '../alert-dialog.component';

@Component({
    selector: 'ui-alert-dialog-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
      (click)="onClick()"
      (keydown.enter)="onClick()"
      (keydown.space)="onClick()"
      [attr.data-slot]="'alert-dialog-trigger'"
      tabindex="0"
      role="button"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class AlertDialogTriggerComponent {
    private readonly alertDialog = inject(ALERT_DIALOG, { optional: true });

    onClick(): void {
        this.alertDialog?.toggle();
    }
}
