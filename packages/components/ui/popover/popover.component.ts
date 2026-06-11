import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
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

    open = model<boolean>(false);
    closeOnScroll = input(false);
    openChange = output<boolean>();

    private portalEl: HTMLElement | null = null;

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

    toggle(): void {
        const newState = !this.open();
        this.open.set(newState);
        this.openChange.emit(newState);
    }

    show(): void {
        this.open.set(true);
        this.openChange.emit(true);
    }

    hide(): void {
        this.open.set(false);
        this.openChange.emit(false);
    }

    getTriggerRect(): DOMRect | null {
        const trigger = this.el.nativeElement.querySelector('[data-slot="popover-trigger"]');
        return trigger?.getBoundingClientRect() ?? null;
    }
}


