import fs from 'fs-extra';
import path from 'node:path';
import { type ComponentName } from '../registry/index.js';
import { resolveDependencies } from './resolve.js';
import { type LayoutScan } from './layout.js';
import { rewriteImports } from './import-rewrite.js';

export interface MigrationPlan {
    /** Legacy (flat) components to convert to folder form (pristine closure). */
    structural: ComponentName[];
    /** Legacy components the consumer customized — left untouched, flagged. */
    customized: ComponentName[];
    /** Pristine legacy components deferred because they depend on a customized
     *  one (a folder component cannot import a still-flat dependency). */
    blocked: ComponentName[];
    /** Everything migrate writes: the dependency closure of `structural`. */
    writeSet: ComponentName[];
    /** writeSet members not currently installed — pulled fresh. */
    newDeps: ComponentName[];
    /** Already-folder deps of the migrated set — refreshed to a compatible version. */
    refreshed: ComponentName[];
    /** Installed folder components NOT needed by the migrated set — left as-is. */
    untouched: ComponentName[];
}

/**
 * Compute the migration plan from a layout scan (pure). Only legacy (flat)
 * components change structurally — their import paths move from
 * `<name>.component` to the `<name>` folder barrel — so they are the only
 * names whose consumer imports need rewriting. migrate writes the dependency
 * CLOSURE of the migrated set, so a freshly-written component never calls a
 * newer API on a stale dep; installed folder components it does NOT depend on
 * are left untouched (run `update` to refresh those).
 *
 * `customized` (legacy components the consumer edited) are NEVER overwritten: a
 * legacy component is migrated only when its entire dependency closure is
 * customization-free, because a folder component cannot import a still-flat
 * dependency. Edited components are left as-is and flagged; pristine components
 * that depend on an edited one are deferred (`blocked`).
 */
export function planMigration(
    scan: LayoutScan, customized: ReadonlySet<ComponentName> = new Set(),
): MigrationPlan {
    const customizedLegacy = scan.legacy.filter(n => customized.has(n));
    const customizedSet = new Set(customizedLegacy);
    const migratable = (n: ComponentName): boolean =>
        [...resolveDependencies([n])].every(d => !customizedSet.has(d));
    const structural = scan.legacy.filter(migratable);
    const blocked = scan.legacy.filter(n => !customizedSet.has(n) && !migratable(n));
    const installed = new Set<ComponentName>([...scan.legacy, ...scan.current]);
    const writeSet = [...resolveDependencies(structural)];
    const writeSetSet = new Set(writeSet);
    return {
        structural,
        customized: customizedLegacy,
        blocked,
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

async function collectSourceFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
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
 * Every file (INCLUDING those under `uiDir`) is scanned, because a pre-existing
 * folder component can import a now-migrated sibling via the old flat path
 * (`../switch.component`) and must be fixed too. Each rewrite is scoped to
 * imports that actually resolve to `<uiDir>/<name>.component` (via `uiAlias` or
 * a relative path), so a component's own barrel self-reference
 * (`./switch.component` → resolves to `<uiDir>/switch/switch.component`, which
 * still exists) and a consumer file that merely shares a component name are
 * both left untouched.
 */
export async function rewriteProjectImports(
    projectRoot: string, migratedNames: ReadonlySet<string>,
    uiDir: string, uiAlias: string,
): Promise<string[]> {
    if (migratedNames.size === 0) return [];
    const resolvedUiDir = path.resolve(uiDir);
    const alias = uiAlias.replace(/\/+$/, '');
    const changed: string[] = [];
    for (const file of await collectSourceFiles(projectRoot)) {
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
