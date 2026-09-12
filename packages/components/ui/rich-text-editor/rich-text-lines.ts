/**
 * The rich text editor's line model.
 *
 * Every editing rule in the editor has to answer the same four questions: which
 * line is the caret in, where does that line's text live, which line is above
 * it, and which is below. Before this module each handler answered them itself.
 * A caret inside an `<li>` resolved to the item, to the enclosing list, or to
 * the list's parent depending on which private walker was asked, and four
 * different predicates disagreed about whether a line was empty. Eleven defects
 * came out of that, three of them from the fixes for the others.
 *
 * So the questions live here, once, as total functions over a DOM subtree — no
 * signals, no component, nothing to mock — and the handlers read from them. The
 * same reasoning gave the editor `rich-text-find.utils.ts`.
 *
 * The rules, in the order they matter:
 *
 * 1. A line is a POSITION, not a kind. The line below is the next line in
 *    document order and the line above is the previous one, so the two are
 *    exact inverses. A list nested inside an item renders between that item and
 *    its next sibling, so its items are the lines that follow it.
 * 2. A line is the innermost element holding one visual line of text. An `<li>`
 *    wrapping a `<p>` is a container, not a line; the `<p>` is the line.
 * 3. Only an `<li>` can be a line of a list. A stray child of a list is not a
 *    line and is never a join target.
 * 4. A nested list is never part of a line's text.
 * 5. A task row's own checkbox is structural BY IDENTITY. Any other `<input>`
 *    is content the author put there.
 * 6. One emptiness rule per question: {@link lineIsEmpty} for a line,
 *    {@link holdsNothing} for a container about to be removed.
 *
 * A `<pre>` is ONE line here, however many rows of code it shows. Splitting it
 * would need a second notion of position (a row inside an element) that no
 * caller has asked for: Enter inside a code block inserts a newline under the
 * block's own rule, and a caret arriving from outside only ever needs the block
 * as a whole. Bare text directly under the root is not a line at all — the
 * editor wraps it in a `<p>` before any rule runs — so {@link lineOf} answers
 * null there and the caller wraps first.
 */

/** What kind of line this is. Callers branch on it; the walk never does. */
export type LineKind = 'block' | 'item' | 'cell' | 'summary' | 'quote' | 'code';

/** One visual line of text, and the elements that own and hold it. */
export interface Line {
    readonly kind: LineKind;
    /** The element that gives the line its identity: the `p`, `li`, `td`, `summary` or `pre`. */
    readonly owner: HTMLElement;
    /** Where this line's inline content lives: a task row's span, else the owner. */
    readonly holder: HTMLElement;
}

/** A caret, as a line and a character offset into that line's own text. */
export interface LinePosition {
    readonly line: Line;
    readonly offset: number;
}

/** Every line of a subtree, in document order. */
export interface LineIndex {
    readonly root: HTMLElement;
    readonly lines: readonly Line[];
}

/** Elements that always hold exactly one line of text. */
const ALWAYS_LINE = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'PRE']);

/** Elements that hold a line only when no block-level child took the job. */
const LINE_OR_CONTAINER = new Set(['LI', 'TD', 'TH', 'SUMMARY', 'BLOCKQUOTE', 'FIGCAPTION', 'DD', 'DT']);

/** Elements that are never a line: they contain lines. */
const CONTAINER_ONLY = new Set(['UL', 'OL', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'DETAILS', 'FIGURE', 'DL']);

/** Content the author sees even though it carries no text. */
const REPLACED_TAGS = new Set(['IMG', 'HR', 'TABLE', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'CANVAS']);

/** The characters a blank line is padded with so it can hold a caret. */
const PLACEHOLDERS = /[\u00A0\u200B]/g;

/** Which kind an element owns, once it is known to hold a line. */
const KIND_BY_TAG: Readonly<Record<string, LineKind>> = {
    LI: 'item', TD: 'cell', TH: 'cell', SUMMARY: 'summary', BLOCKQUOTE: 'quote', PRE: 'code',
};

/** A list nested in a list item: it renders below that item's own text. */
export function isNestedList(node: Node): boolean {
    return node.nodeName === 'UL' || node.nodeName === 'OL';
}

/** A task row, which keeps its text in a span after its checkbox. */
export function isTaskRow(el: Element): boolean {
    return el.nodeName === 'LI' && (el as HTMLElement).dataset['task'] !== undefined;
}

/**
 * The checkbox that belongs to a task row's structure, never one the author
 * typed into the line: only a direct child of a task row counts.
 */
export function taskCheckboxOf(el: Element): HTMLInputElement | null {
    if (!isTaskRow(el)) return null;
    return el.querySelector<HTMLInputElement>(':scope > input[type="checkbox"]');
}

/** Whether an element is block-level, so it would own a line of its own. */
function isBlockLevel(el: Element): boolean {
    return ALWAYS_LINE.has(el.nodeName) || LINE_OR_CONTAINER.has(el.nodeName) || CONTAINER_ONLY.has(el.nodeName);
}

/**
 * Whether `el` holds a line of its own.
 *
 * The "only when no block child" clause is rule 2: an `<li>` wrapping a `<p>`,
 * a `<td>` holding two paragraphs, a quote holding lines are containers, and
 * their children are the lines. Without it the same text belonged to two lines
 * at once, which is how one toggle came to flatten a whole list into one block
 * while another saw only the item.
 *
 * A list nested in an `<li>` is the one block child that does NOT make its item
 * a container: the item still shows its own line of text above that sub-list
 * (rule 4). The exception is the item's alone — a quote or a cell wrapping a
 * list is a container, and the list's items are the lines.
 */
export function isLineOwner(el: Element, root: HTMLElement): boolean {
    if (el === root || !root.contains(el)) return false;
    if (ALWAYS_LINE.has(el.nodeName)) return true;
    if (!LINE_OR_CONTAINER.has(el.nodeName)) return false;
    const ownsSublists = el.nodeName === 'LI';
    return !Array.from(el.children)
        .some((child) => isBlockLevel(child) && !(ownsSublists && isNestedList(child)));
}

/** The line an owner element holds. */
function lineFor(owner: HTMLElement): Line {
    const span = isTaskRow(owner) ? owner.querySelector<HTMLElement>(':scope > span') : null;
    return { kind: KIND_BY_TAG[owner.nodeName] ?? 'block', owner, holder: span ?? owner };
}

/**
 * The line a node sits in, or null when it sits in none — bare text under the
 * root, or a node outside it.
 *
 * An ancestor walk, because that is the only way to resolve a caret, and the
 * innermost owner wins by rule 2.
 */
export function lineOf(node: Node, root: HTMLElement): Line | null {
    if (node !== root && !root.contains(node)) return null;
    let current: Node | null = node;
    while (current && current !== root) {
        if (current.nodeType === Node.ELEMENT_NODE && isLineOwner(current as Element, root)) {
            return lineFor(current as HTMLElement);
        }
        current = current.parentNode;
    }
    return null;
}

/**
 * Every line of `root`, in document order, descending into lists, tables and
 * details.
 *
 * Built by collection rather than by sibling arithmetic, so "the line above" is
 * the previous entry: correct across nesting by construction, and up and down
 * are inverses for free. Three defects came from sibling rules that each missed
 * a different nesting case.
 */
export function buildLineIndex(root: HTMLElement): LineIndex {
    const lines: Line[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (isLineOwner(el, root)) lines.push(lineFor(el));
    }
    return { root, lines };
}

/** Where a line sits in an index, or -1 once it has been removed. */
export function indexOfLine(index: LineIndex, line: Line): number {
    return index.lines.findIndex((candidate) => candidate.owner === line.owner);
}

/** The line before `line` in document order, whatever its kind or depth. */
export function lineAbove(index: LineIndex, line: Line): Line | null {
    const at = indexOfLine(index, line);
    return at > 0 ? index.lines[at - 1] : null;
}

/** The line after `line` in document order, whatever its kind or depth. */
export function lineBelow(index: LineIndex, line: Line): Line | null {
    const at = indexOfLine(index, line);
    return at >= 0 && at + 1 < index.lines.length ? index.lines[at + 1] : null;
}

/** Every line a range touches, from the line it starts in to the line it ends in. */
export function linesInRange(index: LineIndex, range: Range): readonly Line[] {
    const first = lineOf(range.startContainer, index.root);
    const last = lineOf(range.endContainer, index.root);
    if (!first || !last) return [];
    const from = indexOfLine(index, first);
    const to = indexOfLine(index, last);
    if (from < 0 || to < 0) return [];
    return index.lines.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/** The nodes making up a line's own text, structure excluded (rules 4 and 5). */
export function lineOwnNodes(line: Line): readonly ChildNode[] {
    const checkbox: ChildNode | null = taskCheckboxOf(line.owner);
    return Array.from(line.holder.childNodes)
        .filter((node) => node !== checkbox && !isNestedList(node));
}

/** A line's text as the author sees it, placeholders included. */
export function lineText(line: Line): string {
    return lineOwnNodes(line).map((node) => node.textContent ?? '').join('');
}

/**
 * Whether a line shows the author nothing.
 *
 * A `<br>` and an empty `<span>` are nothing; an image is something. This is
 * the single answer that replaced four disagreeing ones, the worst of which
 * tested text alone and so deleted a task row holding only an image.
 */
export function lineIsEmpty(line: Line): boolean {
    const nodes = lineOwnNodes(line);
    if (nodes.some((node) => holdsReplacedContent(node))) return false;
    return nodes.map((node) => node.textContent ?? '').join('').replaceAll(PLACEHOLDERS, '').trim() === '';
}

/**
 * Whether an element that is NOT a line shows the author nothing — a quote or a
 * list about to be removed once its last line has gone.
 *
 * Unlike {@link lineIsEmpty} this asks about the element itself too, because the
 * element in hand may BE the content: a `<table>` is not its own descendant, and
 * missing that deleted an author's empty table.
 */
export function holdsNothing(el: Element): boolean {
    if (holdsReplacedContent(el)) return false;
    return (el.textContent ?? '').replaceAll(PLACEHOLDERS, '').trim() === '';
}

/**
 * Whether a range covers nothing the author would see.
 *
 * Deliberately stricter than {@link lineIsEmpty} about `<br>`. A blank line
 * often IS a lone `<br>`, so a line holding one shows nothing; but a `<br>`
 * BEFORE the caret is a break the author put there, and Backspace's job is to
 * delete it. Answering both questions with one predicate made Backspace at the
 * start of a wrapped row join two rows instead of removing the break.
 */
export function rangeShowsNothing(range: Range): boolean {
    const holder = range.commonAncestorContainer.ownerDocument?.createElement('div');
    if (!holder) return true;
    holder.appendChild(range.cloneContents());
    if (holder.querySelector('br') !== null) return false;
    return holdsNothing(holder);
}

/** Whether a node is, or contains, something the author sees without text. */
function holdsReplacedContent(node: Node): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as Element;
    if (REPLACED_TAGS.has(el.nodeName) || isAuthorInput(el)) return true;
    return Array.from(el.querySelectorAll('*'))
        .some((inner) => REPLACED_TAGS.has(inner.nodeName) || isAuthorInput(inner));
}

/** An `<input>` that is content, not a task row's own checkbox (rule 5). */
function isAuthorInput(el: Element): boolean {
    if (el.nodeName !== 'INPUT') return false;
    const parent = el.parentElement;
    return !parent || taskCheckboxOf(parent) !== (el as HTMLInputElement);
}

/** The caret as a line plus a character offset across that line's own text. */
export function caretPosition(index: LineIndex, range: Range): LinePosition | null {
    const line = lineOf(range.startContainer, index.root);
    if (!line) return null;
    let offset = 0;
    for (const node of lineOwnNodes(line)) {
        if (node === range.startContainer) return { line, offset: offset + range.startOffset };
        if (node.contains(range.startContainer)) {
            return { line, offset: offset + textOffsetWithin(node, range.startContainer, range.startOffset) };
        }
        offset += (node.textContent ?? '').length;
    }
    return { line, offset };
}

/** A collapsed range at a character offset into a line's own text. */
export function placeCaretIn(line: Line, offset: number): Range {
    const range = line.holder.ownerDocument.createRange();
    let remaining = offset;
    for (const node of lineOwnNodes(line)) {
        const length = (node.textContent ?? '').length;
        if (remaining <= length) {
            const target = firstTextNode(node);
            if (target) {
                range.setStart(target, Math.min(remaining, target.data.length));
                range.collapse(true);
                return range;
            }
        }
        remaining -= length;
    }
    range.selectNodeContents(line.holder);
    range.collapse(false);
    return range;
}

/** How far into `container` the boundary `(node, offset)` is, in characters. */
function textOffsetWithin(container: Node, node: Node, offset: number): number {
    const doc = container.ownerDocument;
    if (!doc) return offset;
    const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let seen = 0;
    let text = walker.nextNode() as Text | null;
    while (text) {
        if (text === node) return seen + offset;
        seen += text.data.length;
        text = walker.nextNode() as Text | null;
    }
    return seen;
}

/** The first text node of a subtree, or the node itself when it is one. */
function firstTextNode(node: Node): Text | null {
    if (node.nodeType === Node.TEXT_NODE) return node as Text;
    const doc = node.ownerDocument;
    if (!doc) return null;
    return doc.createTreeWalker(node, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
}
