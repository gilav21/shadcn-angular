import {
    Component,
    ChangeDetectionStrategy,
    computed,
    inject,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { cn } from '../../../../lib/utils';
import { RichTextEditorAddonHost, RichTextToolbarViewContext } from '../..';
import {
    EmojiPickerComponent,
    EmojiPickerTriggerComponent,
    EmojiPickerContentComponent,
} from '../../../emoji-picker';
import { RICH_TEXT_EMOJI_CONTEXT } from './rich-text-emoji.context';

const EMOJI_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/>' +
    '<line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>';

/**
 * The emoji toolbar button the addon contributes as a component slot: the
 * `ui-emoji-picker` compound anchored to a standard toolbar button. Reads
 * editor state through {@link RichTextEditorAddonHost} and reports picks via
 * {@link RICH_TEXT_EMOJI_CONTEXT}.
 */
@Component({
    selector: 'ui-rte-emoji-button',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        EmojiPickerComponent,
        EmojiPickerTriggerComponent,
        EmojiPickerContentComponent,
    ],
    templateUrl: './rich-text-emoji-button.component.html',
    host: { class: 'contents' },
})
export class RichTextEmojiButtonComponent {
    private readonly host = inject(RichTextEditorAddonHost);
    private readonly domSanitizer = inject(DomSanitizer);
    private readonly toolbarView = inject(RichTextToolbarViewContext, { optional: true });
    protected readonly context = inject(RICH_TEXT_EMOJI_CONTEXT);

    protected readonly icon: SafeHtml =
        this.domSanitizer.bypassSecurityTrustHtml(EMOJI_ICON);

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

    protected onEmoji(emoji: string): void {
        if (this.interactionDisabled()) return;
        this.context.onInsert(emoji);
    }
}
