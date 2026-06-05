import fs from 'fs-extra';
import path from 'node:path';
import { type ComponentName } from '../registry/index.js';
import { resolveDependencies } from './resolve.js';
import { type LayoutScan } from './layout.js';
import { rewriteImports } from './import-rewrite.js';

export interface MigrationPlan {
    /** Legacy (flat) components to convert to folder form. */
    structural: ComponentName[];
    /** Already-folder components whose content will be refreshed. */
    refresh: ComponentName[];
    /** Dependencies newly required by the migrated set, not yet installed. */
    newDeps: ComponentName[];
    /** Names whose imports must be rewritten project-wide (the structural set). */
    migratedNames: Set<string>;
}

/**
 * Compute the migration plan from a layout scan (pure). Only legacy (flat)
 * components change structurally — their import paths move from
 * `<name>.component` to the `<name>` folder barrel — so they are the only
 * names whose consumer imports need rewriting. Already-folder components are
 * refreshed in place; dependencies of the migrated set that aren't installed
 * are pulled fresh so every folder-barrel import resolves.
 */
export function planMigration(scan: LayoutScan): MigrationPlan {
    const structural = [...scan.legacy];
    const refresh = [...scan.current];
    const installed = new Set<ComponentName>([...scan.legacy, ...scan.current]);
    const closure = resolveDependencies([...installed]);
    const newDeps = [...closure].filter(n => !installed.has(n));
    return {
        structural,
        refresh,
        newDeps,
        migratedNames: new Set<string>(scan.legacy),
    };
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage']);
const SOURCE_EXT = new Set(['.ts', '.html']);

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
 * `skipDirs` are excluded entirely — pass the CLI-managed `ui` component dir so
 * the migrated components' own barrels (`export * from './button.component'`,
 * an intra-folder reference to a file that still exists) are left untouched.
 * Only consumer code outside `ui/` should have its imports rewritten.
 */
export async function rewriteProjectImports(
    projectRoot: string, migratedNames: ReadonlySet<string>, skipDirs: string[] = [],
): Promise<string[]> {
    if (migratedNames.size === 0) return [];
    const skip = new Set(skipDirs.map(d => path.resolve(d)));
    const changed: string[] = [];
    for (const file of await collectSourceFiles(projectRoot, skip)) {
        const source = await fs.readFile(file, 'utf-8');
        const result = rewriteImports(source, migratedNames);
        if (result.changed) {
            await fs.writeFile(file, result.content);
            changed.push(file);
        }
    }
    return changed;
}

const LEGACY_SUFFIXES = [
    '.component.ts', '.component.html', '.component.css',
    '.component.spec.ts', '.component.stories.ts',
];

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
