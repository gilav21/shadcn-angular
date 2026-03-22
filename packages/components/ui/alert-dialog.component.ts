import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
    AfterViewInit,
    ElementRef,
    effect,
    forwardRef,
} from '@angular/core';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-alert-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'contents' },
})
export class AlertDialogComponent {
    open = signal(false);
    openChange = output<boolean>();

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
    selector: 'ui-alert-dialog-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick()" [attr.data-slot]="'alert-dialog-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class AlertDialogTriggerComponent {
    private readonly alertDialog = inject(AlertDialogComponent, { optional: true });

    onClick() {
        this.alertDialog?.toggle();
    }
}

@Component({
    selector: 'ui-alert-dialog-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        forwardRef(() => AlertDialogHeaderComponent),
        forwardRef(() => AlertDialogTitleComponent),
        forwardRef(() => AlertDialogDescriptionComponent),
        forwardRef(() => AlertDialogFooterComponent),
        forwardRef(() => AlertDialogActionComponent),
        forwardRef(() => AlertDialogCancelComponent),
    ],
    template: `
    @if (alertDialog?.open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        (keydown)="onKeydown($event)"
      >
        <!-- Overlay - no click to close for alert dialogs -->
        <div class="fixed inset-0 bg-black/80 animate-in fade-in-0"></div>
        <!-- Content -->
        <div
          #contentEl
          [class]="classes()"
          role="alertdialog"
          [attr.data-slot]="'alert-dialog-content'"
          tabindex="-1"
        >
          @if (title()) {
            <ui-alert-dialog-header>
              <ui-alert-dialog-title>{{ title() }}</ui-alert-dialog-title>
              @if (description()) {
                <ui-alert-dialog-description>{{ description() }}</ui-alert-dialog-description>
              }
            </ui-alert-dialog-header>
          }
          <ng-content />
          @if (title()) {
            <ui-alert-dialog-footer>
              <ui-alert-dialog-cancel (click)="cancelClick.emit()">{{ cancelText() }}</ui-alert-dialog-cancel>
              <ui-alert-dialog-action (click)="actionClick.emit()">{{ actionText() }}</ui-alert-dialog-action>
            </ui-alert-dialog-footer>
          }
        </div>
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class AlertDialogContentComponent implements AfterViewInit {
    readonly alertDialog = inject(AlertDialogComponent, { optional: true });
    private readonly el = inject(ElementRef);
    class = input('');
    title = input<string>();
    description = input<string>();
    actionText = input('Continue');
    cancelText = input('Cancel');
    actionClick = output<void>();
    cancelClick = output<void>();

    classes = computed(() =>
        cn(
            'fixed z-50 grid w-full max-w-[calc(100vw-2rem)] sm:max-w-lg gap-3 sm:gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 sm:rounded-lg',
            this.class()
        )
    );

    private contentEl?: HTMLElement;
    private previousActiveElement?: Element | null;

    constructor() {
        effect(() => {
            if (this.alertDialog?.open()) {
                this.previousActiveElement = document.activeElement;
                setTimeout(() => this.focusFirstElement(), 0);
            } else if (this.previousActiveElement instanceof HTMLElement) {
                this.previousActiveElement.focus();
            }
        });
    }

    ngAfterViewInit() {
        if (this.alertDialog?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement() {
        const content = this.el.nativeElement.querySelector('[data-slot="alert-dialog-content"]');
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
            this.alertDialog?.hide();
            return;
        }

        if (event.key === 'Tab' && this.contentEl) {
            const focusableElements = this.contentEl.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = Array.from(focusableElements).at(-1) as HTMLElement;

            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement?.focus();
                }
            } else if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement?.focus();
                }
        }
    }
}

@Component({
    selector: 'ui-alert-dialog-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col space-y-2 text-center sm:text-left rtl:text-right',
        '[attr.data-slot]': '"alert-dialog-header"',
    },
})
export class AlertDialogHeaderComponent { }

@Component({
    selector: 'ui-alert-dialog-title',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-lg font-semibold',
        '[attr.data-slot]': '"alert-dialog-title"',
    },
})
export class AlertDialogTitleComponent { }

@Component({
    selector: 'ui-alert-dialog-description',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'text-sm text-muted-foreground',
        '[attr.data-slot]': '"alert-dialog-description"',
    },
})
export class AlertDialogDescriptionComponent { }

@Component({
    selector: 'ui-alert-dialog-footer',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-[10px]',
        '[attr.data-slot]': '"alert-dialog-footer"',
    },
})
export class AlertDialogFooterComponent { }

@Component({
    selector: 'ui-alert-dialog-action',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      [class]="classes()"
      (click)="onClick()"
      [attr.data-slot]="'alert-dialog-action'"
    >
      <ng-content />
    </button>
  `,
    host: { class: 'contents' },
})
export class AlertDialogActionComponent {
    private readonly alertDialog = inject(AlertDialogComponent, { optional: true });
    class = input('');

    classes = computed(() =>
        cn(
            'inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
            this.class()
        )
    );

    onClick() {
        this.alertDialog?.hide();
    }
}

@Component({
    selector: 'ui-alert-dialog-cancel',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <button
      [class]="classes()"
      (click)="onClick()"
      [attr.data-slot]="'alert-dialog-cancel'"
    >
      <ng-content />
    </button>
  `,
    host: { class: 'contents' },
})
export class AlertDialogCancelComponent {
    private readonly alertDialog = inject(AlertDialogComponent, { optional: true });
    class = input('');

    classes = computed(() =>
        cn(
            'inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 mt-2 sm:mt-0',
            this.class()
        )
    );

    onClick() {
        this.alertDialog?.hide();
    }
}
