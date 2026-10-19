/**
 * Component-prefix utilities.
 *
 * The source library ships every component with the canonical `ui-` selector
 * prefix (e.g. `selector: 'ui-button'`, `<ui-accordion-item>`). Consumers
 * can pick a different prefix at `init` time (persisted to
 * `components.json` as `prefix`) — when they do, the CLI rewrites
 * occurrences during `add` so the copies in their project use their prefix.
 *
 * `data-slot` attribute values are intentionally NOT rewritten — they are
 * stable styling/testing hooks that don't depend on the selector.
 */

/** Default prefix used by the library and assumed when config omits one. */
export const DEFAULT_PREFIX = 'ui';

/**
 * Lowercase-kebab token: starts with a letter, optional hyphen-separated
 * lowercase-alphanumeric segments. Examples: `ui`, `myapp`, `acme-ui`.
 * Disallows empty, leading digit, uppercase, underscore, trailing hyphen,
 * and consecutive hyphens.
 */
const PREFIX_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function isValidPrefix(value: unknown): value is string {
    return typeof value === 'string' && PREFIX_PATTERN.test(value);
}

export function assertValidPrefix(value: string): void {
    if (!isValidPrefix(value)) {
        throw new Error(
            `Invalid prefix "${value}". Must be lowercase kebab-case starting with a letter (e.g. "ui", "myapp", "acme-ui").`,
        );
    }
}

// ---------------------------------------------------------------------------
// Source transforms
// ---------------------------------------------------------------------------

/**
 * Rewrites occurrences of the canonical `ui-X` selector to `<newPrefix>-X`
 * inside `selector: '...'` / `selector: "..."` metadata in TypeScript
 * sources. Handles single selectors AND comma-separated lists like
 * `selector: 'thead[uiFoo], ui-table-header'`.
 *
 * Anchored to the `selector:` key on purpose — we never touch arbitrary
 * string literals that happen to start with `ui-` (URLs, IDs, etc.).
 */
function rewriteSelectorMetadata(content: string, newPrefix: string): string {
    return content.replaceAll(
        /(selector\s*:\s*)(['"])([^'"]*)\2/g,
        (match, prefix: string, quote: string, value: string) => {
            const rewritten = value.replaceAll(
                /\bui-([a-z][a-z0-9-]*)/g,
                `${newPrefix}-$1`,
            );
            return `${prefix}${quote}${rewritten}${quote}`;
        },
    );
}

/**
 * Rewrites custom-element tags in template markup.
 * Matches `<ui-X`, `</ui-X` followed by a tag-terminator (`>`, `/`, or
 * whitespace) so we only touch real tag positions, not arbitrary `<ui-`
 * substrings that might appear in text content or comments.
 */
function rewriteTemplateTags(content: string, newPrefix: string): string {
    return content.replaceAll(
        /(<\/?)ui-([a-z][a-z0-9-]*)(?=[\s/>])/g,
        `$1${newPrefix}-$2`,
    );
}

/**
 * Rewrites element selectors in CSS sources.
 * Matches `ui-X` only when it appears as an element-selector token —
 * preceded by start-of-file, whitespace, or a CSS combinator/grouping
 * character, and followed by a non-identifier character.
 */
function rewriteCssSelectors(content: string, newPrefix: string): string {
    return content.replaceAll(
        /(^|[\s,>+~({])ui-([a-z][a-z0-9-]*)(?=[\s,>+~){:[.#]|$)/gm,
        `$1${newPrefix}-$2`,
    );
}

/** `<ng-content … select="…">`, single- or double-quoted; `[^>]` spans newlines. */
const NG_CONTENT_SELECT = /(<ng-content\b[^>]*?(?<![\w-])select\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;

/** A `ui-*` element token inside a select list — not an attribute value, class or id. */
const SELECT_ELEMENT_TOKEN = /(^|[\s,(])ui-([a-z][a-z0-9-]*)(?=$|[\s,.[:)#])/g;

/**
 * Rewrites element tokens inside `<ng-content select="…">` slots, so a
 * prefixed `<acme-x>` child still lands in its named slot. Angular never
 * errors on a `select` that matches nothing, so a miss here is silent.
 *
 * Anchored to `<ng-content` for the same reason `rewriteSelectorMetadata` is
 * anchored to `selector:` — a bare `select="…"` attribute can belong to any
 * element, and arbitrary attribute values are never ours to rewrite. Inside the
 * value only element-type tokens change: `[slot=ui-x]`, `.ui-x` and
 * `nav[data-slot=…]` stay as they are.
 */
function rewriteContentSelects(content: string, newPrefix: string): string {
    return content.replaceAll(
        NG_CONTENT_SELECT,
        (match, head: string, doubleQuoted: string | undefined, singleQuoted: string | undefined) => {
            const quote = doubleQuoted === undefined ? "'" : '"';
            const value = (doubleQuoted ?? singleQuoted ?? '').replaceAll(SELECT_ELEMENT_TOKEN, `$1${newPrefix}-$2`);
            return `${head}${quote}${value}${quote}`;
        },
    );
}

/** Canonical token a prefixed selector collapses to. `@@` cannot appear in a
 *  kebab-case selector, so this can never collide with real source. */
const NEUTRAL_PREFIX = '@@UI@@-';

/**
 * Map `<prefix>-X` selector occurrences to a fixed canonical token in two of
 * the positions `applyPrefixTransforms` rewrites: `selector:` metadata and
 * template tags. The installer ALSO rewrites CSS element selectors and
 * `<ng-content select>` values, and those are NOT neutralized here. So a
 * pristine copy of such a file installed under a custom prefix canonicalizes
 * differently from its baseline, and edit-detection conservatively treats it
 * as user-edited: it is kept, never pruned. Mirroring them would mean
 * regenerating both baseline files and making `canonicalize` filename-aware
 * (specs/selector-independent-component-identity-spec.md §D.4 set E, V-5;
 * recorded there as a follow-up). Unlike `applyPrefixTransforms`
 * this is NOT gated on the default prefix — the canonical form must neutralize
 * `ui-` too, so a default install and a custom-prefix install of the same
 * source collapse to one hash for edit-detection. `prefix` is validated
 * kebab-case (no regex metacharacters), so interpolating it is safe.
 */
export function neutralizePrefix(content: string, prefix: string): string {
    const segment = new RegExp(String.raw`\b${prefix}-([a-z][a-z0-9-]*)`, 'g');
    const neutralizeSegment = (value: string): string => value.replaceAll(segment, `${NEUTRAL_PREFIX}$1`);
    const inSelectors = content.replaceAll(
        /(selector\s*:\s*)(['"])([^'"]*)\2/g,
        (match, key: string, quote: string, value: string) =>
            `${key}${quote}${neutralizeSegment(value)}${quote}`,
    );
    const tag = new RegExp(String.raw`(<\/?)${prefix}-([a-z][a-z0-9-]*)(?=[\s/>])`, 'g');
    return inSelectors.replaceAll(tag, `$1${NEUTRAL_PREFIX}$2`);
}

/**
 * Apply prefix-rewrite transforms appropriate for the given file extension.
 * Returns the input unchanged when `newPrefix === DEFAULT_PREFIX` so the
 * default flow stays byte-for-byte identical to today's behavior.
 */
export function applyPrefixTransforms(file: string, content: string, newPrefix: string): string {
    if (newPrefix === DEFAULT_PREFIX) return content;

    if (file.endsWith('.ts')) {
        const tagged = rewriteTemplateTags(rewriteSelectorMetadata(content, newPrefix), newPrefix);
        return rewriteContentSelects(tagged, newPrefix);
    }
    if (file.endsWith('.html')) {
        return rewriteContentSelects(rewriteTemplateTags(content, newPrefix), newPrefix);
    }
    if (file.endsWith('.css')) {
        return rewriteCssSelectors(content, newPrefix);
    }
    return content;
}
