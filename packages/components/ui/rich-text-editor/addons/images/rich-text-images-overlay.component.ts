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
    readonly target = input<HTMLImageElement | null>(null);
    readonly container = input<HTMLElement | null>(null);
    readonly locale = input.required<RichTextImagesLocale>();
    readonly resizerLabels = input.required<RichTextImageResizerLabels>();
    readonly resizable = input(true);
    readonly showAlignment = input(true);
    readonly minWidth = input(20);
    readonly maxWidth = input<number>();
    readonly lockAspectRatio = input(true);
    readonly uploading = input(false);
    readonly errorEntries = input<readonly ImageUploadErrorEntry[]>([]);

    readonly resizeEnd = output<void>();
    readonly alignmentChange = output<ImageAlignment>();
    readonly imageRemove = output<HTMLImageElement>();
    readonly retryError = output<string>();
    readonly removeError = output<string>();
}
