import { Component, ChangeDetectionStrategy, output, signal, effect } from '@angular/core';
import { AlertDialogComponent, AlertDialogContentComponent } from '../alert-dialog';

@Component({
    selector: 'ui-confirm-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AlertDialogComponent, AlertDialogContentComponent],
    template: `
        <ui-alert-dialog [open]="open()">
            <ui-alert-dialog-content
                [title]="title()"
                [description]="description()"
                [actionText]="confirmLabel()"
                [cancelText]="cancelLabel()"
                (actionClick)="onConfirm()"
                (cancelClick)="onCancel()"
            />
        </ui-alert-dialog>
    `,
})
export class ConfirmDialogComponent {
    readonly open = signal(false);
    readonly title = signal('Confirm');
    readonly description = signal('Are you sure?');
    readonly confirmLabel = signal('Confirm');
    readonly cancelLabel = signal('Cancel');

    readonly confirmed = output<void>();
    readonly cancelled = output<void>();

    private wasOpen = false;

    constructor() {
        // Watch for Escape key closing the dialog via alertDialog.hide() directly,
        // which flips open to false without going through our onCancel/onConfirm paths.
        // We only react when open transitions from true → false externally.
        effect(() => {
            const isOpen = this.open();
            if (this.wasOpen && !isOpen) {
                this.cancelled.emit();
            }
            this.wasOpen = isOpen;
        });
    }

    show(): void {
        this.open.set(true);
    }

    hide(): void {
        this.open.set(false);
    }

    onConfirm(): void {
        this.wasOpen = false;
        this.open.set(false);
        this.confirmed.emit();
    }

    onCancel(): void {
        this.wasOpen = false;
        this.open.set(false);
        this.cancelled.emit();
    }
}
