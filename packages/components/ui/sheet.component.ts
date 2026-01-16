import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    effect,
    ElementRef,
    AfterViewInit,
    OnDestroy,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const sheetVariants = cva(
    'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out',
    {
        variants: {
            side: {
                top: 'inset-x-0 top-0 border-b',
                bottom: 'inset-x-0 bottom-0 border-t',
                left: 'inset-y-0 ltr:left-0 rtl:right-0 h-full w-3/4 ltr:border-r rtl:border-l sm:max-w-sm',
                right: 'inset-y-0 ltr:right-0 rtl:left-0 h-full w-3/4 ltr:border-l rtl:border-r sm:max-w-sm',
            },
        },
        defaultVariants: {
            side: 'right',
        },
    }
);

export type SheetSide = VariantProps<typeof sheetVariants>['side'];

@Component({
    selector: 'ui-sheet',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'contents' },
})
export class SheetComponent implements OnDestroy {
    private document = inject(DOCUMENT);

    open = signal(false);
    openChange = output<boolean>();

    private scrollbarWidth = 0;

    constructor() {
        this.scrollbarWidth = window.innerWidth - this.document.documentElement.clientWidth;

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

@Component({
    selector: 'ui-sheet-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'sheet-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class SheetTriggerComponent {
    private sheet = inject(SheetComponent, { optional: true });

    onClick() {
        this.sheet?.toggle();
    }
}

@Component({
    selector: 'ui-sheet-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (sheet?.open()) {
      <div 
        class="fixed inset-0 z-50" 
        role="dialog" 
        aria-modal="true"
        (keydown)="onKeydown($event)"
      >
        <div
          class="fixed inset-0 bg-black/50 animate-in fade-in-0"
          [attr.data-slot]="'sheet-overlay'"
          (click)="onOverlayClick()"
          aria-hidden="true"
        ></div>
        <div
          #contentEl
          [class]="classes()"
          [attr.data-slot]="'sheet-content'"
          [attr.data-state]="'open'"
          tabindex="-1"
        >
          <ng-content />
          <button
            type="button"
            class="absolute ltr:right-4 rtl:left-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            (click)="close()"
            aria-label="Close"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span class="sr-only">Close</span>
          </button>
        </div>
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class SheetContentComponent implements AfterViewInit {
    sheet = inject(SheetComponent, { optional: true });
    private el = inject(ElementRef);

    side = input<SheetSide>('right');
    class = input('');

    private contentEl?: HTMLElement;
    private previousActiveElement?: Element | null;

    constructor() {
        effect(() => {
            if (this.sheet?.open()) {
                this.previousActiveElement = document.activeElement;
                setTimeout(() => this.focusFirstElement(), 0);
            } else if (this.previousActiveElement instanceof HTMLElement) {
                this.previousActiveElement.focus();
            }
        });
    }

    ngAfterViewInit() {
        if (this.sheet?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement() {
        const content = this.el.nativeElement.querySelector('[data-slot="sheet-content"]');
        if (content) {
            this.contentEl = content;
            const focusable = content.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            ) as HTMLElement;
            if (focusable) {
                focusable.focus();
            } else {
                content.focus();
            }
        }
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.sheet?.hide();
            return;
        }

        if (event.key === 'Tab' && this.contentEl) {
            const focusableElements = this.contentEl.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement?.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement?.focus();
                }
            }
        }
    }

    classes = computed(() =>
        cn(sheetVariants({ side: this.side() }), this.class())
    );

    onOverlayClick() {
        this.sheet?.hide();
    }

    close() {
        this.sheet?.hide();
    }
}

@Component({
    selector: 'ui-sheet-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col space-y-2 text-center sm:ltr:text-left sm:rtl:text-right',
        '[attr.data-slot]': '"sheet-header"',
    },
})
export class SheetHeaderComponent { }

@Component({
    selector: 'ui-sheet-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-lg font-semibold text-foreground',
        '[attr.data-slot]': '"sheet-title"',
    },
})
export class SheetTitleComponent { }

@Component({
    selector: 'ui-sheet-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-sm text-muted-foreground',
        '[attr.data-slot]': '"sheet-description"',
    },
})
export class SheetDescriptionComponent { }

@Component({
    selector: 'ui-sheet-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:ltr:space-x-2 sm:rtl:space-x-reverse',
        '[attr.data-slot]': '"sheet-footer"',
    },
})
export class SheetFooterComponent { }

@Component({
    selector: 'ui-sheet-close',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'sheet-close'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class SheetCloseComponent {
    private sheet = inject(SheetComponent, { optional: true });

    onClick() {
        this.sheet?.hide();
    }
}
