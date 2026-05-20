import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    input,
    signal,
    ViewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn, getClippingRect } from '../../../lib/utils';
import { SELECT } from '../select.component';

@Component({
    selector: 'ui-select-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (select?.open()) {
      <div
        #contentEl
        [class]="classes()"
        [style]="positionStyles()"
        role="listbox"
        tabindex="-1"
        [attr.data-slot]="'select-content'"
        [attr.data-position]="position()"
        (keydown)="onKeydown($event)">
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class SelectContentComponent implements AfterViewInit {
    readonly select = inject(SELECT, { optional: true });
    private readonly el = inject(ElementRef);
    private readonly document = inject(DOCUMENT);

    class = input('');
    position = input<'popper' | 'item-aligned'>('item-aligned');
    side = input<'top' | 'bottom'>('bottom');

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private readonly offsetY = signal(0);
    private readonly effectivePosition = signal<'popper' | 'item-aligned'>('item-aligned');
    private readonly effectiveSide = signal<'top' | 'bottom'>('bottom');
    private previousActiveElement: HTMLElement | null = null;

    constructor() {
        effect(() => {
            if (this.select?.open()) {
                this.previousActiveElement = this.document.activeElement as HTMLElement;

                setTimeout(() => {
                    this.calculatePosition();
                    this.focusContent();
                }, 0);
            } else {
                if (this.previousActiveElement && this.document.body.contains(this.previousActiveElement)) {
                    this.previousActiveElement.focus();
                }
                this.previousActiveElement = null;
                this.effectivePosition.set(this.select?.position() ?? this.position());
                this.effectiveSide.set(this.side());
            }
        });
    }

    ngAfterViewInit() {
        if (this.select?.open()) {
            this.calculatePosition();
            this.focusContent();
        }
    }

    private calculatePosition() {
        const requestedPos = this.select?.position() ?? this.position();
        const contentEl = this.contentEl?.nativeElement;

        if (requestedPos === 'item-aligned' && contentEl) {
            const selectedOffset = this.select?.getSelectedItemOffset() ?? 0;
            const triggerEl = this.select?.getTriggerElement();

            if (triggerEl) {
                const triggerRect = triggerEl.getBoundingClientRect();
                const contentHeight = contentEl.scrollHeight;
                const boundary = getClippingRect(contentEl);
                const viewportPadding = 8;

                const proposedTop = triggerRect.top - selectedOffset - 4;
                const proposedBottom = proposedTop + contentHeight;

                const wouldOverflowTop = proposedTop < boundary.top + viewportPadding;
                const wouldOverflowBottom = proposedBottom > boundary.bottom - viewportPadding;

                if (wouldOverflowTop || wouldOverflowBottom) {
                    this.effectivePosition.set('popper');
                    this.offsetY.set(0);
                    this.resolvePopperSide(triggerRect, contentHeight, boundary, viewportPadding);
                } else {
                    this.effectivePosition.set('item-aligned');
                    this.offsetY.set(-(selectedOffset + 4));
                    this.effectiveSide.set('bottom');
                }
            } else {
                this.effectivePosition.set('item-aligned');
                this.offsetY.set(-(selectedOffset + 4));
                this.effectiveSide.set('bottom');
            }
        } else {
            this.effectivePosition.set('popper');
            this.offsetY.set(0);
            const triggerEl = this.select?.getTriggerElement();
            if (contentEl && triggerEl) {
                const triggerRect = triggerEl.getBoundingClientRect();
                const contentHeight = contentEl.scrollHeight;
                const boundary = getClippingRect(contentEl);
                this.resolvePopperSide(triggerRect, contentHeight, boundary, 8);
            } else {
                this.effectiveSide.set(this.side());
            }
        }
    }

    private resolvePopperSide(
        triggerRect: DOMRect,
        contentHeight: number,
        boundary: DOMRect,
        padding: number,
    ) {
        const preferredSide = this.side();
        const spaceBelow = boundary.bottom - triggerRect.bottom - padding;
        const spaceAbove = triggerRect.top - boundary.top - padding;

        if (preferredSide === 'top') {
            this.effectiveSide.set(contentHeight <= spaceAbove || spaceAbove >= spaceBelow ? 'top' : 'bottom');
        } else {
            this.effectiveSide.set(contentHeight <= spaceBelow || spaceBelow >= spaceAbove ? 'bottom' : 'top');
        }
    }

    private focusContent() {
        if (!this.contentEl?.nativeElement) return;

        const content = this.contentEl.nativeElement;
        const selectedItem = content.querySelector<HTMLElement>('[data-state="checked"]');

        if (selectedItem) {
            selectedItem.focus({ preventScroll: true });
        } else {
            content.focus({ preventScroll: true });
        }
    }

    onKeydown(event: KeyboardEvent) {
        if (!this.contentEl?.nativeElement) return;

        const items = Array.from(this.contentEl.nativeElement.querySelectorAll<HTMLElement>('[data-slot="select-item"]:not([data-disabled])'));

        if (!items.length) return;

        const currentFocus = this.document.activeElement as HTMLElement;
        const currentIndex = items.indexOf(currentFocus);

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = (currentIndex + 1) % items.length;
            items[nextIndex]?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const prevIndex = (currentIndex - 1 + items.length) % items.length;
            items[prevIndex]?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
            if (currentIndex >= 0) {
                items[currentIndex].click();
                event.preventDefault();
            }
        }
    }

    positionStyles = computed(() => {
        const pos = this.effectivePosition();
        if (pos === 'item-aligned') {
            const offset = this.offsetY();
            return `top: ${offset}px; margin-top: 0;`;
        }
        return '';
    });

    classes = computed(() => {
        const pos = this.effectivePosition();
        const isItemAligned = pos === 'item-aligned';
        const side = this.effectiveSide();

        const popperSideClass = side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1';

        return cn(
            'absolute z-50 max-h-96 min-w-[8rem] w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            'animate-in fade-in-0 zoom-in-95',
            isItemAligned ? 'top-0' : popperSideClass,
            'ltr:left-0 rtl:right-0',
            this.class()
        );
    });
}
