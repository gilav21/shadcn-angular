import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    inject,
    AfterViewInit,
    ElementRef,
    effect,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { ALERT_DIALOG } from '../alert-dialog.component';
import { AlertDialogHeaderComponent } from './alert-dialog-header.component';
import { AlertDialogTitleComponent } from './alert-dialog-title.component';
import { AlertDialogDescriptionComponent } from './alert-dialog-description.component';
import { AlertDialogFooterComponent } from './alert-dialog-footer.component';
import { AlertDialogActionComponent } from './alert-dialog-action.component';
import { AlertDialogCancelComponent } from './alert-dialog-cancel.component';

@Component({
    selector: 'ui-alert-dialog-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AlertDialogHeaderComponent,
        AlertDialogTitleComponent,
        AlertDialogDescriptionComponent,
        AlertDialogFooterComponent,
        AlertDialogActionComponent,
        AlertDialogCancelComponent,
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
    readonly alertDialog = inject(ALERT_DIALOG, { optional: true });
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
