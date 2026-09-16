import { Injectable, inject } from '@angular/core';
import { isPhrasing } from './rich-text-lines';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';

/**
 * A serializer an addon registers to control how specific spans become
 * markdown. Consulted before the built-in mention/tag handling.
 */
export interface MarkdownSpanSerializer {
    /** Return markdown / inline-HTML for this span, or null to pass to the next handler. */
    serialize(element: HTMLElement, innerMarkdown: string): string | null;
}

type ListType = 'ul' | 'ol' | 'task';

/** A piece of a list item: its html, or a sub-list where it falls among its blocks. */
type ListItemPart = string | ListContext;

interface ListItem {
    /**
     * The item's content and sub-lists, in order. One slot per item held a single
     * list, so a second sub-list under the same item -- bullets after numbers --
     * replaced the first on reload and its words were gone; and sub-lists were
     * kept apart from the content, so a paragraph after one came back before it.
     */
    parts: ListItemPart[];
    /** The column the item's content starts at: past its marker and the spaces after it. */
    column: number;
}

interface ListContext {
    type: ListType;
    items: ListItem[];
    indent: number;
    /** The number an ordered list counts from. */
    start: number;
    /** The marker this list is written with; see {@link ParsedListLine.marker}. */
    marker: string;
}

interface ParsedListLine {
    indent: number;
    type: ListType;
    content: string;
    /** The column the item's content starts at; see ListItem. */
    column: number;
    /** An ordered item's own number, which sets its list's start. */
    number?: number;
    /**
     * The item's marker character: the bullet for a bullet or task item, the
     * delimiter after the number for an ordered one.
     *
     * CommonMark ends a list at a marker CHANGE, not at a blank line. Without
     * this the reader had no way to tell two sibling lists apart, so two `<ol>`s
     * side by side came back as ONE and the second list's numbering continued
     * the first's. The writer alternates it for exactly that reason; see
     * {@link listMarkerFor}.
     */
    marker: string;
}

/**
 * The text of a list item, from the optional tail after its marker.
 *
 * The tail is one regex group rather than an alternation: a `(?:[ 	]+(.*)|)`
 * form let the engine retry the quantifier against the empty branch, which
 * SonarJS flags as super-linear backtracking.
 */
function listItemContent(tail: string | undefined): string {
    return tail ? tail.replace(/^[ \t]+/, '') : '';
}

/** A thematic break: three or more of one marker, spaces allowed between. */
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
/** The same, applied line by line across a document. */
const THEMATIC_BREAK_LINE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm;

function parseListLine(line: string): ParsedListLine | null {
    // "* * *" and "- - -" are rules, not bullets holding "* *". The rule pass
    // runs after this one, so the refusal has to live here.
    if (THEMATIC_BREAK.test(line)) return null;
    const taskMatch = new RegExp(/^(\s*)([-*+])\s+\[([ xX])\]\s*(\S.*|)$/).exec(line);
    if (taskMatch) {
        const checked = taskMatch[3] !== ' ';
        return {
            indent: taskMatch[1].length,
            type: 'task',
            content: `[${checked ? 'x' : ' '}] ${taskMatch[4]}`,
            column: contentColumn(line, taskMatch[1].length + 1),
            marker: taskMatch[2],
        };
    }

    // The content group is OPTIONAL. Requiring \s+ then a non-space meant an
    // EMPTY item -- which toMarkdown emits as "- ", one trailing space -- did
    // not parse as a list item at all: it ended the list, split it in two, and
    // left a literal "- " in the prose. <li><br></li> is what the browser makes
    // when a user opens a bullet and clicks away, so this hit an everyday
    // keystroke; for <ol> the second list also renumbered from 1.
    // A rule (--- / *** / ___) still does not match: it has no space.
    const ulMatch = new RegExp(/^([ \t]*)([-*+])([ \t].*)?$/).exec(line);
    if (ulMatch) {
        return {
            indent: ulMatch[1].length,
            type: 'ul',
            content: listItemContent(ulMatch[3]),
            column: contentColumn(line, ulMatch[1].length + 1),
            marker: ulMatch[2],
        };
    }

    // Both ordered delimiters, "." and ")". CommonMark has always allowed the
    // second, and the writer needs it to end one ordered list before the next.
    const olMatch = new RegExp(/^([ \t]*)(\d{1,9})([.)])([ \t].*)?$/).exec(line);
    if (olMatch) {
        return {
            indent: olMatch[1].length,
            type: 'ol',
            content: listItemContent(olMatch[4]),
            column: contentColumn(line, olMatch[1].length + olMatch[2].length + 1),
            number: Number.parseInt(olMatch[2], 10),
            marker: olMatch[3],
        };
    }

    return null;
}

/** The two markers each kind of list alternates between; see {@link listMarkerFor}. */
const UL_MARKERS = ['-', '*'] as const;
const OL_MARKERS = ['.', ')'] as const;

/** The previous sibling when it is a list of the same kind, so the two would merge. */
function adjacentSiblingList(element: Element): Element | null {
    const previous = element.previousElementSibling;
    return previous?.tagName === element.tagName ? previous : null;
}

/**
 * The marker a list is written with, alternating along a run of sibling lists.
 *
 * A blank line does not end a list -- CommonMark ends one at a marker CHANGE --
 * so two `<ol>`s side by side were written `1. a` / `1. b` and read back as ONE
 * list with b renumbered to 2. Alternating the bullet character (for an ordered
 * list, the delimiter after the number) puts a boundary the reader honours
 * between every adjacent pair, and leaves a list with no list beside it written
 * exactly as before.
 */
function listMarkerFor(listEl: Element, type: ListType): string {
    const markers: readonly string[] = type === 'ol' ? OL_MARKERS : UL_MARKERS;
    let runs = 0;
    for (let previous = adjacentSiblingList(listEl); previous; previous = adjacentSiblingList(previous)) runs++;
    return markers[runs % markers.length];
}

/** How far a line is indented. */
function indentOf(line: string): number {
    return line.length - line.trimStart().length;
}

/** The column an item's content starts at, from where its marker ends: past the blanks after the marker, and at least one. */
function contentColumn(line: string, markerEnd: number): number {
    const blanks = /^[ \t]*/.exec(line.slice(markerEnd))?.[0].length ?? 0;
    return markerEnd + Math.max(1, blanks);
}

/**
 * For each line, the deepest item indent it ends. An item at indent I ends at a
 * list marker at I or shallower, which starts a sibling or leaves the list, and
 * after a blank line at a line indented short of I + 2, the item's content; so a
 * marker's key is its indent, a line after a blank has indent - 1, and a blank
 * line or any other line ends nothing.
 */
function itemEndKeys(lines: readonly string[]): number[] {
    const keys: number[] = [];
    let blankBefore = false;
    for (const line of lines) {
        if (line.trim() === '') {
            keys.push(Infinity);
            blankBefore = true;
            continue;
        }
        const indent = indentOf(line);
        if (blankBefore) keys.push(indent - 1);
        else keys.push(parseListLine(line) ? indent : Infinity);
        blankBefore = false;
    }
    return keys;
}

/** The first index at or after `start` in a min segment tree whose value is at most `limit`, or -1. */
function firstAtMost(tree: readonly number[], node: number, span: readonly [number, number], start: number, limit: number): number {
    const [low, high] = span;
    if (high < start || tree[node] > limit) return -1;
    if (low === high) return low;
    const middle = Math.floor((low + high) / 2);
    const left = firstAtMost(tree, node * 2, [low, middle], start, limit);
    return left >= 0 ? left : firstAtMost(tree, node * 2 + 1, [middle + 1, high], start, limit);
}

/** Where the open item of a list ends, from a line inside it. */
type ItemEndFinder = (list: ListContext, from: number) => number;

/**
 * An ItemEndFinder that reads the lines once, for every item.
 *
 * Scanning ahead from every details opener read the same lines again for each
 * one: an item holding thousands of openers whose closers lie past the next item
 * took seconds to load, and a cache per list still rescanned for openers in a
 * staircase of nested items, one list each. The keys (see itemEndKeys) go into
 * a segment tree built on the first query, and each query is one descent.
 */
function itemEndFinder(lines: readonly string[]): ItemEndFinder {
    let tree: number[] | null = null;
    let size = 1;
    return (list, from) => {
        if (!tree) {
            const keys = itemEndKeys(lines);
            while (size < keys.length) size *= 2;
            tree = new Array<number>(size * 2).fill(Infinity);
            for (const [at, key] of keys.entries()) tree[size + at] = key;
            for (let node = size - 1; node > 0; node--) tree[node] = Math.min(tree[node * 2], tree[node * 2 + 1]);
        }
        const end = firstAtMost(tree, 1, [0, size - 1], from + 1, list.indent);
        return end < 0 ? lines.length : end;
    };
}

/**
 * The closer an item's continuation holds a details block up to, when it closes
 * within the item.
 *
 * The pairing runs over every line, so a closer found past the item's end
 * belongs to other content: held to it, a sibling item became a list inside the
 * block and a top-level paragraph moved into it.
 */
function heldCloser(opener: number, closer: number | undefined, item: ListContext | undefined, itemEnd: ItemEndFinder): number | undefined {
    return closer !== undefined && item && closer < itemEnd(item, opener) ? closer : undefined;
}

/** Hold a line of a details block that an item's continuation has opened. */
function holdLine(line: string, continuation: string[], pendingBlank: string[]): void {
    continuation.push(...pendingBlank, line);
    pendingBlank.length = 0;
}

/** Close the list levels that a line at `indent` of kind `type` does not continue. */
function closeLevelsFor(stack: ListContext[], indent: number, type: ListType, marker: string): void {
    // Pop only DEEPER levels. Popping the current one too (`>=`) threw away the
    // list a sibling belongs to, so every line started a fresh one — an ordered
    // list renumbered from 1 on every row, and a screen reader announced
    // "list, 1 item" over and over.
    while (stack.length > 0 && (stack.at(-1)?.indent ?? -1) > indent) {
        stack.pop();
    }
    // A same-indent line of a DIFFERENT kind (bullet after numbered) is its own
    // list, so that one context is replaced rather than appended. A different
    // MARKER of the same kind ends it just as surely -- that is CommonMark's
    // only way to put two sibling lists of one kind next to each other, and the
    // writer relies on it (see listMarkerFor).
    const open = stack.at(-1);
    if (open?.indent === indent && (open.type !== type || open.marker !== marker)) {
        stack.pop();
    }
}

function pushListItem(stack: ListContext[], rootLists: ListContext[], line: ParsedListLine): void {
    const item: ListItem = { parts: [line.content], column: line.column };
    const parent = stack.at(-1);
    if (parent && line.indent <= parent.indent) {
        parent.items.push(item);
        return;
    }
    const list: ListContext = { type: line.type, items: [item], indent: line.indent, start: line.number ?? 1, marker: line.marker };
    if (parent) parent.items.at(-1)?.parts.push(list);
    else rootLists.push(list);
    stack.push(list);
}

/**
 * Indent every line after the first by two spaces, so a block child stays
 * inside its list item.
 *
 * Emitting them at column 0 let a <blockquote>, heading, table or second
 * paragraph ESCAPE the list on save: "- Alpha" + a quote line reads back as a
 * list followed by a separate quote, and the nesting was gone for good. Two
 * spaces is what nested lists and fenced code in a list already use, and what
 * parseListContinuation reads back.
 */
/**
 * Drain the held continuation lines into one block, clearing both buffers.
 * Blank lines held speculatively are discarded unless a continuation followed.
 */
/**
 * Take a line that is not a list marker and attach it to the open item,
 * reporting whether it was consumed.
 *
 * Three shapes belong to the item above: a parked code fence, a blank line a
 * continuation may follow, and any line indented to the continuation column.
 * Everything else ends the list.
 */
function absorbNonListLine(
    line: string,
    openList: ListContext | undefined,
    continuation: string[],
    pendingBlank: string[],
): boolean {
    if (!openList?.items.length) return false;
    if (INDENTED_FENCE_TOKEN.test(line)) {
        // Into the continuation once one has started, among the item's other
        // blocks: glued onto the item's first line, the code jumped ahead of the
        // details block it sat in.
        if (continuation.length > 0) {
            continuation.push(...pendingBlank, line);
            pendingBlank.length = 0;
        } else {
            appendToLastItem(openList, line.trim());
        }
        return true;
    }
    if (line.trim() === '') {
        pendingBlank.push(line);
        return true;
    }
    if (CONTINUATION_LINE.test(line)) {
        continuation.push(...pendingBlank, line);
        pendingBlank.length = 0;
        return true;
    }
    return false;
}

/**
 * Drain the held continuation lines into one block.
 *
 * Whatever is still in `pendingBlank` arrived AFTER the last continuation line
 * was claimed, so no continuation ever took it: it is an orphan and the caller
 * has to put it back. Dropping it fused the list with whatever followed --
 * the next paragraph reached parseParagraphs separated by a single newline, so
 * it was one block starting with <ul>, matched the already-block-level guard,
 * and was never wrapped. "List, then prose" lost its <p> permanently.
 *
 * The first fix for that tested `continuation.length === 0`, which conflates
 * "no continuation at all" with "no blanks left over": a list that HAD a
 * continuation still dropped the blank that followed it, so the same loss
 * survived one indirection away. pendingBlank is the whole answer on its own.
 */
function takeContinuation(
    continuation: string[],
    pendingBlank: string[],
): { block: string; orphanBlanks: string[] } {
    const orphanBlanks = [...pendingBlank];
    pendingBlank.length = 0;
    if (continuation.length === 0) return { block: '', orphanBlanks };
    const block = continuation.join('\n');
    continuation.length = 0;
    return { block, orphanBlanks };
}

/** Add html to the end of a list's last item, after any sub-list already in it. */
function appendToLastItem(list: ListContext, html: string): void {
    const parts = list.items.at(-1)?.parts;
    if (!parts) return;
    const last = parts.at(-1);
    if (typeof last === 'string') parts[parts.length - 1] = last + html;
    else parts.push(html);
}

/**
 * Close the sub-lists that a line after a blank is indented short of, so the line
 * continues the item further out, after its sub-list, where CommonMark places it.
 * Given to the deepest item, a paragraph written after a sub-list came back
 * inside the sub-list's last item.
 */
function closeItemsLeftOf(line: string, stack: ListContext[], pendingBlank: readonly string[], flushContinuation: () => void): void {
    if (pendingBlank.length === 0 || line.trim() === '') return;
    while (stack.length > 1 && indentOf(line) < (stack.at(-1)?.indent ?? 0) + 2) {
        flushContinuation();
        stack.pop();
    }
}

function indentContinuation(content: string, indent = ''): string {
    const trimmed = content.trim();
    if (!trimmed.includes('\n')) return trimmed;
    // The continuation column is the ITEM's own indent plus two, not a fixed
    // two: a nested item sits at 2 x depth, so a hardcoded two spaces landed a
    // deep item's block on an ANCESTOR item -- an <h2> in a third-level item
    // reappeared in its grandparent, with the third level demoted below it.
    const pad = indent + '  ';
    const [first, ...rest] = trimmed.split('\n');
    return [first, ...rest.map((line) => (line.trim() ? pad + line : line))].join('\n');
}

/** Emit every open root list into `result` and clear the parse stack. */
function flushListStack(
    rootLists: ListContext[],
    stack: ListContext[],
    result: string[],
): ListContext[] {
    for (const ctx of rootLists) {
        result.push(buildListContextHtml(ctx));
    }
    stack.length = 0;
    return [];
}

/**
 * The number an ordered list starts counting from: its `start`, or 1.
 *
 * Items were always written 1, 2, 3, so a list that continued another -- the
 * second half of a numbered list split around a block -- restarted at 1 on
 * every save.
 */
function listStartOf(list: Element): number {
    const start = Number.parseInt(list.getAttribute('start') ?? '', 10);
    return Number.isInteger(start) && start >= 0 && start <= MAX_LIST_NUMBER ? start : 1;
}

/**
 * The largest item number the parser reads: nine digits, as CommonMark allows.
 * Past it an item's number is written as the first item's, which the parser
 * ignores after the first line, rather than as text the next save keeps.
 */
const MAX_LIST_NUMBER = 999_999_999;

/** Markdown written on one line: each line trimmed, blank ones dropped, the rest joined by a space. */
function oneLine(text: string): string {
    return text.split('\n').map((part) => part.trim()).filter(Boolean).join(' ');
}

/**
 * `text` without its blank first and last lines, keeping the first shown line's
 * own indent. A code block written inside a list item carries that item's
 * indent on every line; trimming it off the opening fence alone left the fence
 * and its closer at different columns, so the fence never closed and the code
 * came back as literal text -- in a list item, and in a details body within one.
 */
function trimBlankLines(text: string): string {
    const lines = text.split('\n');
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && (lines.at(-1) ?? '').trim() === '') lines.pop();
    return lines.join('\n');
}

/**
 * Blocks that cannot share a list marker's line.
 *
 * An item whose first child was one of these was written on the marker line --
 * `- ## title`, `- ```` , `- | a |`, `- ---` -- and none of those read back:
 * the heading, fence and table came back as literal characters, and a lone rule
 * left the list altogether. Paragraphs and divs are plain text on that line and
 * already round-trip.
 */
const LEADING_BLOCK_TAGS = new Set(['PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'HR', 'BLOCKQUOTE', 'DETAILS']);

/** Whether an item's first content is a block that must start on a line of its own. */
function opensWithBlock(li: Element): boolean {
    const first = Array.from(li.childNodes).find((node) =>
        node.nodeName !== 'INPUT' && !(node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === ''));
    return first !== undefined && LEADING_BLOCK_TAGS.has(first.nodeName);
}

/** A list item's children split at its sub-lists: the nodes before the first, then each sub-list and the nodes after it. */
function itemRuns(li: Element): [ChildNode[], ...(HTMLElement | ChildNode[])[]] {
    const lead: ChildNode[] = [];
    const runs: [ChildNode[], ...(HTMLElement | ChildNode[])[]] = [lead];
    let current = lead;
    for (const child of Array.from(li.childNodes)) {
        if (child instanceof HTMLElement && (child.nodeName === 'UL' || child.nodeName === 'OL')) {
            current = [];
            runs.push(child, current);
        } else if (child.nodeName !== 'INPUT') {
            current.push(child);
        }
    }
    return runs;
}

/** `text` without the indent all its lines that are not blank share. */
function dedentLines(text: string): string {
    const lines = text.split('\n');
    const shared = lines.filter((line) => line.trim() !== '').reduce((least, line) => Math.min(least, indentOf(line)), Infinity);
    return lines.map((line) => line.slice(Math.min(shared, indentOf(line)))).join('\n');
}

/**
 * An item's content with its marker line left empty and every line indented as
 * continuation, which parseListContinuation reads back as the item's blocks.
 */
function leadingBlockContinuation(content: string, indent = ''): string {
    const pad = indent + '  ';
    const body = trimBlankLines(content);
    return '\n' + body.split('\n').map((line) => (line.trim() ? pad + line : line)).join('\n');
}

/**
 * The title of a line that opens a details block, or null.
 *
 * Only at the start of a line. A details block nested in a list item or a quote
 * is indented or marked there, and is parsed inside its item or quote once those
 * are stripped. Taken here instead, its body kept the item's indent, so its
 * headings and quotes came back as text, and inside a quote it kept the "> "
 * markers and gained a quote level on every save. The title may be empty, and a
 * quote trims the space after the keyword, so the keyword may end the line.
 */
function toggleOpener(line: string): { title: string } | null {
    if (!line.startsWith(':::details')) return null;
    const rest = line.slice(':::details'.length);
    if (rest !== '' && !/^[ \t]/.test(rest)) return null;
    return { title: rest.trimStart() };
}

/**
 * The closing line of every details block, keyed by its opening line, in one
 * pass. Scanning ahead from each opener instead cost a pass per opener, which
 * is quadratic in a document of unclosed openers.
 */
function pairToggleBlocks(lines: readonly string[]): Map<number, number> {
    const pairs = new Map<number, number>();
    const open: number[] = [];
    for (const [at, line] of lines.entries()) {
        if (toggleOpener(line)) {
            open.push(at);
        } else if (line.trimEnd() === ':::') {
            const opener = open.pop();
            if (opener !== undefined) pairs.set(opener, at);
        }
    }
    return pairs;
}

/**
 * `inner` between two delimiters, with its edge whitespace kept outside them.
 *
 * Markdown opens emphasis only before a non-space and closes it only after
 * one, so `<i> x</i>` written as `* x*` read back as two literal asterisks.
 */
function delimit(inner: string, mark: string): string {
    const body = inner.trim();
    if (!body) return inner;
    const lead = inner.slice(0, inner.length - inner.trimStart().length);
    const trail = inner.slice(inner.trimEnd().length);
    return `${lead}${mark}${body}${mark}${trail}`;
}

/**
 * The italic delimiter for `inner`: an underscore when the text starts or ends
 * with an asterisk -- bold at its edge -- and an asterisk otherwise.
 *
 * `<i><b>x</b> y</i>` written with asterisks is `***x** y*`, which reads back
 * as bold-italic x followed by a separate italic, a different document on the
 * next save. `_**x** y_` has one reading.
 */
function italicMarkFor(inner: string): string {
    return edgedWithAsterisk(inner) ? '_' : '*';
}

/**
 * The bold delimiter for `inner`: underscores when an asterisk is at its edge.
 *
 * Bold ending in italic beside bold opening with one was `**a *h*** ***f* g**`,
 * and the reader paired the two `***` runs across the space between them into
 * an empty bold-italic, scrambling both. `__a *h*__ __*f* g__` has one reading.
 */
function boldMarkFor(inner: string): string {
    return edgedWithAsterisk(inner) ? '__' : '**';
}

function edgedWithAsterisk(inner: string): boolean {
    const body = inner.trim();
    return body.startsWith('*') || body.endsWith('*');
}

/**
 * Emphasis for `inner`: delimiters, or the tag itself inside a word.
 *
 * The parser does not read delimiters with a letter on their outer side, so
 * `un*believ*able` came back as literal asterisks. Inside a word the tag pair
 * is written verbatim, as `<u>` always is, and read back unchanged.
 */
function emphasisFor(element: Element, inner: string, tag: string, mark: string): string {
    return touchesWord(element) ? `<${tag}>${breaksAsTags(inner)}</${tag}>` : delimit(inner, mark);
}

/**
 * Whether an inline element sits against a letter or digit, or against other
 * formatting, on either side. Beside formatting the delimiters run into the
 * neighbour's: `_**x.**_*.y*` read the second italic's asterisks as text,
 * because the underscore before them is a word character.
 */
function touchesWord(element: Element): boolean {
    return touches(nodeBeside(element, 'previousSibling'), /[\p{L}\p{N}]$/u)
        || touches(nodeBeside(element, 'nextSibling'), /^[\p{L}\p{N}]/u);
}

function touches(node: Node | null, letter: RegExp): boolean {
    // A BLOCK sibling is not on this line and cannot run into the delimiters.
    // Counted as touching, a task row's nested <ul> flipped the bold beside it
    // to its tag form on the SECOND save -- the first save had moved the list
    // next to it -- so the document kept changing after it had been saved once.
    if (node?.nodeType === Node.ELEMENT_NODE) return isPhrasing(node) && (node.textContent ?? '') !== '';
    return node?.nodeType === Node.TEXT_NODE && letter.test(node.textContent ?? '');
}

/**
 * The text beside a node on its line, on one side.
 *
 * An inline wrapper does not end the line: in `<span><em>x</em></span>y` the
 * y is against the emphasis. Asking the emphasis's own siblings alone wrote
 * `*x*y`, which reads back as literal asterisks.
 */
function nodeBeside(node: Node, side: 'previousSibling' | 'nextSibling'): Node | null {
    // Past anything that shows nothing, such as an empty span: stopping at it
    // wrote `*x*` against the letter after it, which read back as asterisks.
    let beside = besideOnLine(node, side);
    while (beside && showsNothing(beside)) beside = besideOnLine(beside, side);
    return beside;
}

/** The node beside `node` in reading order on its line, climbing out of inline wrappers. */
function besideOnLine(node: Node, side: 'previousSibling' | 'nextSibling'): Node | null {
    let at: Node = node;
    while (!at[side] && at.parentNode?.nodeType === Node.ELEMENT_NODE && isPhrasing(at.parentNode)) {
        at = at.parentNode;
    }
    return at[side];
}

/** Elements that show something with no text of their own. */
const SHOWS_WITHOUT_TEXT = new Set(['IMG', 'BR', 'INPUT', 'WBR', 'HR']);

/** Whether a node shows nothing on its line: empty text, a comment, or an element with no text, image, break or input. */
function showsNothing(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '') === '';
    if (node.nodeType !== Node.ELEMENT_NODE) return true;
    const element = node as Element;
    return !SHOWS_WITHOUT_TEXT.has(element.nodeName) && element.textContent === '' && !element.querySelector('img, br, input, wbr, hr');
}

/** The level of the heading a line opens, or 0: one to six "#", then a space, a tab or the line's end. */
function headingLevelOf(line: string): number {
    let level = 0;
    while (level < line.length && line[level] === '#') level++;
    if (level === 0 || level > 6) return 0;
    if (level === line.length) return level;
    return line[level] === ' ' || line[level] === '\t' ? level : 0;
}

/**
 * `markdown` with each hard break written as a `<br>` tag.
 *
 * For a construct that is one line in markdown -- a heading, a summary, a task
 * row, an item's marker line -- and inside a tag pair written as tags, whose
 * tags pair only within one block, so two breaks in a row split them. A hard break is two spaces and a newline, and inside one of those the
 * newline ended the construct: the heading lost its second half, emphasis
 * around the break came back as stray asterisks, and a task row's text split
 * into pieces on every save. The tag is read back as the break it was.
 */
function breaksAsTags(markdown: string): string {
    // Only the break's own two spaces and newline: taking the blanks after it
    // too swallowed the next break's spaces, so of two breaks in a row the
    // second was written as a newline that ended the line.
    return markdown.replaceAll(/ {2}\n/g, '<br>');
}

/**
 * Whether a child of a list item is written on the item's marker line: inline
 * content, or a paragraph with nothing before it, which shares the marker's line.
 * A later paragraph is a line of its own, and one holding only a padding break
 * written as the tag joined the item's lines back into one.
 */
function onMarkerLine(child: Node, before: readonly string[]): boolean {
    if (isPhrasing(child)) return true;
    return (child.nodeName === 'P' || child.nodeName === 'DIV') && before.every((part) => part.trim() === '');
}

/**
 * Text with the characters the reader's inline passes act on escaped: backslash,
 * backtick, asterisk, underscore, tilde, brackets and "!".
 *
 * For text written where the reader still runs those passes although nothing
 * there is markdown: between `<code>` tags written as markup, where `*b*` came
 * back italic, backticks as a nested code span and a backslash as an escape;
 * and image alt text, where backticks and asterisks were read as syntax.
 */
function escapeInlineSyntax(text: string): string {
    return text.replaceAll(/[\\`*_~[\]!]/g, String.raw`\$&`);
}

/**
 * Whether a list item holds `element` itself, not through a quote inside the item.
 *
 * A code block in a quote inside an item took the item's indent too, although the
 * quote's lines already carry it, so inside the quote its fence read as the quoted
 * list item's continuation and the code joined that item's text.
 */
function heldByListItem(element: Element): boolean {
    return element.parentElement?.closest('li, blockquote')?.nodeName === 'LI';
}

/** The address an image is saved with: its src, or the original address of a blocked one (see handleImageTag). */
function imageTarget(image: Element): string {
    return image.getAttribute('src') ?? (image as HTMLElement).dataset['blockedSrc'] ?? '';
}

/**
 * Leave out every image with no address. Markdown has nothing to point it at:
 * written as "![alt]()" it came back as that text, and the next save escaped it.
 * Removed before whitespace is collapsed, so the spaces around it collapse as the
 * page shows them; written as nothing in place, "x <img> y" saved as "x  y" and
 * the next save as "x y".
 */
function removeUnaddressedImages(root: HTMLElement): void {
    for (const image of Array.from(root.querySelectorAll('img'))) {
        if (imageTarget(image) === '') image.remove();
    }
}

/**
 * Give each run of loose inline content at the top of the document a paragraph,
 * as the page renders it. Written bare, text after a rule went on the rule's next
 * line, and the next save, which read it as a paragraph, added a blank line.
 * A run a save writes nothing for gets none (see flush).
 */
function wrapLooseTopLevelText(root: HTMLElement): void {
    let run: ChildNode[] = [];
    const flush = (): void => {
        // Only a run a save writes something for: text, or an image. A paragraph
        // around an empty or blank element, a break or an input wrote nothing, and
        // the blank lines around it made the next save differ.
        const shows = run.some((node) => (node.textContent ?? '').trim() !== ''
            || (node.nodeType === Node.ELEMENT_NODE && (node.nodeName === 'IMG' || (node as Element).querySelector('img') !== null)));
        if (shows) {
            const paragraph = root.ownerDocument.createElement('p');
            run[0].before(paragraph);
            paragraph.append(...run);
        }
        run = [];
    };
    for (const node of Array.from(root.childNodes)) {
        if (isPhrasing(node)) run.push(node);
        else flush();
    }
    flush();
}

/** Whether code shows something a save writes without text: a break or an image (see removeUnaddressedImages). */
function codeShowsWithoutText(code: Element): boolean {
    return code.querySelector('br, img') !== null;
}

/** Whether a node is code a save writes as nothing: no text, and nothing shown without it. */
function isCodeWrittenAsNothing(node: Node): boolean {
    return node.nodeName === 'CODE' && node.textContent === '' && !codeShowsWithoutText(node as Element);
}

/** Whether a link or image target holds a parked code span or raw tag (see targetSource). */
function holdsParkedToken(target: string): boolean {
    return target.includes(RAW_TAG_OPEN) || target.includes(INLINE_CODE_OPEN);
}

/** A named, decimal or hexadecimal character reference with its semicolon, as CommonMark reads one. */
const CHARACTER_REFERENCE = /&(?:#\d{1,7}|#[xX][\dA-Fa-f]{1,6}|[A-Za-z][A-Za-z\d]{1,31});/g;

/** `text` with every character reference decoded; an unknown name stays as written. */
function decodeCharacterReferences(text: string): string {
    return text.replaceAll(CHARACTER_REFERENCE, (reference) =>
        new DOMParser().parseFromString(reference, 'text/html').body.textContent ?? reference);
}

/** Tags that apply the same emphasis, so one nested in another adds nothing. */
const BOLD_TAGS: readonly string[] = ['strong', 'b'];
const ITALIC_TAGS: readonly string[] = ['em', 'i'];
const STRIKE_TAGS: readonly string[] = ['s', 'del'];

/** Inline elements an emphasis can sit inside without leaving its line. */
const INLINE_ANCESTORS = new Set(['a', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup', 'small']);

/**
 * A quote's lines: one blank line between its blocks, and a fenced code block's
 * lines as written.
 *
 * The blank line is what keeps two blocks apart when the quote is read back.
 * Dropped, two paragraphs beside a list or a heading read back as one, a table
 * took the paragraph after it as a row, and the text after a code block gained
 * an empty line. Line ends are not trimmed: a hard break nested in the quote is
 * two spaces and a newline, and trimmed it read back as a soft line ending.
 */
function quoteBodyLines(inner: string): string[] {
    const lines: string[] = [];
    let fence: string | null = null;
    let skippedBlank = false;
    for (const raw of inner.split('\n')) {
        // A fence opens only with its run and a word after it, as the reader
        // requires: "```a``b```" (inline code) or "~~~x~~" (strikethrough) is text,
        // and taken for a fence here the quote kept its blank lines and grew one
        // on every save.
        const marker = /^\s*(`{3,}|~{3,})[\w+#.-]*$/.exec(raw.trimEnd())?.[1] ?? null;
        if (fence) {
            lines.push(raw);
            if (marker?.startsWith(fence) && raw.trim() === marker) fence = null;
            continue;
        }
        if (marker) fence = marker;
        if (raw.trim() === '') {
            skippedBlank = lines.length > 0;
            continue;
        }
        if (skippedBlank) lines.push('');
        skippedBlank = false;
        lines.push(raw);
    }
    return lines;
}

/**
 * A `<br>` as markdown: a hard break; in a quote, the tag inside formatting, and
 * the end of a paragraph on the quote's own line.
 *
 * A quote holds lines, and a break on one of its own lines starts the next: the
 * sanitizer splits the line there. Written as a line ending, the reader kept the
 * two halves as one paragraph beside a list or a heading, and the saves
 * disagreed. Inside bold or italic the break stays in the emphasis as the tag: a
 * line ending there left the emphasis open, and it came back as asterisks.
 */
function breakToMarkdown(br: Element): string {
    if (!br.closest('blockquote')) return '  \n';
    if (insideWrittenFormatting(br)) return '<br>';
    return onQuoteLine(br) ? '\n\n' : '  \n';
}

/** Whether a break sits on a quote's own line: in the quote, or in a paragraph or div that is its child. */
function onQuoteLine(br: Element): boolean {
    const line = br.parentElement?.closest('p, div, li, td, th, h1, h2, h3, h4, h5, h6, summary, details, pre, blockquote');
    if (line?.nodeName === 'BLOCKQUOTE') return true;
    if (line?.nodeName !== 'P' && line?.nodeName !== 'DIV') return false;
    // Through the divs that wrap it: a quote's paragraph inside a div is still a
    // line of the quote, and written as a hard break its save did not settle.
    let parent = line.parentElement;
    while (parent?.nodeName === 'DIV') parent = parent.parentElement;
    return parent?.nodeName === 'BLOCKQUOTE';
}

/**
 * Whether a break sits inside inline formatting a save writes around it.
 *
 * Every inline element still in the document is written as markup: spans
 * written as their text alone were unwrapped before the save (see
 * unwrapTextSpans). Taking a span for unformatted text ended the quote paragraph
 * inside a coloured span's tag pair, and the second line lost its colour.
 */
function insideWrittenFormatting(br: Element): boolean {
    const parent = br.parentElement;
    return parent !== null && isPhrasing(parent);
}

function buildListContextHtml(ctx: ListContext): string {
    const tag = ctx.type === 'task' ? 'ul' : ctx.type;
    const taskAttr = ctx.type === 'task' ? ' data-task-list' : '';
    const startAttr = ctx.type === 'ol' && ctx.start !== 1 ? ` start="${ctx.start}"` : '';
    const items = ctx.items.map(({ parts }) => {
        const [first, ...rest] = parts;
        const content = typeof first === 'string' ? first : '';
        const after = rest.map((part) => (typeof part === 'string' ? part : buildListContextHtml(part))).join('');
        if (ctx.type === 'task') {
            const checked = content.startsWith('[x] ') || content.startsWith('[X] ');
            const text = content.replace(/^\[[ xX]\]\s*/, '');
            const checkedAttr = checked ? ' checked' : '';
            return `<li data-task data-checked="${checked}">`
                + `<input type="checkbox"${checkedAttr} /><span>${text}</span>${after}</li>`;
        }
        return `<li>${content}${after}</li>`;
    });
    return `<${tag}${taskAttr}${startAttr}>${items.join('')}</${tag}>`;
}

/**
 * Service for converting between Markdown and HTML.
 * Zero external dependencies - uses regex and DOM APIs.
 * 
 * Supports:
 * - Headings (# - ######)
 * - Bold (**text** or __text__)
 * - Italic (*text* or _text_)
 * - Strikethrough (~~text~~)
 * - Links [text](url)
 * - Images ![alt](src)
 * - Unordered lists (- or * or +)
 * - Ordered lists (1. 2. 3.)
 * - Blockquotes (>)
 * - Code blocks (``` or indented)
 * - Inline code (`code`)
 * - Horizontal rules (--- or ***)
 * - Line breaks
 */
/**
 * Link and image targets, allowing ONE level of balanced parentheses.
 *
 * Stopping at the first `)` truncated Wikipedia-style URLs — a mainstream
 * case, not adversarial input — leaving a broken link and dumping the rest of
 * the URL on the page as visible text.
 */
// The TEXT half allows one level of balanced brackets, matching what the URL
// half already does for parentheses. A flat [^\\]]* meant "see [1]" or
// "[Draft] spec" -- everyday link and alt text -- did not match at all, so the
// anchor was destroyed on save and its markdown source shown as page text.
const TARGET_BODY = String.raw`(?:[^()]|\([^()]*\))`;
const LINK_TEXT_BODY = String.raw`(?:[^[\]]|\[[^[\]]*\])`;
const MEDIA_TARGET_PATTERN = {
    image: new RegExp(String.raw`!\[(${LINK_TEXT_BODY}{0,4096})\]\((${TARGET_BODY}+)\)`, 'g'),
    link: new RegExp(String.raw`\[(${LINK_TEXT_BODY}{1,4096})\]\((${TARGET_BODY}{1,4096})\)`, 'g'),
} as const;

/**
 * The writer's half of {@link TARGET_BODY}: an address the reader hands back
 * unchanged. It also refuses a backslash, which `protectEscapes` consumes
 * before any target is matched, so a plain address holding one would not
 * survive either.
 */
const PLAIN_TARGET = new RegExp(String.raw`^(?:[^()\\]|\([^()\\]*\))*$`);

/**
 * A link or image address as markdown source.
 *
 * The reader's grammar allows at most ONE level of balanced parentheses, so an
 * address holding an odd or a nested ")" was cut at that character: the link
 * pointed at the truncated prefix and the rest of the address landed on the
 * page as visible text. CommonMark's answer is the backslash escape, and
 * `protectEscapes` parks those before any target is matched, so no parenthesis
 * is left for the grammar to trip on. An address the grammar already returns
 * unchanged keeps its plain form, so ordinary URLs -- Wikipedia's
 * "X_(disambiguation)" among them -- are written exactly as before.
 */
function markdownTarget(target: string): string {
    return PLAIN_TARGET.test(target) ? target : target.replaceAll(/[\\()]/g, String.raw`\$&`);
}

/**
 * Marker standing in for a character with Markdown meaning while the emphasis
 * passes run. Those passes regex over the WHOLE string, attribute values
 * included, so a `*` in a query string became `<em>` and the link silently
 * pointed somewhere else. Private-use code points cannot occur in real input.
 */
const URL_SHIELD: ReadonlyArray<readonly [string, string]> = [
    ['*', '\uE100'],
    ['_', '\uE101'],
    ['`', '\uE102'],
    ['~', '\uE103'],
];

/**
 * Any HTML tag written in the source. Whether it SURVIVES is the sanitizer's
 * call, made in `escapeHtmlInContent`; protecting it here only keeps the
 * emphasis and inline-code passes from chewing on tag internals. Both halves of
 * a pair are matched so the escape pass cannot split them -- an earlier version
 * listed seven tags by hand, so `<b>x</b>` rendered a literal `</b>` and
 * corrupted permanently on round-trip.
 */
/** Inline tags Markdown cannot express; emitted as HTML and read back as-is. */
const VERBATIM_INLINE_TAGS = new Set(['u', 'mark', 'sub', 'sup', 'small', 'ins']);

/**
 * Inline tags that WRAP their body in delimiters or a tag pair. When the body
 * is empty there is nothing to wrap, so they serialize to nothing.
 *
 * An allowlist, not an exclusion list: <br> and <img> also have empty
 * textContent but are meaningful on their own, and a first attempt that keyed
 * off "empty textContent" alone swallowed every line break in the document.
 */
const BODY_WRAPPING_INLINE_TAGS = new Set([
    'strong', 'b', 'em', 'i', 'del', 's', 'code',
    'u', 'mark', 'sub', 'sup', 'small', 'ins',
]);

/**
 * Whether an inline element wraps a body that turned out to be empty.
 *
 * `inner` AND textContent must both be empty: an element holding only an image
 * or a line break has a non-empty `inner` and must be kept, and testing
 * textContent alone swallowed <strong><img></strong>.
 */
function isEmptyWrapper(tagName: string, inner: string, element: HTMLElement): boolean {
    return BODY_WRAPPING_INLINE_TAGS.has(tagName)
        && inner === ''
        && (element.textContent ?? '') === '';
}

const PASSTHROUGH_TAG_PATTERN = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]{0,4096}>/g;

/** Private-use delimiters parking a backslash-escaped punctuation character. */
/** ASCII punctuation a backslash may escape, per CommonMark. */
const ESCAPABLE_PUNCTUATION = new Set("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".split(''));

const ESCAPED_OPEN = '';
const ESCAPED_CLOSE = '';

/** Private-use delimiters parking an inline code span; distinct from the fence pair so a lone span is not read as a block. */
const INLINE_CODE_OPEN = '';
const INLINE_CODE_CLOSE = '';

/** Private-use delimiters parking a fenced code block during the inline passes. */
/** A block whose first token is a parked raw tag: already markup, not prose. */
const RAW_TAG_ONLY_BLOCK = /^(\d{1,9})/;

/** Opening and closing block tags, counted to track nesting depth across lines. */
const BLOCK_OPEN_TAG = /<(?:h[1-6]|ul|ol|li|blockquote|pre|div|p|table|thead|tbody|tr|th|td|details|summary|figure)\b[^>]*>/gi;
const BLOCK_CLOSE_TAG = /<\/(?:h[1-6]|ul|ol|li|blockquote|pre|div|p|table|thead|tbody|tr|th|td|details|summary|figure)>/gi;

/** Block-level tags: a parked one of these means the block is already markup. */
const BLOCK_LEVEL_TAG_PATTERN = /^<(?:p|div|h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr|figure|details|summary)\b/i;

/** An indented line holding nothing but a parked code fence. */
const INDENTED_FENCE_TOKEN = /^\s+\d{1,9}\s*$/;

/**
 * A line indented by at least two spaces: CommonMark's continuation of the
 * list item above it, whatever block it turns out to hold.
 */
const CONTINUATION_LINE = /^ {2,}\S/;

/** Columns a tab advances to, per CommonMark. */
const TAB_STOP = 4;

/**
 * Every line's leading whitespace with its tabs advanced to the next
 * four-column tab stop.
 *
 * CommonMark measures block indentation in COLUMNS (§2.2), while every
 * indentation predicate here counts characters -- CONTINUATION_LINE, indentOf,
 * contentColumn. A tab therefore read as one column, fell short of the item's
 * continuation column, and the block escaped its list item: "- a" followed by a
 * tab-indented quote came back as a list and a separate paragraph, and the next
 * save wrote the quote marker as the literal characters "\> q". Expanding the
 * tabs once, up front, lets all of those predicates stay character-based.
 *
 * Only the leading run is rewritten: a tab inside prose is content, not
 * structure. Fenced and inline code are parked before this runs, so no tab
 * inside code is ever seen.
 */
function expandLeadingTabs(text: string): string {
    if (!text.includes('\t')) return text;
    return text.split('\n').map(expandLineIndent).join('\n');
}

function expandLineIndent(line: string): string {
    const indent = /^[ \t]*/.exec(line)?.[0] ?? '';
    if (!indent.includes('\t')) return line;
    let column = 0;
    for (const ch of indent) column += ch === '\t' ? TAB_STOP - (column % TAB_STOP) : 1;
    return ' '.repeat(column) + line.slice(indent.length);
}

/** Private-use delimiters parking a raw HTML tag during the inline passes. */
const RAW_TAG_OPEN = '';
const RAW_TAG_CLOSE = '';

const CODE_FENCE_OPEN = '';
const CODE_FENCE_CLOSE = '';

/**
 * Tags the sanitizer removes together with everything inside them. They are
 * passed through the escape untouched so it is the sanitizer, not the reader,
 * that sees them.
 */
const CONTENT_BEARING_UNSAFE_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'title', 'textarea']);

/**
 * Index of the closing backtick run of exactly `runLength`, or -1. A run that
 * is longer belongs to the span's content, not to its delimiter.
 */
function findClosingTickRun(source: string, from: number, runLength: number): number {
    let i = from;
    while (i < source.length) {
        if (source[i] === '\n') return -1;
        if (source[i] !== '`') {
            i++;
            continue;
        }
        const start = i;
        while (source[i] === '`') i++;
        if (i - start === runLength) return start;
    }
    return -1;
}

/**
 * Drop the one padding space CommonMark allows on each side of a code span,
 * which is how a span whose content starts or ends with a backtick is written.
 */
function stripCodeSpanPadding(code: string): string {
    const padded = code.length >= 2 && code.startsWith(' ') && code.endsWith(' ');
    return padded && code.trim() !== '' ? code.slice(1, -1) : code;
}

/**
 * Escape the literal characters that would otherwise be re-read as syntax.
 *
 * toMarkdown emitted text nodes raw, so a document containing "2 * 3 * 4"
 * came back as "2  3  4" in italics, and a line of prose beginning "# " became
 * a heading -- ordinary text corrupted on save, with no warning.
 *
 * Kept to what this parser reads as syntax, so a document is not littered with
 * backslashes nobody typed. An earlier list required a space after each line
 * marker, and missed the shapes the parser takes without one: "2024." or "-" on
 * a line of their own, ">50%", "---", "~~a~~", ":::details", "[t](u)" came back
 * as a list, a quote, a rule, strikethrough, a details block or a link.
 */
function escapeMarkdownText(text: string): string {
    // The BACKSLASH goes first, and it is not optional. protectEscapes consumes
    // a backslash before ASCII punctuation on the way back in, so an unescaped
    // one is eaten: every \\ in prose lost a backslash on the FIRST save and
    // kept eroding (a Windows path or a regex bleeds one per save). Escaping it
    // first also stops the backslashes added below from being doubled.
    return escapeLineStarts(text
        .replaceAll('\\', String.raw`\\`)
        .replaceAll(/([*_`])/g, String.raw`\$1`)
        // A run of tildes opens strikethrough or a fence; a single one does not.
        .replaceAll(/~(?=~)|(?<=~)~/g, String.raw`\~`)
        // Every bracket. A pair in one text node was escaped, but a link or a
        // task marker split by an element (`[see <b>this</b>](u)`,
        // `[<span>x</span>] done`) or holding a nested pair came back as syntax.
        .replaceAll(/[[\]]/g, String.raw`\$&`)
        // An "&" that can start a character reference. The page decoded "&lt;"
        // typed as text into "<", and legacy names such as "&copy" decode with
        // no semicolon at all.
        .replaceAll(/&(?=[A-Za-z#])/g, String.raw`\&`)
        // A literal "<b>" in prose (an author writing ABOUT markup) became a
        // real element on reload. Only a tag-shaped "<" is escaped.
        .replaceAll(/<(?=[a-z/])/gi, String.raw`\<`));
}

/**
 * The parsed document shaped as the page shows it, before it is written: text
 * merged where spans written as their text alone were unwrapped (see
 * unwrapTextSpans), and whitespace outside code collapsed the way the browser
 * renders it, so a newline or a run of blanks in the markup is written as the
 * single space it shows, and nothing at the start of a line.
 */
function prepareForMarkdown(root: HTMLElement): void {
    unnestPastTheCap(root);
    removeUnaddressedImages(root);
    wrapLooseTopLevelText(root);
    root.normalize();
    collapseRenderedWhitespace(root);
}

/**
 * Unwrap the details blocks and quotes nested past MAX_NESTING_DEPTH, keeping
 * their content where it was; a details block's summary becomes a paragraph
 * before its body.
 *
 * The reader leaves markdown nested past the cap as text, so written whole, a
 * deeper document came back with its markers as text, escaped on the next save:
 * the saves never agreed, and a quote's inner markers showed on the page. The
 * depth counted here (see nestingDepthOf) is never less than the depth the
 * reader counts for what is written, so every block that is written is read
 * back as that block.
 */
function unnestPastTheCap(root: HTMLElement): void {
    for (const block of Array.from(root.querySelectorAll('details, blockquote'))) {
        if (nestingDepthOf(block, root) < MAX_NESTING_DEPTH) continue;
        const summary = block.querySelector(':scope > summary');
        if (summary) {
            const paragraph = root.ownerDocument.createElement('p');
            paragraph.append(...Array.from(summary.childNodes));
            summary.remove();
            block.prepend(paragraph);
        }
        block.replaceWith(...Array.from(block.childNodes));
    }
}

/**
 * The nesting depth of `element` below `root` as a save writes it: one for every
 * details block and quote around it, and one for every list item that holds it in
 * the item's own content. A list item reached through its sub-list adds none: the
 * sub-list is written as indented lines the reader takes in the item's own pass,
 * and counted, forty nested bullets unwrapped a details block the reader had kept.
 * A quote counts even when the reader would not (a quote holding no nested
 * quote), which keeps this never less than the reader's depth.
 */
function nestingDepthOf(element: Element, root: HTMLElement): number {
    let depth = 0;
    for (let child: Element = element, at = element.parentElement; at && at !== root; child = at, at = at.parentElement) {
        const holdsInOwnContent = at.nodeName === 'LI' && child.nodeName !== 'UL' && child.nodeName !== 'OL';
        if (at.nodeName === 'DETAILS' || at.nodeName === 'BLOCKQUOTE' || holdsInOwnContent) depth++;
    }
    return depth;
}

/** A rendered line's pieces in reading order: its text, a line boundary, or something shown without text. */
type LineToken = Text | 'break' | 'content';

/** Elements whose text is kept as written: code keeps every space and newline. */
const VERBATIM_TEXT_TAGS = new Set(['PRE', 'CODE', 'TEXTAREA']);

function lineTokens(root: Node, out: LineToken[]): LineToken[] {
    for (const child of Array.from(root.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            out.push(child as Text);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            pushElementTokens(child as Element, out);
        }
    }
    return out;
}

function pushElementTokens(element: Element, out: LineToken[]): void {
    if (element.nodeName === 'BR') {
        out.push('break');
        return;
    }
    const inline = isPhrasing(element);
    // An inline element that shows nothing, such as emptied code, is not on the
    // line at all: counted as content, the spaces on both its sides stayed. Nor is
    // an input, which a save writes as nothing: "a <input> b" saved as "a  b", and
    // the next save as "a b".
    if (inline && (showsNothing(element) || element.nodeName === 'INPUT')) return;
    if (VERBATIM_TEXT_TAGS.has(element.nodeName) || SHOWS_WITHOUT_TEXT.has(element.nodeName)) {
        out.push(inline ? 'content' : 'break');
        return;
    }
    if (!inline) out.push('break');
    lineTokens(element, out);
    if (!inline) out.push('break');
}

/**
 * Collapse whitespace as the browser renders it: a run of blanks is one space,
 * and a space is dropped after another space, at the start of a line, after a
 * line break too, and at the end of a line, wherever the elements around it
 * split the text.
 */
function collapseRenderedWhitespace(root: HTMLElement): void {
    const tokens = lineTokens(root, []);
    collapseAlongLines(tokens);
}

function collapseAlongLines(tokens: readonly LineToken[]): void {
    let afterSpace = true;
    // The text that ends the line so far. Its trailing space shows nothing either:
    // written, "word\n" before a heading saved as "word " and the next save dropped it.
    let lineEnd: Text | null = null;
    for (const token of tokens) {
        if (typeof token === 'string') {
            if (token === 'break') trimLineEnd(lineEnd);
            lineEnd = null;
            afterSpace = token === 'break';
            continue;
        }
        let text = token.data.replaceAll(/[ \t\n\r\f]+/g, ' ');
        if (afterSpace && text.startsWith(' ')) text = text.slice(1);
        if (text !== '') {
            afterSpace = text.endsWith(' ');
            lineEnd = token;
        }
        token.data = text;
    }
    trimLineEnd(lineEnd);
}

/** Drop the space a line's last text ends with. */
function trimLineEnd(text: Text | null): void {
    if (text?.data.endsWith(' ')) text.data = text.data.slice(0, -1);
}

/** A text node as markdown text; its whitespace is already as rendered (see prepareForMarkdown). */
function textToMarkdown(node: Node): string {
    return escapeMarkdownText(node.textContent ?? '');
}

/**
 * `markdown` with every line the reader would take for a block marker escaped:
 * a heading or list marker, a quote, a number and a dot, a dash run, a details
 * keyword, or a line shaped like a table separator.
 *
 * Run on each text node and again on a paragraph as written, because a marker
 * can be split across inline elements: `2024<span>.</span> x` read back as a
 * numbered list, since neither text node began a list on its own. A line that
 * already begins with a backslash matches none of these, so the second run adds
 * nothing to what the first escaped.
 */
function escapeLineStarts(markdown: string): string {
    return markdown
        .replaceAll(/^([ \t]*)(#{1,6}|[+-])(?=[ \t]|$)/gm, String.raw`$1\$2`)
        .replaceAll(/^([ \t]*)>/gm, String.raw`$1\>`)
        .replaceAll(/^([ \t]*)(\d{1,9})\.(?=[ \t]|$)/gm, String.raw`$1$2\.`)
        .replaceAll(/^([ \t]*)-(?=-)/gm, String.raw`$1\-`)
        .replaceAll(/^([ \t]*):::/gm, String.raw`$1\:::`)
        .split('\n')
        .map(escapeSeparatorShape)
        .join('\n');
}

/**
 * A line of pipes, dashes, colons and spaces holding a pipe and a dash, escaped:
 * after a line holding a pipe it made the two a table, and its own text was gone.
 */
function escapeSeparatorShape(line: string): string {
    const trimmed = line.trim();
    if (!trimmed.includes('-') || !trimmed.includes('|') || !/^[|: \t-]+$/.test(trimmed)) return line;
    const at = line.length - line.trimStart().length;
    return `${line.slice(0, at)}\\${line.slice(at)}`;
}

@Injectable({ providedIn: 'root' })
export class RichTextMarkdownService {
    private readonly sanitizer = inject(RichTextSanitizerService);
    private readonly spanSerializers: MarkdownSpanSerializer[] = [];

    /**
     * Register a span serializer consulted before the built-in mention/tag
     * handling in {@link toMarkdown}. Returns a teardown that unregisters it.
     */
    registerSpanSerializer(serializer: MarkdownSpanSerializer): () => void {
        this.spanSerializers.push(serializer);
        return () => {
            const i = this.spanSerializers.indexOf(serializer);
            if (i !== -1) this.spanSerializers.splice(i, 1);
        };
    }

    /**
     * Convert Markdown to sanitized HTML. Block constructs are parsed before
     * inline ones — the order of the passes below is load-bearing.
     */
    toHtml(markdown: string): string {
        if (!markdown) return '';

        let html = markdown;

        html = html.replaceAll('\r\n', '\n');

        // Fenced code is lifted out FIRST -- before raw-tag protection and
        // before any escaping. A fence is inert text by definition: what is
        // inside it must reach the reader as characters, never as markup. While
        // it stayed inline, protectRawTags lifted <span> out of fence bodies and
        // restored it live afterwards (so markup hidden in a fence became a real
        // element, forging data-mention identity claims), and the body was
        // escaped twice -- once by escapeHtmlInContent, once by parseCodeBlocks
        // -- rendering "</div>" as visible "&lt;/div&gt;".
        const protectedCode: string[] = [];
        html = this.protectCodeFences(html, protectedCode);
        // AFTER the fences are parked, so a tab inside code is never rewritten,
        // and BEFORE every block pass, all of which measure indentation in
        // characters. See expandLeadingTabs.
        html = expandLeadingTabs(html);
        // Inline code is lifted out with the fences and for the same reason: a
        // code span is inert text. parseInlineCode ran LAST, after the emphasis
        // and line-break passes had already rewritten its contents, so
        // documenting `<br>` or `<b>x</b>` corrupted it on the first save.
        const protectedInline: string[] = [];
        // BEFORE inline code: "\`" is a literal backtick and must not open a
        // code span (CommonMark). A backslash inside a real code span is left
        // alone because the span is parked whole, tokens and all, and restored
        // verbatim.
        const protectedEscapes: string[] = [];
        html = this.protectEscapes(html, protectedEscapes);

        const inlineSources: string[] = [];
        html = this.protectInlineCode(html, protectedInline, inlineSources);


        const protectedTags: string[] = [];
        html = this.protectRawTags(html, protectedTags);

        html = this.escapeHtmlInContent(html);
        html = this.parseToggleBlocks(html);
        html = this.parseBlockquotes(html);
        html = this.parseHeadings(html);
        // Lists first: an indented "---" or "> b" under an item is that item's
        // continuation and must not be taken at document level. parseListLine
        // itself refuses a spaced rule such as "* * *". Tables before rules,
        // because a separator row is all dashes.
        html = this.parseLists(html);
        html = this.parseTables(html);
        html = this.parseHorizontalRules(html);
        // BEFORE paragraphs are split. A hard break ending a paragraph is
        // written "  " + blank line, and parseParagraphs splits on the blank
        // line and trims the block -- so the two trailing spaces were gone
        // before this pass ever ran, and the break was silently dropped.
        html = this.parseLineBreaks(html);
        html = this.parseParagraphs(html, protectedTags);

        html = this.parseImages(html, protectedInline, inlineSources, protectedTags, protectedEscapes);
        html = this.parseLinks(html, inlineSources, protectedTags, protectedEscapes);
        html = this.parseBoldItalic(html);
        html = this.parseStrikethrough(html);

        // After the emphasis passes, so the characters hidden in link and image
        // targets come back exactly as the author typed them.
        html = this.unshieldUrls(html);

        html = this.restoreRawTags(html, protectedTags);
        html = this.restoreCodeFences(html, protectedCode);
        html = this.restoreInlineCode(html, protectedInline);
        html = this.restoreEscapes(html, protectedEscapes);

        return this.sanitizer.sanitize(html);
    }

    /**
     * Replace every raw `<span …>` / `</span>` tag and `data-action-*` image
     * tag with a placeholder token the markdown pipeline treats as opaque
     * text, so escaping and block parsing leave the tag intact while its inner
     * content is still processed. The restored tags are re-sanitized, so
     * protecting non-action spans (rare in markdown) is harmless. Any private-
     * use delimiter chars already in the input are stripped first so user
     * content can never spoof a token.
     */
    /**
     * Whether a tag written in the source is markup or prose about markup.
     *
     * An author writing "the <table> element has <tr> children" means those as
     * words; treating them as markup turned the sentence into a real table with
     * the prose swallowed into a cell. Real markup comes in matched pairs, so an
     * unpaired non-void tag is text.
     */
    private isMarkupTag(tagName: string, offset: number, paired: ReadonlySet<number>): boolean {
        if (!this.sanitizer.isAllowedTag(tagName)) return false;
        return paired.has(offset) || VOID_TAGS.has(tagName.toLowerCase());
    }

    private protectRawTags(markdown: string, store: string[]): string {
        const cleaned = markdown.replaceAll(/[]/g, '');
        const push = (match: string): string => {
            const token = `${store.length}`;
            store.push(match);
            return token;
        };
        return perBlock(cleaned, (block, paired) => block
            // Inline formatting tags Markdown has no syntax for (u, sub, sup,
            // mark...) are emitted verbatim by toMarkdown, so toHtml must return
            // them unchanged. Protecting the CLOSING tag matters as much as the
            // opening one: escapeHtmlInContent let "<u>" through (u matches \w)
            // but escaped "</u>" (/ does not), so every round-trip appended
            // another visible "</u>" and the damage compounded per save/load.
            .replaceAll(PASSTHROUGH_TAG_PATTERN, (match: string, tagName: string, offset: number) =>
                this.isMarkupTag(tagName, offset, paired) ? push(match) : match,
            )
            .replaceAll(/<span\b[^>]{0,4096}>/gi, push)
            .replaceAll(/<\/span>/gi, push)
            .replaceAll(/<img\b[^>]{0,4096}\bdata-action-[\w-]{1,64}[^>]{0,4096}>/gi, push));
    }

    /**
     * Lift fenced code bodies out of the source before anything else touches
     * them, already converted to their final `<pre><code>` form. Restored after
     * every inline pass, so a fence is inert text: escaped exactly once, and
     * with no markup smuggled through it into the live document.
     */
    private protectCodeFences(markdown: string, store: string[]): string {
        // Strip our own delimiters from the input first, exactly as
        // protectRawTags does for its pair. Without this a document could carry
        // U+E110/U+E111 itself and forge a token: restoreCodeFences would expand
        // it, so a fence body the author wrote once rendered twice, and an
        // out-of-range index silently erased surrounding text.
        // The opening fence's own line prefix ("> " in a quote, indentation in
        // a list item) is captured and stripped from every body line, then kept
        // on the placeholder so the surrounding block still parses. Lifting the
        // fence before blockquote and list parsing baked those markers INTO the
        // code, and each round-trip added another level -- the same compounding
        // corruption the lift was introduced to stop, reintroduced for nesting.
        return markdown.replaceAll(CODE_FENCE_OPEN, '').replaceAll(CODE_FENCE_CLOSE, '').replaceAll(
            FENCE_PATTERN,
            (_match, prefix: string, _fence: string, lang: string, code: string) => {
                const langAttr = lang ? ` data-language="${lang}" class="language-${lang}"` : '';
                const token = `${prefix}${CODE_FENCE_OPEN}${store.length}${CODE_FENCE_CLOSE}`;
                const body = stripBlockPrefix(code, prefix);
                store.push(`<pre><code${langAttr}>${this.escapeHtml(body.trimEnd())}</code></pre>`);
                return token;
            },
        );
    }

    /**
     * Park a backslash-escaped punctuation character so no later pass reads it
     * as syntax.
     *
     * CommonMark: a backslash before any ASCII punctuation makes that character
     * literal. Neither half of that worked -- "2 \\* 3 \\* 4" came out as
     * "2 \\ 3 \\ 4" in italics, so the escape was ignored AND the backslash
     * rendered. Others (\\#, \\-, \\[) left a visible backslash.
     *
     * Runs after protectInlineCode, so a backslash inside `code` stays literal
     * as the spec requires, and before every syntax pass.
     */
    private protectEscapes(markdown: string, store: string[]): string {
        const source = markdown
            .replaceAll(ESCAPED_OPEN, '')
            .replaceAll(ESCAPED_CLOSE, '');
        const out: string[] = [];

        // A while loop with an explicit cursor: both branches consume more than
        // one character, and mutating a for-loop counter to do that is a code
        // smell the linter rightly flags.
        let i = 0;
        while (i < source.length) {
            const ch = source[i];

            if (ch === '\\' && ESCAPABLE_PUNCTUATION.has(source[i + 1])) {
                out.push(`${ESCAPED_OPEN}${store.length}${ESCAPED_CLOSE}`);
                store.push(source[i + 1]);
                i += 2;
                continue;
            }

            // A code span is copied WHOLE, so a backslash inside it stays literal
            // as CommonMark requires -- `\\d+` and `C:\\temp` are the common
            // case and must not be touched. Scanning here rather than parking
            // escapes in a separate pass is what lets both rules hold at once:
            // outside a span \\` is an escape and must not open one, inside a span
            // it is not an escape at all.
            if (ch === '`') {
                // The delimiter is a RUN closed by a run of the SAME length, the
                // same rule protectInlineCode uses. indexOf on a single backtick
                // contradicted the comment above: for a ``-delimited span it
                // copied only the two opening ticks and then scanned the BODY as
                // prose, so a backslash inside a multi-tick span was parked and
                // dropped -- exactly the spans that hold a backtick, like a regex
                // or a shell snippet.
                const openStart = i;
                while (source[i] === '`') i++;
                const runLength = i - openStart;
                const closeIndex = findClosingTickRun(source, i, runLength);
                if (closeIndex !== -1) {
                    out.push(source.slice(openStart, closeIndex + runLength));
                    i = closeIndex + runLength;
                    continue;
                }
                out.push(source.slice(openStart, i));
                continue;
            }

            out.push(ch);
            i++;
        }

        return out.join('');
    }

    /** Put escaped characters back as literal text, HTML-escaped. */
    private restoreEscapes(html: string, store: string[]): string {
        return restoreParked(html, ESCAPED_OPEN, ESCAPED_CLOSE, store, (s) => this.escapeHtml(s));
    }

    /**
     * Park inline code spans, already escaped, in the same store the fences use.
     *
     * Both are inert text, so both must sit out every pass that rewrites
     * content. Running `parseInlineCode` at the end instead meant the emphasis
     * and line-break passes had already been through the span's body.
     */
    private protectInlineCode(markdown: string, store: string[], sources: string[]): string {
        // Strip our own delimiters from the input first, exactly as the fence
        // and raw-tag stores do. Without it a document carrying U+E112/U+E113
        // could forge a token, and restoreInlineCode would expand it -- so a
        // span the author wrote once rendered twice.
        //
        // Scanned rather than matched with a regex: the delimiter is a RUN of
        // backticks closed by a run of the SAME length (that is how a span
        // holding a backtick is written, and what handleCodeTag emits), and
        // expressing that needs a backreference against a lazy body, which is
        // super-linear. The scan is O(n) and states the rule directly.
        const source = markdown
            .replaceAll(INLINE_CODE_OPEN, '')
            .replaceAll(INLINE_CODE_CLOSE, '');
        const out: string[] = [];
        let i = 0;

        while (i < source.length) {
            if (source[i] !== '`') {
                out.push(source[i]);
                i++;
                continue;
            }

            const openStart = i;
            while (source[i] === '`') i++;
            const runLength = i - openStart;
            const closeIndex = findClosingTickRun(source, i, runLength);

            if (closeIndex === -1) {
                out.push(source.slice(openStart, i));
                continue;
            }

            const code = stripCodeSpanPadding(source.slice(i, closeIndex));
            out.push(`${INLINE_CODE_OPEN}${store.length}${INLINE_CODE_CLOSE}`);
            store.push(`<code>${this.escapeHtml(code)}</code>`);
            // The span as written, backticks included, for a link target it sits in.
            sources.push(source.slice(openStart, closeIndex + runLength));
            i = closeIndex + runLength;
        }

        return out.join('');
    }

    private restoreInlineCode(html: string, store: string[]): string {
        return restoreParked(html, INLINE_CODE_OPEN, INLINE_CODE_CLOSE, store);
    }

    private restoreCodeFences(html: string, store: string[]): string {
        return restoreParked(html, CODE_FENCE_OPEN, CODE_FENCE_CLOSE, store);
    }


    private restoreRawTags(html: string, store: string[]): string {
        return restoreParked(html, RAW_TAG_OPEN, RAW_TAG_CLOSE, store);
    }

    /**
     * Escape HTML entities but preserve Markdown syntax. Only `<`/`>` that look
     * like HTML tags are escaped, so characters carrying Markdown meaning survive.
     */
    private escapeHtmlInContent(text: string): string {

        return perBlock(text, (block, paired) => block
            .replaceAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]{0,4096}>|</g, (match: string, tagName: string | undefined, offset: number) => {
                if (!tagName) return '&lt;';
                if (this.isMarkupTag(tagName, offset, paired)) {
                    return match;
                }
                // Tags whose CONTENT must not survive are left intact so the
                // sanitizer removes the whole subtree. Escaping them here would
                // turn a stripped <script> body into visible page text -- safe
                // to look at, but the payload would still be sitting in the
                // user's document.
                if (CONTENT_BEARING_UNSAFE_TAGS.has(tagName.toLowerCase())) return match;
                return '&lt;' + match.slice(1);
            })
            // `^` alongside the lookbehind: at index 0 there is no preceding
            // character for the lookbehind to test, so a document that OPENS with
            // a blockquote had its ">" escaped to text before parseBlockquotes
            // ever ran — the first line rendered literally while later ones
            // quoted correctly.
            // ">" itself belongs in the safe-preceding class: in the tight
            // nested form ">> b" the SECOND marker is preceded by the first,
            // so it was escaped to text before parseBlockquotes ran. The tight
            // form never reached the parser as markdown -- it collapsed to one
            // level and drifted on every save. CommonMark treats ">>>" as three
            // nested quotes, the same as "> > >".
            .replaceAll(/(?<!^)(?<![\s\w*`~[\]!#>-])>/gm, '&gt;'));
    }

    /**
     * Parse blockquotes (> text).
     */
    private parseToggleBlocks(html: string, depth = 0): string {
        // Each level re-slices and re-pairs its whole body, so the cost grows
        // with the square of the nesting, and this reads untrusted markdown:
        // thousands of nested openers held the page for seconds. Past the cap
        // the rest stays text, as it does for quotes.
        if (depth >= MAX_NESTING_DEPTH) return html;
        // A line scan that pairs each opener with its own closer. The regex it
        // replaces closed a block at the first ":::" after it, which belongs to
        // a nested block, so a details block inside another lost its body and
        // left ":::" as text. The body gets the block passes, not a blind <p>
        // wrap, so a list, heading, quote or table inside a toggle is real
        // content.
        const lines = html.split('\n');
        const pairs = pairToggleBlocks(lines);
        const out: string[] = [];
        let at = 0;
        while (at < lines.length) {
            const open = toggleOpener(lines[at]);
            const close = open ? (pairs.get(at) ?? -1) : -1;
            if (!open || close < 0) {
                out.push(lines[at]);
                at++;
                continue;
            }
            const body = this.parseDetailsBody(lines.slice(at + 1, close).join('\n').trim(), depth + 1);
            out.push(`<details open><summary>${open.title}</summary>${body}</details>`);
            at = close + 1;
        }
        return out.join('\n');
    }

    /**
     * The block passes for markdown nested inside another block: a details
     * body, a quote's lines, a list item's continuation.
     *
     * Each of those kept its own list, and the lists disagreed: a list item's
     * continuation had no rule pass, so "---" under an item came back as those
     * three characters, and neither a quote nor a details body looked for a
     * details block. Tables run before rules because a separator row is all
     * dashes.
     */
    private parseNestedBlocks(source: string, depth = 0): string {
        // One depth for every kind of nesting. Counted apart, a details block in
        // a list item or in a quote started again at zero, and the caps that stop
        // deep input from stalling the page never applied.
        let html = this.parseToggleBlocks(source, depth);
        html = this.parseBlockquotes(html, depth);
        html = this.parseHeadings(html);
        html = this.parseLists(html, depth);
        html = this.parseTables(html);
        return this.parseHorizontalRules(html);
    }

    /** Parse a toggle block's body: real blocks if it holds any, else a paragraph. */
    private parseDetailsBody(content: string, depth: number): string {
        // An empty body stays empty. A paragraph here gave every details block
        // with only a summary a line the author never wrote, on every save.
        if (!content) return '';

        // Every chunk between blank lines is either blocks or loose text, and
        // loose text gets a paragraph. Returning the passes' output as it was
        // left text beside a block bare inside the details element, where the
        // document-level paragraph pass split it apart: a stray line break in
        // a paragraph and one more empty paragraph on each save.
        return this.blocksWithParagraphs(this.parseNestedBlocks(content, depth));
    }

    /** Parsed blocks with each chunk of loose text between blank lines given a paragraph of its own. */
    private blocksWithParagraphs(html: string): string {
        return html
            .split(/\n{2,}/)
            .map((chunk) => this.wrapLooseLines(chunk.trim()))
            .filter(Boolean)
            .join('');
    }

    /**
     * Wrap quoted lines, running the list parser over them first.
     *
     * The body used to be joined with `<br>` and never parsed, so a list inside
     * a quote stayed literal text -- and because `toMarkdown` then re-emitted it
     * as text with the `<br>` becoming trailing whitespace, the document grew
     * two characters on every save/load, forever. Quoted lists are ordinary
     * content; they get the ordinary treatment.
     */
    private buildBlockquote(lines: readonly string[], depth = 0): string {
        // A quoted line that is itself quoted opens a deeper level. Stripping a
        // single ">" and never recursing left the second marker as a literal
        // ">" character in the output, so nested quotes -- ordinary markdown --
        // simply did not work.
        //
        // The depth cap is not cosmetic: each level re-runs parseBlockquotes AND
        // parseLists over the remaining text, so the cost is exponential --
        // measured 1ms, 7ms, 204ms at depths 10, 20, 25. An 81-byte document of
        // 40 markers froze the tab, and it arrives from paste, file import and
        // <ui-rich-text-view [value]>. Past the cap the rest stays literal text,
        // which is what CommonMark implementations do.
        // This test MUST use the same predicate as parseBlockquotes below.
        // It required a space, so after one ">" was stripped ">>> c" became
        // ">> c" -- a quote line by that function's rule but not by this one,
        // so recursion stopped and three-deep tight quotes collapsed to depth 1
        // and drifted on every save. The two disagreeing about what a quote
        // line is was the whole defect.
        const nested = lines.some((line) => line.startsWith('>'));
        if (nested && depth < MAX_NESTING_DEPTH) {
            return `<blockquote>${this.blocksWithParagraphs(this.parseNestedBlocks(lines.join('\n'), depth + 1))}</blockquote>`;
        }
        if (nested) {
            return `<blockquote>${this.escapeHtml(lines.join('\n'))}</blockquote>`;
        }

        // Headings, rules and tables inside a quote get a pass too, not just
        // lists. Only parseLists ran here, so "> ## H" and "> ---" came back as
        // literal characters -- a quoted heading or divider was silently demoted
        // to text on the first save, as a stable fixed point that never
        // recovered. Same recursion parseListContinuation uses for an item's
        // continuation block.
        const source = lines.join('\n');
        const parsed = this.parseNestedBlocks(source, depth);

        // Loose text after a blank line gets its paragraph here. Left bare, the
        // document-level paragraph pass split the quote's markup at that blank
        // line and left an empty paragraph after the quote.
        // Lines with no blank between them are lines of one quote, joined with
        // breaks the sanitizer makes paragraphs of. A blank line separates
        // blocks, including two paragraphs, or a code block and the text after
        // it, which the break join turned into an empty line between them.
        const separated = lines.some((line) => line.trim() === '');
        const body = parsed === source && !separated ? lines.join('<br>') : this.blocksWithParagraphs(parsed);
        return `<blockquote>${body}</blockquote>`;
    }

    private parseBlockquotes(html: string, depth = 0): string {
        const lines = html.split('\n');
        const result: string[] = [];
        let inBlockquote = false;
        let blockquoteContent: string[] = [];

        for (const line of lines) {
            // The space after ">" is optional in CommonMark. Requiring it meant
            // ">> b" was not a quote line at all -- a nested quote written in
            // the tight form produced depth 1 instead of 2, and ">> b" alone
            // produced no blockquote whatsoever. The strip below already
            // tolerates both forms; only this test was too narrow.
            // Only an UNINDENTED marker opens a quote here. CommonMark allows
            // up to three leading spaces, but an indented "> b" under a list
            // item is that item's continuation, and this pass runs before the
            // list pass -- taking it here pulled the quote out of its item.
            if (line.startsWith('>')) {
                inBlockquote = true;
                blockquoteContent.push(line.replace(/^>\s?/, ''));
            } else {
                if (inBlockquote) {
                    result.push(this.buildBlockquote(blockquoteContent, depth));
                    blockquoteContent = [];
                    inBlockquote = false;
                }
                result.push(line);
            }
        }

        if (inBlockquote) {
            result.push(this.buildBlockquote(blockquoteContent, depth));
        }

        return result.join('\n');
    }

    /**
     * Parse headings (# - ######).
     */
    private parseHeadings(html: string): string {
        // A line scan. The pattern it replaced matched "\s+" across the line
        // end, so an empty heading took the paragraph after it as its text.
        return html.split('\n').map((line) => {
            const level = headingLevelOf(line);
            return level === 0 ? line : `<h${level}>${line.slice(level).trim()}</h${level}>`;
        }).join('\n');
    }

    /**
     * Parse unordered and ordered lists.
     */
    private parseLists(html: string, depth = 0): string {
        const lines = html.split('\n');
        const result: string[] = [];

        const stack: ListContext[] = [];
        let rootLists: ListContext[] = [];

        const flushStack = (): void => {
            rootLists = flushListStack(rootLists, stack, result);
        };

        // Lines held for the item currently open, and blank lines not yet known
        // to belong to it. Attached to the item on flush, after the block passes
        // have run over them at their own level.
        const continuation: string[] = [];
        let continuationOwner: ListContext | undefined;
        const pendingBlank: string[] = [];
        // The last line of each details block that closes, by its opening line.
        // Only a block that closes is held: counting openers held every line
        // after an unclosed one, pulling the rest of the document into the item.
        const toggleClosers = pairToggleBlocks(lines.map((line) => line.trim()));
        const itemEnd = itemEndFinder(lines);
        let holdUntil = -1;

        // The continuation owner is captured when the continuation STARTS:
        // a following sibling pops the deeper levels before the flush runs, so
        // stack.at(-1) would be an ancestor by then -- a third-level item's
        // heading landed in its grandparent, as a stable fixed point.
        const flushContinuation = (): string[] => {
            const { block, orphanBlanks } = takeContinuation(continuation, pendingBlank);
            const openList = continuationOwner;
            continuationOwner = undefined;
            holdUntil = -1;
            if (block && openList?.items.length) appendToLastItem(openList, this.parseListContinuation(block, openList, depth));
            return orphanBlanks;
        };

        for (const [at, line] of lines.entries()) {
            // A details block opened in an item's continuation owns every line
            // until it closes. A list-looking line inside it is the block's own
            // list: taken as the next item, it cut the block off from its closer.
            if (at <= holdUntil) {
                holdLine(line, continuation, pendingBlank);
                continue;
            }
            const parsed = parseListLine(line);

            if (!parsed) {
                closeItemsLeftOf(line, stack, pendingBlank, flushContinuation);
                const openList = stack.at(-1);
                if (absorbNonListLine(line, openList, continuation, pendingBlank)) {
                    continuationOwner ??= openList;
                    holdUntil = heldCloser(at, toggleClosers.get(at), openList, itemEnd) ?? holdUntil;
                    continue;
                }
                const orphans = flushContinuation();
                flushStack();
                result.push(...orphans, line);
                continue;
            }

            closeLevelsFor(stack, parsed.indent, parsed.type, parsed.marker);
            flushContinuation();
            pushListItem(stack, rootLists, parsed);
        }

        flushContinuation();
        flushStack();
        return result.join('\n');
    }

    /**
     * Convert a list item's continuation block, dedented to its own level.
     *
     * parseBlockquotes and parseHeadings run BEFORE parseLists, so an indented
     * "> b" or "## b" was consumed at document level and emitted outside the
     * list -- hand-written CommonMark rendered as literal text. Re-running the
     * block passes here, on the dedented lines, is the same recursion
     * buildBlockquote uses for a nested quote.
     */
    private parseListContinuation(block: string, list: ListContext, depth: number): string {
        // The block's own indent is its first line's, up to three past the last
        // item's content column, as CommonMark allows before a block marker; every
        // line loses that width, or less when it is indented less. Two past the
        // item's indent left a numbered item's block one space in, where neither a
        // details block nor a quote opens. Sliced each by its own width, the
        // writer's lines at two and four spaces under a wide marker lost different
        // amounts and a nested list moved a level. Taken from the least indented
        // line, one later line at two spaces pulled a hand-written block short; and
        // capped at the column, a block written at four spaces under "- " kept two,
        // which the trim took off its first line only, so its second quote line,
        // heading or details closer came back as text.
        const lines = block.split('\n');
        const opening = lines.find((line) => line.trim() !== '') ?? '';
        const width = Math.min((list.items.at(-1)?.column ?? list.indent + 2) + 3, indentOf(opening));
        const dedented = lines
            .map((line) => line.slice(Math.min(width, indentOf(line))))
            .join('\n')
            .trim();
        if (!dedented) return '';

        // Loose text becomes paragraphs, chunk by chunk. Returned bare it was
        // concatenated onto the item's first line, so "Alpha" and "Second" fused
        // into one word; and wrapped whole only when it did not start with a tag,
        // text after a block kept its blank line inside the item, where the
        // document-level paragraph pass split the list apart.
        return this.blocksWithParagraphs(this.parseNestedBlocks(dedented, depth + 1));
    }

    /**
     * Parse GFM tables back into real table markup.
     *
     * `tableToMarkdown` has always emitted them, but nothing read them back —
     * so in markdown mode (the documented default) a save followed by a reload
     * turned every table into inert paragraph text that merely looked like a
     * table's source. A run needs a header row, a separator row of dashes, and
     * at least the header to be pipe-delimited; anything else is left alone so
     * a sentence containing a pipe stays a sentence.
     */
    private parseTables(html: string): string {
        const lines = html.split('\n');
        const out: string[] = [];

        let i = 0;
        while (i < lines.length) {
            const header = lines[i];
            const separator = lines[i + 1];
            if (!this.isTableRow(header) || !this.isTableSeparator(separator ?? '')) {
                out.push(header);
                i++;
                continue;
            }

            const bodyRows: string[][] = [];
            let cursor = i + 2;
            while (cursor < lines.length && this.isTableRow(lines[cursor])) {
                bodyRows.push(this.splitTableRow(lines[cursor]));
                cursor++;
            }

            out.push(this.buildTableHtml(this.splitTableRow(header), bodyRows));
            i = cursor;
        }

        return out.join('\n');
    }

    /** Assemble the table markup from its parsed header and body cells. */
    private buildTableHtml(headerCells: string[], bodyRows: string[][]): string {
        const cells = (row: string[], tag: 'th' | 'td'): string =>
            row.map(cell => '<' + tag + '>' + cell + '</' + tag + '>').join('');
        const head = '<thead><tr>' + cells(headerCells, 'th') + '</tr></thead>';
        const body = bodyRows.map(row => '<tr>' + cells(row, 'td') + '</tr>').join('');
        return '<table>' + head + '<tbody>' + body + '</tbody></table>';
    }

    /** A line that could be a table row: contains a pipe outside an escape. */
    private isTableRow(line: string): boolean {
        const trimmed = line.trim();
        return trimmed.includes('|') && trimmed.replaceAll(String.raw`\|`, '').includes('|');
    }

    /** The `| --- | :--: |` row that makes the line above it a header. */
    private isTableSeparator(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
        return this.splitTableRow(trimmed).every(cell => /^:?-+:?$/.test(cell.trim()));
    }

    /** Cells of one row, honouring `\\|` escapes inside cell text. */
    private splitTableRow(line: string): string[] {
        const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
        const cells: string[] = [];
        let current = '';
        for (let i = 0; i < trimmed.length; i++) {
            const ch = trimmed[i];
            // A single backslash. The comparison was against a TWO-character
            // string that no single character can equal, so the escape never
            // fired: "x\|y" split into two cells and left the backslash
            // visible, giving a body row wider than its own header.
            if (ch === '\\' && trimmed[i + 1] === '|') {
                current += '|';
                i++;
                continue;
            }
            if (ch === '|') {
                cells.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }
        cells.push(current.trim());
        return cells;
    }

    /**
     * Parse horizontal rules (---, ***, ___).
     */
    /**
     * Replace a rule line with <hr>.
     *
     * Trailing whitespace is [ \t] and NOT \s: under /m, \s* matches the line
     * terminator too and greedily ate the BLANK LINE after the rule -- the very
     * separator parseParagraphs needs. The rule and the paragraph after it fused
     * into one block, which then matched the "already block-level" guard, so the
     * paragraph was never wrapped: <p>Intro</p><hr><p>Body</p> came back with
     * Body as a bare text node, losing its paragraph styling and any block
     * operation that addresses <p>.
     */
    private parseHorizontalRules(html: string): string {
        // "* * *" and "- - -" are rules too: CommonMark allows interior spaces
        // and up to three leading ones. parseListLine refuses the same shape,
        // so the spaced spelling is never read as a bullet holding "* *".
        return html.replaceAll(THEMATIC_BREAK_LINE, '<hr>');
    }

    /**
     * Wrap remaining text in paragraphs.
     */
    /** Whether `block` opens with a parked tag that is block-level. */
    private startsWithParkedBlockTag(block: string, store: string[]): boolean {
        const match = RAW_TAG_ONLY_BLOCK.exec(block);
        if (!match) return false;
        const tag = store[Number(match[1])] ?? '';
        return BLOCK_LEVEL_TAG_PATTERN.test(tag);
    }

    private parseParagraphs(html: string, store: string[]): string {
        /** Split by double newlines (paragraph breaks) */
        const blocks = html.split(/\n\n+/);

        return blocks.map(block => {
            const trimmed = block.trim();

            if (/^<(h[1-6]|ul|ol|li|blockquote|pre|div|p|hr|table|details|figure)/i.test(trimmed)) {
                return this.wrapLooseLines(trimmed);
            }

            // A parked code fence is a block, even though it currently looks
            // like a single placeholder character. Without this it gets wrapped
            // in a paragraph, and restoring the <pre> inside that <p> leaves a
            // stray empty <p></p> in the output.
            if (trimmed.startsWith(CODE_FENCE_OPEN)) {
                return trimmed;
            }

            // A block that OPENS with a parked block-level tag is markup the
            // author wrote directly -- "<p>Hello <b>World</b></p>" arrives as
            // tokens plus text, and wrapping it again produced
            // "<p></p><p>Hello…</p><p></p>". Inline-only content still gets its
            // paragraph, so "<b>x</b>" stays "<p><b>x</b></p>".
            if (this.startsWithParkedBlockTag(trimmed, store)) {
                return trimmed;
            }

            if (!trimmed) {
                return '';
            }

            return `<p>${trimmed}</p>`;
        }).filter(Boolean).join('\n');
    }

    /**
     * Wrap the prose lines that follow a block element within one chunk.
     *
     * A chunk that merely STARTED with a block tag was returned whole, so
     * "# Title\nBody" left "Body" as a bare text node beside the heading -- no
     * paragraph, so block operations and consumer styling on `p` missed it.
     * Three earlier fixes each taught one upstream pass to preserve the blank
     * line this guard relied on (after a rule, after a list, a held blank);
     * this fixes the guard instead, for every block construct at once.
     *
     * Only lines at the top level count: a line inside a multi-line block
     * element (a details body, a nested list) is left where it is.
     */
    private wrapLooseLines(chunk: string): string {
        const lines = chunk.split('\n');
        const out: string[] = [];
        let prose: string[] = [];
        let depth = 0;
        const flush = (): void => {
            if (prose.length > 0) out.push(`<p>${prose.join('\n')}</p>`);
            prose = [];
        };
        for (const line of lines) {
            const trimmed = line.trim();
            const opens = (line.match(BLOCK_OPEN_TAG) ?? []).length;
            const closes = (line.match(BLOCK_CLOSE_TAG) ?? []).length;
            const isMarkup = depth > 0 || trimmed.startsWith('<') || trimmed.startsWith(CODE_FENCE_OPEN) || trimmed === '';
            if (isMarkup) {
                flush();
                out.push(line);
            } else {
                prose.push(line);
            }
            depth = Math.max(0, depth + opens - closes);
        }
        flush();
        return out.join('\n');
    }

    /**
     * Parse images ![alt](src).
     */
    /** Hide Markdown-meaningful characters in a URL from the emphasis passes. */
    private shieldUrl(url: string): string {
        return URL_SHIELD.reduce((acc, [ch, code]) => acc.replaceAll(ch, code), url);
    }

    /**
     * An attribute value: HTML-escaped so a quote in a link target cannot end
     * the attribute early, then shielded from the emphasis passes. The final
     * sanitize would have caught anything dangerous that broke out, but the
     * parser must not depend on it for the integrity of its own markup -- a
     * relative target such as `./a" style="…` used to write a second
     * attribute of its own.
     */
    private attr(value: string): string {
        return this.shieldUrl(this.escapeHtml(value));
    }

    /**
     * An attribute value made of document text, which escapeHtmlInContent has
     * already escaped: only a quote is escaped here. Escaped again, a "<" in alt
     * text came back as the characters "&lt;", one more layer on every save.
     */
    private textAttr(value: string): string {
        return this.shieldUrl(value.replaceAll('"', '&quot;'));
    }

    /** Restore the characters {@link shieldUrl} hid, once those passes are done. */
    private unshieldUrls(html: string): string {
        return URL_SHIELD.reduce((acc, [ch, code]) => acc.replaceAll(code, ch), html);
    }

    /**
     * A link or image target as the author typed it, or null when it is no target.
     *
     * Earlier passes had rewritten it: a code span and a raw tag were parked, and a
     * stray "<" or ">" was escaped. Taken as they were, a parked token was restored
     * inside the attribute, breaking it, and an escaped "<" was escaped again, so
     * the address held "&lt;". CommonMark reads a target from its characters,
     * backticks and "<" included, with its character references decoded -- the
     * escape pass's "&lt;" is one; kept, an author's "&amp;" was escaped again and
     * the query string broke. A target with a space is no target; only one that
     * held a code span or a tag is checked for it, since a plain target with a
     * space has always been read as a link.
     *
     * A backslash escape is resolved LAST, after the character references: it is
     * the author saying "this character, literally", so what it hands back must
     * not be read as syntax again -- `\&amp;` means those five characters, not
     * an ampersand. Resolving it here at all is what lets the writer escape a
     * parenthesis the target grammar cannot carry (see markdownTarget): the real
     * character reaches the sanitizer and the attribute, rather than the parked
     * token, which sanitizeImageSrc percent-encoded into the address.
     */
    private targetSource(
        target: string,
        inlineSources: readonly string[],
        tagStore: readonly string[],
        escapes: readonly string[],
    ): string | null {
        const typed = restoreParked(
            decodeCharacterReferences(
                restoreParked(restoreParked(target, INLINE_CODE_OPEN, INLINE_CODE_CLOSE, inlineSources), RAW_TAG_OPEN, RAW_TAG_CLOSE, tagStore),
            ),
            ESCAPED_OPEN,
            ESCAPED_CLOSE,
            escapes,
        );
        return holdsParkedToken(target) && /\s/.test(typed) ? null : typed;
    }

    /**
     * An image's alt text as attribute text: a parked code span becomes the text it
     * holds, and a parked raw tag the escaped characters of that tag. Restored only
     * after the attribute was written, a tag's quotes ended the attribute and the
     * rest of the tag showed on the page.
     */
    private altText(alt: string, inlineStore: readonly string[], tagStore: readonly string[]): string {
        return restoreParked(resolveInlineCodeText(alt, inlineStore), RAW_TAG_OPEN, RAW_TAG_CLOSE, tagStore, (tag) => this.escapeHtml(tag));
    }

    /**
     * Park a tag this pass wrote in the raw-tag store, so no later pass can see
     * inside it.
     *
     * The tag is written UNSHIELDED because parking supersedes the shield:
     * restoreRawTags runs after unshieldUrls, so a shielded character parked in
     * here would never be given back.
     */
    private parkWrittenTag(tag: string, tagStore: string[]): string {
        const token = `${RAW_TAG_OPEN}${tagStore.length}${RAW_TAG_CLOSE}`;
        tagStore.push(tag);
        return token;
    }

    /**
     * An `<img>` this pass wrote, with its attributes escaped but not shielded.
     *
     * Its alt text is DOCUMENT TEXT, which escapeHtmlInContent has already
     * escaped, so only the quote is escaped again here -- escaping it twice
     * brought a "<" back as the characters "&lt;", one more layer per save.
     */
    private imageTag(attribute: 'src' | 'data-blocked-src', target: string, alt: string): string {
        return `<img ${attribute}="${this.escapeHtml(target)}" alt="${alt.replaceAll('"', '&quot;')}">`;
    }

    /**
     * Parse images ![alt](src).
     *
     * The tag is parked, not returned live. Left in the stream, its alt
     * attribute was still document text as far as the passes that follow were
     * concerned: parseLinks read `![a [b](u) c](i.png)` as a link INSIDE the
     * attribute and wrote an `<a href="` into it, which ended the attribute and
     * put the rest of the tag on the page. Shielding only hid `* _ \` ~`, so it
     * could never have covered the bracket forms.
     */
    private parseImages(html: string, inlineStore: readonly string[], inlineSources: readonly string[], tagStore: string[], escapes: readonly string[]): string {
        return html.replaceAll(MEDIA_TARGET_PATTERN.image, (match, alt, target) => {
            const src = this.targetSource(target, inlineSources, tagStore, escapes);
            if (src === null) return match;
            const safeSrc = this.sanitizer.sanitizeImageSrc(src);
            // An alt attribute is plain text: a parked code span restored in
            // there would land as the literal string "<code>x</code>". Resolve
            // it back to the text the author typed instead.
            const plainAlt = this.altText(alt, inlineStore, tagStore);
            if (!safeSrc) {
                // A POLICY-blocked image keeps its element and alt, so the
                // reader sees a labelled frame rather than nothing and the block
                // is reversible. An UNSAFE one is still dropped outright. The
                // HTML path does the same; without this, markdown mode -- the
                // DEFAULT -- silently deleted blocked images instead.
                const blocked = this.sanitizer.takeBlockedByPolicy();
                if (blocked === null) return '';
                return this.parkWrittenTag(this.imageTag('data-blocked-src', blocked, plainAlt), tagStore);
            }
            return this.parkWrittenTag(this.imageTag('src', safeSrc, plainAlt), tagStore);
        });
    }

    /**
     * Parse links [text](url).
     */
    private parseLinks(html: string, inlineSources: readonly string[], tagStore: readonly string[], escapes: readonly string[]): string {
        return html.replaceAll(MEDIA_TARGET_PATTERN.link, (match, text, target) => {
            const url = this.targetSource(target, inlineSources, tagStore, escapes);
            if (url === null) return match;
            const safeUrl = this.sanitizer.sanitizeUrl(url);
            if (!safeUrl) return text;
            return `<a href="${this.attr(safeUrl)}" rel="noopener noreferrer">${text}</a>`;
        });
    }

    /**
     * Parse bold and italic, in this order so the longer delimiters win:
     *
     * 1. Bold + italic — `***text***` / `___text___`
     * 2. Bold — `**text**` / `__text__`
     * 3. Italic — `*text*` / `_text_`, ignoring mid-word underscores
     */
    private parseBoldItalic(html: string): string {
        // Bold-italic is one span with no delimiter inside it. Allowing any
        // character read "***x* *y***" -- bold around two italics -- as a single
        // bold-italic run and left the inner "* *" as text.
        html = html.replaceAll(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replaceAll(/___([^_]+)___/g, '<strong><em>$1</em></strong>');

        html = html.replaceAll(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');

        html = html.replaceAll(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');
        html = html.replaceAll(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');

        return html;
    }

    /**
     * Parse strikethrough ~~text~~.
     */
    private parseStrikethrough(html: string): string {
        return html.replaceAll(/~~(.+?)~~/g, '<del>$1</del>');
    }

    /**
     * Parse line breaks (two spaces + newline or explicit \n).
     */
    private parseLineBreaks(html: string): string {
        // Only a break FOLLOWED BY CONTENT on the next line. Two trailing
        // spaces before a blank line, a heading, a fence or the end of the
        // document are not a hard break: the block boundary already ends the
        // line, and inserting a <br> there strands it in an empty paragraph or
        // merges two paragraphs into one. Verified against fifteen shapes --
        // this is the only reading under which every other one is unchanged.
        return html.replaceAll(/ {2}\n(?=[^\n])/g, '<br>');
    }

    /**
     * Escape HTML special characters.
     */
    private escapeHtml(text: string): string {
        return text
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    /**
     * Convert HTML to Markdown.
     * Used for paste handling and output conversion.
     */
    toMarkdown(html: string): string {
        if (!html) return '';

        /** First sanitize the HTML */
        const cleanHtml = this.sanitizer.sanitize(html);

        /** Parse into DOM */
        const parser = new DOMParser();
        const doc = parser.parseFromString(cleanHtml, 'text/html');
        this.unwrapTextSpans(doc.body);
        prepareForMarkdown(doc.body);

        return this.nodeToMarkdown(doc.body).trim();
    }

    /**
     * Recursively convert DOM node to Markdown.
     */
    private nodeToMarkdown(node: Node): string {
        const result: string[] = [];

        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                result.push(textToMarkdown(child));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                result.push(this.elementToMarkdown(child as HTMLElement));
            }
        }

        return result.join('');
    }

    private elementToMarkdown(element: HTMLElement): string {
        const tagName = element.tagName.toLowerCase();
        // These ignore their subtree's markdown: <table> walks its own cells in
        // tableToMarkdown, <pre> reads its text, <ul>, <ol> and <details> walk
        // their own children, and <img> and <input> render from attributes.
        // Details holding lists were converted twice per level too, 4x per
        // nesting level: nine levels took 7s, ten took 29s.
        // Computing `inner` eagerly converted every table's subtree TWICE --
        // once here, discarded, and once in tableToMarkdown -- so nested
        // tables doubled per level: 5, 9, 15, 27, 54ms at depths 9-13, and a
        // 430-byte document of 25 nested tables took minutes. The node budget
        // hid this by cutting such input before it was ever converted.
        if (SUBTREE_INDEPENDENT_TAGS.has(tagName)) {
            const standalone = this.blockTagToMarkdown(tagName, '', element)
                ?? this.inlineTagToMarkdown(tagName, '', element);
            if (standalone !== null) return standalone;
        }

        const inner = this.nodeToMarkdown(element);

        const headingLevel = this.headingTagLevel(tagName);
        if (headingLevel > 0) {
            return `\n${'#'.repeat(headingLevel)} ${breaksAsTags(inner)}\n`;
        }

        const inlineResult = this.inlineTagToMarkdown(tagName, inner, element);
        if (inlineResult !== null) return inlineResult;

        const blockResult = this.blockTagToMarkdown(tagName, inner, element);
        if (blockResult !== null) return blockResult;

        return inner;
    }

    private headingTagLevel(tagName: string): number {
        const match = /^h([1-6])$/.exec(tagName);
        return match ? Number(match[1]) : 0;
    }

    private inlineTagToMarkdown(tagName: string, inner: string, element: HTMLElement): string | null {
        // An empty inline element carries nothing, so it serializes to nothing.
        // Emitting the delimiters around an empty body produced VISIBLE literal
        // punctuation the author never typed: <code></code> became a bare ``,
        // <strong></strong> became ****, <em></em> ** and <del></del> ~~~~ --
        // and none of those parse back, so the noise stuck. Deleting the text
        // inside a bold or code run leaves exactly this shape, so it is reachable
        // by an ordinary edit. <mark> and <u> were already fine, being emitted as
        // tags rather than delimiters.
        //
        // <img> and <input> are excluded: they are legitimately empty and carry
        // their content in attributes.
        // `inner` is the serialized body, so an element holding only an image or
        // a line break has a non-empty `inner` and is correctly kept -- testing
        // element.textContent instead swallowed <strong><img></strong>.
        if (isEmptyWrapper(tagName, inner, element)) return '';

        // Markdown has no syntax for these, so they are emitted verbatim --
        // protectRawTags already carries such tags back through toHtml unchanged.
        // Only <u> used to be handled, so its five siblings (all in the
        // sanitizer's ALLOWED_TAGS) were flattened to bare text on EVERY save in
        // the default markdown mode: <mark>X</mark> became X, unrecoverably.
        if (VERBATIM_INLINE_TAGS.has(tagName)) {
            // The style attribute rides along, exactly as spanToMarkdown carries
            // it for a styled <span>. The sanitizer keeps style on these tags, so
            // dropping it here lost a user's colour the moment they applied it to
            // highlighted or underlined text -- the same defect as the flattened
            // span, one element away. Everything else is still dropped.
            const style = element.getAttribute('style');
            const attr = style ? ` style="${this.escapeHtml(style)}"` : '';
            return `<${tagName}${attr}>${breaksAsTags(inner)}</${tagName}>`;
        }
        const emphasis = this.emphasisToMarkdown(tagName, inner, element);
        if (emphasis !== null) return emphasis;
        switch (tagName) {
            case 'del':
            case 's':
                // Inside another strikethrough it adds nothing: `~~a ~~b~~~~` read
                // back as struck "a " followed by literal tildes.
                return this.insideEmphasis(element, STRIKE_TAGS) ? inner : delimit(inner, '~~');
            // Markdown has no syntax for these, so they are emitted verbatim --
            // protectRawTags already carries such tags back through toHtml
            // unchanged. Only <u> was listed, so its five siblings (all in the
            // sanitizer's ALLOWED_TAGS) were flattened to bare text on EVERY
            // save in the default markdown mode: <mark>X</mark> became X.
            case 'code':
                return this.handleCodeTag(element, inner);
            case 'a':
                return this.handleAnchorTag(element, inner);
            case 'img':
                return this.handleImageTag(element);
            case 'span':
                return this.spanToMarkdown(element, inner);
            default:
                return null;
        }
    }

    /** Bold or italic markdown for `inner`, or null for any other tag. */
    private emphasisToMarkdown(tagName: string, inner: string, element: HTMLElement): string | null {
        if (BOLD_TAGS.includes(tagName)) return this.insideEmphasis(element, BOLD_TAGS) ? inner : emphasisFor(element, inner, 'strong', boldMarkFor(inner));
        if (ITALIC_TAGS.includes(tagName)) {
            return this.insideEmphasis(element, ITALIC_TAGS) ? inner : emphasisFor(element, inner, 'em', italicMarkFor(inner));
        }
        return null;
    }

    /**
     * Whether an enclosing element on the same line already applies this emphasis.
     *
     * `<b><b>x</b> y</b>` was written `****x** y**`, which reads back as stray
     * asterisks around plain text: bold inside bold is still just bold.
     */
    private insideEmphasis(element: HTMLElement, tags: readonly string[]): boolean {
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const tag = parent.tagName.toLowerCase();
            if (tags.includes(tag)) return true;
            if (!INLINE_ANCESTORS.has(tag)) return false;
        }
        return false;
    }

    /**
     * Serialize an inline code span.
     *
     * Reads the element's OWN textContent rather than `inner`: nodeToMarkdown
     * has already run escapeMarkdownText over the text node, and nothing inside
     * a code span may be escaped -- it is inert text by definition. Using the
     * escaped `inner` added a backslash on EVERY save without bound
     * (<code>foo_bar</code> -> foo\_bar -> foo\\_bar -> ...), and an escaped
     * backtick closed the span early, so the tail escaped the element into the
     * paragraph and the code was destroyed on the first save. handlePreTag
     * already read textContent for this reason; the inline path did not.
     *
     * The delimiter is a backtick RUN longer than any run inside the content,
     * with padding spaces when the content starts or ends with one -- the same
     * CommonMark rule the fenced-block path uses.
     */
    private handleCodeTag(element: HTMLElement, inner: string): string {
        if (element.parentElement?.tagName.toLowerCase() === 'pre') return inner;

        const content = element.textContent ?? '';

        // A code span cannot cross a line, and an empty one has no delimiter
        // that parses. Both used to be emitted anyway and neither could be read
        // back: a <code> holding a newline lost the element and left its backticks
        // as visible text (splitting the paragraph when the line was blank), and
        // <code></code> emitted a bare `` that vanished with its content. The
        // verbatim-tag form survives the round trip instead.
        // Also when a code element sits directly against another: `a` + `b`
        // joins as `a``b`, which reads back as ONE span holding "a``b" -- the
        // two elements merge and four characters the author never typed appear
        // in the content. The delimiters are only unambiguous with a gap, and
        // inventing a space would change the text.
        // Past code written as nothing: counted, an empty code element beside this
        // one sent it to the tag form, and the next save, which no longer had the
        // empty element, wrote a span.
        const abutsCode = (side: 'previousSibling' | 'nextSibling'): boolean => {
            let sibling = element[side];
            while (sibling && isCodeWrittenAsNothing(sibling)) sibling = sibling[side];
            return sibling?.nodeName === 'CODE';
        };

        // A break or an image has no text, so a code span written from the text
        // alone lost it -- a break fused the words around it, and code holding
        // only an image was dropped whole; the tag form keeps each.
        const showsWithoutText = codeShowsWithoutText(element);
        if (content === '' && !showsWithoutText) return '';
        if (showsWithoutText || content.includes('\n') || abutsCode('previousSibling') || abutsCode('nextSibling')) {
            return `<code>${this.codeTagContent(element)}</code>`;
        }

        const longestRun = Math.max(
            0,
            ...Array.from(content.matchAll(/`+/g), (m) => m[0].length),
        );
        const fence = '`'.repeat(longestRun + 1);

        // Padding is needed for a leading or trailing SPACE as well as a
        // backtick: stripCodeSpanPadding removes one pair on the way back, so
        // without it <code>  a  </code> lost a space from each side on every
        // save until none were left -- and whitespace is meaningful in code.
        // Not for all-whitespace content: stripCodeSpanPadding declines to strip
        // there (CommonMark keeps a span of only spaces as-is), so padding it
        // would accumulate a space on each side every save.
        const needsPad = content.trim() !== '' && /^[ `]|[ `]$/.test(content);
        const pad = needsPad ? ' ' : '';
        return `${fence}${pad}${content}${pad}${fence}`;
    }

    /**
     * A code element's content for its tag form: its text escaped, each break as
     * the tag, each image as markdown, and newlines as character references -- a
     * raw one ended a heading or a task row the tag sat in, a blank line split the
     * tag pair, and the break rewrite changed the code's own spaces.
     */
    private codeTagContent(node: Node): string {
        return Array.from(node.childNodes, (child) => {
            if (child.nodeName === 'BR') return '<br>';
            if (child.nodeName === 'IMG') return this.handleImageTag(child as HTMLElement);
            if (child.nodeType === Node.ELEMENT_NODE) return this.codeTagContent(child);
            return this.escapeHtml(escapeInlineSyntax(child.textContent ?? '')).replaceAll('\n', '&#10;');
        }).join('');
    }

    private handleAnchorTag(element: HTMLElement, inner: string): string {
        const href = element.getAttribute('href') ?? '';
        // A link with no text is kept as its tag. As `[](href)` it had no link text
        // to read, and came back as that text on the page. What it held -- a space,
        // a break -- is written after the tag: dropped, the words on either side
        // of the link fused.
        if (inner.trim() === '') return `<a href="${this.escapeHtml(href)}"></a>${inner}`;
        return `[${inner}](${markdownTarget(href)})`;
    }

    private handleImageTag(element: HTMLElement): string {
        const alt = element.getAttribute('alt') ?? '';
        // A blocked image serializes with its ORIGINAL url, not an empty one.
        // It has no `src` -- that is the point -- so writing `src` alone gave
        // "![alt]()", which loses the URL permanently on the first save and
        // reloads as visible literal text. The block is meant to be reversible:
        // allowing the host later must bring the image back, and it cannot if
        // the address was thrown away. Re-reading it just re-applies the policy,
        // so a still-blocked image simply blocks again.
        const src = imageTarget(element);
        // The alt text is text on one line, escaped as text is: an unescaped "]"
        // ended it and the image came back as its markdown source, a newline split
        // the paragraph inside the attribute, backticks or asterisks were read as
        // syntax, and "&copy;" or "<i>" came back as a character or a tag.
        const text = escapeMarkdownText(alt.replaceAll(/[ \t\n\r\f]+/g, ' '));
        return `![${text}](${markdownTarget(src)})`;
    }

    /**
     * Unwrap every span that is written as its text alone, so the text on either
     * side merges before it is escaped.
     *
     * Escaped one text node at a time, `~<span>~</span>~`, `&<span>lt;</span>`
     * and `<span>&lt;</span>b>` came back as a fence, an entity and a tag. The
     * rule is the writer's own (see spanToMarkdown): keyed on having no
     * attributes, a span carrying only `dir`, which the sanitizer keeps, was
     * still written as bare text and the split syntax still formed.
     */
    private unwrapTextSpans(root: HTMLElement): void {
        for (const span of Array.from(root.querySelectorAll('span'))) {
            if (!this.writesOwnMarkup(span)) span.replaceWith(...Array.from(span.childNodes));
        }
    }

    /** Whether spanToMarkdown writes a span as markup of its own rather than its inner text. */
    private writesOwnMarkup(span: HTMLElement): boolean {
        if (span.getAttribute('style') || 'mention' in span.dataset || 'tag' in span.dataset) return true;
        return this.spanSerializers.some((serializer) => serializer.serialize(span, '') !== null);
    }

    private spanToMarkdown(element: HTMLElement, inner: string): string {
        for (const serializer of this.spanSerializers) {
            const out = serializer.serialize(element, inner);
            if (out !== null) return out;
        }
        if ('mention' in element.dataset) {
            return `@${element.dataset['mention']}`;
        }
        if ('tag' in element.dataset) {
            return `#${element.dataset['tag']}`;
        }
        // A styled span is emitted verbatim, like the VERBATIM_INLINE_TAGS:
        // markdown cannot express colour, highlight or font, and returning just
        // `inner` dropped it. The colour and highlight toolbar buttons produce
        // exactly this markup, the sanitizer preserves it, and mode defaults to
        // 'markdown' -- so a user coloured text and it went plain on the next
        // save, with no warning.
        //
        // Safe to round-trip: the sanitizer's own style allowlist decides what
        // survives. It keeps colour/background/font/text-decoration and strips
        // position, behavior and url(javascript:...), and it runs again on load,
        // so nothing is trusted here that would not be trusted from a paste.
        const style = element.getAttribute('style');
        return style ? `<span style="${this.escapeHtml(style)}">${inner}</span>` : inner;
    }

    private blockTagToMarkdown(tagName: string, inner: string, element: HTMLElement): string | null {
        switch (tagName) {
            case 'pre':
                return this.handlePreTag(element, heldByListItem(element));
            case 'ul':
                return this.handleUlTag(element);
            case 'ol':
                return this.handleOlTag(element);
            case 'li':
            case 'summary':
                return inner;
            case 'input':
                return '';
            case 'details':
                return this.detailsToMarkdown(element);
            case 'blockquote':
                return this.handleBlockquoteTag(inner);
            case 'p':
                return `\n${escapeLineStarts(inner)}\n`;
            case 'div':
                // Only a div of inline content is one paragraph; one holding blocks
                // carries their real markers.
                return Array.from(element.childNodes).every(isPhrasing)
                    ? `\n${escapeLineStarts(inner)}\n`
                    : `\n${inner}\n`;
            case 'br':
                return breakToMarkdown(element);
            case 'hr':
                return '\n---\n';
            case 'table':
                return '\n' + this.tableToMarkdown(element) + '\n';
            default:
                return null;
        }
    }

    /**
     * A fence inside a list item is re-emitted INDENTED. Without it toMarkdown
     * flattened the fence to column zero, so on the next toHtml the parked
     * token no longer looked indented and the fence escaped its item -- the
     * one-pass fix held, the round-trip did not.
     */
    /**
     * A fenced code block. The fence is three backticks, or longer when the
     * body contains a backtick run of three or more -- CommonMark requires the
     * fence to exceed any run inside it, which is how a code block containing a
     * fence is written. Emitting exactly three destroyed such a block: the
     * inner fence closed the outer one, and the remainder was re-parsed as
     * markdown, so the content changed on every save.
     */
    private handlePreTag(element: HTMLElement, inListItem = false): string {
        // A language the fence can carry: "c++" and "c#" read back; one with any
        // other character is dropped, keeping the code, since it stopped the fence
        // from opening and the code came back as paragraphs.
        const language = element.querySelector('code')?.dataset['language'] ?? '';
        const lang = /^[\w+#.-]+$/.test(language) ? language : '';
        // A fence is TEXT: it cannot carry an image, and a block written from
        // textContent alone deleted one outright on the first save. The tag form
        // can carry it and reads back verbatim, which is the answer inline code
        // already gives for the same content.
        if (element.querySelector('img')) return this.preTagForm(element, lang, inListItem);
        const codeContent = element.textContent ?? '';
        const indent = inListItem ? '  ' : '';
        const body = codeContent
            .split('\n')
            .map((line) => indent + line)
            .join('\n');
        const longestRun = Math.max(
            0,
            ...Array.from(codeContent.matchAll(/`+/g), (m) => m[0].length),
        );
        const fence = '`'.repeat(Math.max(3, longestRun + 1));
        return `\n${indent}${fence}${lang}\n${body}\n${indent}${fence}\n`;
    }

    /**
     * A code block as its tag pair, on one markdown line.
     *
     * One line, with every newline written as a character reference, because a
     * raw newline inside the pair would let the block passes split it: the
     * `<pre>` and `</pre>` are parked separately and the lines between them are
     * read as markdown. The reference decodes to the newline when the sanitizer
     * parses the restored tag, so the code keeps its own line breaks.
     */
    private preTagForm(element: HTMLElement, language: string, inListItem: boolean): string {
        const code = element.querySelector('code') ?? element;
        const lang = language ? ` data-language="${this.escapeHtml(language)}"` : '';
        const indent = inListItem ? '  ' : '';
        return `\n${indent}<pre><code${lang}>${this.codeTagContent(code)}</code></pre>\n`;
    }

    private handleUlTag(element: HTMLElement): string {
        const result: string[] = ['\n'];
        const isTask = 'taskList' in element.dataset;
        this.listToMarkdown(element, isTask ? 'task' : 'ul', '', result);
        return result.join('');
    }

    private handleOlTag(element: HTMLElement): string {
        const result: string[] = ['\n'];
        this.listToMarkdown(element, 'ol', '', result);
        return result.join('');
    }

    private handleBlockquoteTag(inner: string): string {
        // One blank quote line between blocks, and a break on a quote line ends
        // its paragraph (see quoteBodyLines and breakToMarkdown), so the reader
        // rebuilds the same paragraphs whether or not the quote also holds a
        // list, a table or a code block.
        const quoteLines = quoteBodyLines(inner);
        // "> " with a space, so a nested quote emits "> > x" rather than
        // ">> x". parseBlockquotes strips one "> " per level and reads both,
        // but only the spaced form survives its own round trip -- the tight
        // form left the inner marker as literal text on re-import.
        return '\n' + quoteLines.map((line) => (line === '' ? '>' : `> ${line}`)).join('\n') + '\n';
    }

    private detailsToMarkdown(element: HTMLElement): string {
        // Its own summary. An unscoped query found a nested details block's
        // summary first, took its title, and dropped this block's own.
        const summaryEl = element.querySelector(':scope > summary');
        // The summary's own markdown on one line: its text alone dropped every
        // image, link and emphasis in it on the first save.
        // A summary is one line, so a break in it is written as the tag. With no
        // summary the title stays empty: "Toggle" was written in its place, a
        // word the author never typed.
        const summaryText = summaryEl ? oneLine(breaksAsTags(this.nodeToMarkdown(summaryEl))) : '';
        const contentParts: string[] = [];
        for (const ch of Array.from(element.childNodes)) {
            if (summaryEl?.isSameNode(ch)) continue;
            // A node, not its children — the same trap the list serializer fell
            // into: nodeToMarkdown walks a node's OWN children, so a bare text
            // node between blocks yielded nothing and its text vanished.
            contentParts.push(
                ch.nodeType === Node.TEXT_NODE
                    ? textToMarkdown(ch)
                    : this.elementToMarkdown(ch as HTMLElement),
            );
        }
        // Blocks in the body are separated by a blank line, as they are at document
        // level. A single newline let two paragraphs, or a paragraph and the line
        // after a rule, read back as one paragraph on the next save.
        const opener = summaryText ? `:::details ${summaryText}` : ':::details';
        return `\n${opener}\n${contentParts.map(trimBlankLines).filter(Boolean).join('\n\n')}\n:::\n`;
    }

    /**
     * Convert table element to Markdown table syntax.
     */
    /** Pad `contents` out to `width`, inserting blanks after each spanning cell. */
    private padToWidth(contents: string[], cells: Element[], width: number, carried: Map<number, number>): string[] {
        const padded: string[] = [];
        // A column held by a rowspan above is occupied: emit a blank for it
        // before any of this row's own content.
        const takeCarried = (): void => {
            while (carried.has(padded.length)) {
                const left = carried.get(padded.length) ?? 0;
                if (left > 1) carried.set(padded.length, left - 1);
                else carried.delete(padded.length);
                padded.push('');
            }
        };
        takeCarried();
        // Bounded per ROW, not just per cell. Capping one cell at 1000 still let
        // 50 cells emit 50,000 columns: a 63 KB paste became 7.8 MB of markdown,
        // 124x amplification. The per-cell cap only covers the single-cell shape
        // the earlier test happened to use.
        const limit = Math.min(width, MAX_TABLE_COLUMNS);
        for (const [index, cell] of cells.entries()) {
            padded.push(contents[index]);
            takeCarried();
            const span = Number.parseInt(cell.getAttribute('colspan') ?? '1', 10);
            // Leave room for the cells still to come: a wide colspan used to
            // fill the row and every later cell was dropped, so padding blanks
            // were emitted in preference to the author's content.
            const room = limit - padded.length - (cells.length - index - 1);
            const extra = Math.max(0, Math.min(clampSpan(span) - 1, room));
            for (let i = 0; i < extra; i++) padded.push('');
        }
        // Padded UP only. A width derived from the widest row means nothing ever
        // needs cutting here, and cutting is what silently deleted a body row's
        // extra cells when the width came from row 0. The MAX_TABLE_COLUMNS
        // ceiling still applies through `limit`, which bounds pasted input.
        while (padded.length < limit) padded.push('');
        return padded;
    }

    /** A row's width in columns, counting each cell's colspan. */
    private columnSpan(row: HTMLElement): number {
        const total = Array.from(row.querySelectorAll(':scope > th, :scope > td')).reduce((sum, cell) => {
            const span = Number.parseInt(cell.getAttribute('colspan') ?? '1', 10);
            return sum + clampSpan(span);
        }, 0);
        // Same row bound as padToWidth, so the separator cannot be wider than
        // the rows it describes.
        return Math.min(total, MAX_TABLE_COLUMNS);
    }

    private tableToMarkdown(table: HTMLElement): string {
        // Scoped to THIS table. An unscoped descendant query pulled a nested
        // table's rows up as rows of the outer one, so they appeared both inside
        // their cell and again at the top level.
        // thead rows first, whatever their DOM order. A single query returns
        // them in document order, so a table written <tbody> before <thead>
        // -- valid HTML -- put a BODY row in the header position and the real
        // header underneath the separator, inverting the table.
        const pick = (sel: string): HTMLElement[] =>
            Array.from(table.querySelectorAll<HTMLElement>(sel));
        const rows = [
            ...pick(':scope > thead > tr'),
            ...pick(':scope > tr'),
            ...pick(':scope > tbody > tr'),
            ...pick(':scope > tfoot > tr'),
        ];
        if (rows.length === 0) return '';

        const lines: string[] = [];
        let headerProcessed = false;

        // The FIRST row decides the column count, each cell counting its own
        // colspan -- markdown's separator describes the header, so a wider body
        // row must not stretch it (a 3-dash separator under a 2-column header is
        // invalid GFM). The separator previously appeared only when a row held a
        // <th>, so a headerless or colspan table emitted none -- and parseTables,
        // which requires header + separator, refused to read it back, leaving a
        // paragraph of literal pipe characters where the table had been.
        // The WIDEST row decides the width, not row 0. Sizing from the first row
        // and truncating deleted every cell past it -- trading invalid GFM for
        // silent data loss -- and an empty first row made the width 0, so the
        // whole table serialized to nothing. Narrower rows are padded, which is
        // what markdown requires; none are cut.
        const columnCount = Math.min(
            rows.reduce((widest, row) => Math.max(widest, this.columnSpan(row)), 0),
            MAX_TABLE_COLUMNS,
        );

        const carried = new Map<number, number>();

        for (const row of rows) {
            const cells = Array.from(row.querySelectorAll(':scope > th, :scope > td'));
            // Newlines inside a cell would split the row -- a one-row table came
            // back as two on reload -- so a <br> becomes the GFM in-cell break.
            const cellContents = cells.map(cell =>
                this.nodeToMarkdown(this.withRulesAsBreaks(cell))
                    .trim()
                    .replaceAll('|', String.raw`\|`)
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .join('<br>'),
            );

            // A spanning cell contributes one label but several columns.
            // Markdown cannot express the span, so the row is padded to its
            // true width with empty cells: the header and separator then agree,
            // which keeps the output valid GFM and stable on re-import. Emitting
            // the label alone left a 1-cell header over a 2-dash separator, and
            // the next round-trip narrowed the separator to match, so the table
            // lost a column each cycle.
            // Columns still held by a rowspan from an earlier row are filled
            // before this row's own cells, so everything after one shifts right.
            // Without it a rowspan cell's neighbours moved a column LEFT: a
            // figure from one column was filed under another, and saving made
            // that permanent. Count-based tests all passed -- the cell count is
            // right, only the association is wrong.
            const paddedRow = this.padToWidth(cellContents, cells, columnCount, carried);
            trackRowspans(cells, carried);
            lines.push('| ' + paddedRow.join(' | ') + ' |');

            if (!headerProcessed) {
                const separator = new Array(Math.max(1, columnCount)).fill('---').join(' | ');
                lines.push('| ' + separator + ' |');
                headerProcessed = true;
            }
        }

        return lines.join('\n');
    }

    /**
     * A cell's content with each rule turned into a line break.
     *
     * A pipe-table cell is one line and GFM has no rule inside one: the rule was
     * written "---" and read back as those three characters of text. A break is
     * the nearest thing a cell can hold.
     */
    private withRulesAsBreaks(cell: Element): Element {
        if (!cell.querySelector('hr')) return cell;
        const copy = cell.cloneNode(true) as Element;
        for (const rule of Array.from(copy.querySelectorAll('hr'))) {
            rule.replaceWith(copy.ownerDocument.createElement('br'));
        }
        return copy;
    }

    private listToMarkdown(listEl: HTMLElement, type: ListType, indent: string, result: string[]): void {
        const items = Array.from(listEl.children);
        const first = type === 'ol' ? listStartOf(listEl) : 1;
        const marker = listMarkerFor(listEl, type);
        items.forEach((li, index) => {
            const [lead, ...rest] = itemRuns(li);
            const ordinal = first + index <= MAX_LIST_NUMBER ? first + index : first;
            result.push(this.formatListItem(type, li as HTMLElement, this.leadContent(li, lead, indent), indent, ordinal, marker));

            // Every sub-list, in order, with the content after each where it
            // falls. Only the last sub-list was kept, so an item holding two --
            // bullets under numbers, which indenting beside an existing sub-list of
            // the other kind produces -- lost every word of the first on save; and
            // all were written after the item's content, so a paragraph after one
            // came back before it.
            for (const run of rest) {
                if (Array.isArray(run)) result.push(this.contentAfterSubList(run, indent));
                else this.listToMarkdown(run, this.detectNestedListType(run), indent + '  ', result);
            }
        });
    }

    /** An item's content before its first sub-list: its marker line and the blocks under it. */
    private leadContent(li: Element, nodes: readonly ChildNode[], indent: string): string {
        const childParts: string[] = [];
        for (const ch of nodes) {
            const part = this.childToMarkdown(ch);
            // The marker line is one line, so a break in what is written on it is
            // written as the tag. As a hard break the next line read back as a
            // paragraph of the item: emphasis around the break split in two, the
            // space beside it was lost, and the item changed on every save.
            childParts.push(onMarkerLine(ch, childParts) ? breaksAsTags(part) : part);
        }
        const joined = childParts.join('');
        return opensWithBlock(li) ? leadingBlockContinuation(joined, indent) : indentContinuation(joined, indent);
    }

    /**
     * The content after a sub-list, as a block of the item: after a blank line and
     * indented to the item's content, no further. Without the blank, or indented
     * as deep as the sub-list's own items, as a code block is, it read back as the
     * sub-list's last item's.
     */
    private contentAfterSubList(nodes: readonly ChildNode[], indent: string): string {
        const body = trimBlankLines(nodes.map((node) => this.childToMarkdown(node)).join(''));
        return body.trim() === '' ? '' : leadingBlockContinuation(dedentLines(body), indent) + '\n';
    }

    private childToMarkdown(node: ChildNode): string {
        // A node, not its children: `nodeToMarkdown` walks a node's OWN
        // children, which is right for an element but yields nothing for the
        // bare text node a plain `<li>text</li>` holds — so every bullet's
        // text vanished from the saved markdown while the HTML looked fine.
        return node.nodeType === Node.TEXT_NODE ? textToMarkdown(node) : this.elementToMarkdown(node as HTMLElement);
    }

    private formatListItem(type: ListType, li: HTMLElement, content: string, indent: string, ordinal: number, marker: string): string {
        if (type === 'task') {
            const checked = li.dataset['checked'] === 'true';
            return `${indent}${marker} [${checked ? 'x' : ' '}] ${breaksAsTags(content)}\n`;
        }
        if (type === 'ol') {
            return `${indent}${ordinal}${marker} ${content}\n`;
        }
        return `${indent}${marker} ${content}\n`;
    }

    private detectNestedListType(nestedList: HTMLElement): ListType {
        if ('taskList' in nestedList.dataset) return 'task';
        if (nestedList.tagName.toLowerCase() === 'ol') return 'ol';
        return 'ul';
    }

    /**
     * Check if text contains Markdown syntax.
     */
    hasMarkdownSyntax(text: string): boolean {
        const patterns = [
            /^#{1,6}\s/m,           // Headings
            /\*\*[^*]+\*\*/,        // Bold
            /\*[^*]+\*/,            // Italic
            /~~[^~]+~~/,            // Strikethrough
            /\[[^\]]{1,4096}\]\([^)]{1,4096}\)/,  // Links
            /!\[.*\]\(.+\)/,        // Images
            /^[-*+]\s/m,            // Unordered list
            /^\d+\.\s/m,            // Ordered list
            /^>\s/m,                // Blockquote
            /```/,                  // Code fence
            /`[^`]+`/,              // Inline code
        ];

        return patterns.some(pattern => pattern.test(text));
    }

    /**
     * Apply a formatting command to a Markdown selection.
     * Returns the new text and cursor position.
     */
    applyFormat(
        text: string,
        selectionStart: number,
        selectionEnd: number,
        format: 'bold' | 'italic' | 'strikethrough' | 'code'
    ): { text: string; selectionStart: number; selectionEnd: number } {
        const before = text.substring(0, selectionStart);
        const selected = text.substring(selectionStart, selectionEnd);
        const after = text.substring(selectionEnd);

        const markers: Record<string, string> = {
            bold: '**',
            italic: '*',
            strikethrough: '~~',
            code: '`',
        };

        const marker = markers[format];

        if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
            /** Remove formatting */
            const unformatted = selected.slice(marker.length, -marker.length);
            return {
                text: before + unformatted + after,
                selectionStart,
                selectionEnd: selectionEnd - marker.length * 2,
            };
        }

        if (before.endsWith(marker) && after.startsWith(marker)) {
            /** Remove formatting */
            const newBefore = before.slice(0, -marker.length);
            const newAfter = after.slice(marker.length);
            return {
                text: newBefore + selected + newAfter,
                selectionStart: selectionStart - marker.length,
                selectionEnd: selectionEnd - marker.length,
            };
        }

        /** Add formatting */
        const formatted = marker + selected + marker;
        return {
            text: before + formatted + after,
            selectionStart: selectionStart + marker.length,
            selectionEnd: selectionEnd + marker.length,
        };
    }

    /**
     * Insert a link at the current position.
     */
    insertLink(
        text: string,
        position: number,
        linkText: string,
        url: string
    ): { text: string; position: number } {
        const safeUrl = this.sanitizer.sanitizeUrl(url);
        if (!safeUrl) {
            return { text, position };
        }

        const before = text.substring(0, position);
        const after = text.substring(position);
        const link = `[${linkText}](${safeUrl})`;

        return {
            text: before + link + after,
            position: position + link.length,
        };
    }

    /**
     * Insert an image at the current position.
     */
    insertImage(
        text: string,
        position: number,
        alt: string,
        src: string
    ): { text: string; position: number } {
        const safeSrc = this.sanitizer.sanitizeImageSrc(src);
        if (!safeSrc) {
            return { text, position };
        }

        const before = text.substring(0, position);
        const after = text.substring(position);
        const image = `![${alt}](${safeSrc})`;

        return {
            text: before + image + after,
            position: position + image.length,
        };
    }

    /**
     * Insert a heading at the line.
     */
    insertHeading(
        text: string,
        lineStart: number,
        level: 1 | 2 | 3 | 4 | 5 | 6
    ): string {
        const before = text.substring(0, lineStart);
        const afterStart = text.substring(lineStart);

        /** Remove existing heading markers if present */
        const withoutHeading = afterStart.replace(/^#{1,6}\s*/, '');

        /** Add new heading */
        const hashes = '#'.repeat(level);
        return before + hashes + ' ' + withoutHeading;
    }

    /**
     * Insert a code block.
     */
    insertCodeBlock(
        text: string,
        position: number,
        language?: string
    ): { text: string; position: number } {
        const before = text.substring(0, position);
        const after = text.substring(position);
        const lang = language ?? '';
        const block = `\n\`\`\`${lang}\n\n\`\`\`\n`;
        const cursorPosition = position + 4 + lang.length + 1; // After opening fence + newline

        return {
            text: before + block + after,
            position: cursorPosition,
        };
    }
}

/** Tags that legitimately stand alone, so they need no closing partner. */
/**
 * A cell's column span, bounded.
 *
 * The value was range-checked but never capped, and it arrives from paste --
 * the sanitizer keeps the attribute verbatim. A single colspan="99999" cell
 * expanded to roughly 900 KB of markdown, measured at 887x amplification, which
 * is a denial-of-service through ordinary clipboard content. HTML's own table
 * algorithm caps at 1000; no real document needs more.
 */
function clampSpan(span: number): number {
    if (!Number.isFinite(span) || span < 1) return 1;
    return Math.min(span, MAX_COLSPAN);
}


/** How many rows a single cell may span, bounding pasted input. */
/**
 * Tags whose markdown does not depend on their descendants' markdown:
 * `table` re-walks its own cells, `img` and `input` render from attributes.
 * Converting their subtree before the switch was pure waste, and quadratic
 * for nested tables.
 */
const SUBTREE_INDEPENDENT_TAGS = new Set(['table', 'img', 'input', 'pre', 'ul', 'ol', 'details']);

const MAX_TABLE_ROWSPAN = 1000;

/** Widest row a table may emit, bounding paste amplification. */
const MAX_TABLE_COLUMNS = 1000;

/**
 * How deep blocks nest before the reader leaves the rest as text; see
 * parseToggleBlocks and buildBlockquote. The reader counts a level for every
 * details body, quote holding a nested quote and list item's block, so a details
 * block nested through a list or a quote meets the same cap; a sub-list, read in
 * its parent's pass, adds none. The writer counts the same list items and every
 * quote (see nestingDepthOf), which is never less.
 */
const MAX_NESTING_DEPTH = 32;

/** HTML's own limit for a column span. */
const MAX_COLSPAN = 1000;

/** Blank-line boundary between blocks, captured so joining restores the text. */
const BLOCK_SEPARATOR = /(\n\s*\n)/;

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'col']);

/**
 * Tag names that appear as a matched open/close pair in `text`.
 *
 * Used to tell markup from prose about markup: "<b>x</b>" is markup, while
 * "the <table> element" is a sentence. Counting rather than matching positions
 * is deliberate -- it is cheap, and a document with mismatched nesting is not
 * something this pass should try to repair.
 */
/**
 * Run `transform` over each block with only THAT block's paired tag names.
 *
 * An earlier version computed the sets per block and then unioned them into
 * one document-wide set, which threw the locality away again: a genuine
 * `<b>bold</b>` anywhere re-promoted every prose mention of `<b>` to markup and
 * the words were silently deleted. The set has to stay with its block all the
 * way to the point of use.
 */
function perBlock(
    text: string,
    transform: (block: string, paired: ReadonlySet<number>) => string,
): string {
    return text
        .split(BLOCK_SEPARATOR)
        .map((part, index) => (index % 2 === 1 ? part : transform(part, pairedTagOffsets(part))))
        .join('');
}

/**
 * Byte offsets of the tags in `block` that form a matched open/close pair.
 *
 * Pairing is resolved by POSITION, with a stack, not by counting names. Name
 * counting could not tell the first `<b>` in "Use <b> to bold. Like <b>x</b>"
 * from the second: it saw one open and one close, called the name paired, and
 * promoted BOTH -- deleting the prose mention and fabricating a stray closing
 * tag. Only the opener a closer actually matches is markup.
 */
/**
 * Pop back to the nearest unclosed opener of `name` and return its offset, or
 * null when nothing matches. Unwinding discards openers left dangling inside
 * it, which is what a browser's own parser does.
 */
function takeMatchingOpener(stack: { name: string; index: number }[], name: string): number | null {
    for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].name !== name) continue;
        const index = stack[k].index;
        stack.length = k;
        return index;
    }
    return null;
}

function pairedTagOffsets(block: string): ReadonlySet<number> {
    const paired = new Set<number>();
    const openStack: { name: string; index: number }[] = [];
    const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]{0,4096}>/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(block)) !== null) {
        const name = match[2].toLowerCase();
        if (!match[1]) {
            openStack.push({ name, index: match.index });
            continue;
        }
        const opener = takeMatchingOpener(openStack, name);
        if (opener !== null) {
            paired.add(opener);
            paired.add(match.index);
        }
    }
    return paired;
}

/**
 * A fenced block, with whatever prefix opens its line. The prefix is the quote
 * markers and indentation that put the fence inside another block; body lines
 * repeat it and must have it removed before the code is read.
 *
 * The marker group is `(?:>[ 	]?)*`, NOT `(?:[ 	]*> ?)*`. The latter let the
 * inner and trailing whitespace runs match the same spaces, which backtracks
 * catastrophically on a run of quote markers: measured 59ms at depth 20, 385ms
 * at 26, doubling per level, so a 120-byte document froze the tab. Indentation
 * belongs to exactly one place -- after the markers -- so the two runs cannot
 * compete.
 */
/**
 * A fenced code block, optionally quoted or indented.
 *
 * CommonMark allows THREE OR MORE fence characters, and a longer fence is how
 * a code block that itself contains a fence is written. Matching exactly three
 * meant a 4-backtick fence was not a fence at all: its lines were parsed as
 * ordinary markdown, so the round trip never reached a fixed point -- the
 * document gained newlines over the first few saves before settling.
 */
// The prefix is an indent, then quote markers each with their own spacing.
// Quote markers had to come first, so a quote inside a list item -- indent
// before the marker -- was never taken as a fence and its code came back as
// text. Each marker owns the spaces after it, so the prefix cannot be split two
// ways and the pattern stays linear.
const FENCE_PATTERN = /^([ \t]*(?:>[ \t]*)*)(`{3,}|~{3,})([\w+#.-]*)\n([\s\S]*?)^\1?\2/gm;

/** Remove `prefix` (and any looser quote/indent form of it) from each line. */
function stripBlockPrefix(code: string, prefix: string): string {
    if (!prefix) return code;
    const quoteDepth = (prefix.match(/>/g) ?? []).length;
    const indent = /^[ \t]*/.exec(prefix)?.[0] ?? '';
    return code
        .split('\n')
        .map((line) => {
            let rest = line;
            for (let i = 0; i < quoteDepth; i++) {
                rest = rest.replace(/^[ \t]*> ?/, '');
            }
            // Indent is stripped whether or not quote markers preceded it: a
            // fence inside a list inside a quote carries both, and handling only
            // one left the list indentation baked into the code.
            const trailingIndent = prefix.length - prefix.trimEnd().length;
            // After a quote marker, the prefix's first space went with the marker
            // above, so only the indent beyond it is stripped: counting it again
            // took a space of the code's own indentation on every save.
            const width = quoteDepth === 0 ? indent.length : Math.max(0, trailingIndent - 1);
            // Up to `width` leading spaces, not exactly that many: the quote
            // strip above already consumed the single space after each ">", so
            // an exact match never fired and the list indentation stayed baked
            // into the code.
            const leading = /^[ \t]*/.exec(rest)?.[0].length ?? 0;
            rest = rest.slice(Math.min(width, leading));
            return rest;
        })
        .join('\n');
}

/**
 * Record which columns each rowspan cell will still occupy in later rows.
 *
 * A rowspan cell holds its column for `rowspan - 1` further rows, so every cell
 * after it in those rows sits one column further right. Without this the
 * neighbours shifted left and data was filed under the wrong heading.
 */
function trackRowspans(cells: readonly Element[], carried: Map<number, number>): void {
    let column = 0;
    for (const cell of cells) {
        while (carried.has(column)) column++;
        const span = Number.parseInt(cell.getAttribute('rowspan') ?? '1', 10);
        const rows = Number.isFinite(span) && span > 1 ? Math.min(span, MAX_TABLE_ROWSPAN) : 1;
        if (rows > 1) carried.set(column, rows - 1);
        const cols = clampSpan(Number.parseInt(cell.getAttribute('colspan') ?? '1', 10));
        column += cols;
    }
}

/**
 * Replace parked inline-code tokens with the text they hold.
 *
 * Used where markup cannot go -- an `alt` attribute -- so a code span written in
 * alt text reads as its own characters rather than a literal
 * "&lt;code&gt;x&lt;/code&gt;".
 */
function resolveInlineCodeText(value: string, store: readonly string[]): string {
    return value.replaceAll(/(\d{1,9})/g, (_match, index: string) => {
        const parked = store[Number(index)] ?? '';
        return parked.replace(/^<code>/, '').replace(/<\/code>$/, '');
    });
}

/**
 * Expand every parked token of one delimiter pair back into the text it holds,
 * through `map` (identity by default). The five restore passes used to carry
 * five copies of this loop, differing only in the delimiters, so a change to
 * the token shape or the out-of-range fallback had to be made five times.
 */
function restoreParked(
    html: string,
    open: string,
    close: string,
    store: readonly string[],
    map: (s: string) => string = (s) => s,
): string {
    if (store.length === 0) return html;
    const pattern = new RegExp(String.raw`${open}(\d{1,9})${close}`, 'g');
    return html.replaceAll(pattern, (_match, index: string) => map(store[Number(index)] ?? ''));
}
