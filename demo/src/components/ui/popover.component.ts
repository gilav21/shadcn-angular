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
        [class]="classes()"
        [attr.data-state]="popover?.open() ? 'open' : 'closed'"
        [attr.data-slot]="'popover-content'"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class PopoverContentComponent {
    popover = inject(PopoverComponent, { optional: true });
    class = input('');
    align = input<'start' | 'center' | 'end'>('center');
    side = input<'top' | 'right' | 'bottom' | 'left'>('bottom');
    sideOffset = input(4);

    classes = computed(() => {
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
            'absolute z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            'animate-in fade-in-0 zoom-in-95',
            sideClasses[this.side()],
            this.side() === 'top' || this.side() === 'bottom' ? alignClasses[this.align()] : '',
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
