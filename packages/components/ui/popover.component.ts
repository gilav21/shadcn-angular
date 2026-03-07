import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    ElementRef,
    OnDestroy,
    AfterViewInit,
    effect,
    ViewChild,
    model,
    DestroyRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn, getClippingRect } from '../lib/utils';

type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
type PopoverAlign = 'start' | 'center' | 'end';

@Component({
    selector: 'ui-popover',
    changeDetection: ChangeDetectionStrategy.OnPush,
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

    registerPortal(el: HTMLElement | null) {
        this.portalEl = el;
    }

    private readonly clickListener = (event: MouseEvent) => {
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
                    const handler = (e: Event) => {
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

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
        this.removeScrollListener();
    }

    toggle() {
        const newState = !this.open();
        this.open.set(newState);
        this.openChange.emit(newState);
    }

    show() {
        this.open.set(true);
        this.openChange.emit(true);
    }

    hide() {
        this.open.set(false);
        this.openChange.emit(false);
    }

    getTriggerRect(): DOMRect | null {
        const trigger = this.el.nativeElement.querySelector('[data-slot="popover-trigger"]');
        return trigger?.getBoundingClientRect() ?? null;
    }
}

@Component({
    selector: 'ui-popover-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick($event)" [attr.data-slot]="'popover-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class PopoverTriggerComponent {
    private readonly popover = inject(PopoverComponent, { optional: true });

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.popover?.toggle();
    }
}

@Component({
    selector: 'ui-popover-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (popover?.open()) {
      <div
        #contentEl
        [class]="classes()"
        [style]="positionStyles()"
        [attr.data-state]="popover?.open() ? 'open' : 'closed'"
        [attr.data-slot]="'popover-content'"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class PopoverContentComponent implements AfterViewInit, OnDestroy {
    readonly popover = inject(PopoverComponent, { optional: true });
    private readonly document = inject(DOCUMENT);

    class = input('');
    align = input<PopoverAlign>('center');
    side = input<PopoverSide>('bottom');
    sideOffset = input(4);
    avoidCollisions = input(true);
    restoreFocus = input(true);
    strategy = input<'absolute' | 'fixed'>('absolute');

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private portalHost: HTMLElement | null = null;

    private readonly adjustedPosition = signal<{
        side: PopoverSide;
        align: PopoverAlign;
        offsetX: number;
        offsetY: number;
    }>({ side: 'bottom', align: 'center', offsetX: 0, offsetY: 0 });

    constructor() {
        effect(() => {
            if (this.popover?.open()) {
                this.adjustedPosition.set({
                    side: this.side(),
                    align: this.align(),
                    offsetX: 0,
                    offsetY: 0,
                });
                requestAnimationFrame(() => {
                    this.portalToBody();
                    requestAnimationFrame(() => {
                        this.calculatePosition();
                    });
                });
            } else {
                this.removePortal();
            }
        });
    }

    ngAfterViewInit() {
        this.portalToBody();
        this.calculatePosition();
    }

    ngOnDestroy() {
        this.removePortal();
    }

    private portalToBody() {
        if (this.strategy() !== 'fixed') return;
        const el = this.contentEl?.nativeElement;
        if (!el) return;
        if (!this.portalHost) {
            this.portalHost = this.document.createElement('div');
            this.portalHost.dataset['popoverPortal'] = 'true';
            this.portalHost.style.cssText = 'display:contents';
            this.document.body.appendChild(this.portalHost);
            this.popover?.registerPortal(this.portalHost);
        }
        this.portalHost.appendChild(el);
    }

    private removePortal() {
        this.popover?.registerPortal(null);
        this.portalHost?.remove();
        this.portalHost = null;
    }

    private calculatePosition() {
        if (this.strategy() === 'fixed' && this.contentEl?.nativeElement) {
            this.adjustFixedPosition(this.contentEl.nativeElement);
            return;
        }
        if (!this.avoidCollisions() || !this.contentEl?.nativeElement) {
            this.adjustedPosition.set({
                side: this.side(),
                align: this.align(),
                offsetX: 0,
                offsetY: 0,
            });
            return;
        }

        this.adjustCollisionPosition(this.contentEl.nativeElement);
    }

    private adjustFixedPosition(el: HTMLElement) {
        const rect = el.getBoundingClientRect();
        const vw = globalThis.window.innerWidth;
        const vh = globalThis.window.innerHeight;
        const needsHorizontalFix = rect.right > vw || rect.left < 0;
        const needsVerticalFix = rect.bottom > vh || rect.top < 0;

        if (needsHorizontalFix) {
            const clampedLeft = Math.max(8, Math.min(rect.left, vw - rect.width - 8));
            el.style.left = `${clampedLeft}px`;
            el.style.transform = 'none';
        }
        if (needsVerticalFix) {
            const clampedTop = Math.max(8, Math.min(rect.top, vh - rect.height - 8));
            el.style.top = `${clampedTop}px`;
        }
    }

    private adjustCollisionPosition(content: HTMLElement) {
        const contentRect = content.getBoundingClientRect();
        const boundary = getClippingRect(content);

        let adjustedSide = this.side();
        const adjustedAlign = this.align();
        let offsetX = 0;
        let offsetY = 0;

        if (contentRect.right > boundary.right) {
            offsetX = -(contentRect.right - boundary.right + 8);
        } else if (contentRect.left < boundary.left) {
            offsetX = boundary.left - contentRect.left + 8;
        }

        if (contentRect.bottom > boundary.bottom) {
            if (adjustedSide === 'bottom') {
                adjustedSide = 'top';
            } else {
                offsetY = -(contentRect.bottom - boundary.bottom + 8);
            }
        } else if (contentRect.top < boundary.top) {
            if (adjustedSide === 'top') {
                adjustedSide = 'bottom';
            } else {
                offsetY = boundary.top - contentRect.top + 8;
            }
        }

        this.adjustedPosition.set({
            side: adjustedSide,
            align: adjustedAlign,
            offsetX,
            offsetY,
        });
    }

    positionStyles = computed(() => {
        const pos = this.adjustedPosition();

        if (this.strategy() === 'fixed') {
            return this.computeFixedStyles(pos);
        }

        if (pos.offsetX !== 0) {
            return `transform: translateX(${pos.offsetX}px);`;
        }

        return '';
    });

    private computeFixedStyles(pos: { side: PopoverSide; align: PopoverAlign; offsetX: number; offsetY: number }): string {
        const triggerRect = this.popover?.getTriggerRect();
        if (!triggerRect) return '';

        const currentSide = this.avoidCollisions() ? pos.side : this.side();
        const currentAlign = this.avoidCollisions() ? pos.align : this.align();

        const top = currentSide === 'bottom' ? triggerRect.bottom + 4 : triggerRect.top - 4;
        let left = this.computeFixedLeft(currentAlign, triggerRect);

        left = Math.max(8, Math.min(left, globalThis.window.innerWidth - 8));
        const clampedTop = Math.max(8, Math.min(top, globalThis.window.innerHeight - 8));

        let styles = `position:fixed;top:${clampedTop}px;left:${left}px;`;
        if (currentAlign === 'center') {
            styles += 'transform:translateX(-50%);';
        } else if (currentAlign === 'end') {
            styles += 'transform:translateX(-100%);';
        }
        return styles;
    }

    private computeFixedLeft(align: PopoverAlign, triggerRect: DOMRect): number {
        if (align === 'start') return triggerRect.left;
        if (align === 'end') return triggerRect.right;
        return triggerRect.left + triggerRect.width / 2;
    }

    classes = computed(() => {
        const pos = this.adjustedPosition();
        const currentSide = this.avoidCollisions() ? pos.side : this.side();
        const currentAlign = this.avoidCollisions() ? pos.align : this.align();

        const alignClasses = {
            start: 'left-0',
            center: 'left-1/2 -translate-x-1/2',
            end: 'right-0',
        };
        const sideClasses = {
            top: 'bottom-full mb-1',
            bottom: 'top-full mt-1',
            left: 'right-full mr-1 top-0',
            right: 'left-full ml-1 top-0',
        };
        const isFixed = this.strategy() === 'fixed';
        return cn(
            isFixed ? 'z-50 w-72 max-w-[calc(100vw-16px)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none' :
            'absolute z-50 w-72 max-w-[calc(100vw-16px)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            'animate-in fade-in-0 zoom-in-95',
            !isFixed && sideClasses[currentSide],
            !isFixed && (currentSide === 'top' || currentSide === 'bottom') ? alignClasses[currentAlign] : '',
            this.class()
        );
    });
}

@Component({
    selector: 'ui-popover-close',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'popover-close'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class PopoverCloseComponent {
    private readonly popover = inject(PopoverComponent, { optional: true });

    onClick() {
        this.popover?.hide();
    }
}
