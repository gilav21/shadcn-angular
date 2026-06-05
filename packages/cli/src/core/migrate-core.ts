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

async function collectSourceFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) await walk(path.join(dir, entry.name));
            } else if (SOURCE_EXT.has(path.extname(entry.name))) {
                out.push(path.join(dir, entry.name));
            }
        }
    };
    await walk(root);
    return out;
}

/** Rewrite migrated imports across all project source files; return changed paths. */
export async function rewriteProjectImports(
    projectRoot: string, migratedNames: ReadonlySet<string>,
): Promise<string[]> {
    if (migratedNames.size === 0) return [];
    const changed: string[] = [];
    for (const file of await collectSourceFiles(projectRoot)) {
        const source = await fs.readFile(file, 'utf-8');
        const result = rewriteImports(source, migratedNames);
        if (result.changed) {
            await fs.writeFile(file, result.content);
            changed.push(file);
        }
    }
    return changed;
}
