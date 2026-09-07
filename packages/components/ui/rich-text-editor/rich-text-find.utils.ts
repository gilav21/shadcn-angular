/**
 * Pure helpers behind the rich text editor's find & replace.
 *
 * They exist as a separate module so the search can be reasoned about (and unit
 * tested) without a live editor: the component owns DOM, signals and painting,
 * while everything here is a total function over a DOM subtree, a query string
 * or a character offset.
 */

/** One text node in the flattened document, and where its text starts. */
export interface FindSegment {
    /** The text node this segment mirrors. */
    readonly node: Text;
    /** Offset of `node.data[0]` within {@link FindIndex.text}. */
    readonly start: number;
    /** Length of `node.data` at index-build time. */
    readonly length: number;
}

/** The document flattened to one searchable string plus a map back to the DOM. */
export interface FindIndex {
    /** Every searchable text node concatenated, with `\n` at block boundaries. */
    readonly text: string;
    /** The segments making up {@link text}, in document order. */
    readonly segments: readonly FindSegment[];
}

/** A resolved character offset: which text node, and how far into it. */
export interface FindPosition {
    readonly node: Text;
    readonly offset: number;
}

/** The three user-facing search modifiers. */
export interface FindOptions {
    readonly caseSensitive: boolean;
    readonly wholeWord: boolean;
    readonly useRegex: boolean;
}

/**
 * Longest query {@link compileFindRegex} will accept. Longer patterns are
 * rejected like invalid ones: a query that big is never a real search, and the
 * cap bounds the cost of a user-authored regular expression.
 */
export const FIND_MAX_QUERY_LENGTH = 256;

/**
 * Elements whose boundaries break a match. A query may never span two of them,
 * so `<p>cat</p><p>alog</p>` does not contain "catalog".
 */
const BLOCK_TAGS = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE',
    'TD', 'TH', 'TR', 'SUMMARY', 'DETAILS', 'FIGCAPTION', 'HR', 'BR',
]);

/** Subtrees that are atomic chips, not prose: never searched, never replaced. */
const SKIPPED_SELECTOR = '[data-mention], [data-tag], [contenteditable="false"]';

/** Characters that are part of a word for the purposes of the whole-word option. */
const WORD_CHAR = String.raw`\p{L}\p{N}_`;

/**
 * Flatten `root` into one searchable string and the segment map that turns an
 * offset in it back into a DOM position.
 *
 * Block elements contribute a `\n` on entry and exit so a match can never span
 * them; chip subtrees ({@link SKIPPED_SELECTOR}) are skipped whole, so their
 * text is neither counted nor replaceable.
 */
export function buildFindIndex(root: Node): FindIndex {
    const segments: FindSegment[] = [];
    let text = '';

    const appendBreak = (): void => {
        if (text.length > 0 && !text.endsWith('\n')) text += '\n';
    };

    const visit = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            const data = (node as Text).data;
            if (data.length === 0) return;
            segments.push({ node: node as Text, start: text.length, length: data.length });
            text += data;
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const element = node as Element;
        if (element.matches(SKIPPED_SELECTOR)) return;

        const isBlock = BLOCK_TAGS.has(element.tagName);
        if (isBlock) appendBreak();
        for (let child = element.firstChild; child; child = child.nextSibling) visit(child);
        if (isBlock) appendBreak();
    };

    for (let child = root.firstChild; child; child = child.nextSibling) visit(child);
    return { text, segments };
}

/** Escape every regular-expression metacharacter in a literal query. */
function escapeLiteral(query: string): string {
    return query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Compile the user's query into the regular expression the search runs, or
 * `null` when the query cannot be compiled — an invalid pattern in regex mode,
 * or one longer than {@link FIND_MAX_QUERY_LENGTH}. An empty query also yields
 * `null`, since it has no matches by definition.
 *
 * Literal queries are escaped; whole-word wraps the pattern in Unicode-aware
 * look-arounds so it works for any script, not just ASCII.
 */
/**
 * A quantified group that is itself quantified — `(a+)+`, `(a*)*`, `(x+x+)+`.
 *
 * These make the engine try exponentially many ways to split the input, so a
 * six-character pattern hangs the tab outright on a thirty-character line
 * (measured: no completion in twelve seconds). {@link FIND_MAX_QUERY_LENGTH}
 * does not help, because the cost comes from the shape rather than the size.
 * Typing such a pattern into the find box with regex mode on is ordinary use,
 * not an attack, so it is refused the same way an unparseable one is.
 *
 * Deliberately narrow: it looks only for the classic nested-quantifier shape,
 * leaving `a+`, `\\d{2,4}` and `(foo|bar)` — the patterns people actually
 * search with — working.
 */
function hasNestedQuantifier(pattern: string): boolean {
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] !== '(' || pattern[i + 1] === '?') continue;
        const group = scanGroup(pattern, i);
        const after = pattern[group.end];
        if (group.quantifiedInside && (after === '+' || after === '*' || after === '{')) return true;
    }
    return false;
}

/**
 * Walk one parenthesised group, reporting where it ends and whether it contains
 * a quantifier at its own top level. Escapes are skipped so a literal `\\(`
 * does not open a group.
 */
function scanGroup(pattern: string, open: number): { end: number; quantifiedInside: boolean } {
    let depth = 1;
    let quantifiedInside = false;
    let i = open + 1;

    while (i < pattern.length && depth > 0) {
        const ch = pattern[i];
        if (ch === '\\') i++;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (depth === 1 && QUANTIFIERS.has(ch)) quantifiedInside = true;
        i++;
    }

    return { end: i, quantifiedInside };
}

/** Characters that make the token before them repeatable. */
const QUANTIFIERS = new Set(['+', '*', '}']);

export function compileFindRegex(query: string, options: FindOptions): RegExp | null {
    if (!query || query.length > FIND_MAX_QUERY_LENGTH) return null;

    if (options.useRegex && hasNestedQuantifier(query)) return null;

    const body = options.useRegex ? query : escapeLiteral(query);
    const source = options.wholeWord
        ? `(?<![${WORD_CHAR}])(?:${body})(?![${WORD_CHAR}])`
        : body;
    const flags = options.caseSensitive ? 'gu' : 'gui';

    try {
        return new RegExp(source, flags);
    } catch {
        return null;
    }
}

/**
 * Resolve a character offset in {@link FindIndex.text} to the text node and
 * in-node offset holding it, by binary search over the segments.
 *
 * `atEnd` resolves an exclusive end offset: it lands on the segment containing
 * the *previous* character, so a match ending exactly at a segment boundary
 * closes inside the node it actually covered rather than at the start of the
 * next one. Offsets that fall in the `\n` between blocks have no node and
 * yield `null`.
 */
export function offsetToPosition(
    segments: readonly FindSegment[],
    offset: number,
    atEnd = false,
): FindPosition | null {
    const target = atEnd ? offset - 1 : offset;
    if (target < 0) return null;

    let low = 0;
    let high = segments.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const segment = segments[mid];
        if (target < segment.start) {
            high = mid - 1;
        } else if (target >= segment.start + segment.length) {
            low = mid + 1;
        } else {
            return { node: segment.node, offset: target - segment.start + (atEnd ? 1 : 0) };
        }
    }
    return null;
}
