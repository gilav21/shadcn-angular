import { describe, expect, it } from 'vitest';
import {
    buildLineIndex,
    lastOwnInlineNode,
    caretPosition,
    holdsNothing,
    isLineOwner,
    lineAbove,
    lineBelow,
    lineIsEmpty,
    lineIsTextOnly,
    lineOf,
    lineOwnNodes,
    lineText,
    lineTagIsFixed,
    rangeShowsNothing,
    linesBetween,
    linesMayJoin,
    placeCaretIn,
    positionAfterLine,
} from './index';

const TASK_ROWS =
    '<ul data-task-list>'
    + '<li data-task data-checked="true"><input type="checkbox"><span>first</span></li>'
    + '<li data-task data-checked="false"><input type="checkbox"><span>second</span></li>'
    + '</ul>';

const NESTED_TASK_ROWS =
    '<ul data-task-list>'
    + '<li data-task data-checked="false"><input type="checkbox"><span>parent</span>'
    + '<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>child</span></li></ul>'
    + '</li>'
    + '</ul>';

/**
 * The DOM shapes every line rule has to answer for.
 *
 * Each row is `[name, html]`. The name is what a failing case is called, so it
 * says which shape broke rather than which index.
 */
const LINE_SHAPE_FIXTURES: ReadonlyArray<readonly [string, string]> = [
    ['a paragraph', '<p>one</p><p>two</p>'],
    ['headings and a div', '<h1>title</h1><div>body</div>'],
    ['plain list items', '<ul><li>one</li><li>two</li></ul>'],
    ['task rows', TASK_ROWS],
    ['a task row nested under a task row', NESTED_TASK_ROWS],
    ['a plain list nested under a task row', '<ul data-task-list><li data-task><input type="checkbox"><span>parent</span><ul><li>plain</li></ul></li></ul>'],
    ['a task row nested under a plain item', '<ul><li>plain<ul data-task-list><li data-task><input type="checkbox"><span>task</span></li></ul></li></ul>'],
    ['an item wrapping a paragraph', '<ul><li><p>wrapped</p></li></ul>'],
    ['a stray non-item child of a list', '<ul><li>one</li><span>stray</span><li>two</li></ul>'],
    ['an empty task row', '<ul data-task-list><li data-task><input type="checkbox"><span>\u00A0</span></li></ul>'],
    ['a task row holding only an image', '<ul data-task-list><li data-task><input type="checkbox"><span><img src="x.png"></span></li></ul>'],
    ['a task row starting with an image', '<ul data-task-list><li data-task><input type="checkbox"><span><img src="x.png">text</span></li></ul>'],
    ['a task row with inline formatting', '<ul data-task-list><li data-task><input type="checkbox"><span>read <b>the</b> docs</span></li></ul>'],
    ['a task row with a checkbox in its text', '<ul data-task-list><li data-task><input type="checkbox"><span>mid<input type="checkbox">end</span></li></ul>'],
    ['a line holding only a break', '<p><br></p>'],
    ['a line holding only an empty span', '<p><span></span></p>'],
    ['table cells', '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'],
    ['a cell holding two paragraphs', '<table><tbody><tr><td><p>a</p><p>b</p></td></tr></tbody></table>'],
    ['an empty table', '<table><tbody><tr><td><br></td></tr></tbody></table>'],
    ['quote lines', '<blockquote><p>quoted</p><p>lines</p></blockquote>'],
    ['a quote holding a list', '<blockquote><ul><li>quoted item</li></ul></blockquote>'],
    ['a code block', '<pre><code>one\ntwo</code></pre>'],
    ['a div wrapping blocks', '<div><p>one</p><p>two</p></div>'],
    ['an item holding text and a block', '<ul><li>own text<blockquote><p>deep</p></blockquote></li></ul>'],
    ['a details block', '<details><summary>head</summary><p>body</p></details>'],
    ['a horizontal rule between lines', '<p>before</p><hr><p>after</p>'],
];

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
    'a div wrapping blocks': [['P', 'one', false], ['P', 'two', false]],
    'an item holding text and a block': [['P', 'deep', false]],
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
    it.each([
        ['its own text before a sub-list', '<li>parent<ul><li>child</li></ul></li>', 'parent'],
        ['its own formatting before a table and blank text', '<li>a <b>bold</b><table><tbody><tr><td>c</td></tr></tbody></table>\n</li>', 'bold'],
        ['nothing of its own, only a list', '<li><ul><li>x</li></ul></li>', null],
    ])('finds the last node of a block holding %s', (_name, html, text) => {
        const root = document.createElement('ul');
        root.innerHTML = html;

        expect(lastOwnInlineNode(root.firstElementChild!)?.textContent ?? null).toBe(text);
    });

    it.each([
        ['a break between two runs', '<p>one<br>two</p>', 'one\ntwo'],
        ['a break inside emphasis', '<p><em>one<br>two</em> three</p>', 'one\ntwo three'],
        ['a padding break at the end', '<p>one<br></p>', 'one'],
        ['a break then a padding break', '<p>one<br><br></p>', 'one\n'],
        ['a padding break at the end of emphasis', '<p><em>one<br></em></p>', 'one'],
    ])('reads %s as the author sees the line', (_name, html, text) => {
        const root = document.createElement('div');
        root.innerHTML = html;

        expect(lineText(buildLineIndex(root).lines[0])).toBe(text);
    });

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
        expect(line.owner.querySelector(':scope > input[type="checkbox"]')).not.toBeNull();
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

    it('a line holding an image is not text only, though it is not empty either', () => {
        // Two different questions: whether a line shows anything, and whether
        // what it shows is text. Answering the second with the first dropped an
        // image into a code block toggle and out of a join.
        const withImage = rootOf('<p>before<img src="x.png"></p>');
        const line = lineOf(withImage.querySelector('p')!, withImage)!;
        expect(lineIsEmpty(line)).toBe(false);
        expect(lineIsTextOnly(line)).toBe(false);

        const prose = rootOf('<p>just <b>text</b></p>');
        const plain = lineOf(prose.querySelector('p')!, prose)!;
        expect(lineIsTextOnly(plain)).toBe(true);

        const blank = rootOf('<p><br></p>');
        expect(lineIsTextOnly(lineOf(blank.querySelector('p')!, blank)!)).toBe(true);
    });

    it('a container that IS content holds something, even when it has no text', () => {
        const root = rootOf('<table><tbody><tr><td><br></td></tr></tbody></table>');
        expect(holdsNothing(root.querySelector('table')!)).toBe(false);
        expect(holdsNothing(root.querySelector('td')!)).toBe(true);
    });

    it('a block that follows a line goes inside it when the parent rejects blocks', () => {
        // After an <li> would be a child of the <ul>; after a <td> a child of
        // the <tr>. Both are stray blocks the browser relocates or drops.
        const list = rootOf('<ul><li>item</li></ul>');
        const itemLine = lineOf(list.querySelector('li')!.firstChild!, list)!;
        expect(positionAfterLine(itemLine)).toEqual({ parent: itemLine.owner, before: null });

        const table = rootOf('<table><tbody><tr><td>cell</td></tr></tbody></table>');
        const cellLine = lineOf(table.querySelector('td')!.firstChild!, table)!;
        expect(positionAfterLine(cellLine)).toEqual({ parent: cellLine.owner, before: null });

        const prose = rootOf('<p>one</p><p>two</p>');
        const first = lineOf(prose.querySelector('p')!.firstChild!, prose)!;
        expect(positionAfterLine(first)).toEqual({ parent: prose, before: prose.children[1] });
    });

    it('a container element holding both text and a block is a shape the sanitizer removes', () => {
        // The model answers honestly that such text belongs to no line, which
        // is why nothing may hold both: a block command given that item used to
        // reach out to the whole list and destroy it. The editor never builds
        // the shape and the sanitizer takes it apart on the way in, so the raw
        // fixture below is the only place it exists.
        const raw = rootOf('<ul><li>own text<blockquote><p>deep</p></blockquote></li></ul>');
        expect(buildLineIndex(raw).lines.map((line) => lineText(line))).toEqual(['deep']);
        expect(lineOf(raw.querySelector('li')!.firstChild!, raw)).toBeNull();
    });

    it('a div that wraps blocks is a container, not a line of its own', () => {
        // It was in the always-a-line set, so the same text belonged to two
        // lines and the line above a paragraph could be the div containing it.
        const root = rootOf('<div><p>one</p><p>two</p></div>');
        expect(isLineOwner(root.querySelector('div')!, root)).toBe(false);
        expect(buildLineIndex(root).lines.map((line) => line.owner.tagName)).toEqual(['P', 'P']);

        const leaf = rootOf('<div>body</div>');
        expect(isLineOwner(leaf.querySelector('div')!, leaf)).toBe(true);
    });

    it('an element-anchored caret reads as a child index, not as characters', () => {
        // Contenteditable produces these routinely; adding the index as
        // characters reported the END of the line for a caret at its start.
        const root = rootOf('<p>hello</p>');
        const index = buildLineIndex(root);
        const atStart = document.createRange();
        atStart.setStart(root.querySelector('p')!, 0);
        atStart.collapse(true);
        expect(caretPosition(index, atStart)?.offset).toBe(0);

        const mixed = rootOf('<p>read <b>the</b> docs</p>');
        const mixedIndex = buildLineIndex(mixed);
        const beforeBold = document.createRange();
        beforeBold.setStart(mixed.querySelector('p')!, 1);
        beforeBold.collapse(true);
        expect(caretPosition(mixedIndex, beforeBold)?.offset).toBe('read '.length);
    });

    it('an element-anchored caret nested in inline markup counts every character before it', () => {
        // Adding the child index to the text before the line's own node skipped
        // the text between that node's start and the boundary.
        const root = rootOf('<p>a<b>q<i>xy</i></b></p>');
        const index = buildLineIndex(root);
        const range = document.createRange();
        range.setStart(root.querySelector('i')!, 0);
        range.collapse(true);

        const position = caretPosition(index, range)!;
        expect(position.offset).toBe(2);

        // Offset 0 on an element is the one index that reads the same either
        // way, so the general case is a boundary PAST a child: after "q",
        // before the <i>, which is also two characters in.
        const pastChild = document.createRange();
        pastChild.setStart(root.querySelector('b')!, 1);
        pastChild.collapse(true);
        expect(caretPosition(index, pastChild)?.offset).toBe(2);

        // And one further in, after the whole <i>.
        const pastInline = document.createRange();
        pastInline.setStart(root.querySelector('b')!, 2);
        pastInline.collapse(true);
        expect(caretPosition(index, pastInline)?.offset).toBe(4);

        const back = placeCaretIn(position.line, position.offset);
        const measured = document.createRange();
        measured.setStart(root.querySelector('p')!, 0);
        measured.setEnd(back.startContainer, back.startOffset);
        expect(measured.toString()).toHaveLength(2);
    });

    it.each(LINE_SHAPE_FIXTURES)('%s — a caret offset survives the round trip', (_name, html) => {
        const root = rootOf(html);
        const index = buildLineIndex(root);
        for (const line of index.lines) {
            const text = lineText(line);
            for (const offset of [0, Math.floor(text.length / 2), text.length]) {
                const range = placeCaretIn(line, offset);
                const back = caretPosition(index, range);
                expect(back?.line.owner, `${line.owner.tagName} at ${offset}`).toBe(line.owner);
                expect(back?.offset, `${line.owner.tagName} at ${offset}`).toBe(Math.min(offset, text.length));
            }
        }
    });

    it('a line whose element carries its meaning may not be re-tagged', () => {
        const details = rootOf('<details><summary>head</summary><p>body</p></details>');
        expect(lineTagIsFixed(lineOf(details.querySelector('summary')!, details)!)).toBe(true);

        const item = rootOf('<ul><li>one</li></ul>');
        expect(lineTagIsFixed(lineOf(item.querySelector('li')!, item)!)).toBe(true);

        const prose = rootOf('<p>one</p>');
        expect(lineTagIsFixed(lineOf(prose.querySelector('p')!, prose)!)).toBe(false);
    });

    it('a caret anchored on a line that has a sub-list counts only the line\'s own text', () => {
        // The holder of an item line IS the item, so its children include the
        // sub-list. Counting every child before the index added the sub-list's
        // text to the offset, which the task-row shape cannot show: there the
        // holder is a span and every child is already the line's own.
        const root = rootOf('<ul><li>own<ul><li>sub</li></ul></li></ul>');
        const index = buildLineIndex(root);
        const item = root.querySelector('li')!;
        const pastSublist = document.createRange();
        pastSublist.setStart(item, 2);
        pastSublist.collapse(true);

        expect(caretPosition(index, pastSublist)?.offset).toBe('own'.length);
    });

    it('a caret offset past the text stops at the end of the line, not below its sublist', () => {
        const root = rootOf('<ul><li>own<ul><li>sub</li></ul></li></ul>');
        const line = lineOf(root.querySelector('li')!.firstChild!, root)!;

        const range = placeCaretIn(line, 99);

        // The broken version collapsed to the end of the ELEMENT, giving
        // (LI, 2) — past the sub-list. Every obvious assertion passes for that:
        // `contains` includes self, a backwards range reads as empty, and the
        // container is the LI either way. What separates them is whether the
        // caret sits in the line's own text at all, and whether it precedes
        // the sub-list.
        const sublist = root.querySelector('li > ul')!;
        const atSublist = document.createRange();
        atSublist.setStartBefore(sublist);
        expect(range.compareBoundaryPoints(Range.START_TO_START, atSublist)).toBeLessThanOrEqual(0);

        // And not before the line's own text either: the caret goes to its end.
        const atTextEnd = document.createRange();
        atTextEnd.setStartAfter(lineOwnNodes(line).at(-1)!);
        expect(range.compareBoundaryPoints(Range.START_TO_START, atTextEnd)).toBe(0);
    });

    it('two nodes in the same line yield just that line', () => {
        const root = rootOf('<p>one</p><p>two</p>');
        const index = buildLineIndex(root);
        const first = root.querySelector('p')!.firstChild!;

        expect(linesBetween(index, first, first).map((line) => lineText(line))).toEqual(['one']);
    });

    it('prose joins to prose inside one island, never across a cell or a code block', () => {
        const mixed = rootOf('<table><tbody><tr><td>cell</td></tr></tbody></table>'
            + '<pre><code>code</code></pre><p>para</p><ul><li>item</li></ul>');
        const index = buildLineIndex(mixed);
        const byText = (text: string) => index.lines.find((line) => lineText(line) === text)!;

        expect(linesMayJoin(byText('para'), byText('item'))).toBe(true);
        expect(linesMayJoin(byText('item'), byText('cell'))).toBe(false);
        expect(linesMayJoin(byText('item'), byText('code'))).toBe(false);
        expect(linesMayJoin(byText('cell'), byText('para'))).toBe(false);
    });

    it('two lines in the same cell may join, two lines in different cells may not', () => {
        const root = rootOf('<table><tbody><tr>'
            + '<td><p>a</p><p>b</p></td><td><p>c</p></td>'
            + '</tr></tbody></table>');
        const index = buildLineIndex(root);
        const [a, b, c] = index.lines;

        expect(linesMayJoin(a, b)).toBe(true);
        expect(linesMayJoin(b, c)).toBe(false);
    });

    it('the lines between two nodes descend into a nested list', () => {
        const root = rootOf('<ul><li>one<ul><li>sub</li></ul></li><li>two</li></ul>');
        const index = buildLineIndex(root);
        const items = root.querySelectorAll('li');

        expect(linesBetween(index, items[0].firstChild!, items[2].firstChild!).map((l) => lineText(l)))
            .toEqual(['one', 'sub', 'two']);
        // Given the other way round it answers the same, in document order.
        expect(linesBetween(index, items[2].firstChild!, items[0].firstChild!).map((l) => lineText(l)))
            .toEqual(['one', 'sub', 'two']);
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
