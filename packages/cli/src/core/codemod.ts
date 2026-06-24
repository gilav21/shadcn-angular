import fs from 'fs-extra';
import path from 'node:path';
import { registry, type ComponentName } from '../registry/index.js';

/**
 * Post-update consumer scan for stale directive selectors. A selector rename
 * (e.g. virtual-scroll's `[virtualItem]` -> `[uiVirtualItem]`) is the most
 * dangerous kind of break: the directive silently stops matching and Angular
 * emits only an NG8113 *warning*, so the build stays green while the feature is
 * dead. After an update we grep the consumer's templates for the old selector
 * and warn (with file:line), turning a silent regression into a visible one.
 *
 * Default behavior is warn-only — rewriting HTML template strings blind is
 * risky — but `fix: true` performs the rename for the user.
 */

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage']);
const SCANNED_EXT = new Set(['.html', '.ts', '.mts', '.cts', '.js', '.mjs']);

export interface SelectorRename {
    component: string;
    from: string;
    to: string;
}

export interface StaleSelectorHit {
    file: string;
    line: number;
    component: string;
    from: string;
    to: string;
}

/** Selector renames declared by the given components' breaking metadata. */
export function selectorRenames(components: Iterable<ComponentName>): SelectorRename[] {
    const renames: SelectorRename[] = [];
    for (const name of components) {
        for (const change of registry[name].breaking ?? []) {
            if (change.kind === 'selector' && change.codemod === 'selector' && change.to) {
                renames.push({ component: name, from: change.from, to: change.to });
            }
        }
    }
    return renames;
}

async function collectFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    async function walk(dir: string): Promise<void> {
        let entries: import('node:fs').Dirent[];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return; // unreadable dir — skip
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) await walk(full);
            } else if (SCANNED_EXT.has(path.extname(entry.name))) {
                out.push(full);
            }
        }
    }
    await walk(root);
    return out;
}

/** Match the selector token used as an `<ng-template <token>` attribute. */
function staleSelectorRegex(token: string): RegExp {
    // `<ng-template` (any attrs) then the bare attribute token at a word boundary
    // — scoped to ng-template usage so an unrelated identifier isn't flagged.
    return new RegExp(`<ng-template\\b[^>]*\\b${token}\\b`);
}

/**
 * Scan `projectRoot` for stale selectors from the given components' renames.
 * With `fix`, rewrites each occurrence and reports the hits it changed.
 */
export async function scanStaleSelectors(
    projectRoot: string, components: Iterable<ComponentName>, fix = false,
): Promise<StaleSelectorHit[]> {
    const renames = selectorRenames(components);
    if (renames.length === 0) return [];

    const hits: StaleSelectorHit[] = [];
    for (const file of await collectFiles(projectRoot)) {
        let content = await fs.readFile(file, 'utf-8');
        let changed = false;
        for (const rename of renames) {
            const re = staleSelectorRegex(rename.from);
            const lines = content.split('\n');
            lines.forEach((text, i) => {
                if (re.test(text)) hits.push({ file, line: i + 1, ...rename });
            });
            if (fix && re.test(content)) {
                content = content.replaceAll(
                    new RegExp(`(<ng-template\\b[^>]*\\b)${rename.from}\\b`, 'g'),
                    `$1${rename.to}`,
                );
                changed = true;
            }
        }
        if (changed) await fs.writeFile(file, content);
    }
    return hits;
}
