import fs from 'fs-extra';
import path from 'node:path';
import { fetchAndTransform, normalizeContent, type FetchOptions } from './fetch.js';
import { registry, type ComponentName } from '../registry/index.js';

export interface FileDiff {
    file: string;
    /** Unified-style diff text, or null when identical / not installed. */
    diff: string | null;
    error?: string;
}

export interface ComponentDiff {
    name: string;
    files: FileDiff[];
    hasChanges: boolean;
}

export function unifiedDiff(fileName: string, local: string, remote: string): string {
    const localLines = local.split('\n');
    const remoteLines = remote.split('\n');
    const out: string[] = [`--- local/${fileName}`, `+++ remote/${fileName}`];
    const maxLines = Math.max(localLines.length, remoteLines.length);
    let found = false;
    for (let i = 0; i < maxLines; i++) {
        const l = localLines[i];
        const r = remoteLines[i];
        if (l === r) continue;
        found = true;
        out.push(`@@ line ${i + 1} @@`);
        if (l !== undefined) out.push(`- ${l}`);
        if (r !== undefined) out.push(`+ ${r}`);
    }
    return found ? out.join('\n') : '';
}

export async function diffComponentFiles(
    name: ComponentName, targetDir: string, options: FetchOptions, utilsAlias: string,
): Promise<ComponentDiff> {
    const files: FileDiff[] = [];
    for (const file of registry[name].files) {
        const targetPath = path.join(targetDir, file);
        if (!await fs.pathExists(targetPath)) {
            files.push({ file, diff: null });
            continue;
        }
        try {
            const local = normalizeContent(await fs.readFile(targetPath, 'utf-8'));
            const remote = normalizeContent(await fetchAndTransform(file, options, utilsAlias));
            const text = local === remote ? '' : unifiedDiff(file, local, remote);
            files.push({ file, diff: text || null });
        } catch (err: unknown) {
            files.push({ file, diff: null, error: err instanceof Error ? err.message : String(err) });
        }
    }
    // A component "has changes" if any file differs OR could not be fetched —
    // the latter preserves the original CLI's "Could not fetch remote version"
    // report (and its inclusion in the diff count).
    return { name, files, hasChanges: files.some(f => f.diff !== null || f.error !== undefined) };
}
