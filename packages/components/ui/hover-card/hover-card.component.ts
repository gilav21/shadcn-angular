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

    show(): void {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
        this.openTimeout = setTimeout(() => {
            this.open.set(true);
        }, this.openDelay);
    }

    hide(): void {
        if (this.openTimeout) {
            clearTimeout(this.openTimeout);
            this.openTimeout = undefined;
        }
        this.closeTimeout = setTimeout(() => {
            this.open.set(false);
        }, this.closeDelay);
    }

    toggle(): void {
        if (this.open()) {
            this.close();
        } else {
            this.openImmediate();
        }
    }

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
