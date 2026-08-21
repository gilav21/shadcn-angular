import fs from 'fs-extra';
import path from 'node:path';
import { registry, type ComponentName } from '../registry/index.js';
import { resolveDependencies } from './resolve.js';
import {
    getLocalComponentsDir,
    getRegistryBaseUrl,
    DEFAULT_BRANCH,
} from '../utils/paths.js';

/** What one file costs a consumer who installs it. */
export interface FileSize {
    readonly bytes: number;
    readonly lines: number;
}

/** The manifest published next to `registry.json` (see `scripts/gen-file-sizes.ts`). */
export interface FileSizes {
    readonly version: number;
    readonly ui: Readonly<Record<string, FileSize>>;
    readonly lib: Readonly<Record<string, FileSize>>;
    readonly blocks: Readonly<Record<string, FileSize>>;
}

/** What `add <name>` will write, once its whole dependency closure is resolved. */
export interface InstallSize {
    readonly bytes: number;
    readonly lines: number;
    readonly files: number;
    /**
     * Files the manifest had no entry for. Non-zero means the reported size is a
     * floor, not the whole truth, and `why` says so rather than quietly
     * under-reporting.
     */
    readonly unmeasured: number;
}

export interface SizeSourceOptions {
    readonly branch?: string;
    readonly registry?: string;
    readonly remote?: boolean;
}

/** Where the manifest lives relative to the component sources the CLI already fetches. */
function manifestUrl(options: SizeSourceOptions): string {
    const base = getRegistryBaseUrl(options.branch ?? DEFAULT_BRANCH, options.registry);
    // getRegistryBaseUrl points at `<base>/ui`; the manifest sits beside it.
    return `${base.replace(/\/ui$/, '')}/file-sizes.json`;
}

function isFileSizes(value: unknown): value is FileSizes {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate['version'] === 'number'
        && typeof candidate['ui'] === 'object' && candidate['ui'] !== null
        && typeof candidate['lib'] === 'object' && candidate['lib'] !== null
        && typeof candidate['blocks'] === 'object' && candidate['blocks'] !== null;
}

/** One manifest per source, so repeat `why` calls in one process fetch once. */
const cache = new Map<string, FileSizes | null>();

function sourceKey(options: SizeSourceOptions): string {
    return [
        options.registry ?? 'default',
        options.branch ?? DEFAULT_BRANCH,
        options.remote ? 'remote' : 'local',
    ].join('#');
}

/**
 * Load the size manifest, preferring a local monorepo checkout exactly as
 * `fetchComponentContent` does, then the branch it would install from.
 *
 * Returns `null` on any failure. Size is a nice-to-have on an introspection
 * command: a developer offline on a plane should still get files, dependencies
 * and reverse-dependents, with the size lines simply absent.
 */
export async function loadFileSizes(
    options: SizeSourceOptions = {},
): Promise<FileSizes | null> {
    const key = sourceKey(options);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const loaded = await readFileSizes(options);
    cache.set(key, loaded);
    return loaded;
}

async function readFileSizes(options: SizeSourceOptions): Promise<FileSizes | null> {
    try {
        const localDir = getLocalComponentsDir();
        if (localDir && !options.remote) {
            const localPath = path.join(path.dirname(localDir), 'file-sizes.json');
            if (await fs.pathExists(localPath)) {
                const raw: unknown = JSON.parse(await fs.readFile(localPath, 'utf-8'));
                return isFileSizes(raw) ? raw : null;
            }
        }
        const response = await fetch(manifestUrl(options));
        if (!response.ok) return null;
        const raw: unknown = await response.json();
        return isFileSizes(raw) ? raw : null;
    } catch {
        // Offline, 404, or malformed JSON — all mean "no size information",
        // which is a missing detail rather than a failed command.
        return null;
    }
}

/** Drop every cached manifest (tests). */
export function __resetFileSizesCache(): void {
    cache.clear();
}

const EMPTY: InstallSize = { bytes: 0, lines: 0, files: 0, unmeasured: 0 };

/** Namespaces a manifest keys sizes under, matching the roots the CLI fetches from. */
type Namespace = 'ui' | 'lib' | 'blocks';

/**
 * What installing `names` costs, across their whole resolved closure.
 *
 * Files are deduplicated by namespace and path before summing: sibling
 * components share lib files, and counting `utils.ts` once per component would
 * inflate the answer several times over.
 */
export function summarizeInstallSize(
    names: readonly ComponentName[], sizes: FileSizes | null,
): InstallSize {
    if (!sizes) return EMPTY;

    const seen = new Set<string>();
    let bytes = 0;
    let lines = 0;
    let files = 0;
    let unmeasured = 0;

    const add = (namespace: Namespace, file: string): void => {
        const key = `${namespace}:${file}`;
        if (seen.has(key)) return;
        seen.add(key);
        files++;
        const size = sizes[namespace][file];
        if (!size) {
            unmeasured++;
            return;
        }
        bytes += size.bytes;
        lines += size.lines;
    };

    for (const name of resolveDependencies([...names])) {
        const def = registry[name];
        // A block's sources live under packages/blocks/, which is a different
        // fetch root from a component's — so they are keyed separately too.
        const own: Namespace = def.type === 'block' ? 'blocks' : 'ui';
        for (const file of def.files) add(own, file);
        for (const file of def.peerFiles ?? []) add(own, file);
        for (const file of def.libFiles ?? []) add('lib', file);
    }

    return { bytes, lines, files, unmeasured };
}

/** Human-readable byte count: `12.3 KB`, `948 B`, `1.2 MB`. */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
}
