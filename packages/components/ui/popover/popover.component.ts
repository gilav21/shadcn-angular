import {
    Component,
    ChangeDetectionStrategy,
    input,
    inject,
    ElementRef,
    InjectionToken,
    forwardRef,
    OnDestroy,
    effect,
    model,
    DestroyRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
export type PopoverAlign = 'start' | 'center' | 'end';

export const POPOVER = new InjectionToken<PopoverComponent>('POPOVER');

@Component({
    selector: 'ui-popover',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: POPOVER, useExisting: forwardRef(() => PopoverComponent) }],
    template: `<ng-content />`,
    host: { class: 'relative inline-block' },
})
export class PopoverComponent implements OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Two-way open state, shared with the trigger and content through DI. Clicking
     * outside the popover (and outside its portal) closes it and writes `false`
     * back, so a consumer binding stays in sync with user dismissals.
     */
    open = model<boolean>(false);
    /**
     * Dismisses the popover when anything outside it scrolls, in any ancestor
     * (the listener is registered in the capture phase). Off by default because
     * the content follows the trigger anyway; turn it on inside long scrolling
     * pages where a detached panel would look wrong.
     */
    closeOnScroll = input(false);

    private portalEl: HTMLElement | null = null;

    /**
     * Called by the content component to declare the element it renders into when
     * it escapes the host's DOM subtree. Clicks and scrolls inside that element
     * are then treated as "inside" the popover and do not dismiss it. Pass `null`
     * to unregister.
     */
    registerPortal(el: HTMLElement | null): void {
        this.portalEl = el;
    }

    private readonly clickListener = (event: MouseEvent): void => {
        const target = event.target as Node;
        if (this.el.nativeElement.contains(target)) return;
        if (this.portalEl?.contains(target)) return;
        this.hide();
    };

    private scrollCleanup: (() => void) | null = null;

    constructor() {
        this.document.addEventListener('click', this.clickListener);

        effect(() => {
            const isOpen = this.open();
            const shouldClose = this.closeOnScroll();

            this.removeScrollListener();

            if (isOpen && shouldClose) {
                setTimeout(() => {
                    const el = this.el.nativeElement;
                    const handler = (e: Event): void => {
                        if (!(e.target instanceof Node)) return;
                        if (el.contains(e.target)) return;
                        if (this.portalEl?.contains(e.target)) return;
                        this.hide();
                    };
                    globalThis.window.addEventListener('scroll', handler, { capture: true, passive: true });
                    this.scrollCleanup = () => globalThis.window.removeEventListener('scroll', handler, { capture: true });
                }, 0);
            }
        });

        this.destroyRef.onDestroy(() => this.removeScrollListener());
    }

    private removeScrollListener(): void {
        if (this.scrollCleanup) {
            this.scrollCleanup();
            this.scrollCleanup = null;
        }
    }

    ngOnDestroy(): void {
        this.document.removeEventListener('click', this.clickListener);
        this.removeScrollListener();
    }

    /** Flips the open state. This is what the trigger calls, and the usual entry point for a custom trigger of your own. */
    toggle(): void {
        const newState = !this.open();
        this.open.set(newState);
    }

    /** Opens the popover programmatically — e.g. on focus or after an async action. Idempotent. */
    show(): void {
        this.open.set(true);
    }

    /** Closes the popover. Also called internally on an outside click, on Escape, and by `ui-popover-close`. */
    hide(): void {
        this.open.set(false);
    }

    /**
     * Live viewport rectangle of the trigger element, which the content uses as
     * its positioning anchor. Returns `null` when no `data-slot="popover-trigger"`
     * element is present — the content then has nothing to anchor to.
     */
    getTriggerRect(): DOMRect | null {
        const trigger = this.el.nativeElement.querySelector('[data-slot="popover-trigger"]');
        return trigger?.getBoundingClientRect() ?? null;
    }
}


