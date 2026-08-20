/**
 * Public types for `ui-file-upload`. Kept in a dedicated file so consumers can
 * import them without pulling in the component's runtime imports.
 */

/** A rectangle in the SOURCE image's own pixels — not display pixels. */
export interface CropRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** Payload of `(cropped)` — what the crop step produced and what it started from. */
export interface CropResult {
    /** The file the user picked, before cropping. */
    readonly original: File;
    /** The cropped file, which is what enters the queue and what `fileAdded` carries. */
    readonly file: File;
    /** The region taken, in the original image's pixels. */
    readonly rect: CropRect;
}
