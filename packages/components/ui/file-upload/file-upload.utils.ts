/**
 * Local helpers for `FileUploadComponent`. Pure functions kept out of the
 * component file for readability.
 *
 * Nothing here transfers anything: `ui-file-upload` is deliberately
 * transport-agnostic — it validates, enumerates and (optionally) crops, and the
 * consumer performs the actual upload.
 */

import type { CropRect } from './file-upload.types';

/**
 * A dropped entry, as exposed by the non-standard but universally implemented
 * `webkitGetAsEntry()`. Declared locally because the DOM lib's
 * `FileSystemEntry` family does not include `createReader`/`file` in every
 * TypeScript version, and we only need this much of it.
 */
interface DroppedEntry {
    readonly isFile: boolean;
    readonly isDirectory: boolean;
    readonly name: string;
    readonly fullPath: string;
    file?(onSuccess: (file: File) => void, onError: (error: unknown) => void): void;
    createReader?(): DroppedDirectoryReader;
}

interface DroppedDirectoryReader {
    readEntries(onSuccess: (entries: DroppedEntry[]) => void, onError: (error: unknown) => void): void;
}

interface EntryCapableItem {
    webkitGetAsEntry?(): DroppedEntry | null;
}

/** Depth cap, so a symlink loop or a pathological tree cannot spin forever. */
const MAX_DEPTH = 32;

/**
 * Every file in a drop, walking dropped **directories** recursively when
 * `allowDirectories` is set.
 *
 * The `DataTransferItemList` is only alive for the synchronous span of the drop
 * event, so every `webkitGetAsEntry()` call happens up front, before the first
 * `await` — reading them afterwards yields nulls and the drop silently becomes
 * empty. That ordering is the whole reason this is not a simple `for await`.
 *
 * Falls back to `dataTransfer.files` when directories are not requested, when
 * the browser exposes no entries, or when a walk fails partway.
 */
export async function collectDroppedFiles(
    dataTransfer: DataTransfer | null | undefined,
    allowDirectories: boolean,
): Promise<File[]> {
    if (!dataTransfer) return [];

    const flat = Array.from(dataTransfer.files ?? []);
    if (!allowDirectories) return flat;

    const entries = snapshotEntries(dataTransfer);
    if (entries.length === 0) return flat;

    const collected: File[] = [];
    for (const entry of entries) {
        await walkEntry(entry, collected, 0);
    }
    return collected.length > 0 ? collected : flat;
}

/**
 * Grabs every entry synchronously, before anything awaits. See
 * {@link collectDroppedFiles} for why that is not optional.
 */
function snapshotEntries(dataTransfer: DataTransfer): DroppedEntry[] {
    const items: EntryCapableItem[] = Array.from(dataTransfer.items ?? []);
    const entries: DroppedEntry[] = [];
    for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) entries.push(entry);
    }
    return entries;
}

async function walkEntry(entry: DroppedEntry, out: File[], depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return;

    if (entry.isFile) {
        const file = await entryFile(entry);
        if (file) out.push(file);
        return;
    }
    if (!entry.isDirectory) return;

    for (const child of await readDirectory(entry)) {
        await walkEntry(child, out, depth + 1);
    }
}

function entryFile(entry: DroppedEntry): Promise<File | null> {
    return new Promise(resolve => {
        if (!entry.file) {
            resolve(null);
            return;
        }
        entry.file(file => resolve(file), () => resolve(null));
    });
}

/**
 * Every child of a directory. `readEntries` returns a *batch* — usually 100 —
 * and must be called until it answers empty, or large folders are silently
 * truncated.
 */
async function readDirectory(entry: DroppedEntry): Promise<DroppedEntry[]> {
    const reader = entry.createReader?.();
    if (!reader) return [];

    const all: DroppedEntry[] = [];
    let batch = await readBatch(reader);
    while (batch.length > 0) {
        all.push(...batch);
        batch = await readBatch(reader);
    }
    return all;
}

function readBatch(reader: DroppedDirectoryReader): Promise<DroppedEntry[]> {
    return new Promise(resolve => {
        reader.readEntries(entries => resolve(entries), () => resolve([]));
    });
}

/** Whether a file is an image, and therefore a candidate for the crop step. */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * A centred starting selection for `natural`-sized image, honouring `aspect`
 * (width / height) when one is given. Returns the largest such rectangle that
 * fits, so the user starts from the most useful default rather than a corner.
 */
export function initialCropRect(
    natural: { width: number; height: number },
    aspect: number | null,
): CropRect {
    if (aspect === null || aspect <= 0 || natural.width <= 0 || natural.height <= 0) {
        return { x: 0, y: 0, width: natural.width, height: natural.height };
    }

    let width = natural.width;
    let height = width / aspect;
    if (height > natural.height) {
        height = natural.height;
        width = height * aspect;
    }
    return {
        x: (natural.width - width) / 2,
        y: (natural.height - height) / 2,
        width,
        height,
    };
}

/** Keeps `rect` inside `natural`, never smaller than one pixel on either side. */
export function clampCropRect(rect: CropRect, natural: { width: number; height: number }): CropRect {
    const width = Math.min(Math.max(1, rect.width), natural.width);
    const height = Math.min(Math.max(1, rect.height), natural.height);
    return {
        width,
        height,
        x: Math.min(Math.max(0, rect.x), natural.width - width),
        y: Math.min(Math.max(0, rect.y), natural.height - height),
    };
}

/**
 * The crop rect a key press produces, or `null` when the key means nothing
 * here (so the caller leaves the event alone rather than swallowing it).
 *
 * Arrows move the box; `+`/`=` and `-`/`_` resize it, honouring `aspect` so a
 * locked ratio stays locked under the keyboard exactly as under the pointer.
 */
export function cropKeyStep(
    key: string,
    rect: CropRect,
    step: number,
    aspect: number | null,
): CropRect | null {
    switch (key) {
        case 'ArrowLeft': return { ...rect, x: rect.x - step };
        case 'ArrowRight': return { ...rect, x: rect.x + step };
        case 'ArrowUp': return { ...rect, y: rect.y - step };
        case 'ArrowDown': return { ...rect, y: rect.y + step };
        case '+': case '=': return resizeBy(rect, step, aspect);
        case '-': case '_': return resizeBy(rect, -step, aspect);
        default: return null;
    }
}

function resizeBy(rect: CropRect, delta: number, aspect: number | null): CropRect {
    const width = rect.width + delta;
    const height = aspect === null || aspect <= 0 ? rect.height + delta : width / aspect;
    return { ...rect, width, height };
}

/**
 * Cuts `rect` out of `file` and returns a new `File` with the same name.
 *
 * Rejects for a non-image, so the caller can skip rather than corrupt. The
 * output MIME follows the input except for formats a canvas cannot re-encode
 * losslessly — SVG and GIF become PNG, since `toBlob` would otherwise hand back
 * a PNG under a lying MIME type.
 */
export async function cropImageFile(file: File, rect: CropRect): Promise<File> {
    if (!isImageFile(file)) {
        throw new Error(`file-upload: ${file.name} is not an image and cannot be cropped`);
    }

    const bitmap = await createImageBitmap(file);
    try {
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));

        const canvas = globalThis.document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('file-upload: 2D canvas context unavailable');

        ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);

        const type = encodableType(file.type);
        const blob = await canvasBlob(canvas, type);
        return new File([blob], file.name, { type: blob.type || type, lastModified: Date.now() });
    } finally {
        bitmap.close();
    }
}

function encodableType(type: string): string {
    return type === 'image/jpeg' || type === 'image/webp' ? type : 'image/png';
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (blob) resolve(blob);
                else reject(new Error('file-upload: canvas produced no blob'));
            },
            type,
            0.92,
        );
    });
}
