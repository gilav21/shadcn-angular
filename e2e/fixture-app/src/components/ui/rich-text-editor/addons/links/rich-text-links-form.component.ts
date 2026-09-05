import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../../../button';
import { RICH_TEXT_LINKS_LOCALES, type RichTextLinksLocale } from './rich-text-links.locales';

/** Payload emitted when the link form is confirmed. */
export interface RichTextLinkSubmit {
    readonly text: string;
    readonly url: string;
}

/**
 * The link insert/edit form: a link-text field, a URL field, and confirm /
 * cancel / (edit-mode) remove actions. Presentational only — the links addon
 * hosts it inside the toolbar popover and inside the caret/anchor overlay, and
 * performs the actual insert/remove through the editor host. The URL is trimmed
 * and required; the addon validates and sanitizes it before writing any anchor.
 */
@Component({
    selector: 'ui-rich-text-links-form',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ButtonComponent],
    templateUrl: './rich-text-links-form.component.html',
    host: { class: 'contents' },
})
export class RichTextLinksFormComponent {
    /** Resolved locale strings. */
    readonly locale = input<RichTextLinksLocale>(RICH_TEXT_LINKS_LOCALES['en']);
    /** Initial link text (seeded from the selection or an existing anchor). */
    readonly text = input('');
    /** Initial URL (empty for insert, the anchor href for edit). */
    readonly url = input('');
    /** Render the remove button and the update label (edit mode). */
    readonly showRemove = input(false);

    /** Confirm the link with the entered text + URL. */
    readonly submitLink = output<RichTextLinkSubmit>();
    /** Dismiss without changes. */
    readonly cancelLink = output<void>();
    /** Remove the edited link. */
    readonly removeLink = output<void>();

    protected readonly dir = computed<'rtl' | null>(() => (this.locale().rtl ? 'rtl' : null));

    protected onSubmit(text: string, url: string): void {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) return;
        this.submitLink.emit({ text: text.trim(), url: trimmedUrl });
    }
}
