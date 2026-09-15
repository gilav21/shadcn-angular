import { ChangeDetectionStrategy, Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../../lib/utils';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';
import {
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
} from '../../../popover';
import { RichTextLinksFormComponent, type RichTextLinkSubmit } from './rich-text-links-form.component';
import { RICH_TEXT_LINKS_BUTTON_CONTEXT } from './rich-text-links.context';

const LINK_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

/**
 * The link toolbar button the links addon contributes as a component slot: a
 * standard toolbar button anchoring a popover with the shared link form. Reads
 * editor state through {@link RichTextEditorAddonHost} and its locale + seeded
 * text + submit callback through {@link RICH_TEXT_LINKS_BUTTON_CONTEXT}.
 */
@Component({
    selector: 'ui-rte-links-button',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        RichTextLinksFormComponent,
    ],
    templateUrl: './rich-text-links-button.component.html',
    host: { class: 'contents' },
})
export class RichTextLinksButtonComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly toolbarView = inject(RichTextToolbarViewContext, { optional: true });
    protected readonly context = inject(RICH_TEXT_LINKS_BUTTON_CONTEXT);

    protected readonly open = signal(false);
    /** Membership in the toolbar's single-open-panel group. */
    private readonly exclusive = this.host.registerExclusivePopover(() => this.open.set(false));

    constructor() {
        inject(DestroyRef).onDestroy(() => this.exclusive.release());
    }

    protected readonly icon: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(LINK_ICON);

    protected readonly interactionDisabled = computed(
        () => this.host.isDisabled() || this.host.readonly(),
    );

    protected readonly buttonClasses = computed(() => cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        // The global (pointer: coarse) floor targets `button:not([data-slot])`,
        // and these addon buttons carry a data-slot for testing — so they must
        // state the 44px touch minimum themselves rather than inherit it.
        'pointer-coarse:min-h-11 pointer-coarse:min-w-11',
        this.toolbarView?.compact() ? 'p-1' : 'p-1.5',
    ));

    protected onOpenChange(next: boolean): void {
        if (next) {
            this.exclusive.notifyOpened();
            this.context.onOpen();
        }
        this.open.set(next);
    }

    protected onRemove(): void {
        this.context.onRemove();
        this.open.set(false);
    }

    protected onSubmit(payload: RichTextLinkSubmit): void {
        this.context.onSubmit(payload);
        // Only close if the URL was accepted. Closing regardless discarded what
        // the user typed and looked exactly like a successful insert — the
        // Ctrl+K overlay already stays open on a rejection, and the two entry
        // points to the same feature must not disagree.
        if (!this.context.urlError()) this.open.set(false);
    }
}
