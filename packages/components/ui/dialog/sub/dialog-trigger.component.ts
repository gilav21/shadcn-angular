import {
    Component,
    ChangeDetectionStrategy,
    inject,
} from '@angular/core';
import { DIALOG } from '../dialog.component';

@Component({
    selector: 'ui-dialog-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'dialog-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DialogTriggerComponent {
    private readonly dialog = inject(DIALOG, { optional: true });

    onClick() {
        this.dialog?.toggle();
    }
}
