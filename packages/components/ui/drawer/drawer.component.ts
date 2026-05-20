import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
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
    'fixed z-50 flex flex-col bg-background',
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

    open = model(false);
    direction = input<DrawerDirection>('bottom');
    openChange = output<boolean>();

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

    ngOnDestroy() {
        this.unlockScroll();
    }

    private lockScroll() {
        const body = this.document.body;
        body.style.overflow = 'hidden';
        body.style.paddingRight = `${this.scrollbarWidth}px`;
    }

    private unlockScroll() {
        const body = this.document.body;
        body.style.overflow = '';
        body.style.paddingRight = '';
    }

    show() {
        this.open.set(true);
        this.openChange.emit(true);
    }

    hide() {
        this.open.set(false);
        this.openChange.emit(false);
    }

    toggle() {
        const newState = !this.open();
        this.open.set(newState);
        this.openChange.emit(newState);
    }
}
