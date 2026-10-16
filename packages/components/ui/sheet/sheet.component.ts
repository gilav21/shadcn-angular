import {
    Component,
    ChangeDetectionStrategy,
    output,
    signal,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { bindOverlayLayer } from '../../lib/overlay-stack.service';

export const sheetVariants = cva(
    'fixed z-50 gap-4 bg-background p-4 sm:p-6 shadow-lg transition ease-in-out overflow-y-auto',
    {
        variants: {
            side: {
                top: 'inset-x-0 top-0 border-b',
                bottom: 'inset-x-0 bottom-0 border-t',
                left: 'inset-y-0 ltr:left-0 rtl:right-0 h-full w-3/4 ltr:border-r rtl:border-l sm:max-w-sm',
                right: 'inset-y-0 ltr:right-0 rtl:left-0 h-full w-3/4 ltr:border-l rtl:border-r sm:max-w-sm',
            },
        },
        defaultVariants: {
            side: 'right',
        },
    }
);

export type SheetSide = VariantProps<typeof sheetVariants>['side'];

export const SHEET = new InjectionToken<SheetComponent>('SHEET');

@Component({
    selector: 'ui-sheet',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'contents', '[attr.data-slot]': '"sheet"' },
    providers: [
        { provide: SHEET, useExisting: forwardRef(() => SheetComponent) },
    ],
})
export class SheetComponent {

    open = signal(false);
    /**
     * Emits the new visibility whenever {@link show}, {@link hide} or
     * {@link toggle} runs. It is **not** emitted when `open` is set directly,
     * so drive the sheet through those methods (or a `ui-sheet-trigger`) if you
     * rely on this event.
     */
    openChange = output<boolean>();

    constructor() {
        // Modal: locks page scroll while open, and Escape reaches only the innermost layer.
        bindOverlayLayer(() => this.open(), { modal: true, dismiss: () => this.hide() });
    }

    /**
     * Opens the sheet and emits {@link openChange}. Locks body scroll and
     * compensates for the removed scrollbar with matching body padding, so the
     * page behind does not shift.
     */
    show(): void {
        this.open.set(true);
        this.openChange.emit(true);
    }

    /**
     * Closes the sheet, emits {@link openChange} and releases the body scroll
     * lock. Same path taken by Escape, a backdrop click, the corner close button
     * and `ui-sheet-close`.
     */
    hide(): void {
        this.open.set(false);
        this.openChange.emit(false);
    }

    /** Flips visibility and emits {@link openChange}. Used by `ui-sheet-trigger`. */
    toggle(): void {
        const newState = !this.open();
        this.open.set(newState);
        this.openChange.emit(newState);
    }
}
