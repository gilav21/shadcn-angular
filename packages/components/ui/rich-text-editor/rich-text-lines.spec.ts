import { describe, expect, it } from 'vitest';
import {
    buildLineIndex,
    caretPosition,
    holdsNothing,
    isLineOwner,
    LINE_SHAPE_FIXTURES,
    lineAbove,
    lineBelow,
    lineIsEmpty,
    lineOf,
    lineOwnNodes,
    lineText,
    rangeShowsNothing,
    linesInRange,
    placeCaretIn,
    taskCheckboxOf,
} from './index';

/**
 * The lines one shape must produce: each line's owning tag, the text it holds,
 * and whether it shows the author nothing.
 *
 * Written out per shape rather than derived, so a rule change has to be
 * acknowledged here instead of silently agreeing with itself.
 */
type ExpectedLine = readonly [tag: string, text: string, empty: boolean];

const EXPECTED: Readonly<Record<string, readonly ExpectedLine[]>> = {
    'a paragraph': [['P', 'one', false], ['P', 'two', false]],
    'headings and a div': [['H1', 'title', false], ['DIV', 'body', false]],
    'plain list items': [['LI', 'one', false], ['LI', 'two', false]],
    'task rows': [['LI', 'first', false], ['LI', 'second', false]],
    'a task row nested under a task row': [['LI', 'parent', false], ['LI', 'child', false]],
    'a plain list nested under a task row': [['LI', 'parent', false], ['LI', 'plain', false]],
    'a task row nested under a plain item': [['LI', 'plain', false], ['LI', 'task', false]],
    'an item wrapping a paragraph': [['P', 'wrapped', false]],
    'a stray non-item child of a list': [['LI', 'one', false], ['LI', 'two', false]],
    'an empty task row': [['LI', ' ', true]],
    'a task row holding only an image': [['LI', '', false]],
    'a task row starting with an image': [['LI', 'text', false]],
    'a task row with inline formatting': [['LI', 'read the docs', false]],
    'a task row with a checkbox in its text': [['LI', 'midend', false]],
    'a line holding only a break': [['P', '', true]],
    'a line holding only an empty span': [['P', '', true]],
    'table cells': [['TD', 'a', false], ['TD', 'b', false]],
    'a cell holding two paragraphs': [['P', 'a', false], ['P', 'b', false]],
    'an empty table': [['TD', '', true]],
    'quote lines': [['P', 'quoted', false], ['P', 'lines', false]],
    'a quote holding a list': [['LI', 'quoted item', false]],
    'a code block': [['PRE', 'one\ntwo', false]],
    'a details block': [['SUMMARY', 'head', false], ['P', 'body', false]],
    'a horizontal rule between lines': [['P', 'before', false], ['P', 'after', false]],
};

/** A detached root holding one shape, which is all these functions need. */
function rootOf(html: string): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
}

/** Every line of a shape as the table writes it. */
function actualLines(html: string): ExpectedLine[] {
    const root = rootOf(html);
    return buildLineIndex(root).lines.map((line) => [line.owner.tagName, lineText(line), lineIsEmpty(line)]);
}

describe('rich text line model — the shape table', () => {
    it('has an expectation for every shape, so a new shape cannot slip through untested', () => {
        const named = LINE_SHAPE_FIXTURES.map(([name]) => name);
        expect(named.filter((name) => EXPECTED[name] === undefined)).toEqual([]);
        expect(Object.keys(EXPECTED).filter((name) => !named.includes(name))).toEqual([]);
    });

    it.each(LINE_SHAPE_FIXTURES)('%s yields the lines the table says', (name, html) => {
        expect(actualLines(html)).toEqual(EXPECTED[name].map((row) => [...row]));
    });

    it.each(LINE_SHAPE_FIXTURES)('%s — above and below are exact inverses', (_name, html) => {
        const root = rootOf(html);
        const index = buildLineIndex(root);
        for (const line of index.lines) {
            const below = lineBelow(index, line);
            if (below) expect(lineAbove(index, below)?.owner).toBe(line.owner);
            const above = lineAbove(index, line);
            if (above) expect(lineBelow(index, above)?.owner).toBe(line.owner);
        }
    });

    it.each(LINE_SHAPE_FIXTURES)('%s — the first line has nothing above and the last nothing below', (_name, html) => {
        const root = rootOf(html);
        const index = buildLineIndex(root);
        expect(index.lines.length).toBeGreaterThan(0);
        expect(lineAbove(index, index.lines[0])).toBeNull();
        expect(lineBelow(index, index.lines[index.lines.length - 1])).toBeNull();
    });

    it.each(LINE_SHAPE_FIXTURES)('%s — every line resolves to itself from its own text', (_name, html) => {
        const root = rootOf(html);
        for (const line of buildLineIndex(root).lines) {
            const from = lineOwnNodes(line)[0] ?? line.holder;
            expect(lineOf(from, root)?.owner).toBe(line.owner);
        }
    });
});

describe('rich text line model — the rules', () => {
    it('a list item keeps its own line above a sub-list, but not when a block holds its text', () => {
        const withSublist = rootOf('<ul><li>own text<ul><li>sub</li></ul></li></ul>');
        expect(isLineOwner(withSublist.querySelector('li')!, withSublist)).toBe(true);

        const wrapped = rootOf('<ul><li><p>wrapped</p></li></ul>');
        expect(isLineOwner(wrapped.querySelector('li')!, wrapped)).toBe(false);
    });

    it('a quote or a cell wrapping a list is a container, so the items are the lines', () => {
        const quote = rootOf('<blockquote><ul><li>item</li></ul></blockquote>');
        expect(isLineOwner(quote.querySelector('blockquote')!, quote)).toBe(false);
        expect(buildLineIndex(quote).lines.map((l) => l.owner.tagName)).toEqual(['LI']);
    });

    it('a stray child of a list is never a line', () => {
        const root = rootOf('<ul><li>one</li><span>stray</span></ul>');
        expect(isLineOwner(root.querySelector('span')!, root)).toBe(false);
        expect(lineOf(root.querySelector('span')!.firstChild!, root)).toBeNull();
    });

    it('bare text under the root belongs to no line, so a caller wraps it first', () => {
        const root = rootOf('loose text');
        expect(lineOf(root.firstChild!, root)).toBeNull();
        expect(buildLineIndex(root).lines).toEqual([]);
    });

    it('a task row holds its text in its span, and its own checkbox is not part of it', () => {
        const root = rootOf(
            '<ul data-task-list><li data-task><input type="checkbox"><span>text</span></li></ul>',
        );
        const line = lineOf(root.querySelector('span')!.firstChild!, root)!;

        expect(line.owner.tagName).toBe('LI');
        expect(line.holder.tagName).toBe('SPAN');
        expect(lineOwnNodes(line).some((node) => node.nodeName === 'INPUT')).toBe(false);
        expect(taskCheckboxOf(line.owner)).toBe(root.querySelector('input'));
    });

    it('a checkbox the author put in the text is content, not structure', () => {
        const root = rootOf(
            '<ul data-task-list><li data-task><input type="checkbox"><span><input type="checkbox"></span></li></ul>',
        );
        const line = lineOf(root.querySelector('span')!, root)!;

        expect(lineOwnNodes(line)).toHaveLength(1);
        expect(lineIsEmpty(line)).toBe(false);
    });

    it('a nested list is not part of its item line, in text or in nodes', () => {
        const root = rootOf('<ul><li>own<ul><li>sub</li></ul></li></ul>');
        const line = lineOf(root.querySelector('li')!.firstChild!, root)!;

        expect(lineText(line)).toBe('own');
        expect(lineOwnNodes(line).some((node) => node.nodeName === 'UL')).toBe(false);
    });

    it('an image makes a line non-empty; a break and an empty span do not', () => {
        const withImage = rootOf('<p><img src="x.png"></p>');
        expect(lineIsEmpty(lineOf(withImage.querySelector('img')!, withImage)!)).toBe(false);

        const withBreak = rootOf('<p><br></p>');
        expect(lineIsEmpty(lineOf(withBreak.querySelector('p')!, withBreak)!)).toBe(true);

        const withSpan = rootOf('<p><span></span></p>');
        expect(lineIsEmpty(lineOf(withSpan.querySelector('p')!, withSpan)!)).toBe(true);
    });

    it('a break is nothing to a line and something to a range, which are two questions', () => {
        // A blank line often IS a lone <br>, so the line shows nothing. A <br>
        // before the caret is a break the author put there, and Backspace's job
        // is to delete it rather than to join two lines.
        const root = rootOf('<p><br>text</p>');
        const line = lineOf(root.querySelector('p')!, root)!;
        expect(lineIsEmpty(line)).toBe(false);

        const blank = rootOf('<p><br></p>');
        expect(lineIsEmpty(lineOf(blank.querySelector('p')!, blank)!)).toBe(true);

        const beforeCaret = document.createRange();
        beforeCaret.setStart(root.querySelector('p')!, 0);
        beforeCaret.setEnd(root.querySelector('p')!.lastChild!, 0);
        expect(rangeShowsNothing(beforeCaret)).toBe(false);

        const empty = document.createRange();
        empty.setStart(root.querySelector('p')!.lastChild!, 0);
        empty.collapse(true);
        expect(rangeShowsNothing(empty)).toBe(true);
    });

    it('a container that IS content holds something, even when it has no text', () => {
        const root = rootOf('<table><tbody><tr><td><br></td></tr></tbody></table>');
        expect(holdsNothing(root.querySelector('table')!)).toBe(false);
        expect(holdsNothing(root.querySelector('td')!)).toBe(true);
    });

    it('a range spanning into a nested list includes the items it reaches', () => {
        const root = rootOf('<ul><li>one<ul><li>sub</li></ul></li><li>two</li></ul>');
        const index = buildLineIndex(root);
        const range = document.createRange();
        range.setStart(root.querySelector('li')!.firstChild!, 0);
        range.setEnd(root.querySelectorAll('li')[2].firstChild!, 1);

        expect(linesInRange(index, range).map((line) => lineText(line))).toEqual(['one', 'sub', 'two']);
    });

    it('a caret round-trips through a character offset across inline markup', () => {
        const root = rootOf('<p>read <b>the</b> docs</p>');
        const index = buildLineIndex(root);
        const bold = root.querySelector('b')!.firstChild!;
        const range = document.createRange();
        range.setStart(bold, 2);
        range.collapse(true);

        const position = caretPosition(index, range)!;
        expect(position.offset).toBe('read th'.length);

        const back = placeCaretIn(position.line, position.offset);
        expect(back.startContainer).toBe(bold);
        expect(back.startOffset).toBe(2);
    });

    it('a line removed from the document is no longer in an index built before it went', () => {
        const root = rootOf('<p>one</p><p>two</p>');
        const index = buildLineIndex(root);
        const second = index.lines[1];
        second.owner.remove();

        expect(lineBelow(buildLineIndex(root), buildLineIndex(root).lines[0])).toBeNull();
        expect(lineAbove(buildLineIndex(root), second)).toBeNull();
    });
});
