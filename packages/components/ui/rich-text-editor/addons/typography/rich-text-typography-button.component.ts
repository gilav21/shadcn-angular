import {
    Component,
    ChangeDetectionStrategy,
    computed,
    inject,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../../lib/utils';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';
import {
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
} from '../../../popover';
import { AutocompleteComponent } from '../../../autocomplete';
import { RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT } from './rich-text-typography.context';

const SIZE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/>' +
    '<line x1="12" x2="12" y1="4" y2="20"/></svg>';

const FAMILY_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 14h-5"/><path d="M21 18h-5"/><path d="M17 14v8"/><path d="m3 16 4-8 4 8"/>' +
    '<path d="M4.5 14h5"/></svg>';

/**
 * A typography toolbar button the typography addon contributes as a component
 * slot: a standard toolbar button anchoring a popover with an inline
 * `ui-autocomplete`. Reads editor state through {@link RichTextEditorAddonHost}
 * and its per-kind config + apply callback through
 * {@link RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT}.
 */
@Component({
    selector: 'ui-rte-typography-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
        AutocompleteComponent,
    ],
    templateUrl: './rich-text-typography-button.component.html',
    host: { class: 'contents' },
})
export class RichTextTypographyButtonComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly toolbarView = inject(RichTextToolbarViewContext, { optional: true });
    protected readonly context = inject(RICH_TEXT_TYPOGRAPHY_BUTTON_CONTEXT);

    protected readonly open = signal(false);

    protected readonly icon: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(
        this.context.kind === 'size' ? SIZE_ICON : FAMILY_ICON,
    );

    protected readonly panelClasses = this.context.kind === 'size' ? 'w-48' : 'w-56';

    protected readonly interactionDisabled = computed(
        () => this.host.disabled() || this.host.readonly(),
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

    /**
     * Forward a picked value to the addon. Gated on `open()` so a value the
     * autocomplete surfaces while the popover is closed never reaches the editor.
     */
    protected onValueChange(value: string): void {
        if (!this.open() || this.interactionDisabled()) return;
        this.context.onSelect(value);
    }
}
