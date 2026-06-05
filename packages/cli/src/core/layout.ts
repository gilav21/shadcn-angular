import fs from 'fs-extra';
import path from 'node:path';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';

export type InstallLayout = 'new' | 'legacy' | 'absent';

/** True when a component's registry files live under a `<name>/` folder. */
export function isFolderized(name: ComponentName): boolean {
    return registry[name].files.some(f => f.startsWith(`${name}/`));
}

/** New-layout entry file (`<name>/<name>.component.ts`), or null when flat. */
export function newEntryFile(name: ComponentName): string | null {
    return isFolderized(name) ? `${name}/${name}.component.ts` : null;
}

/** Legacy flat entry candidate (`<name>.component.ts`), or null when flat. */
export function legacyEntryFile(name: ComponentName): string | null {
    return isFolderized(name) ? `${name}.component.ts` : null;
}

/** Classify how (or whether) a component is installed under `uiDir`. */
export async function detectLayout(name: ComponentName, uiDir: string): Promise<InstallLayout> {
    const newEntry = newEntryFile(name);
    if (!newEntry) {
        const flat = registry[name].files[0];
        return await fs.pathExists(path.join(uiDir, flat)) ? 'new' : 'absent';
    }
    if (await fs.pathExists(path.join(uiDir, newEntry))) return 'new';
    const legacy = legacyEntryFile(name);
    if (legacy && await fs.pathExists(path.join(uiDir, legacy))) return 'legacy';
    return 'absent';
}

export interface LayoutScan {
    /** Folderized components installed in flat (legacy) form. */
    legacy: ComponentName[];
    /** Components installed in the current (folder) form. */
    current: ComponentName[];
}

/** Scan every registry component's install layout under `uiDir`. */
export async function scanLayouts(uiDir: string): Promise<LayoutScan> {
    const legacy: ComponentName[] = [];
    const current: ComponentName[] = [];
    for (const name of getComponentNames()) {
        const result = await detectLayout(name, uiDir);
        if (result === 'legacy') legacy.push(name);
        else if (result === 'new') current.push(name);
    }
    return { legacy, current };
}
