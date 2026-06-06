import fs from 'fs-extra';
import path from 'node:path';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { DEFAULT_PREFIX } from '../utils/prefix.js';

export type InstallLayout = 'new' | 'legacy' | 'absent';

/**
 * True when the file DECLARES our component's selector token (`<prefix>-<name>`)
 * inside `selector: '...'` metadata — anchored to the selector key, not bare
 * file content, so a consumer file that merely renders `<ui-card>` in its
 * template or mentions it in a comment is NOT mistaken for ours. A genuine
 * legacy install was written by the CLI with that selector; a consumer's own
 * `<name>.component.ts` declares a different selector and must never be treated
 * as ours (so migrate won't delete/convert it, update/doctor won't flag it).
 */
export function declaresOurSelector(content: string, prefix: string, name: ComponentName): boolean {
    const token = `${prefix}-${name}`;
    for (const m of content.matchAll(/selector\s*:\s*(['"])([^'"]*)\1/g)) {
        if (m[2].includes(token)) return true;
    }
    return false;
}

async function isOurLegacyComponent(absPath: string, prefix: string, name: ComponentName): Promise<boolean> {
    if (!await fs.pathExists(absPath)) return false;
    try {
        return declaresOurSelector(await fs.readFile(absPath, 'utf-8'), prefix, name);
    } catch {
        // Unreadable — treat as "not ours" so nothing deletes/converts it.
        return false;
    }
}

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

/**
 * Classify how (or whether) a component is installed under `uiDir`. A flat
 * `<name>.component.ts` only counts as a legacy install of OURS when it
 * declares our `<prefix>-<name>` selector — a consumer's own same-named file is
 * reported `absent` so nothing touches it.
 */
export async function detectLayout(
    name: ComponentName, uiDir: string, prefix: string = DEFAULT_PREFIX,
): Promise<InstallLayout> {
    const newEntry = newEntryFile(name);
    if (!newEntry) {
        const flat = registry[name].files[0];
        return await fs.pathExists(path.join(uiDir, flat)) ? 'new' : 'absent';
    }
    if (await fs.pathExists(path.join(uiDir, newEntry))) return 'new';
    const legacy = legacyEntryFile(name);
    if (legacy && await isOurLegacyComponent(path.join(uiDir, legacy), prefix, name)) return 'legacy';
    return 'absent';
}

export interface LayoutScan {
    /** Folderized components installed in flat (legacy) form. */
    legacy: ComponentName[];
    /** Components installed in the current (folder) form. */
    current: ComponentName[];
}

/** Scan every registry component's install layout under `uiDir`. */
export async function scanLayouts(uiDir: string, prefix: string = DEFAULT_PREFIX): Promise<LayoutScan> {
    const legacy: ComponentName[] = [];
    const current: ComponentName[] = [];
    for (const name of getComponentNames()) {
        const result = await detectLayout(name, uiDir, prefix);
        if (result === 'legacy') legacy.push(name);
        else if (result === 'new') current.push(name);
    }
    return { legacy, current };
}
