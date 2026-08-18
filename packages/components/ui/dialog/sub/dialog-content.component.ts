import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    effect,
    AfterViewInit,
    ElementRef,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
import { COMMON_LOCALES, type CommonLocale } from '../../../lib/i18n/common.locales';
import { DIALOG } from '../dialog.component';
import { DialogHeaderComponent } from './dialog-header.component';
import { DialogTitleComponent } from './dialog-title.component';
import { DialogDescriptionComponent } from './dialog-description.component';

@Component({
    selector: 'ui-dialog-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DialogHeaderComponent,
        DialogTitleComponent,
        DialogDescriptionComponent,
    ],
    templateUrl: './dialog-content.component.html',
    styleUrl: './dialog-content.component.css',
    host: { class: 'contents' },
})
export class DialogContentComponent implements AfterViewInit {
    readonly dialog = inject(DIALOG, { optional: true });
    private readonly el = inject(ElementRef);
    /**
     * Extra classes merged onto the centred panel (not the backdrop). Overrides
     * the default `max-w-[calc(100vw-2rem)] sm:max-w-lg` sizing when you pass a
     * width utility.
     */
    readonly class = input('');
    /**
     * Simple mode: renders a `ui-dialog-header`/`ui-dialog-title` above the
     * projected content. Leave unset and project your own header for full
     * control — {@link description} is only rendered when this is set too.
     */
    readonly title = input<string>();
    /** Simple-mode sub-heading. Only rendered when {@link title} is also set. */
    readonly description = input<string>();

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();

    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    readonly classes = computed(() =>
        cn(
            'fixed z-50 grid w-full max-w-[calc(100vw-2rem)] sm:max-w-lg border bg-background shadow-lg duration-200 sm:rounded-lg',
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

    ngAfterViewInit(): void {
        if (this.dialog?.open()) {
            this.focusFirstElement();
        }
    }

    private focusFirstElement(): void {
        const content = this.el.nativeElement.querySelector('[data-slot="dialog-content"]');
        if (content) {
            this.contentEl = content;
            const focusable = content.querySelector(
                'button:not([disabled]), [href]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
            ) as HTMLElement;
            if (focusable) {
                focusable.focus();
            } else {
                content.focus();
            }
        }
    }

    /**
     * Backdrop click handler — the dialog is dismissible by clicking outside.
     * Bound to the overlay button, so it never fires for clicks landing on the
     * panel itself.
     */
    onOverlayClick(): void {
        this.dialog?.hide();
    }

    /**
     * Closes the owning `ui-dialog`. Bound to the built-in corner close button
     * and reused by the Escape branch of {@link onKeydown}; a no-op when this
     * content is used outside a `ui-dialog`.
     */
    close(): void {
        this.dialog?.hide();
    }

    /**
     * Panel key handler: Escape closes, Tab/Shift+Tab wrap focus so it stays
     * trapped inside the panel. The panel renders in normal stacking context at
     * `z-50`, not the native top layer, so it can be covered by higher-z UI.
     */
    onKeydown(event: KeyboardEvent): void {
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
