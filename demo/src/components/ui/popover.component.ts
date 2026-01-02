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
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-popover',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'relative inline-block' },
})
export class PopoverComponent implements OnDestroy {
    private el = inject(ElementRef);
    private document = inject(DOCUMENT);

    open = signal(false);
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
    private document = inject(DOCUMENT);

    class = input('');
    align = input<'start' | 'center' | 'end'>('center');
    side = input<'top' | 'right' | 'bottom' | 'left'>('bottom');
    sideOffset = input(4);
    avoidCollisions = input(true);

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    // Computed position adjustments
    private adjustedPosition = signal<{
        side: 'top' | 'right' | 'bottom' | 'left';
        align: 'start' | 'center' | 'end';
        offsetX: number;
        offsetY: number;
    }>({ side: 'bottom', align: 'center', offsetX: 0, offsetY: 0 });

    constructor() {
        // Recalculate position when opened
        effect(() => {
            if (this.popover?.open()) {
                // Reset offset first
                this.adjustedPosition.set({
                    side: this.side(),
                    align: this.align(),
                    offsetX: 0,
                    offsetY: 0,
                });
                // Wait for two frames: one to apply reset, one to measure
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
        const viewportWidth = this.document.defaultView?.innerWidth ?? 0;
        const viewportHeight = this.document.defaultView?.innerHeight ?? 0;

        let adjustedSide = this.side();
        let adjustedAlign = this.align();
        let offsetX = 0;
        let offsetY = 0;

        // Check horizontal bounds
        if (contentRect.right > viewportWidth) {
            // Content goes off right edge
            const overflow = contentRect.right - viewportWidth + 8; // 8px padding
            offsetX = -overflow;
        } else if (contentRect.left < 0) {
            // Content goes off left edge
            offsetX = -contentRect.left + 8;
        }

        // Check vertical bounds
        if (contentRect.bottom > viewportHeight) {
            // Content goes off bottom edge - flip to top if there's room
            if (adjustedSide === 'bottom') {
                adjustedSide = 'top';
            } else {
                const overflow = contentRect.bottom - viewportHeight + 8;
                offsetY = -overflow;
            }
        } else if (contentRect.top < 0) {
            // Content goes off top edge - flip to bottom if there's room
            if (adjustedSide === 'top') {
                adjustedSide = 'bottom';
            } else {
                offsetY = -contentRect.top + 8;
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
        return cn(
            'absolute z-50 w-72 max-w-[calc(100vw-16px)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            'animate-in fade-in-0 zoom-in-95',
            sideClasses[currentSide],
            currentSide === 'top' || currentSide === 'bottom' ? alignClasses[currentAlign] : '',
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
