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
    readonly importing = input(false);
    readonly errorMessage = input('');
    readonly locale = input.required<RichTextFileImportLocale>();
}
