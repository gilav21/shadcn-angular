import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    effect,
    model,
    AfterViewInit,
    ElementRef,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'contents' },
})
export class DialogComponent {
    open = model(false);

    show() {
        this.open.set(true);
    }

    hide() {
        this.open.set(false);
    }

    toggle() {
        this.open.update(v => !v);
    }
}

@Component({
    selector: 'ui-dialog-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'dialog-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DialogTriggerComponent {
    private dialog = inject(DialogComponent, { optional: true });

    onClick() {
        this.dialog?.toggle();
    }
}

@Component({
    selector: 'ui-dialog-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (dialog?.open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Overlay -->
        <div
          class="fixed inset-0 bg-black/80 animate-in fade-in-0"
          [attr.data-slot]="'dialog-overlay'"
          (click)="onOverlayClick()"
        ></div>
        <!-- Content -->
        <div
          #contentEl
          [class]="classes()"
          [attr.data-slot]="'dialog-content'"
          (keydown)="onKeydown($event)"
          tabindex="-1"
        >
          <ng-content />
          <!-- Close button -->
          <button
            type="button"
            class="absolute right-4 top-4 w-fit rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none rtl:left-4 rtl:right-auto"
            (click)="close()"
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
export class DialogContentComponent implements AfterViewInit {
    dialog = inject(DialogComponent, { optional: true });
    private el = inject(ElementRef);
    class = input('');

    classes = computed(() =>
        cn(
            'fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
            this.class()
        )
    );

    private contentEl?: HTMLElement;
    private previousActiveElement?: Element | null;

    constructor() {
        effect((onCleanup) => {
            if (this.dialog?.open()) {
                this.previousActiveElement = document.activeElement;
                document.body.style.overflow = 'hidden';
                setTimeout(() => this.focusFirstElement(), 0);
            } else {
                document.body.style.overflow = '';
                if (this.previousActiveElement instanceof HTMLElement) {
                    this.previousActiveElement.focus();
                }
            }

            onCleanup(() => {
                document.body.style.overflow = '';
            });
        });
    }

    ngAfterViewInit() {
        if (this.dialog?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement() {
        const content = this.el.nativeElement.querySelector('[data-slot="dialog-content"]');
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

    onOverlayClick() {
        this.dialog?.hide();
    }

    close() {
        this.dialog?.hide();
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
            return;
        }

        if (event.key === 'Tab' && this.contentEl) {
            const focusableElements = this.contentEl.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length === 0) return;

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
    selector: 'ui-dialog-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col space-y-1.5 text-center sm:text-left',
        '[attr.data-slot]': '"dialog-header"',
    },
})
export class DialogHeaderComponent { }

@Component({
    selector: 'ui-dialog-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-lg font-semibold leading-none tracking-tight flex justify-start',
        '[attr.data-slot]': '"dialog-title"',
    },
})
export class DialogTitleComponent { }

@Component({
    selector: 'ui-dialog-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-sm text-muted-foreground flex justify-start',
        '[attr.data-slot]': '"dialog-description"',
    },
})
export class DialogDescriptionComponent { }

@Component({
    selector: 'ui-dialog-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
        '[attr.data-slot]': '"dialog-footer"',
    },
})
export class DialogFooterComponent { }
