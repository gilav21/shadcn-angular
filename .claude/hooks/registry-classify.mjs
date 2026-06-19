/**
 * Pure registry-analysis helpers for `validate-registry.mjs`.
 *
 * Kept I/O-free so the new-component classification can be unit-tested
 * directly. The hook itself owns all file reads/writes and the sync call.
 *
 * This module is intentionally a sibling of — not shared with —
 * `packages/cli/scripts/sync-registry-lib.ts`. The hook runs under plain
 * `node`, which cannot import a `.ts` file, whereas the sync script runs
 * under `tsx`. The small directory-owner / file-reference overlap between the
 * two is a deliberate, accepted cost of that runtime split.
 */
import { posix } from 'node:path';

// Component names and `files: [...]` arrays are scanned independently and
// paired by document order: within every registry entry `name:` precedes
// `files:`, so each files array belongs to the nearest preceding name. This
// keeps every pattern linear — no brace-matching backtracking.
const NAME_REGEX = /name:\s*['"]([^'"]+)['"]/g;
const FILES_REGEX = /files:\s*\[([\s\S]*?)\]/g;
const QUOTED_STRING_REGEX = /['"]([^'"]+)['"]/g;

/**
 * True when the registry already declares `name` as a component key.
 * Matches both `name: {` and `'name': {` forms.
 */
export function registryHasComponent(registrySource, name) {
    const safe = name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^\\s*['"]?${safe}['"]?\\s*:\\s*\\{`, 'm').test(registrySource);
}

/**
 * True when the registry already lists this exact `ui/`-relative path inside
 * any entry's files / libFiles array.
 */
export function registryReferencesFile(registrySource, relPath) {
    const safe = relPath.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`['"]${safe}['"]`).test(registrySource);
}

/**
 * True when any path segment of `relPath` is exactly `sub` — the dedicated
 * directory that holds a component's sub-components.
 */
export function pathHasSubSegment(relPath) {
    return relPath.split('/').includes('sub');
}

/**
 * Build a `directory → owning components` map from every registry entry's
 * `files[]`. Directories are `ui/`-relative; a flat file maps to `.`.
 */
export function buildDirOwnerMap(registrySource) {
    const dirOwners = new Map();
    const names = [...registrySource.matchAll(NAME_REGEX)];
    let nameIdx = 0;
    for (const filesMatch of registrySource.matchAll(FILES_REGEX)) {
        while (nameIdx + 1 < names.length && names[nameIdx + 1].index < filesMatch.index) {
            nameIdx++;
        }
        const owner = names[nameIdx];
        if (!owner || owner.index > filesMatch.index) continue;
        const name = owner[1];
        for (const file of filesMatch[1].matchAll(QUOTED_STRING_REGEX)) {
            const dir = posix.dirname(file[1]);
            const owners = dirOwners.get(dir) ?? new Set();
            owners.add(name);
            dirOwners.set(dir, owners);
        }
    }
    return dirOwners;
}

/**
 * True when `relPath` lives in a directory owned by exactly one component —
 * a declared signal that the file is that component's sub-component. The
 * `ui/` root (`.`) is never component-owned: a file there is top-level.
 */
export function isInSingleOwnerDirectory(relPath, dirOwnerMap) {
    const dir = posix.dirname(relPath);
    if (dir === '.') return false;
    const owners = dirOwnerMap.get(dir);
    return owners !== undefined && owners.size === 1;
}

/**
 * Classify a `ui/`-relative component-entry file path, in priority order:
 *  - `referenced`   — already listed in the registry; leave it alone;
 *  - `sub-directory`— under a `sub/` segment; a sub-component, not an entry;
 *  - `single-owner` — in a directory owned by exactly one component; a
 *                     sub-component of that component;
 *  - `new-component`— none of the above; a genuinely new top-level component.
 */
export function classifyComponentFile(relPath, registrySource) {
    if (registryReferencesFile(registrySource, relPath)) return 'referenced';
    if (pathHasSubSegment(relPath)) return 'sub-directory';
    if (isInSingleOwnerDirectory(relPath, buildDirOwnerMap(registrySource))) {
        return 'single-owner';
    }
    return 'new-component';
}
