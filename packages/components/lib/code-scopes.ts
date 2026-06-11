/**
 * Built-in scope detectors for `ui-code-block`'s `collapseScope` feature.
 *
 * A `ScopeDetector` takes the source split into lines and returns the
 * foldable ranges. `startLine` and `endLine` are 0-based inclusive indices;
 * `depth` is 0 for outermost scopes and increases with nesting.
 */

export type ScopeRange = { startLine: number; endLine: number; depth: number };
export type ScopeDetector = (lines: readonly string[]) => ScopeRange[];

type BracketPair = { open: string; close: string };

const BRACE_PAIRS: readonly BracketPair[] = [{ open: '{', close: '}' }];
const BRACE_BRACKET_PAIRS: readonly BracketPair[] = [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
];

type ScanState = {
    inString: false | '"' | "'" | '`';
    inLineComment: boolean;
    inBlockComment: boolean;
    escape: boolean;
};

function freshScanState(): ScanState {
    return { inString: false, inLineComment: false, inBlockComment: false, escape: false };
}

function advanceScanner(state: ScanState, ch: string, next: string): boolean {
    if (state.escape) { state.escape = false; return false; }
    if (state.inLineComment) { return false; }
    if (state.inBlockComment) { return advanceScannerInBlockComment(state, ch, next); }
    if (state.inString) { return advanceScannerInString(state, ch); }
    if (ch === '/' && next === '/') { state.inLineComment = true; return false; }
    if (ch === '/' && next === '*') { state.inBlockComment = true; return false; }
    if (ch === '"' || ch === "'" || ch === '`') { state.inString = ch; return false; }
    return true;
}

function advanceScannerInBlockComment(state: ScanState, ch: string, next: string): false {
    if (ch === '*' && next === '/') { state.inBlockComment = false; }
    return false;
}

function advanceScannerInString(state: ScanState, ch: string): false {
    if (ch === '\\') { state.escape = true; return false; }
    if (ch === state.inString) { state.inString = false; }
    return false;
}

function processBracketClose(
    ch: string,
    lineIdx: number,
    stack: { open: string; startLine: number; depth: number }[],
    ranges: ScopeRange[],
    closes: Map<string, string>,
): void {
    const top = stack.pop();
    if (top && top.open === closes.get(ch) && lineIdx > top.startLine) {
        ranges.push({ startLine: top.startLine, endLine: lineIdx, depth: top.depth });
    }
}

function bracketDetector(pairs: readonly BracketPair[]): ScopeDetector {
    const opens = new Set(pairs.map(p => p.open));
    const closes = new Map(pairs.map(p => [p.close, p.open] as const));

    return (lines) => {
        const ranges: ScopeRange[] = [];
        const stack: { open: string; startLine: number; depth: number }[] = [];
        const state = freshScanState();

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                const next = line[i + 1] ?? '';
                if (!advanceScanner(state, ch, next)) { continue; }
                if (opens.has(ch)) {
                    stack.push({ open: ch, startLine: lineIdx, depth: stack.length });
                } else if (closes.has(ch)) {
                    processBracketClose(ch, lineIdx, stack, ranges, closes);
                }
            }
            state.inLineComment = false;
        }
        return ranges;
    };
}

export const braceScopeDetector: ScopeDetector = bracketDetector(BRACE_PAIRS);
export const braceBracketScopeDetector: ScopeDetector = bracketDetector(BRACE_BRACKET_PAIRS);

const INDENT_REGEX = /^[ \t]*/;

function indentOf(line: string): number {
    const match = INDENT_REGEX.exec(line);
    return match ? match[0].length : 0;
}

function isBlank(line: string): boolean {
    return line.trim().length === 0;
}

export const indentScopeDetector: ScopeDetector = (lines) => {
    const ranges: ScopeRange[] = [];
    const openers: { startLine: number; indent: number; depth: number }[] = [];

    const closeUntil = (lineIdx: number, indent: number): void => {
        while (openers.length > 0 && openers[openers.length - 1].indent > indent) {
            const opener = openers.pop();
            if (opener && lineIdx - 1 > opener.startLine) {
                ranges.push({ startLine: opener.startLine, endLine: lineIdx - 1, depth: opener.depth });
            }
        }
    };

    let prevIndent = 0;
    let prevLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (isBlank(lines[i])) { continue; }
        const indent = indentOf(lines[i]);
        if (prevLine !== -1 && indent > prevIndent) {
            openers.push({ startLine: prevLine, indent, depth: openers.length });
        } else if (indent < prevIndent) {
            closeUntil(i, indent);
        }
        prevIndent = indent;
        prevLine = i;
    }
    closeUntil(lines.length, -1);
    return ranges;
};

const TAG_TOKEN_REGEX = /<\/?([a-zA-Z_][\w.\-:]*)\b[^>]*?(\/?)>/g;
const VOID_HTML_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'source', 'track', 'wbr',
]);

function processTagMatch(
    match: RegExpExecArray,
    lineIdx: number,
    stack: { name: string; startLine: number; depth: number }[],
    ranges: ScopeRange[],
): void {
    const [full, name, selfClose] = match;
    const lower = name.toLowerCase();
    const isClose = full.startsWith('</');
    if (isClose) {
        const top = stack.pop();
        if (top && top.name === lower && lineIdx > top.startLine) {
            ranges.push({ startLine: top.startLine, endLine: lineIdx, depth: top.depth });
        }
    } else if (!selfClose && !VOID_HTML_TAGS.has(lower)) {
        stack.push({ name: lower, startLine: lineIdx, depth: stack.length });
    }
}

export const tagScopeDetector: ScopeDetector = (lines) => {
    const ranges: ScopeRange[] = [];
    const stack: { name: string; startLine: number; depth: number }[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        TAG_TOKEN_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = TAG_TOKEN_REGEX.exec(lines[lineIdx])) !== null) {
            processTagMatch(match, lineIdx, stack, ranges);
        }
    }
    return ranges;
};

export const BUILTIN_SCOPE_DETECTORS: Readonly<Record<string, ScopeDetector>> = {
    typescript: braceScopeDetector,
    javascript: braceScopeDetector,
    java: braceScopeDetector,
    csharp: braceScopeDetector,
    css: braceScopeDetector,
    bash: braceScopeDetector,
    json: braceBracketScopeDetector,
    python: indentScopeDetector,
    yaml: indentScopeDetector,
    html: tagScopeDetector,
    xml: tagScopeDetector,
};
