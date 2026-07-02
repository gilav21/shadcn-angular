import fs from 'fs-extra';
import path from 'node:path';
import { fetchLibContent, normalizeContent, type FetchOptions } from './fetch.js';
import { registry, type ComponentName } from '../registry/index.js';
import {
    hashContent, fileStatus, recordFile, readManifest, writeManifest, type Manifest,
} from './manifest.js';
import { LIB_BASELINES } from '../registry/lib-baselines.js';

/**
 * Shared lib reconciliation — the missing counterpart to component drift
 * detection. Components are diffed and refreshed by `add`/`update`/`doctor`, but
 * the shared files under `lib/` were not: `utils.ts` is written once at `init`
 * from a bundled template and never revisited, and a component's `libFiles` are
 * only (re)written when that component itself is installed. So when the registry
 * adds a new export (e.g. `stringifyValue` in `utils.ts`) that upgraded
 * components import, an existing project never receives it and the build breaks
 * with a missing-export error no tool surfaced (report B2/B3).
 *
 * This module classifies each required lib file against the registry and the
 * published baselines, mirroring the component contract: a file the user edited
 * is protected; a pristine-but-stale file is safe to refresh.
 */

/**
 * Lib files always present in a project regardless of which components are
 * installed — written at `init`, not via any component's `libFiles`. Without
 * this, `utils.ts` would never be reconciled (it belongs to no component).
 */
export const CORE_LIB_FILES: readonly string[] = ['utils.ts'];

export type LibDriftStatus = 'clean' | 'missing' | 'stale' | 'userEdited';

/**
 * Every lib file a project should carry: the core set ∪ installed components'
 * libFiles. The core set is only required once at least one component is
 * installed — a project with no components has nothing importing `utils.ts`, so
 * its absence is not a defect.
 */
export function requiredLibFiles(installed: Iterable<ComponentName>): string[] {
    const names = [...installed];
    if (names.length === 0) return [];
    const set = new Set<string>(CORE_LIB_FILES);
    for (const name of names) {
        for (const file of registry[name].libFiles ?? []) set.add(file);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}

/** True when `local` matches a known published revision of this lib file. */
export function isPristineLib(file: string, local: string): boolean {
    return LIB_BASELINES[file]?.includes(hashContent(local)) ?? false;
}

/**
 * Classify one lib file. A file identical to the registry is `clean`; one that
 * differs is `stale` (safe to refresh) only when it is unmodified from what we
 * installed (manifest `clean`) or matches a published baseline (a pristine but
 * out-of-date copy). Anything else that differs — a manifest `modified` file, or
 * an `untracked` file that matches no baseline (e.g. an `i18n.token.ts` a user
 * customized via `set-locale`) — is `userEdited` and protected.
 */
async function classifyLibFile(
    file: string, libDir: string, manifest: Manifest, options: FetchOptions,
): Promise<LibDriftStatus> {
    const target = path.join(libDir, file);
    if (!await fs.pathExists(target)) return 'missing';

    const local = await fs.readFile(target, 'utf-8');
    let remote: string;
    try {
        remote = await fetchLibContent(file, options);
    } catch {
        return 'clean'; // can't reach the registry copy → never flag (conservative)
    }
    if (normalizeContent(local) === normalizeContent(remote)) return 'clean';

    const status = fileStatus(manifest, file, local);
    if (status === 'modified') return 'userEdited';
    if (status === 'clean') return 'stale';
    return isPristineLib(file, local) ? 'stale' : 'userEdited';
}

export interface LibDriftReport {
    /** Behind the registry but safe to refresh (pristine or unmodified-from-install). */
    stale: string[];
    /** Required but absent on disk. */
    missing: string[];
    /** Differ from the registry but protected (user-edited / customized). */
    userEdited: string[];
}

/** Diagnose every required lib file's state against the registry. */
export async function collectLibDrift(
    libDir: string,
    installed: Iterable<ComponentName>,
    manifest: Manifest,
    options: FetchOptions,
): Promise<LibDriftReport> {
    const stale: string[] = [];
    const missing: string[] = [];
    const userEdited: string[] = [];
    for (const file of requiredLibFiles(installed)) {
        const status = await classifyLibFile(file, libDir, manifest, options);
        if (status === 'stale') stale.push(file);
        else if (status === 'missing') missing.push(file);
        else if (status === 'userEdited') userEdited.push(file);
    }
    return { stale, missing, userEdited };
}

export interface LibRefreshResult {
    refreshed: string[];
    warnings: string[];
}

/**
 * Overwrite the given lib files with the registry copy and record their
 * fingerprints. Self-contained: reads and writes the manifest so it composes
 * after `performInstall` without racing on a shared manifest object.
 */
export async function refreshLibFiles(
    files: string[], libDir: string, cwd: string, options: FetchOptions,
): Promise<LibRefreshResult> {
    const refreshed: string[] = [];
    const warnings: string[] = [];
    if (files.length === 0) return { refreshed, warnings };

    const manifest = await readManifest(cwd);
    await fs.ensureDir(libDir);
    for (const file of files) {
        try {
            const content = await fetchLibContent(file, options);
            const target = path.join(libDir, file);
            await fs.ensureDir(path.dirname(target));
            await fs.writeFile(target, content);
            recordFile(manifest, file, content, '(lib)');
            refreshed.push(file);
        } catch (err: unknown) {
            warnings.push(`Could not refresh lib file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    try {
        await writeManifest(cwd, manifest);
    } catch (err: unknown) {
        warnings.push(`Could not write components.lock.json: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { refreshed, warnings };
}
