import fs from 'fs-extra';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeContent } from './fetch.js';

export const MANIFEST_FILENAME = 'components.lock.json';
export const MANIFEST_VERSION = 1;

export interface ManifestEntry {
    sha256: string;
    component: string;
}
export interface Manifest {
    version: number;
    files: Record<string, ManifestEntry>;
}
export type FileStatus = 'clean' | 'modified' | 'untracked';

/** Hash normalized (LF) content so line-ending churn never reads as an edit. */
export function hashContent(content: string): string {
    return createHash('sha256').update(normalizeContent(content), 'utf8').digest('hex');
}

export function emptyManifest(): Manifest {
    return { version: MANIFEST_VERSION, files: {} };
}

export async function readManifest(cwd: string): Promise<Manifest> {
    const p = path.join(cwd, MANIFEST_FILENAME);
    if (!await fs.pathExists(p)) return emptyManifest();
    try {
        const data = await fs.readJson(p) as Partial<Manifest>;
        // eslint-disable-next-line sonarjs/different-types-comparison -- data is runtime JSON; files may be null even though Partial<Manifest> excludes null
        if (!data || typeof data.files !== 'object' || data.files === null) return emptyManifest();
        return { version: data.version ?? MANIFEST_VERSION, files: data.files };
    } catch {
        return emptyManifest();
    }
}

export async function writeManifest(cwd: string, manifest: Manifest): Promise<void> {
    const sorted = Object.fromEntries(
        Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
    );
    await fs.writeJson(
        path.join(cwd, MANIFEST_FILENAME),
        { version: MANIFEST_VERSION, files: sorted },
        { spaces: 2 },
    );
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
