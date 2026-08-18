import {
    Component,
    ChangeDetectionStrategy,
    signal,
    inject,
    ElementRef,
    DestroyRef,
    NgZone,
} from '@angular/core';

@Component({
    selector: 'ui-hover-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'relative inline-block',
        '[attr.data-slot]': '"hover-card"',
    },
})
export class HoverCardComponent {
    readonly open = signal(false);
    readonly touchOpen = signal(false);
    private readonly openDelay = 200;
    private readonly closeDelay = 300;
    private openTimeout?: ReturnType<typeof setTimeout>;
    private closeTimeout?: ReturnType<typeof setTimeout>;
    private readonly el = inject(ElementRef<HTMLElement>);
    private readonly zone = inject(NgZone);
    private readonly destroyRef = inject(DestroyRef);
    private clickOutsideCleanup?: () => void;

    constructor() {
        this.destroyRef.onDestroy(() => {
            this.removeClickOutsideListener();
        });
    }

    /**
     * Schedules the card to open after a 200ms hover dwell, cancelling any
     * pending close first so moving between trigger and card does not flicker.
     * Pointer/keyboard path only — it does not arm the click-outside listener,
     * so use {@link toggle} for touch.
     */
    show(): void {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
        this.openTimeout = setTimeout(() => {
            this.open.set(true);
        }, this.openDelay);
    }

    /**
     * Schedules the card to close after a 300ms grace period — the window in
     * which the pointer can travel from the trigger onto the card, whose
     * mouseenter calls {@link cancelClose}. Cancels a pending open.
     */
    hide(): void {
        if (this.openTimeout) {
            clearTimeout(this.openTimeout);
            this.openTimeout = undefined;
        }
        this.closeTimeout = setTimeout(() => {
            this.open.set(false);
        }, this.closeDelay);
    }

    /**
     * Touch path: opens or closes immediately, with no delay. Opening also sets
     * `touchOpen` and registers a capture-phase click/touchend listener that
     * closes the card on the first interaction outside the host. The card never
     * traps focus and Escape is not handled.
     */
    toggle(): void {
        if (this.open()) {
            this.close();
        } else {
            this.openImmediate();
        }
    }

    /**
     * Aborts a pending {@link hide} so the card stays open. Called by
     * `ui-hover-card-content` on mouseenter — that is what lets the pointer move
     * onto the card without dismissing it.
     */
    cancelClose(): void {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
    }

    private openImmediate(): void {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
        this.open.set(true);
        this.touchOpen.set(true);
        this.addClickOutsideListener();
    }

    private close(): void {
        if (this.openTimeout) {
            clearTimeout(this.openTimeout);
            this.openTimeout = undefined;
        }
        this.open.set(false);
        this.touchOpen.set(false);
        this.removeClickOutsideListener();
    }

    private addClickOutsideListener(): void {
        this.removeClickOutsideListener();
        const handler = (event: MouseEvent | TouchEvent): void => {
            const target = event.target as Node;
            if (!this.el.nativeElement.contains(target)) {
                this.zone.run(() => this.close());
            }
        };
        globalThis.document?.addEventListener('click', handler, true);
        globalThis.document?.addEventListener('touchend', handler, true);
        this.clickOutsideCleanup = () => {
            globalThis.document?.removeEventListener('click', handler, true);
            globalThis.document?.removeEventListener('touchend', handler, true);
        };
    }

    private removeClickOutsideListener(): void {
        this.clickOutsideCleanup?.();
        this.clickOutsideCleanup = undefined;
    }
}
