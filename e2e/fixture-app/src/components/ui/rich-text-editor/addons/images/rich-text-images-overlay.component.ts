import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
    RichTextImageResizerComponent,
    type RichTextImageResizerLabels,
} from './rich-text-images-resizer.component';
import type { ImageAlignment } from './rich-text-images.utils';
import type { RichTextImagesLocale } from './rich-text-images.locales';

/** A positioned auto-upload error badge over a failed image. */
export interface ImageUploadErrorEntry {
    readonly id: string;
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly height: number;
}

/**
 * The images addon's editor-frame overlay layer: the resize/align handles for
 * the selected image, the full-editor uploading spinner, and per-image
 * auto-upload error badges. The directive creates one instance inside the
 * editor's positioned container and feeds it state through inputs.
 */
@Component({
    selector: 'ui-rte-images-overlay',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RichTextImageResizerComponent],
    templateUrl: './rich-text-images-overlay.component.html',
    host: { class: 'contents' },
})
export class RichTextImagesOverlayComponent {
    /**
     * The currently selected image, forwarded to the resizer. `null` (the
     * default, and what the directive sends while the addon is disabled) hides
     * the handles and the align/delete toolbar entirely.
     */
    readonly target = input<HTMLImageElement | null>(null);
    /**
     * The editor's content root. Handle positions are measured relative to this
     * element's box, and it is the scroll/resize source the resizer tracks — so
     * it must be the same positioned element the overlay is mounted into, or
     * the handles drift away from the image.
     */
    readonly container = input<HTMLElement | null>(null);
    /**
     * Resolved images dictionary. Supplies the spinner caption and the error
     * badge's failure/retry/remove wording; the resizer's own button titles come
     * separately through {@link resizerLabels}.
     */
    readonly locale = input.required<RichTextImagesLocale>();
    /**
     * The five resize-toolbar button titles, already narrowed from
     * {@link locale} by the directive. Passed separately so the resizer stays
     * usable without the addon's full dictionary.
     */
    readonly resizerLabels = input.required<RichTextImageResizerLabels>();
    /** Show the drag handles. False leaves the align/delete toolbar in place. */
    readonly resizable = input(true);
    /** Show the alignment buttons; the delete button remains either way. */
    readonly showAlignment = input(true);
    /** Lower clamp in CSS pixels, applied to both width and height while dragging. */
    readonly minWidth = input(20);
    /** Upper clamp in CSS pixels for the dragged width. Unset means no ceiling. */
    readonly maxWidth = input<number>();
    /**
     * When true, corner drags scale from the image's starting aspect ratio.
     * False unlocks the axes and reveals the four edge handles.
     */
    readonly lockAspectRatio = input(true);
    /** Renders the full-editor uploading layer over the content area. */
    readonly uploading = input(false);
    /**
     * One badge per failed auto-upload, pre-positioned by the directive in
     * container-relative pixels. Recomputed from live bounding boxes, so stale
     * entries are dropped rather than left floating.
     */
    readonly errorEntries = input<readonly ImageUploadErrorEntry[]>([]);

    /**
     * A resize drag finished. The new size is already on the image; the
     * directive uses this only to record a single undo entry for the whole drag.
     */
    readonly resizeEnd = output<void>();
    /**
     * The user picked an alignment. The float/margin styles and `data-align` are
     * already applied to the image — this reports the change for undo history.
     */
    readonly alignmentChange = output<ImageAlignment>();
    /**
     * The delete button was pressed. Emits the image itself; the overlay does
     * NOT remove it — the directive detaches it inside a tracked mutation.
     */
    readonly imageRemove = output<HTMLImageElement>();
    /** Retry pressed on an error badge. Emits that entry's `id`. */
    readonly retryError = output<string>();
    /** Remove pressed on an error badge. Emits that entry's `id`; the directive drops the image with it. */
    readonly removeError = output<string>();
}
