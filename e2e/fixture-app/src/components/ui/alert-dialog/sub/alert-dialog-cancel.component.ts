import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '@/components/lib/utils';
import { ALERT_DIALOG } from '../alert-dialog.component';

@Component({
    selector: 'ui-alert-dialog-cancel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      [class]="classes()"
      (click)="onClick()"
      [attr.data-slot]="'alert-dialog-cancel'"
    >
      <ng-content />
    </button>
  `,
    styleUrl: './alert-dialog-cancel.component.css',
    host: { class: 'contents' },
})
export class AlertDialogCancelComponent {
    private readonly alertDialog = inject(ALERT_DIALOG, { optional: true });
    class = input('');

    classes = computed(() =>
        cn(
            'inline-flex items-center justify-center rounded-md border border-input bg-background text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 mt-2 sm:mt-0',
            this.class()
        )
    );

    onClick(): void {
        this.alertDialog?.hide();
    }
}
