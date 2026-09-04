import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../../lib/utils';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';
import { RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT } from './rich-text-file-import.context';

const IMPORT_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>' +
    '<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>';

/**
 * The import toolbar button the file-import addon contributes as a component
 * slot: a standard toolbar button that opens a hidden file picker restricted to
 * the addon's accepted types. Reads editor state through
 * {@link RichTextEditorAddonHost} and its locale + import callback through
 * {@link RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT}; the directive performs the parse
 * and insert.
 */
@Component({
    selector: 'ui-rte-file-import-button',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-file-import-button.component.html',
    host: { class: 'contents' },
})
export class RichTextFileImportButtonComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly toolbarView = inject(RichTextToolbarViewContext, { optional: true });
    protected readonly context = inject(RICH_TEXT_FILE_IMPORT_BUTTON_CONTEXT);

    protected readonly icon: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(IMPORT_ICON);

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

    protected onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (this.interactionDisabled() || !file) return;
        this.context.onImport(file);
    }
}
