/**
 * The syntax tokenizer, shared by every surface that shows code.
 *
 * It began inside `ui-code-block` as private methods over a private pattern
 * table. The rich text editor and its read-only view need exactly the same
 * tokens — `rich-text-markdown.service.ts` has always stored and round-tripped
 * a code block's language, and the sanitizer has always allowed the
 * `language-*` and `token-*` classes — so the tokenizer moved here rather than
 * being written a second time. Rendering the whole `ui-code-block` COMPONENT
 * inside a document was the alternative and is wrong: it brings a copy button,
 * a line-number gutter, fold chevrons and a hard-coded dark surface into prose,
 * and none of that can live inside a contenteditable.
 *
 * Two rules the callers rely on:
 *
 * 1. **A line is tokenized on its own.** Highlighting never spans lines, so a
 *    multi-line string or block comment is coloured per line. That is what lets
 *    the editor re-highlight one line without re-reading the block.
 * 2. **An unknown language is not a guess.** {@link languagePatternsFor}
 *    returns `null` for a language it does not know, and for none at all.
 *    `ui-code-block` is a code viewer and keeps its documented TypeScript
 *    fallback, but a DOCUMENT is mostly prose: a fence with no language, or one
 *    tagged `text`, `log` or `diff`, would otherwise be coloured by TypeScript
 *    rules, inventing keywords in the reader's notes.
 */

/** One run of characters and what the tokenizer made of it. */
export interface CodeToken {
    type: string;
    text: string;
}

/** A language's rules: the first pattern to match at the lowest index wins. */
export type LanguagePattern = { type: string; regex: RegExp }[];

/**
 * Build a word-boundary keyword matcher from a list. Constructed at runtime so
 * the (legitimately long) per-language keyword set is a maintainable array
 * rather than one giant, hard-to-read regex literal.
 */
const keywordPattern = (words: readonly string[]): RegExp =>
    new RegExp(String.raw`\b(${words.join('|')})\b`);

const TS_KEYWORDS = ['const', 'let', 'var', 'function', 'class', 'import', 'from', 'return', 'if', 'else', 'for', 'while', 'export', 'interface', 'type', 'public', 'private', 'protected', 'implements', 'extends', 'new', 'this', 'true', 'false', 'null', 'undefined', 'void', 'async', 'await'];
const JS_KEYWORDS = ['const', 'let', 'var', 'function', 'class', 'import', 'from', 'return', 'if', 'else', 'for', 'while', 'export', 'new', 'this', 'true', 'false', 'null', 'undefined', 'void', 'async', 'await'];
const PYTHON_KEYWORDS = ['def', 'class', 'import', 'from', 'if', 'else', 'elif', 'for', 'while', 'return', 'try', 'except', 'finally', 'with', 'as', 'pass', 'break', 'continue', 'lambda', 'yield', 'async', 'await', 'True', 'False', 'None'];
const JAVA_KEYWORDS = ['public', 'private', 'protected', 'class', 'interface', 'enum', 'extends', 'implements', 'new', 'this', 'super', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'void', 'int', 'boolean', 'char', 'byte', 'short', 'long', 'float', 'double', 'static', 'final', 'abstract', 'synchronized', 'volatile', 'transient', 'native', 'strictfp', 'instanceof', 'null', 'true', 'false'];
const CSHARP_KEYWORDS = ['public', 'private', 'protected', 'internal', 'class', 'struct', 'record', 'interface', 'enum', 'delegate', 'event', 'void', 'int', 'string', 'bool', 'var', 'async', 'await', 'Task', 'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'base', 'using', 'namespace', 'static', 'readonly', 'const', 'override', 'virtual', 'abstract', 'sealed', 'get', 'set', 'value'];

/** The built-in language rules, keyed by lowercase language name. */
export const LANGUAGE_PATTERNS: Readonly<Record<string, LanguagePattern>> = {
    typescript: [
        { type: 'comment', regex: /\/\/.*/ },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
        { type: 'keyword', regex: keywordPattern(TS_KEYWORDS) },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$]\w*(?=\()/ },
    ],
    javascript: [
        { type: 'comment', regex: /\/\/.*/ },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
        { type: 'keyword', regex: keywordPattern(JS_KEYWORDS) },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$]\w*(?=\()/ },
    ],
    python: [
        { type: 'comment', regex: /#.*/ },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
        { type: 'decorator', regex: /@[\w.]+/ },
        { type: 'keyword', regex: keywordPattern(PYTHON_KEYWORDS) },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_]\w*(?=\()/ },
    ],
    java: [
        { type: 'comment', regex: /\/\/.*/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'keyword', regex: keywordPattern(JAVA_KEYWORDS) },
        { type: 'decorator', regex: /@\w+/ },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$]\w*(?=\()/ },
    ],
    html: [
        { type: 'comment', regex: /<!--[\s\S]*?-->/ },
        { type: 'tag', regex: /<\/?[a-z0-9-]+/i },
        { type: 'attr', regex: /[a-z0-9-]{1,256}(?==)/i },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
    ],
    xml: [
        { type: 'comment', regex: /<!--[\s\S]*?-->/ },
        { type: 'decorator', regex: /<\?xml[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>/i },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
        { type: 'tag', regex: /<\/?[a-zA-Z_][\w.\-:]{0,256}/ },
        { type: 'attr', regex: /[a-zA-Z_][\w.\-:]{0,256}(?==)/ },
        { type: 'keyword', regex: /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/ },
        { type: 'number', regex: /\b\d+\b/ },
    ],
    css: [
        { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
        { type: 'selector', regex: /[.#]?[a-zA-Z0-9_-]{1,256}(?=\{)/ },
        { type: 'property', regex: /[a-z0-9-]{1,256}(?=:)/i },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
        { type: 'number', regex: /\b\d+(?:px|rem|em|%|vh|vw|s|ms|deg)?\b/ },
    ],
    json: [
        { type: 'function', regex: /"[^"]+":/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'keyword', regex: /\b(true|false|null)\b/ },
        { type: 'number', regex: /\b\d+\b/ },
    ],
    csharp: [
        { type: 'comment', regex: /\/\/.*/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"/ },
        { type: 'decorator', regex: /\[[a-zA-Z]\w*\]/ },
        { type: 'keyword', regex: keywordPattern(CSHARP_KEYWORDS) },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'function', regex: /\b[a-zA-Z_$]\w*(?=\()/ },
    ],
    yaml: [
        { type: 'comment', regex: /#.*/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
        { type: 'attr', regex: /[a-zA-Z0-9_-]{1,256}(?=:)/ },
        { type: 'keyword', regex: /\b(true|false|null|yes|no|on|off)\b/ },
        { type: 'number', regex: /\b\d+(\.\d+)?\b/ },
    ],
    bash: [
        { type: 'comment', regex: /#.*/ },
        { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
        { type: 'keyword', regex: /\b(echo|ls|cd|pwd|mkdir|rm|cp|mv|touch|cat|grep|open|ssh|git|npm|node|ng|sudo|chmod|chown)\b/ },
        { type: 'decorator', regex: /\$\w+/ },
    ],
};

/**
 * Spellings an author writes in a fence that mean a language the table already
 * knows. A markdown fence carries whatever the author typed, and "ts" is far
 * more common than "typescript".
 */
const LANGUAGE_ALIASES: Readonly<Record<string, string>> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    'c#': 'csharp',
    cs: 'csharp',
    yml: 'yaml',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    htm: 'html',
    svg: 'xml',
    scss: 'css',
};

/**
 * The rules for a language, or `null` when it is one this module does not know.
 *
 * `null` is a real answer, not a failure: see rule 2 in the module comment. The
 * caller decides what to do with it — `ui-code-block` substitutes TypeScript,
 * a document leaves the code alone.
 */
export function languagePatternsFor(language: string | null | undefined): LanguagePattern | null {
    if (!language) return null;
    const key = language.toLowerCase();
    return LANGUAGE_PATTERNS[LANGUAGE_ALIASES[key] ?? key] ?? null;
}

/**
 * Tokenize ONE line. See rule 1 in the module comment: highlighting never spans
 * lines, so the caller splits and calls this per line.
 */
export function tokenizeLine(line: string, patterns: LanguagePattern): CodeToken[] {
    if (!line) return [];
    const tokens: CodeToken[] = [];
    let cursor = 0;

    while (cursor < line.length) {
        const remaining = line.slice(cursor);
        const best = findBestMatch(remaining, patterns);

        if (best?.index === 0) {
            tokens.push({ type: best.type, text: best.text });
            cursor += best.text.length;
        } else if (best) {
            tokens.push({ type: 'text', text: remaining.slice(0, best.index) });
            cursor += best.index;
        } else {
            tokens.push({ type: 'text', text: remaining });
            cursor += remaining.length;
        }
    }

    return tokens;
}

function findBestMatch(
    remaining: string,
    patterns: LanguagePattern,
): { type: string; text: string; index: number } | null {
    let best: { type: string; text: string; index: number } | null = null;
    for (const pattern of patterns) {
        const match = pattern.regex.exec(remaining);
        if (match && (best === null || match.index < best.index)) {
            best = { type: pattern.type, text: match[0], index: match.index };
        }
    }
    return best;
}

/**
 * The class a document's highlighter marks a token with.
 *
 * `token` plus `token-<type>`, which `rich-text-sanitizer.service.ts` has
 * allowed since before there was a highlighter: markup coloured elsewhere and
 * pasted in already survived sanitization with these exact classes, so the
 * colours this produces and the colours a paste brings are one set of rules.
 * The colours themselves live in RICH_TEXT_PROSE_CLASSES, where the editor and
 * the view share them and light and dark each get their own.
 *
 * A `text` run gets no class at all: it is the code's own colour, and a span
 * per unstyled run would triple the node count for nothing.
 */
export function tokenClassFor(type: string): string | null {
    return type === 'text' ? null : `token token-${type}`;
}

/**
 * How a line break is written inside a code block: a newline character, or a
 * `<br>` element. The editor's Shift+Enter inserts the element.
 */
type LineBreakKind = 'newline' | 'br';

/** A code block's text, read as lines, with the kind of every break between them. */
interface CodeLines {
    /** The block's text with EVERY line break as `\n`, whichever form it took. */
    text: string;
    /** The form of each break, in order: one per `\n` in {@link text}. */
    breaks: LineBreakKind[];
    /**
     * A `<br>` that ends the block. It shows no line of its own — a browser needs
     * it only to give an empty last line somewhere to put the caret — so it is
     * not text, but it has to be written back or that empty line disappears.
     */
    trailingBr: boolean;
}

/**
 * A code block's text with its line breaks, whichever form each one takes.
 *
 * The rule every reader of a code block has to follow: a line break is a line
 * break, whether it is a `\n` character or a `<br>` element. `textContent`
 * does not follow it — a `<br>` contributes nothing — and Shift+Enter, the
 * editor's key for a new line inside a block, inserts `<br>`. So a function
 * typed line by line was saved as one line, and the highlighter, which refused
 * any block holding an element, stopped colouring from the first new line on.
 */
export function readCodeLines(node: Node): CodeLines {
    const lines: CodeLines = { text: '', breaks: [], trailingBr: false };
    collectCodeLines(node, lines);
    if (lines.breaks.at(-1) === 'br' && lines.text.endsWith('\n') && endsWithBr(node)) {
        lines.text = lines.text.slice(0, -1);
        lines.breaks.pop();
        lines.trailingBr = true;
    }
    return lines;
}

function collectCodeLines(node: Node, into: CodeLines): void {
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            const data = (child as Text).data;
            into.text += data;
            into.breaks.push(...Array.from(data.matchAll(/\n/g), (): LineBreakKind => 'newline'));
        } else if (child.nodeName === 'BR') {
            into.text += '\n';
            into.breaks.push('br');
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            collectCodeLines(child, into);
        }
    }
}

/** Whether the last thing in `node`, looking into nested elements, is a `<br>`. */
function endsWithBr(node: Node): boolean {
    let last = node.lastChild;
    while (last?.nodeType === Node.ELEMENT_NODE && last.nodeName !== 'BR') last = last.lastChild;
    return last?.nodeName === 'BR';
}

/** A code block's text with every line break as `\n`; see {@link readCodeLines}. */
export function codeTextOf(node: Node): string {
    return readCodeLines(node).text;
}

/**
 * Whether the paint can rebuild the block without losing anything.
 *
 * The paint is rebuilt from the block's lines, so it may only run where lines
 * are all there is. A code block CAN hold more: the markdown writer keeps an
 * image in one by writing the block in its tag form, and rebuilding that block
 * deleted the image outright. A `<br>` is a line break and is rebuilt; a span
 * this module painted is exactly what the rebuild replaces — including one a
 * browser has typed a `<br>` into, which happens when Shift+Enter lands inside
 * a coloured word.
 */
function isTextOnlyCode(code: HTMLElement): boolean {
    return Array.from(code.querySelectorAll('*')).every((element) => element.matches('span.token, br'));
}

/**
 * Marks a document's `<pre><code>` element up with token spans, in place.
 *
 * The element's own TEXT is the source of truth and is never changed — the
 * children are rebuilt from `textContent`, so running this twice is the same as
 * running it once and a block that was already highlighted re-highlights
 * cleanly. That idempotence is what lets the editor re-run it on every quiet
 * moment without the markup growing.
 *
 * Returns whether anything was painted, so a caller that has to restore a caret
 * can skip the work when nothing moved.
 */
export function highlightCodeElement(code: HTMLElement, language: string | null | undefined): boolean {
    const painted = paintedFragment(code, language);
    if (!painted) return false;
    code.replaceChildren(painted);
    return true;
}

/**
 * The token markup for a block, built detached, or `null` when the block is not
 * one to paint. Built apart from the element so a caller can compare it with
 * what is already there BEFORE any node is replaced.
 */
function paintedFragment(code: HTMLElement, language: string | null | undefined): DocumentFragment | null {
    const patterns = languagePatternsFor(language);
    if (!patterns || !isTextOnlyCode(code)) return null;
    const { text, breaks, trailingBr } = readCodeLines(code);
    if (text === '') return null;

    const doc = code.ownerDocument;
    const painted = doc.createDocumentFragment();
    const lines = text.split('\n');

    lines.forEach((line, index) => {
        // Every break is written back as its own node AND in the form it had.
        // As `\n` inside the last token, a trailing blank line was dropped on
        // every pass; converted from `<br>` to `\n`, the empty line a
        // Shift+Enter had just opened collapsed and took the caret with it.
        if (index > 0) painted.appendChild(breaks[index - 1] === 'br' ? doc.createElement('br') : doc.createTextNode('\n'));
        for (const token of tokenizeLine(line, patterns)) {
            const className = tokenClassFor(token.type);
            if (className === null) {
                painted.appendChild(doc.createTextNode(token.text));
                continue;
            }
            const span = doc.createElement('span');
            span.className = className;
            span.textContent = token.text;
            painted.appendChild(span);
        }
    });
    if (trailingBr) painted.appendChild(doc.createElement('br'));

    return painted;
}

/** A fragment's markup, for comparing with an element's `innerHTML`. */
function markupOf(fragment: DocumentFragment): string {
    const holder = fragment.ownerDocument.createElement('div');
    holder.appendChild(fragment.cloneNode(true));
    return holder.innerHTML;
}

/** The language a rendered `<pre><code>` carries: `data-language`, else the `language-*` class. */
export function languageOfCodeElement(code: HTMLElement): string | null {
    const attribute = code.dataset['language'];
    if (attribute) return attribute;
    const fromClass = /(?:^|\s)language-([\w+#.-]+)/.exec(code.className);
    return fromClass?.[1] ?? null;
}

/**
 * Highlights every code block under `root` that names a language this module
 * knows, and returns how many it painted.
 */
export function highlightCodeBlocks(root: ParentNode): number {
    let painted = 0;
    for (const code of Array.from(root.querySelectorAll<HTMLElement>('pre > code'))) {
        if (highlightCodeElement(code, languageOfCodeElement(code))) painted++;
    }
    return painted;
}

/**
 * Removes the spans the highlighter painted, in place.
 *
 * Only from a block whose language {@link languagePatternsFor} knows, which is
 * exactly the set this module paints. Spans in a block it does NOT know came
 * from the author — a paste from an already-highlighted source, which the
 * sanitizer deliberately keeps — and are content, not decoration.
 *
 * The spans are unwrapped rather than the element flattened to its text: a code
 * block may hold an image (the markdown writer keeps one by writing the block
 * in its tag form), and `textContent = textContent` would delete it.
 */
export function stripCodeHighlighting(root: ParentNode): void {
    for (const code of Array.from(root.querySelectorAll<HTMLElement>('pre > code'))) {
        if (!languagePatternsFor(languageOfCodeElement(code))) continue;
        for (const span of Array.from(code.querySelectorAll<HTMLElement>('span.token'))) {
            span.replaceWith(...Array.from(span.childNodes));
        }
        code.normalize();
    }
}

/**
 * How many characters come before the boundary (`container`, `offset`) in
 * `root`, counting each `<br>` as one — the newline it stands for.
 *
 * `Range.toString()` counts a `<br>` as nothing, so on a line opened with
 * Shift+Enter the caret was remembered one character early per break above it,
 * and every repaint walked it back towards the top of the block.
 */
function characterOffsetIn(root: HTMLElement, container: Node, offset: number): number | null {
    if (!root.contains(container)) return null;
    const measure = root.ownerDocument.createRange();
    measure.setStart(root, 0);
    measure.setEnd(container, offset);
    return rawLengthOf(measure.cloneContents());
}

/** Text length with every `<br>` counted as one character, the trailing one included. */
function rawLengthOf(node: Node): number {
    let length = 0;
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) length += (child as Text).data.length;
        else if (child.nodeName === 'BR') length += 1;
        else length += rawLengthOf(child);
    }
    return length;
}

function collapsedRange(doc: Document, place: (range: Range) => void): Range {
    const range = doc.createRange();
    place(range);
    range.collapse(true);
    return range;
}

/**
 * A collapsed range `offset` characters into `root`, counted as
 * {@link characterOffsetIn} counts them, or `null` when the block is empty.
 */
function rangeAtCharacterOffset(root: HTMLElement, offset: number): Range | null {
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let seen = 0;
    let tail: Node | null = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node as Text;
            if (seen + text.data.length >= offset) return collapsedRange(doc, (range) => range.setStart(text, offset - seen));
            seen += text.data.length;
            tail = text;
        } else if (node.nodeName === 'BR') {
            const br = node;
            if (seen >= offset) return collapsedRange(doc, (range) => range.setStartBefore(br));
            seen += 1;
            tail = br;
        }
    }
    const end = tail;
    if (!end) return null;
    // Past a break with nothing after it: the empty line a Shift+Enter opened.
    if (end.nodeType === Node.TEXT_NODE) return collapsedRange(doc, (range) => range.setStart(end, (end as Text).data.length));
    return collapsedRange(doc, (range) => range.setStartAfter(end));
}

/**
 * Highlights one code block and puts the caret back where it was.
 *
 * The caret is remembered as a CHARACTER OFFSET into the block's text, not as a
 * node and an index: every node inside the block is replaced, so a remembered
 * node would be detached by the time it was restored — the caret would jump to
 * the top of the document and the next keystroke would land there. The text
 * itself does not change, so the offset always still means the same place.
 *
 * Does nothing when the block is already painted exactly as it would be, so a
 * keystroke that changes no token does not move the selection at all. That
 * comparison is made on the DETACHED paint, before any node is replaced: made
 * after, as it first was, the nodes were already swapped, the "nothing changed"
 * exit skipped the restore, and the browser dropped the caret to the start of
 * the block -- so every second keystroke in a word landed at the front.
 */
export function highlightCodeElementKeepingCaret(
    code: HTMLElement,
    language: string | null | undefined,
    selection: Selection | null,
): boolean {
    const painted = paintedFragment(code, language);
    if (!painted || markupOf(painted) === code.innerHTML) return false;

    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const caret = range?.collapsed ? characterOffsetIn(code, range.startContainer, range.startOffset) : null;

    code.replaceChildren(painted);

    if (caret !== null && selection) {
        const restored = rangeAtCharacterOffset(code, caret);
        if (restored) {
            selection.removeAllRanges();
            selection.addRange(restored);
        }
    }
    return true;
}
