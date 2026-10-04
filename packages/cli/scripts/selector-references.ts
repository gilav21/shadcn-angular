/**
 * Selector-reference guard (specs/selector-independent-component-identity-spec.md §F.5).
 *
 * Invariant: renaming a component's selector, or installing with any
 * `--prefix`, never changes runtime behaviour. So shipped source may name a
 * `ui-*` selector only where the CLI's prefix transform rewrites it (selector
 * metadata, template tags, `<ng-content select>`, `.css` element selectors),
 * and every such name must still be declared somewhere. Anything else — a DOM
 * query string, a stylesheet string, a Tailwind arbitrary variant — is a
 * runtime dependency on selector text and must go, or be allowlisted with a
 * reason when the token is not really a selector (a storage key, a log label).
 *
 * The core functions are pure; `scanRepo` is the only IO.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type PositionKind = 'selector-metadata' | 'tag' | 'select' | 'css-element' | 'other-string';

export interface SelectorReference {
    file: string;
    line: number;
    token: string;
    kind: PositionKind;
}

export interface AllowEntry {
    file: string;
    token: string;
    /**
     * How many `other-string` occurrences of `token` the file holds today. A
     * file allowlisted for a log label must not silently absorb a new
     * `closest('ui-x')`, so any other count is a finding. Known limit: a swap
     * (one use removed, a different one added) keeps the count — review it.
     */
    occurrences: number;
    reason: string;
}

export interface RepoScan {
    files: ReadonlyMap<string, string>;
    declared: ReadonlySet<string>;
    references: SelectorReference[];
}

const PERSISTED_KEY = 'persisted localStorage key prefix, not a selector — renaming it would orphan users\' stored state';
const LOG_LABEL = 'console log label, not a selector';

const UI = 'packages/components/ui';

/**
 * Tokens in selector shape that are not selector dependencies. An entry must
 * match exactly its `occurrences` (T-10): fewer means stale, more means a new
 * use slipped in under an old excuse.
 */
export const SELECTOR_REFERENCE_ALLOWLIST: readonly AllowEntry[] = [
    { file: `${UI}/color-picker/color-picker.utils.ts`, token: 'ui-color-picker', occurrences: 1, reason: PERSISTED_KEY },
    { file: `${UI}/command/command.utils.ts`, token: 'ui-command', occurrences: 1, reason: PERSISTED_KEY },
    { file: `${UI}/sidebar/sidebar.service.ts`, token: 'ui-sidebar', occurrences: 1, reason: PERSISTED_KEY },
    { file: `${UI}/tour/tour.utils.ts`, token: 'ui-tour', occurrences: 1, reason: PERSISTED_KEY },
    { file: `${UI}/data-table/data-table.component.ts`, token: 'ui-data-table', occurrences: 14, reason: LOG_LABEL },
    { file: `${UI}/slider/slider.component.ts`, token: 'ui-slider', occurrences: 1, reason: LOG_LABEL },
    { file: `${UI}/tour/tour.component.ts`, token: 'ui-tour', occurrences: 3, reason: LOG_LABEL },
    {
        file: `${UI}/icon/icon.component.ts`,
        token: 'ui-icon',
        occurrences: 1,
        reason: 'CSS class on the inner <svg> (paired with `ui-icon-<name>`), not an element selector',
    },
];

const SCAN_ROOTS = ['packages/components/ui', 'packages/components/lib', 'packages/blocks'];
const SCANNED_EXTENSIONS = ['.ts', '.html', '.css'];
const EXCLUDED_SUFFIXES = ['.spec.ts', '.stories.ts', '-fixtures.ts', '.fixtures.ts'];

/**
 * A whole `ui-*` token: not inside a longer identifier, not the stem of a
 * `${…}` interpolation. `_` is a valid left boundary on purpose — Tailwind
 * writes a space as `_` in arbitrary variants (`[&_ui-x]`).
 */
const WHOLE_TOKEN = /(?<![A-Za-z0-9-])ui-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w-]|\$\{)/g;
/** The same token upper-cased — a `tagName`/`nodeName` comparison. */
const UPPER_TOKEN = /(?<![A-Za-z0-9-])UI-[A-Z0-9]+(?:-[A-Z0-9]+)*(?![\w-]|\$\{)/g;
/*
 * Positioned tokens use the CLI's own token shape (a letter after `ui-`) and
 * lookarounds no wider than the CLI's, so every position the guard permits is
 * one `applyPrefixTransforms` rewrites (UC-7).
 */
const TOKEN_BODY = String.raw`ui-[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;
/** `selector:` metadata element token; the CLI rewrites any `\bui-` there. */
const METADATA_TOKEN = new RegExp(String.raw`(?<=^|[\s,(>+~])${TOKEN_BODY}(?=$|[\s,.[:)>+~#])`, 'g');
/** `<ng-content select>` element token — exactly the CLI's `SELECT_ELEMENT_TOKEN` lookarounds. */
const SELECT_TOKEN = new RegExp(String.raw`(?<=^|[\s,(])${TOKEN_BODY}(?=$|[\s,.[:)#])`, 'g');
/** Same lookarounds as the CLI's `rewriteCssSelectors`. */
const CSS_ELEMENT_TOKEN = new RegExp(String.raw`(?<=^|[\s,>+~({])${TOKEN_BODY}(?=[\s,>+~){:[.#]|$)`, 'gm');
const TAG_TOKEN = new RegExp(String.raw`<\/?(${TOKEN_BODY})(?=[\s/>])`, 'g');
const NG_CONTENT_SELECT = /<ng-content\b[^>]*?(?<![\w-])select\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/** An occurrence at an absolute offset in the (CRLF-normalised) file. */
interface Span {
    offset: number;
    token: string;
    kind: PositionKind;
}

/** Blank out a match while keeping offsets and line breaks intact. */
function blank(text: string, pattern: RegExp): string {
    return text.replaceAll(pattern, (match) => match.replaceAll(/[^\n]/g, ' '));
}

function matchesOf(text: string, pattern: RegExp, base: number, kind: PositionKind): Span[] {
    return [...text.matchAll(pattern)].map((m) => ({ offset: base + m.index, token: m[0], kind }));
}

function tagSpans(text: string, base: number): Span[] {
    return [...text.matchAll(TAG_TOKEN)].map((m) => ({
        offset: base + m.index + m[0].length - m[1].length,
        token: m[1],
        kind: 'tag' as const,
    }));
}

function selectSpans(text: string, base: number): Span[] {
    const spans: Span[] = [];
    for (const m of text.matchAll(NG_CONTENT_SELECT)) {
        const value = m[1] ?? m[2] ?? '';
        const valueStart = m.index + m[0].length - value.length - 1;
        spans.push(...matchesOf(value, SELECT_TOKEN, base + valueStart, 'select'));
    }
    return spans;
}

/** Markup (an `.html` file or a TS string literal): tags, select slots, and every other whole token. */
function markupSpans(raw: string, base: number): Span[] {
    const text = blank(raw, HTML_COMMENT);
    const positioned = [...tagSpans(text, base), ...selectSpans(text, base)];
    const taken = new Set(positioned.map((s) => s.offset));
    const others = matchesOf(text, WHOLE_TOKEN, base, 'other-string').filter((s) => !taken.has(s.offset));
    const upper = matchesOf(text, UPPER_TOKEN, base, 'other-string').map((s) => ({ ...s, token: s.token.toLowerCase() }));
    return [...positioned, ...others, ...upper];
}

/**
 * `.css`: element tokens in rule preludes only. Declaration values (an
 * `animation` name), at-rule preludes (`@keyframes ui-x`), classes and custom
 * properties are not selector positions.
 */
function cssSpans(raw: string): Span[] {
    const text = blank(raw, CSS_COMMENT);
    const preludes: Array<[number, number]> = [];
    let segmentStart = 0;
    for (const m of text.matchAll(/[{};]/g)) {
        if (m[0] === '{' && !text.slice(segmentStart, m.index).trimStart().startsWith('@')) {
            preludes.push([segmentStart, m.index]);
        }
        segmentStart = m.index + 1;
    }
    // Matched on the RAW text, exactly as the CLI sees it, then narrowed to
    // prelude text outside comments — so every reported position is one the
    // CLI's `rewriteCssSelectors` rewrites.
    const inPrelude = (offset: number): boolean => preludes.some(([from, to]) => offset >= from && offset < to);
    return matchesOf(raw, CSS_ELEMENT_TOKEN, 0, 'css-element')
        .filter((span) => inPrelude(span.offset) && text[span.offset] === 'u');
}

/**
 * The `selector:` value of a `@Component`/`@Directive`-style decorator call, in
 * the exact shape the CLI rewrites: a `'…'`/`"…"` literal holding no quote
 * character (`([^'"]*)` in `rewriteSelectorMetadata`). Anything else — a
 * backtick selector, a mixed-quote value, a `selector` key in a plain object —
 * is an ordinary string and declares nothing.
 */
function isSelectorValue(node: ts.Node, text: string): boolean {
    const property = node.parent;
    if (!ts.isStringLiteral(node) || /['"]/.test(text)) return false;
    if (!ts.isPropertyAssignment(property) || property.initializer !== node) return false;
    if (!ts.isIdentifier(property.name) || property.name.text !== 'selector') return false;
    const call = property.parent.parent;
    return ts.isCallExpression(call) && ts.isDecorator(call.parent);
}

/**
 * The raw source text of a literal's contents, with its absolute start. Template
 * heads and middles keep their trailing `${` so a `ui-x-${n}` stem is never a
 * whole token. Regex literals count too: `/^ui-x$/.test(el.localName)` is a
 * selector dependency like any string.
 */
function literalText(node: ts.Node, source: ts.SourceFile, content: string): { text: string; start: number } | null {
    const start = node.getStart(source) + 1;
    switch (node.kind) {
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        case ts.SyntaxKind.TemplateTail:
            return { text: content.slice(start, node.end - 1), start };
        case ts.SyntaxKind.TemplateHead:
        case ts.SyntaxKind.TemplateMiddle:
        case ts.SyntaxKind.RegularExpressionLiteral:
            return { text: content.slice(start, node.end), start };
        default:
            return null;
    }
}

/** `.ts`: string and template literals only — comments are trivia and never count. */
function typeScriptSpans(file: string, content: string): Span[] {
    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const spans: Span[] = [];
    const visit = (node: ts.Node): void => {
        const literal = literalText(node, source, content);
        if (literal && isSelectorValue(node, literal.text)) {
            spans.push(...matchesOf(literal.text, METADATA_TOKEN, literal.start, 'selector-metadata'));
        } else if (literal) {
            spans.push(...markupSpans(literal.text, literal.start));
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return spans;
}

function spansOf(file: string, content: string): Span[] {
    if (!/ui-/i.test(content)) return [];
    if (file.endsWith('.ts')) return typeScriptSpans(file, content);
    if (file.endsWith('.html')) return markupSpans(content, 0);
    if (file.endsWith('.css')) return cssSpans(content);
    return [];
}

function lineStarts(content: string): number[] {
    const starts = [0];
    for (const m of content.matchAll(/\n/g)) starts.push(m.index + 1);
    return starts;
}

function lineOf(starts: readonly number[], offset: number): number {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (starts[mid] <= offset) low = mid;
        else high = mid - 1;
    }
    return low + 1;
}

/**
 * Every selector-shaped reference in one file. Positions the CLI rewrites are
 * returned whatever the token (the STALE check needs them); `other-string`
 * tokens only when they name a declared selector.
 */
export function findSelectorReferences(file: string, content: string, declared: ReadonlySet<string>): SelectorReference[] {
    const normalised = content.replaceAll('\r\n', '\n');
    const starts = lineStarts(normalised);
    return spansOf(file, normalised)
        .filter((span) => span.kind !== 'other-string' || declared.has(span.token))
        .sort((a, b) => a.offset - b.offset)
        .map((span) => ({ file, line: lineOf(starts, span.offset), token: span.token, kind: span.kind }));
}

/** Every element-type `ui-*` selector declared in `selector:` metadata — components and directives alike. */
export function declaredSelectors(files: ReadonlyMap<string, string>): ReadonlySet<string> {
    const declared = new Set<string>();
    const none: ReadonlySet<string> = new Set();
    for (const [file, content] of files) {
        if (!file.endsWith('.ts')) continue;
        for (const ref of findSelectorReferences(file, content, none)) {
            if (ref.kind === 'selector-metadata') declared.add(ref.token);
        }
    }
    return declared;
}

const RUNTIME_ADVICE = 'use ElementRef / data-slot, or allowlist it with a reason';

const allowKey = (file: string, token: string): string => `${file}\u0000${token}`;

function countOtherStrings(refs: readonly SelectorReference[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const ref of refs) {
        if (ref.kind !== 'other-string') continue;
        const key = allowKey(ref.file, ref.token);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

function findingFor(ref: SelectorReference, declared: ReadonlySet<string>, allowed: ReadonlySet<string>): string | null {
    const where = `${ref.file}:${ref.line}`;
    if (ref.kind !== 'other-string') {
        return declared.has(ref.token)
            ? null
            : `  ${'STALE'.padEnd(7)} ${where}  ${ref.kind} token "${ref.token}" names no declared selector`;
    }
    if (!declared.has(ref.token) || allowed.has(allowKey(ref.file, ref.token))) return null;
    return `  RUNTIME ${where}  "${ref.token}" in a string literal — ${RUNTIME_ADVICE}`;
}

function allowEntryFinding(entry: AllowEntry, found: number): string | null {
    if (found === 0) return `  ALLOW-STALE ${entry.file}  allowlist entry for "${entry.token}" matches nothing — remove it`;
    if (found === entry.occurrences) return null;
    return `  ALLOW-COUNT ${entry.file}  "${entry.token}" occurs ${found} time(s), allowlist expects ${entry.occurrences}`
        + ' — review the new use, then update the entry';
}

/**
 * Finding lines in input order, allowlist findings last; `[]` means clean. An
 * entry suppresses its references only while its occurrence count still holds.
 */
export function checkReferences(
    refs: SelectorReference[],
    declared: ReadonlySet<string>,
    allow: readonly AllowEntry[],
): string[] {
    const counts = countOtherStrings(refs);
    const allowed = new Set(
        allow
            .filter((entry) => counts.get(allowKey(entry.file, entry.token)) === entry.occurrences)
            .map((entry) => allowKey(entry.file, entry.token)),
    );
    const findings = refs
        .map((ref) => findingFor(ref, declared, allowed))
        .filter((line): line is string => line !== null);
    for (const entry of allow) {
        const line = allowEntryFinding(entry, counts.get(allowKey(entry.file, entry.token)) ?? 0);
        if (line) findings.push(line);
    }
    return findings;
}

function isScanned(name: string): boolean {
    return SCANNED_EXTENSIONS.some((ext) => name.endsWith(ext))
        && !EXCLUDED_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function walk(root: string, dir: string, files: Map<string, string>): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== 'dist') walk(root, full, files);
        } else if (isScanned(entry.name)) {
            files.set(path.relative(root, full).replaceAll('\\', '/'), readFileSync(full, 'utf8'));
        }
    }
}

/** Reads the shipped library and scans it. */
export function scanRepo(root: string): RepoScan {
    const files = new Map<string, string>();
    for (const scanRoot of SCAN_ROOTS) walk(root, path.join(root, scanRoot), files);
    const declared = declaredSelectors(files);
    const references = [...files].flatMap(([file, content]) => findSelectorReferences(file, content, declared));
    return { files, declared, references };
}
