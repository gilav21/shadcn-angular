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
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn, getClippingRect } from '../lib/utils';

@Component({
    selector: 'ui-popover',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'relative inline-block' },
})
export class PopoverComponent implements OnDestroy {
    private el = inject(ElementRef);
    private document = inject(DOCUMENT);

    open = model<boolean>(false);
    openChange = output<boolean>();

    private clickListener = (event: MouseEvent) => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.hide();
        }
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener);
    }

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
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
    private popover = inject(PopoverComponent, { optional: true });

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
export class PopoverContentComponent implements AfterViewInit {
    popover = inject(PopoverComponent, { optional: true });

    class = input('');
    align = input<'start' | 'center' | 'end'>('center');
    side = input<'top' | 'right' | 'bottom' | 'left'>('bottom');
    sideOffset = input(4);
    avoidCollisions = input(true);
    restoreFocus = input(true);
    strategy = input<'absolute' | 'fixed'>('absolute');

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private adjustedPosition = signal<{
        side: 'top' | 'right' | 'bottom' | 'left';
        align: 'start' | 'center' | 'end';
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
                    requestAnimationFrame(() => {
                        this.calculatePosition();
                    });
                });
            }
        });
    }

    ngAfterViewInit() {
        this.calculatePosition();
    }

    private calculatePosition() {
        if (this.strategy() === 'fixed' && this.contentEl?.nativeElement) {
            const el = this.contentEl.nativeElement;
            const rect = el.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                el.style.left = `${window.innerWidth - rect.width - 8}px`;
            }
            if (rect.bottom > window.innerHeight) {
                el.style.top = `${window.innerHeight - rect.height - 8}px`;
            }
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

        const content = this.contentEl.nativeElement;
        const contentRect = content.getBoundingClientRect();
        const boundary = getClippingRect(content);

        let adjustedSide = this.side();
        let adjustedAlign = this.align();
        let offsetX = 0;
        let offsetY = 0;

        if (contentRect.right > boundary.right) {
            const overflow = contentRect.right - boundary.right + 8;
            offsetX = -overflow;
        } else if (contentRect.left < boundary.left) {
            offsetX = boundary.left - contentRect.left + 8;
        }

        if (contentRect.bottom > boundary.bottom) {
            if (adjustedSide === 'bottom') {
                adjustedSide = 'top';
            } else {
                const overflow = contentRect.bottom - boundary.bottom + 8;
                offsetY = -overflow;
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
        let styles = '';

        if (this.strategy() === 'fixed') {
            const triggerRect = this.popover?.getTriggerRect();
            if (triggerRect) {
                const currentSide = this.avoidCollisions() ? pos.side : this.side();
                const currentAlign = this.avoidCollisions() ? pos.align : this.align();
                let top: number;
                let left: number;
                if (currentSide === 'bottom') {
                    top = triggerRect.bottom + 4;
                } else {
                    top = triggerRect.top - 4;
                }
                if (currentAlign === 'start') {
                    left = triggerRect.left;
                } else if (currentAlign === 'end') {
                    left = triggerRect.right;
                } else {
                    left = triggerRect.left + triggerRect.width / 2;
                }
                left = Math.max(8, Math.min(left, window.innerWidth - 8));
                top = Math.max(8, Math.min(top, window.innerHeight - 8));
                styles += `position:fixed;top:${top}px;left:${left}px;`;
                if (currentAlign === 'center') {
                    styles += 'transform:translateX(-50%);';
                } else if (currentAlign === 'end') {
                    styles += 'transform:translateX(-100%);';
                }
            }
            return styles;
        }

        if (pos.offsetX !== 0) {
            styles += `transform: translateX(${pos.offsetX}px);`;
        }

        return styles;
    });

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
    private popover = inject(PopoverComponent, { optional: true });

    onClick() {
        this.popover?.hide();
    }
}
