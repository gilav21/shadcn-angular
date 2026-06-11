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
    <span
      tabindex="0"
      role="button"
      [attr.data-slot]="'dialog-trigger'"
      (click)="onClick()"
      (keydown.enter)="onClick()"
      (keydown.space)="onClick()"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DialogTriggerComponent {
    private readonly dialog = inject(DIALOG, { optional: true });

    onClick(): void {
        this.dialog?.toggle();
    }
}
