import { type ComponentName } from '../registry/index.js';
import { resolveDependencies } from './resolve.js';
import { type LayoutScan } from './layout.js';

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
