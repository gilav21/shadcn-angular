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
import { COMMON_LOCALES, type CommonLocale, createLocaleBindings, type LocaleInput } from '../../../lib/i18n';
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
    readonly class = input('');
    readonly title = input<string>();
    readonly description = input<string>();

    /** Locale dictionary or registry key. Falls back to `UI_LOCALE_ID` when not set. */
    readonly locale = input<LocaleInput<CommonLocale>>();

    private readonly i18n = createLocaleBindings(this.locale, COMMON_LOCALES);
    protected readonly t = this.i18n.t;
    protected readonly dir = this.i18n.dir;

    readonly classes = computed(() =>
        cn(
            'fixed z-50 grid w-full max-w-[calc(100vw-2rem)] sm:max-w-lg gap-3 sm:gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 sm:rounded-lg',
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
                'button:not([disabled]), [href]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
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
