/**
 * Pure Markdown input-rule matchers — no Angular, no DOM, no `document`.
 *
 * The editor calls these from its typing path to decide whether the characters
 * just typed complete a recognised Markdown marker. Keeping them here, free of
 * any editor state, is what makes the syntax table testable headlessly and
 * reusable by a consumer writing a custom slash command.
 *
 * The syntax mirrors the subset the editor's own Markdown parser understands
 * (`rich-text-markdown.service.ts`); anything outside that subset is
 * deliberately not a rule.
 */

/**
 * How far back from the caret an inline rule looks. A marker whose opening
 * delimiter is further away than this is not transformed, which bounds the
 * per-keystroke cost on a very long paragraph.
 */
export const INLINE_RULE_LOOKBEHIND = 200;

/** The block-level transform a completed marker asks for. */
export type BlockInputRuleKind =
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'bulletList'
    | 'orderedList'
    | 'blockquote'
    | 'taskUnchecked'
    | 'taskChecked'
    | 'horizontalRule'
    | 'codeBlock';

/** A matched block rule: what to build, and how many characters to remove. */
export interface BlockInputRuleMatch {
    /** The transform to apply to the caret's block. */
    kind: BlockInputRuleKind;
    /** Marker characters including the terminator, counted from the block start. */
    markerLength: number;
    /** The code fence's language word, `''` when the fence carried none. */
    language?: string;
}

/** The inline element a completed wrapper asks for. */
export type InlineInputRuleKind = 'strong' | 'em' | 'code';

/** A matched inline rule, with offsets into the string that was searched. */
export interface InlineInputRuleMatch {
    /** The element to wrap the body in. */
    kind: InlineInputRuleKind;
    /** Offset of the opening delimiter, relative to the searched string. */
    start: number;
    /** Offset just past the closing delimiter, relative to the searched string. */
    end: number;
    /** The body text, with both delimiters stripped. */
    text: string;
}

/** The character that has to follow a marker for it to count as complete. */
type BlockRuleTerminator = ' ' | '\n' | '';

interface BlockRuleDefinition {
    readonly kind: BlockInputRuleKind;
    readonly pattern: RegExp;
    readonly terminators: readonly BlockRuleTerminator[];
}

/**
 * The block syntax table, in match order. `terminators` is the set of
 * characters that complete the marker: a space for the prefix rules, a newline
 * as well for the code fence (typing ``` then Enter opens a block), and the
 * empty string for `---`, which is complete the moment its third dash lands.
 */
const BLOCK_RULES: readonly BlockRuleDefinition[] = [
    { kind: 'heading1', pattern: /^#$/, terminators: [' '] },
    { kind: 'heading2', pattern: /^#{2}$/, terminators: [' '] },
    { kind: 'heading3', pattern: /^#{3}$/, terminators: [' '] },
    { kind: 'bulletList', pattern: /^[-*]$/, terminators: [' '] },
    { kind: 'orderedList', pattern: /^\d{1,3}\.$/, terminators: [' '] },
    { kind: 'blockquote', pattern: /^>$/, terminators: [' '] },
    { kind: 'taskUnchecked', pattern: /^\[]$/, terminators: [' '] },
    { kind: 'taskChecked', pattern: /^\[[xX]]$/, terminators: [' '] },
    { kind: 'horizontalRule', pattern: /^-{3}$/, terminators: [''] },
    { kind: 'codeBlock', pattern: /^`{3}(\w{0,16})$/, terminators: [' ', '\n'] },
];

/**
 * Matches the text before the caret against the block syntax table.
 *
 * `textBeforeCaret` is the caret's block text with the terminator already
 * stripped by the caller; `terminator` says which character completed it
 * (`' '` for a typed space, `'\n'` for Enter, `''` for any other input, which
 * only `---` accepts). The caller alone decides the terminator — a trailing
 * space in the text is never promoted to one here, so an insertion that merely
 * happens to end in a space (a drop, a paste) cannot complete a marker.
 * Non-breaking spaces inside the marker are normalised first, because a
 * contenteditable surface stores a typed space as a non-breaking one.
 *
 * Returns `null` when nothing matches — the overwhelmingly common case, so the
 * table is walked with cheap anchored patterns and no allocation.
 */
export function matchBlockInputRule(
    textBeforeCaret: string,
    terminator: BlockRuleTerminator,
): BlockInputRuleMatch | null {
    const marker = textBeforeCaret.replaceAll('\u00A0', ' ');

    for (const rule of BLOCK_RULES) {
        if (!rule.terminators.includes(terminator)) continue;
        const match = rule.pattern.exec(marker);
        if (!match) continue;
        const markerLength = marker.length + terminator.length;
        return rule.kind === 'codeBlock'
            ? { kind: rule.kind, markerLength, language: match[1] ?? '' }
            : { kind: rule.kind, markerLength };
    }
    return null;
}

interface InlineRuleDefinition {
    readonly kind: InlineInputRuleKind;
    readonly pattern: RegExp;
}

/**
 * The inline syntax table, in precedence order: `**` is tried before `*` so a
 * completed `**bold**` is never read as an emphasis around `*bold*`.
 *
 * Each pattern is anchored at the end of the string and requires a character
 * that is neither whitespace nor a delimiter on both inner edges, so `** **`
 * is not a wrapper and `***` is not an emphasis around a star. The `em` pattern
 * additionally rejects an opening `*` preceded by `*` or a word character:
 * that star belongs to an in-progress `**bold` or to `a*b*`, neither of which
 * the author means as emphasis.
 */
const INLINE_RULES: readonly InlineRuleDefinition[] = [
    { kind: 'strong', pattern: /(?<!\*)\*\*(?=[^\s*])([^*]*[^\s*])\*\*$/ },
    { kind: 'em', pattern: /(?<![*\w])\*(?=[^\s*])([^*]*[^\s*])\*$/ },
    { kind: 'code', pattern: /(?<!`)`([^`]+)`$/ },
];

/**
 * Matches the text before the caret against the inline syntax table, looking
 * back at most {@link INLINE_RULE_LOOKBEHIND} characters.
 *
 * Offsets in the result are relative to the full `textBeforeCaret` string the
 * caller passed, not to the truncated window, so the caller can turn them into
 * text-node offsets without knowing the window size.
 */
export function matchInlineInputRule(textBeforeCaret: string): InlineInputRuleMatch | null {
    const base = Math.max(0, textBeforeCaret.length - INLINE_RULE_LOOKBEHIND);
    const window = textBeforeCaret.slice(base);

    for (const rule of INLINE_RULES) {
        const match = rule.pattern.exec(window);
        if (!match) continue;
        return {
            kind: rule.kind,
            start: base + (match.index ?? 0),
            end: base + (match.index ?? 0) + match[0].length,
            text: match[1],
        };
    }
    return null;
}
