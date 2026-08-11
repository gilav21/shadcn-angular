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

    /** Extra classes merged onto the panel. Keep a width constraint viewport-aware (`max-w-[calc(100vw-2rem)]`), since the panel is positioned, not laid out by its parent. */
    class = input('');
    /** Alignment along the chosen {@link side}'s edge: `'start'`, `'center'` or `'end'`. May be flipped at runtime when {@link avoidCollisions} is on. */
    align = input<PopoverAlign>('center');
    /** Preferred edge of the trigger to open from. Treated as a preference — collision handling can move the panel to the opposite side when there is no room. */
    side = input<PopoverSide>('bottom');
    /** Gap in pixels between the trigger and the panel, measured along {@link side}. */
    sideOffset = input(4);
    /** Lets the panel flip and shift to stay inside the nearest clipping rectangle. Turn it off to pin it strictly to {@link side} / {@link align}, accepting clipping. */
    avoidCollisions = input(true);
    /**
     * Returns focus to the trigger when the popover closes, so a keyboard user
     * carries on from where they opened it. Only applies when focus was still
     * inside the panel (or nowhere) at close time — dismissing the popover by
     * clicking or tabbing to something else leaves that new focus alone. Set
     * `false` to never move focus.
     */
    restoreFocus = input(true);
    /**
     * Positioning mode. `'absolute'` keeps the panel inside the popover's own
     * subtree — simplest, but it can be clipped by an `overflow: hidden`
     * ancestor. `'fixed'` portals the panel out and promotes it to the browser's
     * top layer via the native Popover API, so it renders above dialogs and any
     * z-index; the panel is kept hidden for the frame it takes to portal, to
     * avoid a flash at the wrong position.
     */
    strategy = input<'absolute' | 'fixed'>('absolute');

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private portalHost: HTMLElement | null = null;
    private usedPopoverApi = false;
    private wasOpen = false;
    public readonly portalReady = signal(false);

    /**
     * Trigger geometry captured on a settled frame. `positionStyles` reads this
     * signal so it recomputes once the surrounding layout (e.g. a dialog that is
     * still reflowing when the popover opens) has stabilised — reading the rect
     * imperatively would memoise a stale position.
     */
    private readonly triggerRectSig = signal<DOMRect | null>(null);

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
                    this.usedPopoverApi = false;
                }
                this.adjustedPosition.set({
                    side: this.side(),
                    align: this.align(),
                    offsetX: 0,
                    offsetY: 0,
                });
                requestAnimationFrame(() => this.portalAndPosition(0));
                this.wasOpen = true;
            } else {
                const shouldRestoreFocus = this.wasOpen && this.restoreFocus() && this.isFocusRestorable();
                this.wasOpen = false;
                this.portalReady.set(false);
                this.removeContent();
                if (shouldRestoreFocus) {
                    this.popover?.getTriggerFocusTarget()?.focus();
                }
            }
        });
    }

    /**
     * Whether closing should move focus back to the trigger. Restoring is only
     * right while focus is still inside the panel — or already lost to the body,
     * which is where it lands when the panel element is torn down. Focus that
     * has moved to another control belongs to the user, and stealing it back
     * would fight them.
     */
    private isFocusRestorable(): boolean {
        const active = this.document.activeElement;
        if (!active || active === this.document.body) return true;
        const el = this.contentEl?.nativeElement;
        return !!el && el.contains(active);
    }

    ngAfterViewInit(): void {
        const placed = this.placeContent();
        if (this.strategy() === 'fixed') {
            if (placed) this.finalizeFixedPosition();
            return;
        }
        this.calculatePosition();
    }

    private portalAndPosition(attempt: number): void {
        if (!this.popover?.open()) return;
        const placed = this.placeContent();
        if (!placed && this.strategy() === 'fixed' && attempt < 10) {
            requestAnimationFrame(() => this.portalAndPosition(attempt + 1));
            return;
        }
        if (this.strategy() === 'fixed') {
            if (placed) this.finalizeFixedPosition();
            else this.fallbackToPortal();
            return;
        }
        this.calculatePosition();
        this.portalReady.set(true);
    }

    /**
     * Position a fixed/top-layer popover once layout has settled. The trigger
     * rect is captured into a signal (so `positionStyles` recomputes with the
     * final geometry) across two frames — covering a dialog or toolbar that is
     * still reflowing when the popover opens — then a width-aware collision
     * adjustment runs and the content is revealed.
     */
    private finalizeFixedPosition(): void {
        if (!this.popover?.open()) return;
        this.triggerRectSig.set(this.popover.getTriggerRect());
        requestAnimationFrame(() => {
            if (!this.popover?.open()) return;
            this.triggerRectSig.set(this.popover.getTriggerRect());
            const el = this.contentEl?.nativeElement;
            if (el) this.adjustFixedPosition(el);
            this.portalReady.set(true);
        });
    }

    ngOnDestroy(): void {
        this.removeContent();
    }

    /**
     * Place a fixed popover so it renders above any modal. Prefers the native
     * Popover API, which promotes the element to the browser top layer — above a
     * native `<dialog>`, our `ui-dialog`, or a high z-index modal — regardless of
     * ancestor stacking contexts, while keeping the element in its DOM position
     * (so outside-click detection still works). Top-layer elements also resolve
     * `position:fixed` against the viewport, so the trigger-relative coordinates
     * stay correct even inside transformed/overflow ancestors. `showPopover`
     * throws on engines without the Popover API, so we fall back to a
     * `document.body` portal there.
     *
     * Returns `false` while the API exists but the element is not yet attached,
     * so the caller retries on the next frame. `showPopover` throws
     * `InvalidStateError` on a disconnected element, and treating that like an
     * unsupported engine would permanently downgrade a top-layer popover to the
     * portal whenever the open raced the element's attachment — silently losing
     * the above-any-modal guarantee. Only a genuine lack of the API falls back.
     */
    private placeContent(): boolean {
        if (this.strategy() !== 'fixed') return false;
        const el = this.contentEl?.nativeElement;
        if (!el) return false;
        if (this.usedPopoverApi) return true;
        if (typeof el.showPopover === 'function' && !el.isConnected) return false;
        try {
            el.setAttribute('popover', 'manual');
            el.showPopover();
            this.usedPopoverApi = true;
            return true;
        } catch {
            el.removeAttribute('popover');
        }
        return this.portalToBody();
    }

    /**
     * Last-resort placement once the retry budget is spent: the element never
     * attached, or the engine has no Popover API. Portals to `document.body` so
     * a fixed popover still escapes `overflow`/stacking ancestors, then runs the
     * normal fixed-position finalisation.
     */
    private fallbackToPortal(): void {
        if (this.portalToBody()) this.finalizeFixedPosition();
    }

    private removeContent(): void {
        const el = this.contentEl?.nativeElement;
        if (this.usedPopoverApi && el) {
            try {
                el.hidePopover();
            } catch {
                // The element may already be disconnected from the DOM — nothing to hide.
            }
            el.removeAttribute('popover');
        }
        this.usedPopoverApi = false;
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

    private removePortal(): void {
        this.popover?.registerPortal(null);
        this.portalHost?.remove();
        this.portalHost = null;
    }

    private calculatePosition(): void {
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

    private adjustFixedPosition(el: HTMLElement): void {
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

    private adjustCollisionPosition(content: HTMLElement): void {
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
        const triggerRect = this.triggerRectSig() ?? this.popover?.getTriggerRect();
        if (!triggerRect) return '';

        const currentSide = this.avoidCollisions() ? pos.side : this.side();
        const currentAlign = this.avoidCollisions() ? pos.align : this.align();

        const top = currentSide === 'bottom' ? triggerRect.bottom + 4 : triggerRect.top - 4;
        let left = this.computeFixedLeft(currentAlign, triggerRect);

        left = Math.max(8, Math.min(left, globalThis.window.innerWidth - 8));
        const clampedTop = Math.max(8, Math.min(top, globalThis.window.innerHeight - 8));

        // `inset:auto;margin:0;overflow:visible` neutralize the UA `[popover]`
        // defaults (centered via inset:0 + margin:auto, overflow:auto) so our
        // own fixed coordinates and layout apply when promoted to the top layer.
        let styles = `position:fixed;inset:auto;margin:0;overflow:visible;top:${clampedTop}px;left:${left}px;`;
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
            isFixed ? 'z-50 w-72 max-w-[calc(100vw-16px)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none' :
            'absolute z-50 w-72 max-w-[calc(100vw-16px)] rounded-md border bg-popover text-popover-foreground shadow-md outline-none',
            'animate-in fade-in-0 zoom-in-95',
            !isFixed && sideClasses[currentSide],
            !isFixed && (currentSide === 'top' || currentSide === 'bottom') ? alignClasses[currentAlign] : '',
            this.class()
        );
    });
}
