import { createHash } from 'node:crypto';
import { normalizeContent } from './fetch.js';
import { neutralizePrefix } from '../utils/prefix.js';
import { LEGACY_BASELINES } from '../registry/legacy-baselines.js';

/** Canonical token the lib import path collapses to. `@@` cannot appear in an
 *  import path, so this can never collide with real source. */
const NEUTRAL_LIB = '@@LIB@@/';

/**
 * Collapse both the repo-relative (`../lib/`, `../../lib/`) and the installed
 * (configured `aliases.utils`) forms of the lib import to one token, so a
 * pristine install and the repo source hash to the same value regardless of the
 * consumer's alias.
 */
function neutralizeAlias(content: string, utilsAlias: string): string {
    let result = content.replaceAll(/(?:\.\.\/)+lib\//g, NEUTRAL_LIB);
    const alias = utilsAlias.replace(/\/{1,256}$/, '');
    if (alias) result = result.replaceAll(`${alias}/`, NEUTRAL_LIB);
    return result;
}

/**
 * Config-independent canonical projection of a component source: neutralize the
 * exact two axes the installer rewrites (the selector prefix and the lib alias),
 * then LF/trim-normalize. The generator and the runtime call this SAME function
 * — that identity is what guarantees a pristine install matches a baseline hash.
 */
export function canonicalize(content: string, prefix: string, utilsAlias: string): string {
    return normalizeContent(neutralizePrefix(neutralizeAlias(content, utilsAlias), prefix));
}

export function canonicalHash(content: string, prefix: string, utilsAlias: string): string {
    return createHash('sha256').update(canonicalize(content, prefix, utilsAlias), 'utf8').digest('hex');
}

/**
 * Like `canonicalize`, but also strips the `.component` suffix from relative
 * imports (`from '../select.component'` → `from '../select'`). The flat→folder
 * `migrate` import-rewrite produces that exact transform in installed files, so
 * an installed (migrated) component and the historical flat source it came from
 * canonicalize to the same value — letting clean-reinstall recognize a pristine
 * but superseded file across that refactor. Kept separate from `canonicalize`
 * so the migrate `LEGACY_BASELINES` (which hash flat sources verbatim) are
 * unaffected.
 */
export function canonicalizeComponentFile(content: string, prefix: string, utilsAlias: string): string {
    return canonicalize(content, prefix, utilsAlias)
        .replaceAll(/(from '(?:\.\.?\/)+[\w/-]+)\.component'/g, "$1'");
}

export function componentFileHash(content: string, prefix: string, utilsAlias: string): string {
    return createHash('sha256').update(canonicalizeComponentFile(content, prefix, utilsAlias), 'utf8').digest('hex');
}

export type Baselines = Readonly<Record<string, readonly string[]>>;

export function loadBaselines(): Baselines {
    return LEGACY_BASELINES;
}

/**
 * A legacy flat file is "pristine" iff its canonical hash matches some recorded
 * historical release of that component. No baseline entry — or any failure to
 * canonicalize (e.g. an unexpected prefix) — is treated conservatively as
 * customized: we cannot prove the file is untouched, so we protect it rather
 * than risk overwriting the user's edits. This makes the "never throws"
 * guarantee self-contained, independent of caller-side prefix validation.
 */
export function isPristine(
    baselines: Baselines, name: string, content: string, prefix: string, utilsAlias: string,
): boolean {
    const hashes = baselines[name];
    if (!hashes?.length) return false;
    try {
        return hashes.includes(canonicalHash(content, prefix, utilsAlias));
    } catch {
        return false;
    }
}
