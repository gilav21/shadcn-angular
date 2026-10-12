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
import { fetchText } from '../utils/http.js';
import { findManifestViolations, type ManifestViolation } from './manifest-rules.js';

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

/**
 * A `presets` map: preset name → the addon keys it bundles. An array is not a
 * map, and every value must be a list of strings.
 */
function isPresetMap(value: unknown): boolean {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    return Object.values(value).every(isStringArray);
}

/** Optional fields every consumer iterates as a list of strings. */
const STRING_LIST_FIELDS = [
    'addons', 'testFiles', 'testDependencies', 'peerFiles', 'libFiles', 'obsoleteFiles',
    'requiresBaseFiles', 'dependencies', 'npmDependencies',
] as const;
/** Optional fields every consumer iterates as a list of objects. */
const OBJECT_LIST_FIELDS = ['optionalDependencies', 'shortcutDefinitions'] as const;

function isObjectArray(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null);
}

function isValidRegistryEntry(entry: unknown): boolean {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    if (typeof e['name'] !== 'string' || !isStringArray(e['files'])) return false;
    if (STRING_LIST_FIELDS.some((f) => e[f] !== undefined && !isStringArray(e[f]))) return false;
    if (OBJECT_LIST_FIELDS.some((f) => e[f] !== undefined && !isObjectArray(e[f]))) return false;
    if (e['presets'] !== undefined && !isPresetMap(e['presets'])) return false;
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
    const response = await fetchText(url);
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} from ${url}`);
    }
    return response.text;
}

/** Where {@link fetchManifest} reads the manifest from, for messages — keep the two in sync. */
function manifestLocation(options: LoadRegistryOptions): string {
    const local = getLocalRegistryJson();
    if (local && !wantsRemoteManifest(options)) return local;
    return getRegistryManifestUrl(options.branch ?? DEFAULT_BRANCH, options.registry);
}

const LISTED_VIOLATIONS = 3;

/**
 * Escape C0/C1 control characters the way JSON does. Keys, preset names and the
 * reasons quoting them come from the untrusted manifest, and an ESC sequence
 * printed raw would drive the developer's terminal.
 */
function printable(text: string): string {
    let out = '';
    for (const ch of text) {
        const code = ch.codePointAt(0) ?? 0;
        const control = code < 0x20 || (code >= 0x7f && code < 0xa0);
        out += control ? String.raw`\u${code.toString(16).padStart(4, '0')}` : ch;
    }
    return out;
}

/** The warning for a manifest that parsed but breaks R1–R4 (see manifest-rules.ts). */
function rejectionMessage(location: string, violations: readonly ManifestViolation[]): string {
    const listed = violations.slice(0, LISTED_VIOLATIONS)
        .map((v) => printable(`${v.entry}.${v.field} contains ${JSON.stringify(v.value)} (${v.reason})`))
        .join(', ');
    const more = violations.length > LISTED_VIOLATIONS ? ` (+${violations.length - LISTED_VIOLATIONS} more)` : '';
    return `⚠ Could not use the registry manifest from ${location}: ${listed}${more}; ` +
        `using the bundled copy, which may be stale.`;
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
        const violations = findManifestViolations(data);
        if (violations.length > 0) {
            console.warn(rejectionMessage(manifestLocation(options), violations));
            applyManifest(BUNDLED, null);
            return false;
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
