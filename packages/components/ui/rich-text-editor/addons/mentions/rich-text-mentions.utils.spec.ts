import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    buildEntityInsertNode,
    buildEntityRenderContext,
    detectTrigger,
    selectTriggerRange,
} from './rich-text-mentions.utils';
import type {
    MentionItem,
    RichTextEntityRenderContext,
    RichTextEntityRenderOptions,
} from './rich-text-mentions.types';

const passthroughUrl = (url: string): string | null => url;
const rejectUrl = (): string | null => null;

function contextFor(overrides: Partial<RichTextEntityRenderContext> = {}): RichTextEntityRenderContext {
    return {
        type: 'mention', trigger: '@', id: 'u1', value: 'jane', label: 'Jane Doe',
        query: 'ja', item: { value: 'jane', label: 'Jane Doe' }, userId: 'u1', tagId: 'u1',
        ...overrides,
    };
}

describe('rich-text-mentions.utils', () => {
    describe('detectTrigger', () => {
        let host: HTMLElement;

        beforeEach(() => {
            host = document.createElement('div');
            host.setAttribute('contenteditable', 'true');
            document.body.appendChild(host);
        });

        afterEach(() => {
            document.getSelection()?.removeAllRanges();
            host.remove();
        });

        function caretAfter(text: string): void {
            host.textContent = text;
            const node = host.firstChild as Text;
            const range = document.createRange();
            range.setStart(node, text.length);
            range.collapse(true);
            const sel = document.getSelection()!;
            sel.removeAllRanges();
            sel.addRange(range);
        }

        it('returns null when there is no collapsed selection', () => {
            document.getSelection()?.removeAllRanges();
            expect(detectTrigger(document, true, true)).toBeNull();
        });

        it('detects an @mention trigger and its query', () => {
            caretAfter('hello @jane');
            expect(detectTrigger(document, true, true)).toEqual({ type: 'mention', query: 'jane' });
        });

        it('detects a #tag trigger only when tags are allowed', () => {
            caretAfter('topic #ux');
            expect(detectTrigger(document, true, false)).toBeNull();
            expect(detectTrigger(document, true, true)).toEqual({ type: 'tag', query: 'ux' });
        });

        it('ignores a mention trigger when mentions are disabled', () => {
            caretAfter('hi @jane');
            expect(detectTrigger(document, false, true)).toBeNull();
        });

        it('does not treat an email as a trigger', () => {
            caretAfter('mail me@host');
            expect(detectTrigger(document, true, true)).toBeNull();
        });

        it('reads the text before the caret from an element container', () => {
            for (const ch of '@bob') host.appendChild(document.createTextNode(ch));
            const range = document.createRange();
            range.setStart(host, 4);
            range.collapse(true);
            const sel = document.getSelection()!;
            sel.removeAllRanges();
            sel.addRange(range);
            expect(detectTrigger(document, true, true)).toEqual({ type: 'mention', query: 'bob' });
        });
    });

    describe('buildEntityRenderContext', () => {
        it('falls back to value when the item has no id', () => {
            const item: MentionItem = { value: 'jane', label: 'Jane' };
            const ctx = buildEntityRenderContext(item, 'mention', '@', 'ja');
            expect(ctx.id).toBe('jane');
            expect(ctx.userId).toBe('jane');
            expect(ctx.tagId).toBe('jane');
        });

        it('uses the explicit id when present', () => {
            const ctx = buildEntityRenderContext({ id: 'u9', value: 'jane', label: 'Jane' }, 'mention', '@', '');
            expect(ctx.id).toBe('u9');
        });
    });

    describe('buildEntityInsertNode', () => {
        it('builds a chip span by default with mention data attributes', () => {
            const { element, url } = buildEntityInsertNode(document, contextFor(), {}, passthroughUrl);
            expect(element.tagName).toBe('SPAN');
            expect(element.dataset['mention']).toBe('jane');
            expect(element.dataset['mentionId']).toBe('u1');
            expect(element.textContent).toBe('@Jane Doe');
            expect(element.className).toContain('bg-accent');
            expect(url).toBeUndefined();
        });

        it('builds a plain text span with tag data attributes', () => {
            const ctx = contextFor({ type: 'tag', trigger: '#' });
            const { element } = buildEntityInsertNode(document, ctx, { mode: 'text' }, passthroughUrl);
            expect(element.tagName).toBe('SPAN');
            expect(element.dataset['tag']).toBe('jane');
            expect(element.dataset['tagId']).toBe('u1');
            expect(element.className).toBe('');
        });

        it('applies a custom className in text mode', () => {
            const { element } = buildEntityInsertNode(
                document, contextFor(), { mode: 'text', className: 'my-chip' }, passthroughUrl,
            );
            expect(element.className).toBe('my-chip');
        });

        it('resolves a link with url and text templates', () => {
            const options: RichTextEntityRenderOptions = {
                mode: 'link',
                urlTemplate: 'https://x.test/@@userId@@?q=:query',
                textTemplate: '@@label@@ (:value)',
            };
            const { element, url } = buildEntityInsertNode(document, contextFor(), options, passthroughUrl);
            expect(element.tagName).toBe('A');
            expect(element.getAttribute('href')).toBe('https://x.test/u1?q=ja');
            expect(element.textContent).toBe('Jane Doe (jane)');
            expect(url).toBe('https://x.test/u1?q=ja');
            expect(element.getAttribute('target')).toBe('_blank');
            expect(element.getAttribute('rel')).toBe('noopener noreferrer');
        });

        it('honors buildUrl, buildText, target and rel overrides', () => {
            const options: RichTextEntityRenderOptions = {
                mode: 'link',
                buildUrl: (c) => `https://y.test/${c.value}`,
                buildText: (c) => `link:${c.label}`,
                target: '_self',
                rel: 'nofollow',
                className: 'link-chip',
            };
            const { element } = buildEntityInsertNode(document, contextFor(), options, passthroughUrl);
            expect(element.getAttribute('href')).toBe('https://y.test/jane');
            expect(element.textContent).toBe('link:Jane Doe');
            expect(element.getAttribute('target')).toBe('_self');
            expect(element.getAttribute('rel')).toBe('nofollow');
            expect(element.className).toBe('link-chip');
        });

        it('falls back to a chip span when the link url is rejected by the sanitizer', () => {
            const options: RichTextEntityRenderOptions = { mode: 'link', urlTemplate: 'javascript:alert(1)' };
            const { element, url } = buildEntityInsertNode(document, contextFor(), options, rejectUrl);
            expect(element.tagName).toBe('SPAN');
            expect(url).toBeUndefined();
        });

        it('falls back to a chip span when a link mode supplies no url source', () => {
            const { element } = buildEntityInsertNode(document, contextFor(), { mode: 'link' }, passthroughUrl);
            expect(element.tagName).toBe('SPAN');
        });

        it('leaves unknown @@tokens empty and unknown :tokens untouched', () => {
            const options: RichTextEntityRenderOptions = {
                mode: 'text',
                textTemplate: '@@missing@@:unknown-:label',
            };
            const { element } = buildEntityInsertNode(document, contextFor(), options, passthroughUrl);
            expect(element.textContent).toBe(':unknown-Jane Doe');
        });
    });

    describe('selectTriggerRange', () => {
        it('expands a text-node caret back over the trigger string', () => {
            const root = document.createElement('div');
            const text = document.createTextNode('hello @foo');
            root.appendChild(text);
            const range = document.createRange();
            range.setStart(text, text.length);
            range.collapse(true);

            selectTriggerRange(document, range, '@foo', root);

            expect(range.startContainer).toBe(text);
            expect(range.startOffset).toBe(6);
        });

        it('selects the trigger from a direct text child of an element container', () => {
            const root = document.createElement('div');
            const text = document.createTextNode('a@foo');
            root.appendChild(text);
            const range = document.createRange();
            range.setStart(root, 1);

            selectTriggerRange(document, range, '@foo', root);

            expect(range.startContainer).toBe(text);
            expect(range.startOffset).toBe(1);
            expect(range.endOffset).toBe(5);
        });

        it('descends into the last child to find the trigger text', () => {
            const root = document.createElement('div');
            const span = document.createElement('span');
            const text = document.createTextNode('z@foo');
            span.appendChild(text);
            root.appendChild(span);
            const range = document.createRange();
            range.setStart(root, 1);

            selectTriggerRange(document, range, '@foo', root);

            expect(range.startContainer).toBe(text);
            expect(range.endOffset).toBe(5);
        });

        it('walks the editor tree when the container child does not end with the trigger', () => {
            const root = document.createElement('div');
            root.appendChild(document.createTextNode('no-match'));
            root.appendChild(document.createTextNode('later @foo tail'));
            const range = document.createRange();
            range.setStart(root, 1);

            selectTriggerRange(document, range, '@foo', root);

            const found = range.startContainer as Text;
            expect(found.data.slice(range.startOffset, range.endOffset)).toBe('@foo');
        });

        it('walks the editor tree when the preceding container child is a childless element', () => {
            const root = document.createElement('div');
            root.appendChild(document.createElement('br'));
            root.appendChild(document.createTextNode('tail @foo end'));
            const range = document.createRange();
            range.setStart(root, 1);

            selectTriggerRange(document, range, '@foo', root);

            const found = range.startContainer as Text;
            expect(found.data.slice(range.startOffset, range.endOffset)).toBe('@foo');
        });

        it('walks the editor tree when the caret sits at container offset zero', () => {
            const root = document.createElement('div');
            root.appendChild(document.createTextNode('start @foo end'));
            const range = document.createRange();
            range.setStart(root, 0);

            selectTriggerRange(document, range, '@foo', root);

            const found = range.startContainer as Text;
            expect(found.data.slice(range.startOffset, range.endOffset)).toBe('@foo');
        });
    });
});
