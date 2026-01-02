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
import { cva, type VariantProps } from 'class-variance-authority';

const sheetVariants = cva(
    'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out',
    {
        variants: {
            side: {
                top: 'inset-x-0 top-0 border-b',
                bottom: 'inset-x-0 bottom-0 border-t',
                left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
                right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
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
export class SheetComponent {
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
      <div class="fixed inset-0 z-50">
        <!-- Overlay -->
        <div
          class="fixed inset-0 bg-black/80 animate-in fade-in-0"
          (click)="onOverlayClick()"
        ></div>
        <!-- Content -->
        <div
          [class]="classes()"
          [attr.data-slot]="'sheet-content'"
        >
          <ng-content />
          <!-- Close button -->
          <button
            type="button"
            class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
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
export class SheetContentComponent {
    sheet = inject(SheetComponent, { optional: true });
    side = input<SheetSide>('right');
    class = input('');

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
        class: 'flex flex-col space-y-2 text-center sm:text-left',
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
        class: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
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
