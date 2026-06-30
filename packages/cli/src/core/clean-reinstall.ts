import fs from 'fs-extra';
import path from 'node:path';
import { registry, type ComponentName } from '../registry/index.js';
import { COMPONENT_BASELINES } from '../registry/component-baselines.js';
import { componentFileHash } from './baseline.js';

/**
 * Clean-reinstall reconciliation. `update`/`doctor` write a component's new
 * files but never removed the ones a layout refactor superseded, so a project
 * accumulates pristine stale files — a relocated type, a sub-component moved
 * into `sub/`, a chart split into its own folder (report: "only file-viewer was
 * customized, yet the upgrade leaves stale data behind").
 *
 * This identifies, for every on-disk ui file the current registry no longer
 * ships, whether it is a pristine shadcn artifact (matches a published
 * baseline) safe to remove, a file relocated to a new component (declared
 * move — migrated), or a file the consumer authored/edited (matches no
 * baseline — never touched).
 */

const BASELINE_SET = new Set(COMPONENT_BASELINES);
const SCAN_EXT = new Set(['.ts', '.html', '.css', '.mts', '.cts', '.js', '.mjs']);
const SOURCE_SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage']);

/** A file extracted from one component into its own component across a refactor. */
export interface ComponentMove {
    /** ui-relative path of the old in-folder file (e.g. page-builder/page-renderer.component.ts). */
    readonly fromFile: string;
    /** The component now shipping it, installed during the migration. */
    readonly toComponent: ComponentName;
    /** Import specifier suffix consumers used (no extension). */
    readonly fromImport: string;
    /** Import specifier suffix to rewrite consumers to. */
    readonly toImport: string;
}

/**
 * Declared component extractions. A pristine file alone can't tell the tooling
 * "this became its own component you should install and re-point imports to" —
 * that's an intent the registry declares here.
 */
export const COMPONENT_MOVES: readonly ComponentMove[] = [
    {
        fromFile: 'page-builder/page-renderer.component.ts',
        toComponent: 'page-renderer',
        fromImport: 'page-builder/page-renderer.component',
        toImport: 'page-renderer',
    },
];

/** Every ui file the current registry ships (component files + peer files; not blocks). */
function shippedUiFiles(): Set<string> {
    const shipped = new Set<string>();
    for (const def of Object.values(registry)) {
        if (def.type === 'block') continue;
        for (const f of def.files) shipped.add(f.replaceAll('\\', '/'));
        for (const f of def.peerFiles ?? []) shipped.add(f.replaceAll('\\', '/'));
    }
    return shipped;
}

const isScannable = (rel: string): boolean =>
    SCAN_EXT.has(path.extname(rel)) && !/\.(spec|stories)\.[mc]?[tj]s$/.test(rel);

async function walkRel(root: string, rel = ''): Promise<string[]> {
    let entries: import('node:fs').Dirent[];
    try {
        entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            if (!SOURCE_SKIP_DIRS.has(entry.name)) out.push(...await walkRel(root, childRel));
        } else if (SCAN_EXT.has(path.extname(entry.name))) {
            out.push(childRel);
        }
    }
    return out;
}

function escapeRegExp(s: string): string {
    return s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** A ui-relative path reduced to its import key (no extension, no `.component` suffix). */
function importKey(uiRel: string): string {
    return uiRel.replaceAll('\\', '/').replace(/\.(ts|mts|cts|js|mjs|html|css)$/, '').replace(/\.component$/, '');
}

// `from '…'`, `import('…')`, `require('…')` — same matcher as core/import-rewrite.
const SPECIFIER_RE = /(\bfrom\s*|(?:\bimport|\brequire)\s*\(\s*)(['"])([^'"]+)\2/g;

/**
 * The set of import keys a source file references that resolve INTO the ui dir —
 * via the ui alias (`@/components/ui/x`) or a relative path that lands under
 * `uiDir`. Resolving precisely (not substring-matching) is essential: a new
 * `icon/icon.component.ts` importing `./icon.token` must NOT read as an importer
 * of the stale flat `icon.token.ts` at the ui root.
 */
function uiImportKeys(absFile: string, content: string, uiDir: string, uiAlias: string): Set<string> {
    const keys = new Set<string>();
    const aliasPrefix = uiAlias.replace(/\/{1,256}$/, '') + '/';
    const fileDir = path.dirname(absFile);
    for (let m = SPECIFIER_RE.exec(content); m !== null; m = SPECIFIER_RE.exec(content)) {
        const spec = m[3];
        let uiRel: string | null = null;
        if (spec.startsWith(aliasPrefix)) {
            uiRel = spec.slice(aliasPrefix.length);
        } else if (spec.startsWith('.')) {
            const abs = path.resolve(fileDir, spec);
            const rel = path.relative(uiDir, abs);
            if (!rel.startsWith('..') && !path.isAbsolute(rel)) uiRel = rel;
        }
        if (uiRel !== null) keys.add(importKey(uiRel));
    }
    return keys;
}

export type StaleAction = 'prune' | 'migrate' | 'keep-warn';

export interface StaleEntry {
    /** ui-relative path. */
    file: string;
    action: StaleAction;
    /** For `migrate`. */
    move?: ComponentMove;
}

export interface StaleReport {
    /** Pristine shadcn files the registry no longer ships, with the action for each. */
    entries: StaleEntry[];
}

/**
 * Classify every on-disk ui file the current registry no longer ships:
 *  - declared move → `migrate` (install the new component + re-point imports + prune);
 *  - pristine + imported by the consumer's own code → `keep-warn` (manual migration);
 *  - pristine + unimported → `prune` (dead stale artifact);
 *  - not pristine (consumer-authored/edited) → omitted (protected).
 */
/**
 * On-disk ui files the registry no longer ships that are pristine shadcn
 * artifacts (match a published baseline) or a declared move's `fromFile`.
 */
async function collectStaleCandidates(
    uiDir: string, moveByFile: Map<string, ComponentMove>, prefix: string, utilsAlias: string,
): Promise<string[]> {
    const shipped = shippedUiFiles();
    const onDisk = (await walkRel(uiDir))
        .map(f => f.replaceAll('\\', '/'))
        .filter(f => isScannable(f) && !shipped.has(f) && !f.startsWith('lib/'));
    const candidates: string[] = [];
    for (const file of onDisk) {
        if (moveByFile.has(file)) { candidates.push(file); continue; }
        const content = await fs.readFile(path.join(uiDir, file), 'utf-8');
        if (BASELINE_SET.has(componentFileHash(content, prefix, utilsAlias))) candidates.push(file);
    }
    return candidates;
}

/**
 * Union of ui-import keys referenced by every NON-stale project file. Stale
 * files are excluded as importers — a stale file importing another stale file
 * isn't an external consumer, else the interdependent old layout would protect
 * itself from pruning.
 */
async function collectImportedKeys(
    projectRoot: string, uiDir: string, uiAlias: string, staleSet: Set<string>,
): Promise<Set<string>> {
    const keys = new Set<string>();
    for (const rel of await walkRel(projectRoot)) {
        const uiRel = toUiRel(projectRoot, uiDir, rel);
        if (uiRel !== null && staleSet.has(uiRel)) continue;
        const abs = path.join(projectRoot, rel);
        try {
            for (const key of uiImportKeys(abs, await fs.readFile(abs, 'utf-8'), uiDir, uiAlias)) keys.add(key);
        } catch {
            // unreadable file — ignore
        }
    }
    return keys;
}

function classifyStale(file: string, move: ComponentMove | undefined, importedKeys: Set<string>): StaleEntry {
    if (move) return { file, action: 'migrate', move };
    if (importedKeys.has(importKey(file))) return { file, action: 'keep-warn' };
    return { file, action: 'prune' };
}

export async function collectStaleReport(
    uiDir: string, projectRoot: string, prefix: string, utilsAlias: string, uiAlias: string,
): Promise<StaleReport> {
    const moveByFile = new Map(COMPONENT_MOVES.map(m => [m.fromFile, m]));
    const candidates = await collectStaleCandidates(uiDir, moveByFile, prefix, utilsAlias);
    const importedKeys = await collectImportedKeys(projectRoot, uiDir, uiAlias, new Set(candidates));
    return { entries: candidates.map(file => classifyStale(file, moveByFile.get(file), importedKeys)) };
}

/** ui-relative path of a project file if it lives under uiDir, else null. */
function toUiRel(projectRoot: string, uiDir: string, projectRel: string): string | null {
    const abs = path.join(projectRoot, projectRel);
    const rel = path.relative(uiDir, abs);
    return rel.startsWith('..') || path.isAbsolute(rel) ? null : rel.replaceAll('\\', '/');
}

/** Rewrite a moved component's import specifier across one source file. */
export function rewriteMovedImport(content: string, move: ComponentMove): { content: string; changed: boolean } {
    const re = new RegExp(String.raw`(from\s*['"][^'"]*?)${escapeRegExp(move.fromImport)}(['"])`, 'g');
    let changed = false;
    const next = content.replaceAll(re, (_full, pre: string, quote: string) => {
        changed = true;
        return `${pre}${move.toImport}${quote}`;
    });
    return { content: next, changed };
}

/** Rewrite a moved import across every consumer source file under projectRoot. */
export async function rewriteMovedImports(projectRoot: string, move: ComponentMove): Promise<string[]> {
    const rewritten: string[] = [];
    for (const rel of await walkRel(projectRoot)) {
        if (!/\.[mc]?[tj]s$/.test(rel) && !rel.endsWith('.html')) continue;
        const abs = path.join(projectRoot, rel);
        let content: string;
        try {
            content = await fs.readFile(abs, 'utf-8');
        } catch {
            continue;
        }
        const out = rewriteMovedImport(content, move);
        if (out.changed) {
            await fs.writeFile(abs, out.content);
            rewritten.push(rel.replaceAll('\\', '/'));
        }
    }
    return rewritten;
}
