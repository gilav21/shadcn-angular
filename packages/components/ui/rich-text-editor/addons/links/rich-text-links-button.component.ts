import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

    protected readonly icon: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(LINK_ICON);

    protected readonly interactionDisabled = computed(
        () => this.host.isDisabled() || this.host.readonly(),
    );

    protected readonly buttonClasses = computed(() => cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        this.toolbarView?.compact() ? 'p-1' : 'p-1.5',
    ));

    protected onOpenChange(next: boolean): void {
        if (next) {
            this.context.onOpen();
        }
        this.open.set(next);
    }

    protected onSubmit(payload: RichTextLinkSubmit): void {
        this.context.onSubmit(payload);
        this.open.set(false);
    }
}
