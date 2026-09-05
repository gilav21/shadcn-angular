import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { RichTextFileImportLocale } from './rich-text-file-import.locales';

/**
 * The file-import addon's editor-frame overlay: a full-editor busy layer while a
 * file is parsing and a transient error banner when it fails. The directive
 * creates one instance inside the editor's positioned container
 * (`overlayAnchor`) and feeds it state through inputs — reproducing the busy /
 * error UI the base editor used to render inline.
 */
@Component({
    selector: 'ui-rte-file-import-overlay',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './rich-text-file-import-overlay.component.html',
    host: { class: 'contents' },
})
export class RichTextFileImportOverlayComponent {
    /**
     * Renders the full-editor busy layer (`data-slot="rte-file-import-busy"`)
     * showing {@link locale}`.importing`. The directive holds this true for the
     * whole parse, so the editor stays visually blocked until the imported
     * content lands.
     */
    readonly importing = input(false);
    /**
     * Already-localized failure text. Any non-empty value renders the error
     * layer (`data-slot="rte-file-import-error"`); `''` hides it. The directive
     * clears it on a timer, so treat this as transient — it is not a sticky
     * error state the consumer has to dismiss.
     */
    readonly errorMessage = input('');
    /**
     * Resolved file-import dictionary. Only `importing` is read here — the
     * failure string arrives pre-resolved through {@link errorMessage} — but the
     * whole locale is passed so the overlay can grow strings without a new input.
     */
    readonly locale = input.required<RichTextFileImportLocale>();
}
