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

    /** Emits when the user accepts. Always followed by the dialog closing. */
    readonly confirmed = output<void>();
    /**
     * Emits on every non-accepting close — the Cancel button, Escape, or a
     * backdrop dismiss — so a caller can rely on exactly one of
     * {@link confirmed} / {@link cancelled} firing per open.
     */
    readonly cancelled = output<void>();

    private wasOpen = false;

    /**
     * Bridges dismissals that bypass the buttons. Escape (and any other route
     * that calls the alert dialog's own `hide()`) flips `open` to false without
     * going through {@link onCancel}, so a true → false transition is treated as
     * a cancel. {@link onConfirm} and {@link onCancel} clear `wasOpen` first, so
     * they never double-emit through this path.
     */
    constructor() {
        effect(() => {
            const isOpen = this.open();
            if (this.wasOpen && !isOpen) {
                this.cancelled.emit();
            }
            this.wasOpen = isOpen;
        });
    }

    /** Open the dialog. */
    show(): void {
        this.open.set(true);
    }

    /** Close the dialog without emitting an outcome. */
    hide(): void {
        this.open.set(false);
    }

    /** Accept: close and emit {@link confirmed}. */
    onConfirm(): void {
        this.wasOpen = false;
        this.open.set(false);
        this.confirmed.emit();
    }

    /** Reject: close and emit {@link cancelled}. */
    onCancel(): void {
        this.wasOpen = false;
        this.open.set(false);
        this.cancelled.emit();
    }
}
