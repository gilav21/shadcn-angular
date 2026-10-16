import {
    Component,
    ChangeDetectionStrategy,
    model,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { bindOverlayLayer } from '../../lib/overlay-stack.service';

export const DIALOG = new InjectionToken<DialogComponent>('DIALOG');

@Component({
    selector: 'ui-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: DIALOG, useExisting: forwardRef(() => DialogComponent) }],
    template: `<ng-content />`,
    host: { class: 'contents', '[attr.data-slot]': '"dialog"' },
})
export class DialogComponent {
    /**
     * Two-way bound visibility. The projected `ui-dialog-content` only renders
     * its overlay and panel while this is `true`, so nothing inside the dialog
     * exists in the DOM when closed — bind it if you need to open the dialog
     * without a `ui-dialog-trigger`.
     */
    open = model(false);

    constructor() {
        // Modal: locks page scroll while open, and Escape reaches only the innermost layer.
        bindOverlayLayer(() => this.open(), { modal: true, dismiss: () => this.hide() });
    }

    /** Opens the dialog. Equivalent to setting {@link open} to `true`. */
    show(): void {
        this.open.set(true);
    }

    /**
     * Closes the dialog. Same path the Escape key, the backdrop click and the
     * corner close button take, so focus returns to the element that was
     * focused before opening.
     */
    hide(): void {
        this.open.set(false);
    }

    /** Flips {@link open}. This is what `ui-dialog-trigger` calls on activation. */
    toggle(): void {
        this.open.update(v => !v);
    }
}
