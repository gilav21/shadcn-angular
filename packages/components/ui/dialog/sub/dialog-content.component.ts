import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    effect,
    afterRenderEffect,
    signal,
    AfterViewInit,
    ElementRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../../lib/utils';
import { focusFirstTabbable, trapTabKey } from '../../../lib/a11y';
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
    private readonly document = inject(DOCUMENT);
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

    /**
     * `id` of this panel's own title, for `aria-labelledby`; null while it has none. The title is rendered
     * either from the `title` input or projected as a `<ui-dialog-title>`, so it is found in the DOM after
     * render and given an id, which covers both modes.
     */
    protected readonly titleId = signal<string | null>(null);
    /** `id` of this panel's own description, for `aria-describedby`; null while it has none. */
    protected readonly descriptionId = signal<string | null>(null);

    private static idSeq = 0;

    private contentEl?: HTMLElement;
    private previousActiveElement?: Element | null;

    constructor() {
        effect(() => {
            if (this.dialog?.open()) {
                this.previousActiveElement = this.document.activeElement;
                setTimeout(() => this.focusFirstElement(), 0);
            } else if (this.previousActiveElement instanceof HTMLElement) {
                this.previousActiveElement.focus();
            }
        });

        afterRenderEffect(() => {
            // The inputs are read so a title or description set after the dialog opened is picked up too.
            this.title();
            this.description();
            if (!this.dialog?.open()) return;
            const panel = this.el.nativeElement.querySelector('[data-slot="dialog-content"]') as HTMLElement | null;
            this.titleId.set(panel ? this.ownId(panel, 'dialog-title') : null);
            this.descriptionId.set(panel ? this.ownId(panel, 'dialog-description') : null);
        });
    }

    /**
     * The id of the `slot` element that belongs to `panel` itself, giving it one if it has none. A dialog
     * nested inside this one has a title of its own that this panel must never take as its name, so only
     * elements whose nearest panel is this one count.
     */
    private ownId(panel: HTMLElement, slot: string): string | null {
        const own = [...panel.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)].find(
            el => el.closest('[data-slot="dialog-content"]') === panel
        );
        if (!own) return null;
        own.id ||= `${slot}-${++DialogContentComponent.idSeq}`;
        return own.id;
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
            focusFirstTabbable(content);
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
     * and reused by the overlay stack on Escape; a no-op when this
     * content is used outside a `ui-dialog`.
     */
    close(): void {
        this.dialog?.hide();
    }

    /**
     * Panel key handler: Tab/Shift+Tab wrap focus so it stays
     * trapped inside the panel. The panel renders in normal stacking context at
     * `z-50`, not the native top layer, so it can be covered by higher-z UI.
     */
    onKeydown(event: KeyboardEvent): void {
        if (this.contentEl) trapTabKey(event, this.contentEl);
    }
}
