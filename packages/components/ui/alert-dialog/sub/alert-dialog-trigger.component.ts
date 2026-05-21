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
    <span (click)="onClick()" [attr.data-slot]="'alert-dialog-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class AlertDialogTriggerComponent {
    private readonly alertDialog = inject(ALERT_DIALOG, { optional: true });

    onClick() {
        this.alertDialog?.toggle();
    }
}
