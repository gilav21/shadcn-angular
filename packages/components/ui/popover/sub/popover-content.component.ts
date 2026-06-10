import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    AfterViewInit,
    OnDestroy,
    effect,
    ViewChild,
    ElementRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn, getClippingRect } from '../../../lib/utils';
import { POPOVER } from '../popover.component';

type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
type PopoverAlign = 'start' | 'center' | 'end';

@Component({
    selector: 'ui-popover-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrl: './popover-content.component.css',
    template: `
    @if (popover?.open()) {
      <div
        #contentEl
        [class]="classes()"
        [style]="positionStyles()"
        [style.visibility]="strategy() === 'fixed' && !portalReady() ? 'hidden' : null"
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
    readonly popover = inject(POPOVER, { optional: true });
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
    public readonly portalReady = signal(false);

    private readonly adjustedPosition = signal<{
        side: PopoverSide;
        align: PopoverAlign;
        offsetX: number;
        offsetY: number;
    }>({ side: 'bottom', align: 'center', offsetX: 0, offsetY: 0 });

    constructor() {
        effect(() => {
            if (this.popover?.open()) {
                if (this.strategy() === 'fixed') {
                    this.portalReady.set(false);
                }
                this.adjustedPosition.set({
                    side: this.side(),
                    align: this.align(),
                    offsetX: 0,
                    offsetY: 0,
                });
                requestAnimationFrame(() => this.portalAndPosition(0));
            } else {
                this.portalReady.set(false);
                this.removePortal();
            }
        });
    }

    ngAfterViewInit() {
        const portaled = this.portalToBody();
        this.calculatePosition();
        if (portaled) {
            this.portalReady.set(true);
        }
    }

    private portalAndPosition(attempt: number) {
        if (!this.popover?.open()) return;
        const portaled = this.portalToBody();
        if (!portaled && this.strategy() === 'fixed' && attempt < 10) {
            requestAnimationFrame(() => this.portalAndPosition(attempt + 1));
            return;
        }
        this.calculatePosition();
        if (this.strategy() !== 'fixed' || portaled) {
            this.portalReady.set(true);
        }
    }

    ngOnDestroy() {
        this.removePortal();
    }

    private portalToBody(): boolean {
        if (this.strategy() !== 'fixed') return false;
        const el = this.contentEl?.nativeElement;
        if (!el) return false;
        if (!this.portalHost) {
            this.portalHost = this.document.createElement('div');
            this.portalHost.dataset['popoverPortal'] = 'true';
            this.portalHost.style.cssText = 'display:contents';
            this.document.body.appendChild(this.portalHost);
            this.popover?.registerPortal(this.portalHost);
        }
        this.portalHost.appendChild(el);
        return true;
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

        const offsetX = this.computeHorizontalOffset(contentRect, boundary);
        const { side, offsetY } = this.computeVerticalAdjustment(contentRect, boundary);

        this.adjustedPosition.set({
            side,
            align: this.align(),
            offsetX,
            offsetY,
        });
    }

    private computeHorizontalOffset(contentRect: DOMRect, boundary: { left: number; right: number }): number {
        if (contentRect.right > boundary.right) {
            return -(contentRect.right - boundary.right + 8);
        }
        if (contentRect.left < boundary.left) {
            return boundary.left - contentRect.left + 8;
        }
        return 0;
    }

    private computeVerticalAdjustment(
        contentRect: DOMRect,
        boundary: { top: number; bottom: number }
    ): { side: PopoverSide; offsetY: number } {
        const overflowBottom = contentRect.bottom - boundary.bottom;
        const overflowTop = boundary.top - contentRect.top;
        const currentSide = this.side();

        if (overflowBottom > 0) {
            return this.resolveVerticalOverflow(currentSide, 'bottom', 'top', overflowBottom, contentRect.height, boundary);
        }
        if (overflowTop > 0) {
            return this.resolveVerticalOverflow(currentSide, 'top', 'bottom', -overflowTop, contentRect.height, boundary);
        }
        return { side: currentSide, offsetY: 0 };
    }

    private resolveVerticalOverflow(
        currentSide: PopoverSide,
        overflowSide: PopoverSide,
        flipSide: PopoverSide,
        overflow: number,
        contentHeight: number,
        boundary: { top: number; bottom: number }
    ): { side: PopoverSide; offsetY: number } {
        if (currentSide !== overflowSide) {
            return { side: currentSide, offsetY: -(overflow + 8) };
        }
        const triggerRect = this.popover?.getTriggerRect();
        const availableSpace = this.getAvailableSpace(flipSide, triggerRect, boundary);

        if (availableSpace >= contentHeight) {
            return { side: flipSide, offsetY: 0 };
        }
        return { side: currentSide, offsetY: -(overflow + 8) };
    }

    private getAvailableSpace(
        flipSide: PopoverSide,
        triggerRect: DOMRect | null | undefined,
        boundary: { top: number; bottom: number }
    ): number {
        if (!triggerRect) return 0;
        if (flipSide === 'top') return triggerRect.top - boundary.top;
        return boundary.bottom - triggerRect.bottom;
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
            left: 'right-full me-1 top-0',
            right: 'left-full ms-1 top-0',
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
