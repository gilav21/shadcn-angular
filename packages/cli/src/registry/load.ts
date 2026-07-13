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

/**
 * A local monorepo checkout only stands in for the DEFAULT source. The moment a
 * caller names another source — `--remote`, a non-default `--branch`, or a
 * `--registry` fork — the local `registry.json` is the wrong manifest: names and
 * `files[]` would be resolved against the checkout while `fetchComponentContent`
 * pulls the SOURCES from the named branch/fork (it falls through to remote for
 * any file the checkout lacks). Honour the explicit source for the manifest too.
 */
function wantsRemoteManifest(options: LoadRegistryOptions): boolean {
    if (options.remote) return true;
    if (options.registry !== undefined) return true;
    return options.branch !== undefined && options.branch !== DEFAULT_BRANCH;
}

async function fetchManifest(options: LoadRegistryOptions): Promise<string> {
    const local = getLocalRegistryJson();
    if (local && !wantsRemoteManifest(options)) {
        return fs.readFile(local, 'utf-8');
    }
    const url = getRegistryManifestUrl(options.branch ?? DEFAULT_BRANCH, options.registry);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} from ${url}`);
    }
    return response.text();
}

type Manifest = Record<string, ComponentDefinition>;

/** The bundled offline snapshot — the fallback whenever a manifest can't be fetched. */
const BUNDLED: Manifest = structuredClone(registry as unknown as Manifest);

/**
 * One manifest per registry source. A branch (or a fork's base URL) is its own
 * registry: `add`ing from branch X must resolve names and `files[]` against X's
 * manifest, not the default branch's. Keyed by base+branch+remote so the CLI's
 * single startup load and an MCP tool call targeting another branch coexist
 * without refetching each other's manifest.
 */
const manifestCache = new Map<string, Manifest>();

/** The source currently applied to the in-memory `registry` object. */
let appliedKey: string | null = null;

function sourceKey(options: LoadRegistryOptions): string {
    return [
        options.registry ?? 'default',
        options.branch ?? DEFAULT_BRANCH,
        options.remote ? 'remote' : 'local',
    ].join('#');
}

/** Repopulate the module-level `registry` object in place (see the file header). */
function applyManifest(data: Manifest, key: string | null): void {
    if (appliedKey === key) return;
    const mutable = registry as unknown as Manifest;
    for (const name of Object.keys(mutable)) delete mutable[name];
    Object.assign(mutable, data);
    __resetRegistryCaches();
    appliedKey = key;
}

/**
 * Fetches the registry manifest for a source (branch / custom base URL) and
 * populates the in-memory `registry` object in place. Manifests are cached per
 * source, so repeat calls for the same branch don't refetch. On any failure
 * (offline, 404, malformed JSON) it warns and applies the bundled snapshot, so
 * the CLI keeps working offline.
 *
 * @returns `true` if a live manifest was applied, `false` if the bundled
 *          snapshot was used.
 */
export async function loadRegistry(options: LoadRegistryOptions = {}): Promise<boolean> {
    const key = sourceKey(options);
    const cached = manifestCache.get(key);
    if (cached) {
        applyManifest(cached, key);
        return true;
    }
    try {
        const raw = await fetchManifest(options);
        const data: unknown = JSON.parse(raw);
        if (!isValidRegistryShape(data)) {
            throw new Error('registry manifest has an unexpected shape');
        }
        manifestCache.set(key, data);
        applyManifest(data, key);
        return true;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
            `⚠ Could not fetch the live component registry (${reason}); ` +
            `using the bundled copy, which may be stale.`,
        );
        applyManifest(BUNDLED, null);
        return false;
    }
}

/** Drop every cached manifest (tests; also resets what is applied). */
export function __resetRegistryManifestCache(): void {
    manifestCache.clear();
    appliedKey = null;
}
