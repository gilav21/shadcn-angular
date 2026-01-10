import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    OnDestroy,
    effect,
    ElementRef,
    AfterViewInit,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const drawerVariants = cva(
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

@Component({
    selector: 'ui-drawer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'contents',
        '[attr.data-slot]': '"drawer"',
    },
})
export class DrawerComponent implements OnDestroy {
    private document = inject(DOCUMENT);

    open = signal(false);
    direction = input<DrawerDirection>('bottom');
    rtl = input(false);
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
    selector: 'ui-drawer-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'drawer-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DrawerTriggerComponent {
    private drawer = inject(DrawerComponent, { optional: true });

    onClick() {
        this.drawer?.toggle();
    }
}

@Component({
    selector: 'ui-drawer-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (drawer?.open()) {
      <div 
        class="fixed inset-0 z-50" 
        role="dialog" 
        aria-modal="true"
        [dir]="drawer?.rtl() ? 'rtl' : 'ltr'"
        (keydown)="onKeydown($event)"
      >
        <!-- Overlay -->
        <div
          class="fixed inset-0 bg-black/50 animate-in fade-in-0"
          [attr.data-slot]="'drawer-overlay'"
          (click)="onOverlayClick()"
          aria-hidden="true"
        ></div>
        <!-- Content -->
        <div
          #contentEl
          [class]="classes()"
          [attr.data-slot]="'drawer-content'"
          [attr.data-state]="'open'"
          [attr.data-vaul-drawer-direction]="direction()"
          tabindex="-1"
        >
          <!-- Handle for bottom/top drawers -->
          @if (direction() === 'bottom' || direction() === 'top') {
            <div class="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted"></div>
          }
          <ng-content />
        </div>
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class DrawerContentComponent implements AfterViewInit {
    drawer = inject(DrawerComponent, { optional: true });
    private el = inject(ElementRef);
    class = input('');

    private contentEl?: HTMLElement;
    private previousActiveElement?: Element | null;

    constructor() {
        effect(() => {
            if (this.drawer?.open()) {
                this.previousActiveElement = document.activeElement;
                setTimeout(() => this.focusFirstElement(), 0);
            } else if (this.previousActiveElement instanceof HTMLElement) {
                this.previousActiveElement.focus();
            }
        });
    }

    ngAfterViewInit() {
        if (this.drawer?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement() {
        const content = this.el.nativeElement.querySelector('[data-slot="drawer-content"]');
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

    direction = computed(() => this.drawer?.direction() ?? 'bottom');

    classes = computed(() => cn(
        drawerVariants({ direction: this.direction() }),
        this.class()
    ));

    onOverlayClick() {
        this.drawer?.hide();
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.drawer?.hide();
            return;
        }

        // Focus trap
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
}

@Component({
    selector: 'ui-drawer-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"drawer-header"',
    },
})
export class DrawerHeaderComponent {
    class = input('');

    classes = computed(() => cn(
        'flex flex-col gap-1.5 p-4 text-center sm:ltr:text-left sm:rtl:text-right',
        this.class()
    ));
}

@Component({
    selector: 'ui-drawer-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-foreground font-semibold',
        '[attr.data-slot]': '"drawer-title"',
    },
})
export class DrawerTitleComponent { }

@Component({
    selector: 'ui-drawer-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-muted-foreground text-sm',
        '[attr.data-slot]': '"drawer-description"',
    },
})
export class DrawerDescriptionComponent { }

@Component({
    selector: 'ui-drawer-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"drawer-footer"',
    },
})
export class DrawerFooterComponent {
    class = input('');

    classes = computed(() => cn('mt-auto flex flex-col gap-2 p-4', this.class()));
}

@Component({
    selector: 'ui-drawer-close',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'drawer-close'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DrawerCloseComponent {
    private drawer = inject(DrawerComponent, { optional: true });

    onClick() {
        this.drawer?.hide();
    }
}
