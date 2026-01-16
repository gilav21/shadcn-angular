import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    ElementRef,
    effect,
    ViewChild,
    AfterViewInit,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';

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
    open = signal(false);
    private openDelay = 200;
    private closeDelay = 300;
    private openTimeout?: ReturnType<typeof setTimeout>;
    private closeTimeout?: ReturnType<typeof setTimeout>;

    show() {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
        this.openTimeout = setTimeout(() => {
            this.open.set(true);
        }, this.openDelay);
    }

    hide() {
        if (this.openTimeout) {
            clearTimeout(this.openTimeout);
            this.openTimeout = undefined;
        }
        this.closeTimeout = setTimeout(() => {
            this.open.set(false);
        }, this.closeDelay);
    }

    cancelClose() {
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
    }
}

@Component({
    selector: 'ui-hover-card-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span 
      (mouseenter)="onMouseEnter()" 
      (mouseleave)="onMouseLeave()"
      (focus)="onMouseEnter()"
      (blur)="onMouseLeave()"
      [attr.data-slot]="'hover-card-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class HoverCardTriggerComponent {
    private hoverCard = inject(HoverCardComponent, { optional: true });

    onMouseEnter() {
        this.hoverCard?.show();
    }

    onMouseLeave() {
        this.hoverCard?.hide();
    }
}

@Component({
    selector: 'ui-hover-card-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (hoverCard?.open()) {
      <div
        #contentEl
        [class]="classes()"
        [style]="positionStyles()"
        [attr.data-state]="hoverCard?.open() ? 'open' : 'closed'"
        [attr.data-slot]="'hover-card-content'"
        (mouseenter)="onMouseEnter()"
        (mouseleave)="onMouseLeave()"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class HoverCardContentComponent implements AfterViewInit {
    hoverCard = inject(HoverCardComponent, { optional: true });
    private document = inject(DOCUMENT);

    class = input('');
    align = input<'start' | 'center' | 'end'>('center');
    side = input<'top' | 'bottom'>('bottom');

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private adjustedPosition = signal<{
        offsetX: number;
        offsetY: number;
        actualSide: 'top' | 'bottom';
    }>({ offsetX: 0, offsetY: 0, actualSide: 'bottom' });

    constructor() {
        effect(() => {
            if (this.hoverCard?.open()) {
                this.adjustedPosition.set({
                    offsetX: 0,
                    offsetY: 0,
                    actualSide: this.side(),
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
        if (this.hoverCard?.open()) {
            this.calculatePosition();
        }
    }

    private calculatePosition() {
        if (!this.contentEl?.nativeElement) return;

        const content = this.contentEl.nativeElement;
        const rect = content.getBoundingClientRect();
        const viewportWidth = this.document.defaultView?.innerWidth ?? 0;
        const viewportHeight = this.document.defaultView?.innerHeight ?? 0;

        let offsetX = 0;
        let offsetY = 0;
        let actualSide = this.side();

        if (rect.right > viewportWidth) {
            offsetX = viewportWidth - rect.right - 8;
        } else if (rect.left < 0) {
            offsetX = -rect.left + 8;
        }

        if (actualSide === 'bottom' && rect.bottom > viewportHeight) {
            actualSide = 'top';
        } else if (actualSide === 'top' && rect.top < 0) {
            actualSide = 'bottom';
        }

        this.adjustedPosition.set({ offsetX, offsetY, actualSide });
    }

    onMouseEnter() {
        this.hoverCard?.cancelClose();
    }

    onMouseLeave() {
        this.hoverCard?.hide();
    }

    positionStyles = computed(() => {
        const pos = this.adjustedPosition();
        return `transform: translateX(${pos.offsetX}px);`;
    });

    classes = computed(() => {
        const alignClasses = {
            start: 'left-0',
            center: 'left-1/2 -translate-x-1/2',
            end: 'right-0',
        };
        const pos = this.adjustedPosition();
        const sideClasses = {
            top: 'bottom-full mb-2',
            bottom: 'top-full mt-2',
        };

        return cn(
            'absolute z-50 w-64 max-w-[calc(100vw-16px)] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            'animate-in fade-in-0 zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            sideClasses[pos.actualSide],
            alignClasses[this.align()],
            this.class()
        );
    });
}
