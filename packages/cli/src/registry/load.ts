// Runtime registry loader.
//
// The bundled `registry` object in ./index.ts is only a fallback snapshot.
// At CLI startup we fetch the live `registry.json` from the same GitHub raw
// location that already serves component files, then populate the bundled
// object IN PLACE so every existing `import { registry }` site and helper
// (which read the module-level object at call time) transparently sees the
// fresh data — no call-site changes needed.
//
// This is what removes the need to republish the npm package whenever a
// component, dependency, or lib file changes: only `registry.json` on the
// branch changes, and the live CLI picks it up.

import fs from 'fs-extra';
import { registry, __resetRegistryCaches, type ComponentDefinition } from './index.js';
import { getRegistryManifestUrl, getLocalRegistryJson, DEFAULT_BRANCH } from '../utils/paths.js';

export interface LoadRegistryOptions {
    branch?: string;
    /** Custom registry base URL (e.g. a fork or mirror). */
    registry?: string;
    /** Force the remote fetch even when a local monorepo copy is present. */
    remote?: boolean;
}

function isValidAddonEntry(entry: Record<string, unknown>): boolean {
    if (typeof entry['parent'] !== 'string') return false;
    const attach = entry['attach'];
    if (typeof attach !== 'object' || attach === null) return false;
    const { import: imp, selector } = attach as Record<string, unknown>;
    return typeof imp === 'string' && typeof selector === 'string';
}

function isStringArray(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidRegistryEntry(entry: unknown): boolean {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    if (typeof e['name'] !== 'string' || !Array.isArray(e['files'])) return false;
    if (e['addons'] !== undefined && !isStringArray(e['addons'])) return false;
    if (e['type'] === 'addon') return isValidAddonEntry(e);
    return true;
}

export function isValidRegistryShape(data: unknown): data is Record<string, ComponentDefinition> {
    if (typeof data !== 'object' || data === null) return false;
    return Object.values(data).every(isValidRegistryEntry);
}

async function fetchManifest(options: LoadRegistryOptions): Promise<string> {
    const local = getLocalRegistryJson();
    if (local && !options.remote) {
        return fs.readFile(local, 'utf-8');
    }
    const url = getRegistryManifestUrl(options.branch ?? DEFAULT_BRANCH, options.registry);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} from ${url}`);
    }
    return response.text();
}

/**
 * Fetches the live registry manifest and populates the in-memory `registry`
 * object in place. On any failure (offline, 404, malformed JSON) it warns and
 * leaves the bundled snapshot intact so the CLI keeps working offline.
 *
 * @returns `true` if the live manifest was applied, `false` if the bundled
 *          snapshot was kept.
 */
export async function loadRegistry(options: LoadRegistryOptions = {}): Promise<boolean> {
    try {
        const raw = await fetchManifest(options);
        const data: unknown = JSON.parse(raw);
        if (!isValidRegistryShape(data)) {
            throw new Error('registry manifest has an unexpected shape');
        }
        const mutable = registry as unknown as Record<string, ComponentDefinition>;
        for (const key of Object.keys(mutable)) delete mutable[key];
        Object.assign(mutable, data);
        __resetRegistryCaches();
        return true;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
            `⚠ Could not fetch the live component registry (${reason}); ` +
            `using the bundled copy, which may be stale.`,
        );
        return false;
    }
}
