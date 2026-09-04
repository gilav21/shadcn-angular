import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../../lib/utils';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';
import { ButtonComponent } from '../../../button';
import {
    PopoverComponent,
    PopoverTriggerComponent,
    PopoverContentComponent,
} from '../../../popover';
import { RICH_TEXT_IMAGES_BUTTON_CONTEXT } from './rich-text-images.context';

const IMAGE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/>' +
    '<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';

/**
 * The image toolbar button the images addon contributes as a component slot: a
 * standard toolbar button anchoring a popover with a URL/alt form and, when the
 * configured sources allow it, a file picker. Reads editor state through
 * {@link RichTextEditorAddonHost} and its locale + callbacks through
 * {@link RICH_TEXT_IMAGES_BUTTON_CONTEXT}; the directive performs the insert.
 */
@Component({
    selector: 'ui-rte-images-button',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ButtonComponent,
        PopoverComponent,
        PopoverTriggerComponent,
        PopoverContentComponent,
    ],
    templateUrl: './rich-text-images-button.component.html',
    host: { class: 'contents' },
})
export class RichTextImagesButtonComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly toolbarView = inject(RichTextToolbarViewContext, { optional: true });
    protected readonly context = inject(RICH_TEXT_IMAGES_BUTTON_CONTEXT);

    protected readonly open = signal(false);
    protected readonly icon: SafeHtml = this.domSanitizer.bypassSecurityTrustHtml(IMAGE_ICON);

    protected readonly locale = computed(() => this.context.locale());
    protected readonly showUrl = computed(() => this.context.sources() !== 'upload');
    protected readonly showUpload = computed(() => this.context.sources() !== 'url');

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

    protected onInsertUrl(src: string, alt: string): void {
        if (this.interactionDisabled() || !src) return;
        this.context.onInsertUrl(src, alt);
        this.open.set(false);
    }

    protected onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (this.interactionDisabled() || !file) return;
        this.context.onUploadFile(file);
        this.open.set(false);
    }
}
