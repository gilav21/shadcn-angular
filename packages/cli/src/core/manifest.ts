import fs from 'fs-extra';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeContent } from './fetch.js';

export const MANIFEST_FILENAME = 'components.lock.json';
export const MANIFEST_VERSION = 2;

/** Guards the once-per-process legacy-lockfile warning (see {@link warnLegacyManifest}). */
let warnedLegacyManifest = false;

export interface ManifestEntry {
    sha256: string;
    component: string;
}
/** Per-component install/merge metadata. `ref` is the commit a component's files were last brought up to. */
export interface ComponentRecord {
    ref: string;
}
export interface Manifest {
    version: number;
    files: Record<string, ManifestEntry>;
    /** Optional (added in v2). Absent for manifests written before the 3-way-merge feature. */
    components?: Record<string, ComponentRecord>;
}
export type FileStatus = 'clean' | 'modified' | 'untracked';

/** Hash normalized (LF) content so line-ending churn never reads as an edit. */
export function hashContent(content: string): string {
    return createHash('sha256').update(normalizeContent(content), 'utf8').digest('hex');
}

export function emptyManifest(): Manifest {
    return { version: MANIFEST_VERSION, files: {} };
}

/** Read `components` only when it's a real object (tolerates the old ref-less shape). */
function readComponents(data: Partial<Manifest>): Record<string, ComponentRecord> | undefined {
    const c = data.components;
    return c && typeof c === 'object' ? c : undefined;
}

/**
 * Surface a version skew: when this (v2+) CLI reads a lockfile last written by
 * an older CLI (version < MANIFEST_VERSION) that still recorded files, warn once
 * per process — the pre-v2 file carries no per-component merge baselines, so the
 * next update re-records them.
 */
function warnLegacyManifest(data: Partial<Manifest>): void {
    if (warnedLegacyManifest) return;
    if (typeof data.version !== 'number' || data.version >= MANIFEST_VERSION) return;
    if (!data.files || Object.keys(data.files).length === 0) return;
    warnedLegacyManifest = true;
    console.warn(
        'components.lock.json was last written by an older CLI (v1) — ' +
        'per-component merge baselines will be re-recorded on the next update.',
    );
}

export async function readManifest(cwd: string): Promise<Manifest> {
    const p = path.join(cwd, MANIFEST_FILENAME);
    if (!await fs.pathExists(p)) return emptyManifest();
    try {
        const data = await fs.readJson(p) as Partial<Manifest>;
        // eslint-disable-next-line sonarjs/different-types-comparison -- data is runtime JSON; files may be null even though Partial<Manifest> excludes null
        if (!data || typeof data.files !== 'object' || data.files === null) return emptyManifest();
        warnLegacyManifest(data);
        return { version: data.version ?? MANIFEST_VERSION, files: data.files, components: readComponents(data) };
    } catch {
        return emptyManifest();
    }
}

function sortByKey<T>(record: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

export async function writeManifest(cwd: string, manifest: Manifest): Promise<void> {
    const out: Manifest = { version: MANIFEST_VERSION, files: sortByKey(manifest.files) };
    if (manifest.components && Object.keys(manifest.components).length > 0) {
        out.components = sortByKey(manifest.components);
    }
    await fs.writeJson(path.join(cwd, MANIFEST_FILENAME), out, { spaces: 2 });
}

/** Record (or advance) the commit ref a component's files were brought up to. */
export function recordComponentRef(manifest: Manifest, component: string, ref: string): void {
    manifest.components ??= {};
    manifest.components[component] = { ref };
}

/** The recorded ref for a component, or `undefined` (→ merge fallback) when none. */
export function getComponentRef(manifest: Manifest, component: string): string | undefined {
    return manifest.components?.[component]?.ref;
}

export function recordFile(manifest: Manifest, file: string, content: string, component: string): void {
    manifest.files[file] = { sha256: hashContent(content), component };
}

export function removeFiles(manifest: Manifest, files: string[]): void {
    for (const f of files) delete manifest.files[f];
}

/** Compare a local file against the recorded baseline. */
export function fileStatus(manifest: Manifest, file: string, localContent: string): FileStatus {
    const entry = manifest.files[file];
    if (!entry) return 'untracked';
    return entry.sha256 === hashContent(localContent) ? 'clean' : 'modified';
}
