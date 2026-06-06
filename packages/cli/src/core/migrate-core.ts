import fs from 'fs-extra';
import path from 'node:path';
import { type ComponentName } from '../registry/index.js';
import { resolveDependencies } from './resolve.js';
import { type LayoutScan } from './layout.js';
import { rewriteImports } from './import-rewrite.js';

export interface MigrationPlan {
    /** Legacy (flat) components to convert to folder form. */
    structural: ComponentName[];
    /** Everything migrate writes: the dependency closure of the legacy set. */
    writeSet: ComponentName[];
    /** writeSet members not currently installed — pulled fresh. */
    newDeps: ComponentName[];
    /** Already-folder deps of the legacy set — refreshed to a compatible version. */
    refreshed: ComponentName[];
    /** Installed folder components NOT needed by the legacy set — left as-is. */
    untouched: ComponentName[];
}

/**
 * Compute the migration plan from a layout scan (pure). Only legacy (flat)
 * components change structurally — their import paths move from
 * `<name>.component` to the `<name>` folder barrel — so they are the only
 * names whose consumer imports need rewriting. migrate writes the dependency
 * CLOSURE of the legacy set (the legacy components plus the deps they need),
 * so a freshly-written component never calls a newer API on a stale dep;
 * installed folder components the legacy set does NOT depend on are left
 * untouched (run `update` to refresh those).
 */
export function planMigration(scan: LayoutScan): MigrationPlan {
    const structural = [...scan.legacy];
    const installed = new Set<ComponentName>([...scan.legacy, ...scan.current]);
    const writeSet = [...resolveDependencies(structural)];
    const writeSetSet = new Set(writeSet);
    return {
        structural,
        writeSet,
        newDeps: writeSet.filter(n => !installed.has(n)),
        refreshed: writeSet.filter(n => scan.current.includes(n)),
        untouched: scan.current.filter(n => !writeSetSet.has(n)),
    };
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage']);
// Only TS/JS carry ES import specifiers. HTML templates never do, so rewriting
// them is pure risk (a template string like `from './x.component'` could be
// mangled) for no benefit.
const SOURCE_EXT = new Set(['.ts', '.mts', '.cts', '.js', '.mjs']);

async function collectSourceFiles(root: string, skip: ReadonlySet<string>): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
        if (skip.has(path.resolve(dir))) return;
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) await walk(full);
            } else if (SOURCE_EXT.has(path.extname(entry.name))) {
                out.push(full);
            }
        }
    };
    await walk(root);
    return out;
}

/**
 * Rewrite migrated imports across project source files; return changed paths.
 * The CLI-managed `uiDir` is excluded entirely so the migrated components' own
 * barrels (`export * from './button.component'`, an intra-folder reference to a
 * file that still exists) are left untouched. Each rewrite is scoped to imports
 * that actually resolve to `<uiDir>/<name>.component` (via `uiAlias` or a
 * relative path), so a consumer file that merely shares a component name is
 * never corrupted.
 */
export async function rewriteProjectImports(
    projectRoot: string, migratedNames: ReadonlySet<string>,
    uiDir: string, uiAlias: string,
): Promise<string[]> {
    if (migratedNames.size === 0) return [];
    const resolvedUiDir = path.resolve(uiDir);
    const alias = uiAlias.replace(/\/+$/, '');
    const changed: string[] = [];
    for (const file of await collectSourceFiles(projectRoot, new Set([resolvedUiDir]))) {
        const source = await fs.readFile(file, 'utf-8');
        const result = rewriteImports(source, {
            migrated: migratedNames,
            uiAlias: alias,
            uiDir: resolvedUiDir,
            fileDir: path.dirname(file),
        });
        if (result.changed) {
            await fs.writeFile(file, result.content);
            changed.push(file);
        }
    }
    return changed;
}

// Only the component source migrate replaces. Deliberately NOT spec/stories —
// those are the consumer's own tests and must not be deleted (the folder layout
// doesn't reinstall them).
const LEGACY_SUFFIXES = ['.component.ts', '.component.html', '.component.css'];

/** Remove legacy flat files for each migrated component; return deleted rel paths. */
export async function deleteLegacyFiles(
    uiDir: string, structural: ComponentName[],
): Promise<string[]> {
    const deleted: string[] = [];
    for (const name of structural) {
        for (const suffix of LEGACY_SUFFIXES) {
            const rel = `${name}${suffix}`;
            const abs = path.join(uiDir, rel);
            if (await fs.pathExists(abs)) {
                await fs.remove(abs);
                deleted.push(rel);
            }
        }
    }
    return deleted;
}
