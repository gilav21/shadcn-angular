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
    afterRenderEffect,
    signal,
} from '@angular/core';
import { cn } from '@/components/lib/utils';
import { COMMON_LOCALES, type CommonLocale, createLocaleBindings, type LocaleInput } from '@/components/lib/i18n';
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
        [attr.dir]="dir()"
        (keydown)="onKeydown($event)"
        tabindex="-1"
      >
        <!-- Overlay - no click to close for alert dialogs -->
        <div class="fixed inset-0 bg-black/80 animate-in fade-in-0"></div>
        <!-- Content -->
        <div
          #contentEl
          [class]="classes()"
          role="alertdialog"
          [attr.data-slot]="'alert-dialog-content'"
          [attr.aria-labelledby]="titleId()"
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
              <ui-alert-dialog-cancel (click)="cancelClick.emit()">{{ cancelText() ?? t().cancel }}</ui-alert-dialog-cancel>
              <ui-alert-dialog-action (click)="actionClick.emit()">{{ actionText() ?? t().continue }}</ui-alert-dialog-action>
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
    readonly class = input('');
    readonly title = input<string>();
    readonly description = input<string>();

    /**
     * `id` of the element naming the dialog. `role="alertdialog"` requires an
     * accessible name (axe `aria-dialog-name`) and it must come from the author.
     * The title is rendered either from the `title` input or projected as a
     * `<ui-alert-dialog-title>`, so it is located in the DOM after render and
     * given an id to point `aria-labelledby` at — which covers both modes.
     */
    readonly titleId = signal<string | null>(null);

    /** Override for the action button text. When unset, falls back to the locale's `continue` string. */
    readonly actionText = input<string>();
    /** Override for the cancel button text. When unset, falls back to the locale's `cancel` string. */
    readonly cancelText = input<string>();

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();

    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    readonly actionClick = output<void>();
    readonly cancelClick = output<void>();

    readonly classes = computed(() =>
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

        afterRenderEffect(() => {
            if (!this.alertDialog?.open()) return;
            const host = this.el.nativeElement as HTMLElement;
            const titleEl = host.querySelector<HTMLElement>('[data-slot="alert-dialog-title"]');
            if (!titleEl) return;
            titleEl.id ||= `alert-dialog-title-${++AlertDialogContentComponent.titleSeq}`;
            this.titleId.set(titleEl.id);
        });
    }

    private static titleSeq = 0;

    ngAfterViewInit(): void {
        if (this.alertDialog?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement(): void {
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

    onKeydown(event: KeyboardEvent): void {
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
