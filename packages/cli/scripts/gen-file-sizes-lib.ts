/**
 * Builder for `packages/components/file-sizes.json`.
 *
 * `why` answers "should I add this component" before anything is installed, so
 * it cannot measure files on disk — they are not there yet. It could fetch
 * every file in the closure to weigh them, but a mid-sized component pulls
 * 100+ files and that turns an introspection command into a minute of network
 * traffic that fails offline.
 *
 * So the sizes are measured here, at registry-build time, and published as a
 * small manifest alongside `registry.json`. The CLI fetches it from the same
 * branch, which means new components report real sizes the moment they land on
 * master — no republish — and a fetch failure costs the size lines only, not
 * the command.
 *
 * Kept out of `registry.json` on purpose: that file is edited by every bundle
 * that adds a component, and byte counts change on every source edit. Mixing
 * them would make the manifest churn on formatting changes and conflict
 * constantly.
 *
 * Pure — no IO. `gen-file-sizes.ts` supplies the file contents.
 */

/** What one file costs a consumer who installs it. */
export interface FileSize {
    readonly bytes: number;
    readonly lines: number;
}

/**
 * Sizes keyed the way the registry references them: `ui` paths match a
 * component entry's `files[]` / `peerFiles[]`, `lib` paths match its
 * `libFiles[]`, and `blocks` paths match a `type: 'block'` entry's `files[]`.
 *
 * Three namespaces rather than one flat map because the same path exists in
 * more than one root — `touch.ts` is both a lib file and a plausible component
 * file — and because blocks are fetched from `packages/blocks/`, a different
 * base URL entirely.
 */
export interface FileSizes {
    /** Bumped when the shape changes, so a reader can fail loudly. */
    readonly version: 1;
    readonly ui: Readonly<Record<string, FileSize>>;
    readonly lib: Readonly<Record<string, FileSize>>;
    readonly blocks: Readonly<Record<string, FileSize>>;
}

/** A file as read from disk, before it is keyed into a namespace. */
export interface MeasuredFile {
    /** Path relative to the namespace root, forward-slashed. */
    readonly path: string;
    readonly contents: string;
}

/**
 * Bytes and lines for one file.
 *
 * Bytes are UTF-8 bytes, which is what the consumer's disk and their bundler
 * see. Lines count newline-separated lines with no trailing-newline artefact,
 * so a 3-line file reports 3 whether or not it ends in a newline.
 */
export function measure(contents: string): FileSize {
    const normalized = contents.replaceAll('\r\n', '\n');
    const withoutTrailing = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
    return {
        bytes: Buffer.byteLength(contents, 'utf-8'),
        lines: withoutTrailing === '' ? 0 : withoutTrailing.split('\n').length + 0,
    };
}

function index(files: readonly MeasuredFile[]): Record<string, FileSize> {
    const out: Record<string, FileSize> = {};
    for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
        out[file.path] = measure(file.contents);
    }
    return out;
}

/** Build the manifest. Deterministic: sorted keys, no clock, no IO. */
export function buildFileSizes(
    ui: readonly MeasuredFile[],
    lib: readonly MeasuredFile[],
    blocks: readonly MeasuredFile[] = [],
): FileSizes {
    return { version: 1, ui: index(ui), lib: index(lib), blocks: index(blocks) };
}

/** Serialize exactly as committed (stable, newline-terminated). */
export function serializeFileSizes(sizes: FileSizes): string {
    return JSON.stringify(sizes, null, 2) + '\n';
}
