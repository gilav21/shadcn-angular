import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    inject,
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
    private alertDialog = inject(AlertDialogComponent, { optional: true });

    onClick() {
        this.alertDialog?.toggle();
    }
}

@Component({
    selector: 'ui-alert-dialog-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (alertDialog?.open()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Overlay - no click to close for alert dialogs -->
        <div class="fixed inset-0 bg-black/80 animate-in fade-in-0"></div>
        <!-- Content -->
        <div
          [class]="classes()"
          role="alertdialog"
          [attr.data-slot]="'alert-dialog-content'"
        >
          <ng-content />
        </div>
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class AlertDialogContentComponent {
    alertDialog = inject(AlertDialogComponent, { optional: true });
    class = input('');

    classes = computed(() =>
        cn(
            'fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
            this.class()
        )
    );
}

@Component({
    selector: 'ui-alert-dialog-header',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'flex flex-col space-y-2 text-center sm:text-left',
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
        class: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
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
    private alertDialog = inject(AlertDialogComponent, { optional: true });
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
    private alertDialog = inject(AlertDialogComponent, { optional: true });
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
