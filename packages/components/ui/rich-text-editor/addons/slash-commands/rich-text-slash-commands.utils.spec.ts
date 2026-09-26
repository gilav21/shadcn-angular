import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    captureSlashTriggerRange,
    findClosestEditableBlock,
    findClosestEditableBlockFromRange,
    getClosestEditableBlockForSlashCommand,
    getClosestEditableBlockFromSelection,
    isSelectionInsideEditor,
    matchSlashTriggerAtCaret,
    matchSlashTriggerInText,
    matchSlashTriggerWithinCurrentBlock,
    placeCaretAtEndOfBlock,
    removeCaretSentinelAtSelection,
    removeSlashTriggerText,
} from './rich-text-slash-commands.utils';

const ZW = '​';

describe('rich-text-slash-commands.utils', () => {
    const roots: HTMLElement[] = [];

    function makeRoot(html: string): HTMLElement {
        const root = document.createElement('div');
        root.innerHTML = html;
        document.body.appendChild(root);
        roots.push(root);
        return root;
    }

    function setCaret(node: Node, offset: number): void {
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        const sel = document.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
    }

    afterEach(() => {
        // Restore any getSelection spy first — jest does not auto-restore spies
        // between tests, so a leaked mock would null out later tests.
        vi.restoreAllMocks();
        document.getSelection()?.removeAllRanges();
        while (roots.length > 0) {
            roots.pop()!.remove();
        }
    });

    describe('matchSlashTriggerInText', () => {
        it('matches a slash at the string start', () => {
            const match = matchSlashTriggerInText('/head', 5);
            expect(match).not.toBeNull();
            expect(match![1]).toBe('head');
        });

        it('matches a slash after whitespace and slices at the cursor', () => {
            const match = matchSlashTriggerInText('type /he extra', 8);
            expect(match![1]).toBe('he');
        });

        it('does not match a slash that follows a letter', () => {
            expect(matchSlashTriggerInText('a/he', 4)).toBeNull();
        });
    });

    describe('matchSlashTriggerAtCaret', () => {
        it('returns null when there is no selection', () => {
            document.getSelection()!.removeAllRanges();
            expect(matchSlashTriggerAtCaret(document)).toBeNull();
        });

        it('returns null when the caret sits on a non-text node', () => {
            const root = makeRoot('<p>x</p>');
            setCaret(root, 0);
            expect(matchSlashTriggerAtCaret(document)).toBeNull();
        });

        it('matches the slash prefix of the caret text node', () => {
            const root = makeRoot('<p>hi /go</p>');
            const text = root.querySelector('p')!.firstChild as Text;
            setCaret(text, text.data.length);
            expect(matchSlashTriggerAtCaret(document)![1]).toBe('go');
        });
    });

    describe('matchSlashTriggerWithinCurrentBlock', () => {
        it('returns null with no selection', () => {
            const root = makeRoot('<p>x</p>');
            document.getSelection()!.removeAllRanges();
            expect(matchSlashTriggerWithinCurrentBlock(document, root)).toBeNull();
        });

        it('returns null when the caret is outside the root', () => {
            const root = makeRoot('<p>x</p>');
            const outside = makeRoot('<p>/go</p>');
            const text = outside.querySelector('p')!.firstChild as Text;
            setCaret(text, text.data.length);
            expect(matchSlashTriggerWithinCurrentBlock(document, root)).toBeNull();
        });

        it('matches from the block start to the caret, across inline formatting', () => {
            const root = makeRoot('<p>/he<b>ad</b></p>');
            const text = root.querySelector('b')!.firstChild as Text;
            setCaret(text, 2);
            expect(matchSlashTriggerWithinCurrentBlock(document, root)![1]).toBe('head');
        });

        it('returns null when the block has no trigger', () => {
            const root = makeRoot('<p>hello</p>');
            const text = root.querySelector('p')!.firstChild as Text;
            setCaret(text, 5);
            expect(matchSlashTriggerWithinCurrentBlock(document, root)).toBeNull();
        });

        it('probes child blocks when the caret container is the root', () => {
            const root = makeRoot('<p>/menu</p>');
            setCaret(root, 1);
            expect(matchSlashTriggerWithinCurrentBlock(document, root)![1]).toBe('menu');
        });

        it('returns null when the root-anchored probe finds no trigger', () => {
            const root = makeRoot('<p>plain</p>');
            setCaret(root, 1);
            expect(matchSlashTriggerWithinCurrentBlock(document, root)).toBeNull();
        });

        it('returns null when the caret resolves to no editable block', () => {
            const root = makeRoot('');
            const comment = document.createComment('c');
            root.appendChild(comment);
            root.appendChild(document.createTextNode('loose'));
            setCaret(comment, 0);
            expect(matchSlashTriggerWithinCurrentBlock(document, root)).toBeNull();
        });
    });

    describe('isSelectionInsideEditor', () => {
        it('is false without a selection', () => {
            const root = makeRoot('<p>x</p>');
            document.getSelection()!.removeAllRanges();
            expect(isSelectionInsideEditor(document, root)).toBe(false);
        });

        it('is true when the caret is inside the root', () => {
            const root = makeRoot('<p>hi</p>');
            const text = root.querySelector('p')!.firstChild as Text;
            setCaret(text, 1);
            expect(isSelectionInsideEditor(document, root)).toBe(true);
        });

        it('is false when the caret is outside the root', () => {
            const root = makeRoot('<p>hi</p>');
            const outside = makeRoot('<p>out</p>');
            const text = outside.querySelector('p')!.firstChild as Text;
            setCaret(text, 1);
            expect(isSelectionInsideEditor(document, root)).toBe(false);
        });
    });

    describe('captureSlashTriggerRange', () => {
        it('returns null without a selection', () => {
            const root = makeRoot('<p>x</p>');
            document.getSelection()!.removeAllRanges();
            expect(captureSlashTriggerRange(document, root)).toBeNull();
        });

        it('returns null when the caret is outside the root', () => {
            const root = makeRoot('<p>x</p>');
            const outside = makeRoot('<p>y</p>');
            setCaret(outside.querySelector('p')!.firstChild as Text, 1);
            expect(captureSlashTriggerRange(document, root)).toBeNull();
        });

        it('captures the in-editor caret as a copy that edits to the live selection range do not move', () => {
            const root = makeRoot('<p>hi /go</p>');
            const text = root.querySelector('p')!.firstChild as Text;
            setCaret(text, 6);
            const range = captureSlashTriggerRange(document, root)!;

            // Caret code edits the selection's own range in place (the live-caret
            // trigger removal does), which must not drag the captured trigger along.
            document.getSelection()!.getRangeAt(0).setStart(text, 0);

            expect(range.startContainer).toBe(text);
            expect(range.startOffset).toBe(6);
            expect(range.collapsed).toBe(true);
        });
    });

    describe('getClosestEditableBlockFromSelection', () => {
        it('returns null without a selection', () => {
            const root = makeRoot('<p>x</p>');
            document.getSelection()!.removeAllRanges();
            expect(getClosestEditableBlockFromSelection(document, root)).toBeNull();
        });

        it('resolves the block from the live caret', () => {
            const root = makeRoot('<p>hi</p>');
            const p = root.querySelector('p')!;
            setCaret(p.firstChild as Text, 1);
            expect(getClosestEditableBlockFromSelection(document, root)).toBe(p);
        });
    });

    describe('getClosestEditableBlockForSlashCommand', () => {
        it('prefers a contained anchor block', () => {
            const root = makeRoot('<p>a</p><p>b</p>');
            const anchor = root.querySelectorAll('p')[1] as HTMLElement;
            expect(getClosestEditableBlockForSlashCommand(document, root, anchor, null)).toBe(anchor);
        });

        it('falls back to the live selection when the anchor is not contained', () => {
            const root = makeRoot('<p>live</p>');
            const detached = document.createElement('p');
            const p = root.querySelector('p')!;
            setCaret(p.firstChild as Text, 1);
            expect(getClosestEditableBlockForSlashCommand(document, root, detached, null)).toBe(p);
        });

        it('falls back to the trigger range when there is no usable selection', () => {
            const root = makeRoot('<p>range</p>');
            const p = root.querySelector('p')!;
            const range = document.createRange();
            range.setStart(p.firstChild as Text, 1);
            range.collapse(true);
            document.getSelection()!.removeAllRanges();
            expect(getClosestEditableBlockForSlashCommand(document, root, null, range)).toBe(p);
        });

        it('returns null when nothing resolves', () => {
            const root = makeRoot('<p>x</p>');
            document.getSelection()!.removeAllRanges();
            expect(getClosestEditableBlockForSlashCommand(document, root, null, null)).toBeNull();
        });

        it('ignores a selection outside the root before trying the trigger range', () => {
            const root = makeRoot('<p>inner</p>');
            const outside = makeRoot('<p>outer</p>');
            setCaret(outside.querySelector('p')!.firstChild as Text, 1);
            const p = root.querySelector('p')!;
            const range = document.createRange();
            range.setStart(p.firstChild as Text, 1);
            range.collapse(true);
            expect(getClosestEditableBlockForSlashCommand(document, root, null, range)).toBe(p);
        });
    });

    describe('findClosestEditableBlockFromRange', () => {
        it('resolves a child block when the range container is the root', () => {
            const root = makeRoot('<p>one</p><p>two</p>');
            const range = document.createRange();
            range.setStart(root, 2);
            range.collapse(true);
            expect(findClosestEditableBlockFromRange(document, root, range)).toBe(root.querySelectorAll('p')[1]);
        });

        it('creates a paragraph when the root is empty', () => {
            const root = makeRoot('');
            const range = document.createRange();
            range.setStart(root, 0);
            range.collapse(true);
            const block = findClosestEditableBlockFromRange(document, root, range);
            expect(block!.tagName).toBe('P');
            expect(root.contains(block)).toBe(true);
        });
    });

    describe('findClosestEditableBlock', () => {
        it.each([
            ['a summary', '<details open><summary>Title</summary><p>Body</p></details>', 'summary', 'SUMMARY'],
            ['a table cell', '<table><tbody><tr><td>first</td><td>second</td></tr><tr><td>last</td></tr></tbody></table>', 'td', 'TD'],
            ['a cell of a table in a list item', '<ul><li>item<table><tbody><tr><td>cell</td></tr></tbody></table></li></ul>', 'td', 'TD'],
            ['a level-five heading in a quote', '<blockquote><h5>deep</h5></blockquote>', 'h5', 'H5'],
        ])('anchors to the line the caret sits in: %s', (_name, html, selector, tag) => {
            // The addon's own tag list had none of these, so the anchor was the
            // details block, the table or the quote around them.
            const root = makeRoot(html);
            const text = root.querySelector(selector)!.firstChild as Text;

            expect(findClosestEditableBlock(document, root, text)!.tagName).toBe(tag);
            expect(findClosestEditableBlock(document, root, text)).toBe(root.querySelector(selector));
        });

        it('anchors loose text in a list item that also holds a table to the item, not the list', () => {
            const root = makeRoot('<ul><li>item<table><tbody><tr><td>cell</td></tr></tbody></table></li></ul>');
            const text = root.querySelector('li')!.firstChild as Text;

            expect(findClosestEditableBlock(document, root, text)).toBe(root.querySelector('li'));
        });

        it('walks up to the nearest editable block tag', () => {
            const root = makeRoot('<blockquote><span>deep</span></blockquote>');
            const text = root.querySelector('span')!.firstChild as Text;
            expect(findClosestEditableBlock(document, root, text)!.tagName).toBe('BLOCKQUOTE');
        });

        it('wraps a bare text child of the root in a paragraph', () => {
            const root = makeRoot('');
            const text = document.createTextNode('loose');
            root.appendChild(text);
            const block = findClosestEditableBlock(document, root, text);
            expect(block!.tagName).toBe('P');
            expect(block!.textContent).toBe('loose');
        });

        it('returns the top-level element for a non-block wrapper', () => {
            const root = makeRoot('<section><em>hi</em></section>');
            const text = root.querySelector('em')!.firstChild as Text;
            expect(findClosestEditableBlock(document, root, text)).toBe(root.querySelector('section'));
        });

        it('returns the first element child when anchoring from a non-element node', () => {
            const root = makeRoot('');
            const comment = document.createComment('c');
            root.appendChild(comment);
            const span = document.createElement('span');
            span.textContent = 'x';
            root.appendChild(span);
            expect(findClosestEditableBlock(document, root, comment)).toBe(span);
        });

        it('returns null when the root holds no element to anchor to', () => {
            const root = makeRoot('');
            const comment = document.createComment('only');
            root.appendChild(comment);
            root.appendChild(document.createTextNode('text'));
            expect(findClosestEditableBlock(document, root, comment)).toBeNull();
        });
    });

    describe('removeSlashTriggerText', () => {
        it('returns the table cell a trigger was typed in, not the table', () => {
            const root = makeRoot('<table><tbody><tr><td>first /go</td><td>second</td></tr><tr><td>last</td></tr></tbody></table>');
            const text = root.querySelector('td')!.firstChild as Text;
            const range = document.createRange();
            range.setStart(text, text.data.length);
            range.collapse(true);
            setCaret(text, text.data.length);

            const block = removeSlashTriggerText(document, root, 'go', range, null);

            expect(block).toBe(root.querySelector('td'));
            expect(root.querySelector('td')!.textContent).toBe('first ');
        });

        it('ignores a captured range whose node the editor no longer contains', () => {
            // undo/redo/writeValue/setContent all reassign the editable's
            // innerHTML, detaching every node while the menu stays open. A
            // detached text node still reports nodeType TEXT_NODE, so a
            // type-only check lets the removal mutate a tree nothing renders —
            // and the live document silently keeps the trigger text.
            const root = makeRoot('<p>hi /go</p>');
            const text = root.querySelector('p')!.firstChild as Text;
            const range = document.createRange();
            range.setStart(text, text.data.length);
            range.collapse(true);

            root.innerHTML = '<p>replaced by an undo</p>';
            expect(root.contains(text)).toBe(false);

            const block = removeSlashTriggerText(document, root, 'go', range, null);

            // The live document is untouched and no stale block is returned, so
            // the fallback chain recovers. Guarding earlier also avoids mutating
            // the orphaned node and stealing the selection on the way through.
            expect(root.textContent).toBe('replaced by an undo');
            expect(block).toBeNull();
            expect(text.data).toBe('hi /go');
        });

        it('removes the trigger from the anchor block when there is no captured range', () => {
            const root = makeRoot('<p>keep</p><p>type /cmd here</p>');
            const anchor = root.querySelectorAll('p')[1] as HTMLElement;
            setCaret(anchor.firstChild as Text, 1);
            const block = removeSlashTriggerText(document, root, 'cmd', null, anchor);
            expect(block).toBe(anchor);
            expect(anchor.textContent).toContain('type  here');
        });

        it('scans the whole editor when neither range nor anchor block match', () => {
            const root = makeRoot('<p>empty</p><p>find /needle now</p>');
            const emptyBlock = root.querySelectorAll('p')[0] as HTMLElement;
            setCaret(emptyBlock.firstChild as Text, 0);
            const block = removeSlashTriggerText(document, root, 'needle', null, emptyBlock);
            expect(block).toBe(root.querySelectorAll('p')[1]);
            expect(root.textContent).toContain('find  now');
        });

        it('falls back to the live caret when the trigger lives outside the root', () => {
            const root = makeRoot('<p>plain</p>');
            const outside = makeRoot('<p>run /live cmd</p>');
            const text = outside.querySelector('p')!.firstChild as Text;
            setCaret(text, 9);
            removeSlashTriggerText(document, root, 'live', null, null);
            expect(outside.textContent).toContain('run  cmd');
        });

        it('returns null when nothing matches anywhere', () => {
            const root = makeRoot('<p>nothing</p>');
            setCaret(root.querySelector('p')!.firstChild as Text, 3);
            expect(removeSlashTriggerText(document, root, 'zzz', null, null)).toBeNull();
        });

        it('ignores a captured range whose text does not spell the trigger', () => {
            const root = makeRoot('<p>abc def</p>');
            const text = root.querySelector('p')!.firstChild as Text;
            const range = document.createRange();
            range.setStart(text, 7);
            range.collapse(true);
            setCaret(text, 7);
            expect(removeSlashTriggerText(document, root, 'xyz', range, null)).toBeNull();
            expect(root.textContent).toBe('abc def');
        });

        it('returns null when the live caret sits on a non-text node', () => {
            const root = makeRoot('<p>abc</p>');
            setCaret(root, 0);
            expect(removeSlashTriggerText(document, root, 'no', null, null)).toBeNull();
        });

        it('skips the captured-range path when the selection is unavailable', () => {
            const root = makeRoot('<p>use /go now</p>');
            const p = root.querySelector('p')!;
            const text = p.firstChild as Text;
            const range = document.createRange();
            range.setStart(text, 8);
            range.collapse(true);
            vi.spyOn(document, 'getSelection').mockReturnValue(null);
            const block = removeSlashTriggerText(document, root, 'go', range, p);
            expect(block).toBe(p);
            expect(p.textContent).toContain('use  now');
        });

        it('returns null via the live-caret fallback when the selection is unavailable', () => {
            const root = makeRoot('<p>none</p>');
            vi.spyOn(document, 'getSelection').mockReturnValue(null);
            expect(removeSlashTriggerText(document, root, 'x', null, null)).toBeNull();
        });
    });

    describe('placeCaretAtEndOfBlock', () => {
        it('does nothing without a selection', () => {
            const root = makeRoot('<p>hi</p>');
            vi.spyOn(document, 'getSelection').mockReturnValue(null);
            expect(() => placeCaretAtEndOfBlock(document, root.querySelector('p')!)).not.toThrow();
        });

        it('seeds a zero-width node in a br-only empty block', () => {
            const root = makeRoot('<p><br></p>');
            const block = root.querySelector('p')!;
            placeCaretAtEndOfBlock(document, block);
            expect(block.textContent).toContain(ZW);
            expect(document.getSelection()!.anchorNode!.nodeType).toBe(Node.TEXT_NODE);
        });

        it('appends a zero-width node in a truly empty block', () => {
            const root = makeRoot('<p></p>');
            const block = root.querySelector('p')!;
            placeCaretAtEndOfBlock(document, block);
            expect((block.firstChild as Text).data).toBe(ZW);
        });

        it('reuses an existing zero-width node', () => {
            const root = makeRoot(`<p>${ZW}</p>`);
            const block = root.querySelector('p')!;
            const existing = block.firstChild as Text;
            placeCaretAtEndOfBlock(document, block);
            expect(document.getSelection()!.anchorNode).toBe(existing);
        });

        it('places the caret after the deepest text of a non-empty block', () => {
            const root = makeRoot('<p>abc</p>');
            const block = root.querySelector('p')!;
            placeCaretAtEndOfBlock(document, block);
            const sel = document.getSelection()!;
            expect(sel.anchorNode).toBe(block.firstChild);
            expect(sel.anchorOffset).toBe(3);
        });

        it('places the caret after a trailing element node', () => {
            const root = makeRoot('<p>hi<img></p>');
            const block = root.querySelector('p')!;
            placeCaretAtEndOfBlock(document, block);
            const sel = document.getSelection()!;
            expect(sel.anchorNode).toBe(block);
            expect(sel.anchorOffset).toBe(2);
        });
    });

    describe('placeCaretAtEndOfBlock on an item holding blocks', () => {
        it.each([
            ['a sub-list', '<ul><li>parent<ul><li>child</li></ul></li></ul>', 'parent'],
            ['a table', '<ul><li>text<table><tbody><tr><td>cell</td></tr></tbody></table></li></ul>', 'text'],
            ['a code block and blank text', '<ul><li>line<pre><code>x</code></pre>\n</li></ul>', 'line'],
            ['a sub-list after a blank line of its own', '<ul><li>\u00a0<ul><li>child</li></ul></li></ul>', '\u00a0'],
        ])('places the caret at the end of the item own text, not in %s nested at its end', (_name, html, text) => {
            const root = makeRoot(html);
            placeCaretAtEndOfBlock(document, root.querySelector('li')!);

            const selection = document.getSelection()!;
            expect(selection.anchorNode?.textContent).toBe(text);
            expect(selection.anchorOffset).toBe(text.length);
        });
    });

    it('places the caret in the empty text a removed trigger leaves, not in the item sub-list', () => {
        const root = makeRoot('<ul><li><ul><li>child</li></ul></li></ul>');
        const item = root.querySelector('li')!;
        const blank = document.createTextNode('');
        item.insertBefore(blank, item.firstChild);

        placeCaretAtEndOfBlock(document, item);

        expect(document.getSelection()!.anchorNode).toBe(blank);
    });

    describe('removeCaretSentinelAtSelection', () => {
        it('does nothing without a selection', () => {
            vi.spyOn(document, 'getSelection').mockReturnValue(null);
            expect(() => removeCaretSentinelAtSelection(document)).not.toThrow();
        });

        it('does nothing when the caret sits on a non-text node', () => {
            const root = makeRoot('<p>x</p>');
            setCaret(root, 0);
            expect(() => removeCaretSentinelAtSelection(document)).not.toThrow();
        });

        it('strips sentinels and keeps the caret at the visible offset', () => {
            const root = makeRoot('<p></p>');
            const text = document.createTextNode(`${ZW}ab${ZW}`);
            root.querySelector('p')!.appendChild(text);
            setCaret(text, 3);
            removeCaretSentinelAtSelection(document);
            expect(text.data).toBe('ab');
            expect(document.getSelection()!.anchorOffset).toBe(2);
        });
    });
});
