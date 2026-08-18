import {
    Component,
    ChangeDetectionStrategy,
    input,
    inject,
    OnDestroy,
    effect,
    model,
    InjectionToken,
    forwardRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cva, type VariantProps } from 'class-variance-authority';

export const drawerVariants = cva(
    'fixed z-50 flex flex-col bg-background overflow-y-auto',
    {
        variants: {
            direction: {
                top: 'inset-x-0 top-0 mb-24 max-h-[80vh] rounded-b-lg border-b',
                bottom: 'inset-x-0 bottom-0 mt-24 max-h-[80vh] rounded-t-lg border-t',
                left: 'inset-y-0 ltr:left-0 rtl:right-0 h-full w-3/4 ltr:border-r rtl:border-l sm:max-w-sm',
                right: 'inset-y-0 ltr:right-0 rtl:left-0 h-full w-3/4 ltr:border-l rtl:border-r sm:max-w-sm',
            },
        },
        defaultVariants: {
            direction: 'bottom',
        },
    }
);

export type DrawerDirection = VariantProps<typeof drawerVariants>['direction'];

export const DRAWER = new InjectionToken<DrawerComponent>('DRAWER');

@Component({
    selector: 'ui-drawer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: DRAWER, useExisting: forwardRef(() => DrawerComponent) }],
    template: `<ng-content />`,
    host: {
        class: 'contents',
        '[attr.data-slot]': '"drawer"',
    },
})
export class DrawerComponent implements OnDestroy {
    private readonly document = inject(DOCUMENT);

    /**
     * Two-way bound visibility. While `true` the body is scroll-locked (with
     * padding compensating for the hidden scrollbar) and `ui-drawer-content`
     * renders; nothing inside the drawer exists in the DOM when closed.
     */
    open = model(false);
    /**
     * Edge the drawer slides in from, read by `ui-drawer-content` (set it here,
     * not on the content). `bottom`/`top` cap at `max-h-[80vh]` and get the
     * drag-handle bar; `left`/`right` are full-height, 75% wide capped at
     * `sm:max-w-sm`, and mirror automatically in RTL.
     */
    direction = input<DrawerDirection>('bottom');

    private readonly scrollbarWidth: number = 0;

    constructor() {
        this.scrollbarWidth = globalThis.window.innerWidth - this.document.documentElement.clientWidth;

        effect(() => {
            if (this.open()) {
                this.lockScroll();
            } else {
                this.unlockScroll();
            }
        });
    }

    ngOnDestroy(): void {
        this.unlockScroll();
    }

    private lockScroll(): void {
        const body = this.document.body;
        body.style.overflow = 'hidden';
        body.style.paddingRight = `${this.scrollbarWidth}px`;
    }

    private unlockScroll(): void {
        const body = this.document.body;
        body.style.overflow = '';
        body.style.paddingRight = '';
    }

    /** Opens the drawer and locks body scroll. Equivalent to setting {@link open} to `true`. */
    show(): void {
        this.open.set(true);
    }

    /**
     * Closes the drawer and releases the body scroll lock. Same path taken by
     * Escape, a backdrop click and `ui-drawer-close`; focus returns to whatever
     * was focused before opening.
     */
    hide(): void {
        this.open.set(false);
    }

    /** Flips {@link open}. This is what `ui-drawer-trigger` calls on activation. */
    toggle(): void {
        const newState = !this.open();
        this.open.set(newState);
    }
}
