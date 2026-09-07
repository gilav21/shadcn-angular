import { describe, expect, it, afterEach } from 'vitest';
import { caretIsInCode } from './caret-context';

describe('caretIsInCode', () => {
    let host: HTMLElement | null = null;

    const mount = (html: string, selector: string): void => {
        host = document.createElement('div');
        host.innerHTML = html;
        document.body.appendChild(host);
        const target = host.querySelector(selector)!;
        const node = target.firstChild as Text;
        const range = document.createRange();
        range.setStart(node, node.data.length);
        range.collapse(true);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
    };

    afterEach(() => {
        document.getSelection()?.removeAllRanges();
        host?.remove();
        host = null;
    });

    it('is true inside an inline code span', () => {
        mount('<p><code>@Component</code></p>', 'code');
        expect(caretIsInCode(document)).toBe(true);
    });

    it('is true inside a fenced code block', () => {
        mount('<pre><code>/usr/bin</code></pre>', 'code');
        expect(caretIsInCode(document)).toBe(true);
    });

    it('is false in ordinary prose', () => {
        mount('<p>hello @ja</p>', 'p');
        expect(caretIsInCode(document)).toBe(false);
    });

    it('is false with no selection at all', () => {
        document.getSelection()?.removeAllRanges();
        expect(caretIsInCode(document)).toBe(false);
    });
});
