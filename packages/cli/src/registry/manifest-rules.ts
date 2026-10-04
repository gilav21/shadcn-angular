/**
 * Load-time rules for a registry manifest. A registry is trusted for the
 * CONTENT of the files it ships, never for WHERE they go, what they name, or
 * text the CLI splices into commands and consumer code:
 *
 * - R1 paths: relative POSIX, `[A-Za-z0-9._-]` segments, no `.`/`..` segment.
 * - R2 names: every key is a component key equal to its `name`; every name
 *   reference resolves to an OWN key of the manifest.
 * - R3 package specs: `name` or `name@range`, never a flag, path, URL or git spec.
 * - R4 code tokens: attach symbols and shortcut export names are identifiers,
 *   attach selectors are selector tokens, shortcut component names are keys.
 *
 * Every rule is an allow-list: a form nobody thought of is rejected, not let through.
 */

import { parseAttachSymbol } from '../core/apply-wire.js';

/** One reason a manifest cannot be trusted, phrased for the developer. */
export interface ManifestViolation {
    /** Registry key, e.g. `page-builder`. */
    readonly entry: string;
    /** e.g. `obsoleteFiles`, `attach.selector`, `presets.writing`. */
    readonly field: string;
    /** The offending value, verbatim. */
    readonly value: string;
    /** e.g. `path leaves its install directory`. */
    readonly reason: string;
}

const PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;
const COMPONENT_KEY = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)?$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const ATTACH_SELECTOR = /^[A-Za-z][\w-]*$/;
// npm's documented name rules: lowercase, URL-safe, no leading `.`/`_`, an
// optional `@scope/`. Deliberately stricter than npm on legacy names (no
// uppercase, no leading `-`) — rejection only costs a fork its npm deps. The
// range forbids whitespace, `:` and `/`, which is what shuts out `file:`,
// `git+…`, `npm:` aliases and URLs.
const PACKAGE_NAME = /^(?:@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*$/;
const PACKAGE_RANGE = /^[\w.^~<>=*|+-]+$/;
const MAX_PACKAGE_NAME = 214;

const PATH_REASON = 'path leaves its install directory';
const KEY_REASON = 'not a component key';
const IDENTIFIER_REASON = 'not a JavaScript identifier';
const SELECTOR_REASON = 'not a selector token';
const PACKAGE_REASON = 'not a plain registry package spec (name or name@range)';

/** Fields whose elements are paths relative to the ui or lib directory. */
const PATH_LIST_FIELDS = ['files', 'peerFiles', 'libFiles', 'obsoleteFiles', 'testFiles', 'requiresBaseFiles'] as const;
/** Fields whose elements name another manifest entry. */
const NAME_LIST_FIELDS = ['dependencies', 'testDependencies', 'addons'] as const;

type Entry = Record<string, unknown>;

/** R1 — a path that cannot name anything outside the directory it is joined to. */
export function isSafeRelativePath(value: string): boolean {
    return value.split('/').every(s => s !== '.' && s !== '..' && PATH_SEGMENT.test(s));
}

/** R2 — the shape of a registry key: `name` or `parent/addon`. */
export function isComponentKey(value: string): boolean {
    return COMPONENT_KEY.test(value);
}

/** R3 — `name` or `name@range`, as the package manager's registry resolves it. */
export function isRegistryPackageSpec(value: string): boolean {
    const at = value.indexOf('@', 1);
    const name = at === -1 ? value : value.slice(0, at);
    if (name.length > MAX_PACKAGE_NAME || !PACKAGE_NAME.test(name)) return false;
    return at === -1 || PACKAGE_RANGE.test(value.slice(at + 1));
}

/** R4 — a JavaScript identifier (attach symbol, shortcut export name). */
export function isIdentifier(value: string): boolean {
    return IDENTIFIER.test(value);
}

/** R4 — a selector token the CLI may insert into a consumer template. */
export function isAttachSelector(value: string): boolean {
    return ATTACH_SELECTOR.test(value);
}

function asList(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asEntry(value: unknown): Entry {
    return typeof value === 'object' && value !== null ? value as Entry : {};
}

/** A violation when `value` is not a string satisfying `rule`, else null. */
function check(
    entry: string, field: string, value: unknown, rule: (v: string) => boolean, reason: string,
): ManifestViolation | null {
    if (typeof value === 'string' && rule(value)) return null;
    return { entry, field, value: String(value), reason };
}

function checkPaths(key: string, entry: Entry): (ManifestViolation | null)[] {
    const out = PATH_LIST_FIELDS.flatMap(field =>
        asList(entry[field]).map(p => check(key, field, p, isSafeRelativePath, PATH_REASON)));
    asList(entry['shortcutDefinitions']).forEach((sd, i) => {
        out.push(check(key, `shortcutDefinitions[${i}].sourceFile`, asEntry(sd)['sourceFile'], isSafeRelativePath, PATH_REASON));
    });
    return out;
}

function checkKey(key: string, entry: Entry): (ManifestViolation | null)[] {
    const name = entry['name'];
    return [
        check(key, 'key', key, isComponentKey, KEY_REASON),
        name === key ? null : { entry: key, field: 'name', value: String(name), reason: `key does not match its name "${String(name)}"` },
    ];
}

function checkReferences(key: string, entry: Entry, data: Record<string, unknown>): (ManifestViolation | null)[] {
    const refs: [string, unknown][] = [];
    for (const field of NAME_LIST_FIELDS) {
        for (const ref of asList(entry[field])) refs.push([field, ref]);
    }
    asList(entry['optionalDependencies']).forEach((dep, i) => {
        refs.push([`optionalDependencies[${i}].name`, asEntry(dep)['name']]);
    });
    for (const [preset, addons] of Object.entries(asEntry(entry['presets']))) {
        for (const ref of asList(addons)) refs.push([`presets.${preset}`, ref]);
    }
    if (entry['parent'] !== undefined) refs.push(['parent', entry['parent']]);
    return refs.map(([field, ref]) => {
        const own = typeof ref === 'string' && Object.hasOwn(data, ref);
        return own ? null : { entry: key, field, value: String(ref), reason: `refers to "${String(ref)}", which this registry does not define` };
    });
}

function checkPackages(key: string, entry: Entry): (ManifestViolation | null)[] {
    return asList(entry['npmDependencies']).map(spec => check(key, 'npmDependencies', spec, isRegistryPackageSpec, PACKAGE_REASON));
}

function checkTokens(key: string, entry: Entry): (ManifestViolation | null)[] {
    const out: (ManifestViolation | null)[] = [];
    if (entry['attach'] !== undefined) {
        const attach = asEntry(entry['attach']);
        const imp = attach['import'];
        const symbolOk = typeof imp === 'string' && isIdentifier(parseAttachSymbol(imp));
        out.push(symbolOk ? null : { entry: key, field: 'attach.import', value: String(imp), reason: IDENTIFIER_REASON });
        out.push(check(key, 'attach.selector', attach['selector'], isAttachSelector, SELECTOR_REASON));
    }
    asList(entry['shortcutDefinitions']).forEach((sd, i) => {
        const def = asEntry(sd);
        out.push(check(key, `shortcutDefinitions[${i}].exportName`, def['exportName'], isIdentifier, IDENTIFIER_REASON));
        out.push(check(key, `shortcutDefinitions[${i}].componentName`, def['componentName'], isComponentKey, KEY_REASON));
    });
    return out;
}

/** Every violation of R1–R4 in a parsed manifest; `[]` when it is safe to apply. */
export function findManifestViolations(data: Record<string, unknown>): ManifestViolation[] {
    const violations: ManifestViolation[] = [];
    for (const [key, value] of Object.entries(data)) {
        const entry = asEntry(value);
        for (const v of [
            ...checkKey(key, entry),
            ...checkPaths(key, entry),
            ...checkReferences(key, entry, data),
            ...checkPackages(key, entry),
            ...checkTokens(key, entry),
        ]) {
            if (v !== null) violations.push(v);
        }
    }
    return violations;
}
