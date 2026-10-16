import {
    Component,
    ChangeDetectionStrategy,
    model,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { bindOverlayLayer } from '../../lib/overlay-stack.service';

export const ALERT_DIALOG = new InjectionToken<AlertDialogComponent>('ALERT_DIALOG');

@Component({
    selector: 'ui-alert-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: ALERT_DIALOG, useExisting: forwardRef(() => AlertDialogComponent) }],
    template: `<ng-content />`,
    host: { class: 'contents', '[attr.data-slot]': '"alert-dialog"' },
})
export class AlertDialogComponent {
    /**
     * Two-way bound visibility. Nothing inside `ui-alert-dialog-content` exists
     * in the DOM while this is `false`. Unlike `ui-dialog`, clicking the
     * backdrop does not clear it — only Escape, the action/cancel buttons or
     * your own code can.
     */
    open = model(false);

    constructor() {
        // Modal: locks page scroll while open, and Escape reaches only the innermost layer.
        bindOverlayLayer(() => this.open(), { modal: true, dismiss: () => this.hide() });
    }

    /** Opens the alert dialog. Equivalent to setting {@link open} to `true`. */
    show(): void {
        this.open.set(true);
    }

    /**
     * Closes the alert dialog. Called by `ui-alert-dialog-action` and
     * `ui-alert-dialog-cancel` and by Escape; focus returns to whatever was
     * focused before opening.
     */
    hide(): void {
        this.open.set(false);
    }

    /** Flips {@link open}. This is what `ui-alert-dialog-trigger` calls on activation. */
    toggle(): void {
        this.open.update(v => !v);
    }
}
