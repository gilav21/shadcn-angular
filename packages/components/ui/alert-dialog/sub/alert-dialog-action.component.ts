import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ALERT_DIALOG } from '../alert-dialog.component';

@Component({
    selector: 'ui-alert-dialog-action',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      [class]="classes()"
      (click)="onClick()"
      [attr.data-slot]="'alert-dialog-action'"
    >
      <ng-content />
    </button>
  `,
    styleUrl: './alert-dialog-action.component.css',
    host: { class: 'contents' },
})
export class AlertDialogActionComponent {
    private readonly alertDialog = inject(ALERT_DIALOG, { optional: true });
    /**
     * Extra classes merged onto the inner `<button>`, after the primary-button
     * defaults — pass e.g. `bg-destructive hover:bg-destructive/90` to style a
     * destructive confirmation.
     */
    class = input('');

    classes = computed(() =>
        cn(
            'inline-flex items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
            this.class()
        )
    );

    /**
     * Closes the owning `ui-alert-dialog` — the button always dismisses, so bind
     * your own `(click)` on this element for the confirm side effect rather than
     * calling `hide()` again.
     */
    onClick(): void {
        this.alertDialog?.hide();
    }
}
