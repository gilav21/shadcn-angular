import { describe, expect, it } from 'vitest';
import {
    LANGUAGE_PATTERNS,
    codeTextOf,
    readCodeLines,
    highlightCodeBlocks,
    highlightCodeElement,
    highlightCodeElementKeepingCaret,
    languageOfCodeElement,
    languagePatternsFor,
    stripCodeHighlighting,
    tokenClassFor,
    tokenizeLine,
} from './code-highlight';

const root = (html: string): HTMLElement => {
    const el = document.createElement('div');
    el.innerHTML = html;
    return el;
};

const types = (code: HTMLElement): string[] =>
    Array.from(code.querySelectorAll('span.token'), (span) => span.className.replace('token token-', ''));

describe('tokenizeLine', () => {
    it('splits a line into typed runs and plain text', () => {
        const tokens = tokenizeLine('const a = 1;', LANGUAGE_PATTERNS['typescript']);
        expect(tokens.filter((t) => t.type !== 'text').map((t) => [t.type, t.text]))
            .toEqual([['keyword', 'const'], ['number', '1']]);
        expect(tokens.map((t) => t.text).join('')).toBe('const a = 1;');
    });

    it('returns nothing for an empty line', () => {
        expect(tokenizeLine('', LANGUAGE_PATTERNS['typescript'])).toEqual([]);
    });

    it('never loses or invents a character, whatever the line', () => {
        const lines = [
            'const a = "str with // not a comment";',
            '// all comment',
            '   ',
            'x',
            'function f(a, b) { return a + b; }',
            'אב shalom 42',
        ];
        for (const line of lines) {
            expect(tokenizeLine(line, LANGUAGE_PATTERNS['typescript']).map((t) => t.text).join('')).toBe(line);
        }
    });
});

describe('languagePatternsFor', () => {
    it('resolves a built-in language', () => {
        expect(languagePatternsFor('python')).toBe(LANGUAGE_PATTERNS['python']);
    });

    it('resolves the spellings an author actually types in a fence', () => {
        expect(languagePatternsFor('ts')).toBe(LANGUAGE_PATTERNS['typescript']);
        expect(languagePatternsFor('py')).toBe(LANGUAGE_PATTERNS['python']);
        expect(languagePatternsFor('sh')).toBe(LANGUAGE_PATTERNS['bash']);
        expect(languagePatternsFor('c#')).toBe(LANGUAGE_PATTERNS['csharp']);
    });

    it('is case-insensitive', () => {
        expect(languagePatternsFor('TypeScript')).toBe(LANGUAGE_PATTERNS['typescript']);
    });

    it('returns null for a language it does not know, and for none', () => {
        // Not a fallback to TypeScript. A document is mostly prose: a fence with
        // no language would otherwise have keywords invented in it.
        expect(languagePatternsFor('klingon')).toBeNull();
        expect(languagePatternsFor('')).toBeNull();
        expect(languagePatternsFor(null)).toBeNull();
        expect(languagePatternsFor(undefined)).toBeNull();
    });
});

describe('tokenClassFor', () => {
    it('uses the classes the sanitizer already allows', () => {
        expect(tokenClassFor('keyword')).toBe('token token-keyword');
    });

    it('gives plain text no class of its own', () => {
        expect(tokenClassFor('text')).toBeNull();
    });
});

describe('languageOfCodeElement', () => {
    it('prefers the data attribute', () => {
        expect(languageOfCodeElement(root('<code data-language="ts" class="language-js">x</code>').firstElementChild as HTMLElement))
            .toBe('ts');
    });

    it('falls back to the language-* class', () => {
        expect(languageOfCodeElement(root('<code class="hljs language-python">x</code>').firstElementChild as HTMLElement))
            .toBe('python');
    });

    it('reports none when the block names none', () => {
        expect(languageOfCodeElement(root('<code>x</code>').firstElementChild as HTMLElement)).toBeNull();
    });
});

describe('highlightCodeElement', () => {
    const code = (html: string, lang: string | null = 'typescript'): HTMLElement => {
        const el = root(`<pre><code>${html}</code></pre>`).querySelector('code') as HTMLElement;
        highlightCodeElement(el, lang);
        return el;
    };

    it('paints the tokens it found', () => {
        expect(types(code('const a = 1;'))).toEqual(['keyword', 'number']);
    });

    it('leaves the block\'s own text byte for byte', () => {
        const source = 'const a = 1;\n\n\nlet b = 2;\n';
        const el = root('<pre><code></code></pre>').querySelector('code') as HTMLElement;
        el.textContent = source;
        highlightCodeElement(el, 'typescript');
        expect(el.textContent).toBe(source);
    });

    it('is idempotent', () => {
        const el = root('<pre><code data-language="ts">const a = 1;</code></pre>');
        highlightCodeBlocks(el);
        const once = el.innerHTML;
        highlightCodeBlocks(el);
        expect(el.innerHTML).toBe(once);
    });

    it('paints nothing for a language it does not know', () => {
        expect(code('const a = 1;', 'klingon').innerHTML).toBe('const a = 1;');
        expect(code('const a = 1;', null).innerHTML).toBe('const a = 1;');
    });

    it('refuses a block holding anything but text, so it cannot delete it', () => {
        // The markdown writer keeps an image in a code block by writing the
        // block in its tag form. Rebuilding that block from `textContent` --
        // which is what the paint does -- would delete the image outright.
        const el = root('<pre><code data-language="ts">a<img src="https://e.com/x.png" alt="q">b</code></pre>');
        expect(highlightCodeBlocks(el)).toBe(0);
        expect(el.querySelector('img')).not.toBeNull();
    });

    it('highlights every block under a root that names a language', () => {
        const el = root(
            '<pre><code data-language="ts">const a = 1;</code></pre>'
            + '<pre><code data-language="klingon">const a = 1;</code></pre>'
            + '<pre><code class="language-python">def f(): pass</code></pre>',
        );
        expect(highlightCodeBlocks(el)).toBe(2);
    });
});

describe('stripCodeHighlighting', () => {
    it('restores the markup the paint started from, exactly', () => {
        const el = root('<pre><code data-language="ts">const a = 1;\nlet b = 2;</code></pre>');
        const before = el.innerHTML;
        highlightCodeBlocks(el);
        expect(el.innerHTML).not.toBe(before);
        stripCodeHighlighting(el);
        expect(el.innerHTML).toBe(before);
    });

    it('leaves a pasted block in an unknown language alone', () => {
        // Those spans are the AUTHOR's -- pasted from an already-highlighted
        // source, which the sanitizer deliberately keeps. Nothing here painted
        // them, so nothing here may take them away.
        const html = '<pre><code data-language="klingon"><span class="token token-keyword">qapla</span></code></pre>';
        const el = root(html);
        stripCodeHighlighting(el);
        expect(el.innerHTML).toBe(html);
    });

    it('keeps an image in a code block', () => {
        const el = root('<pre><code data-language="ts">a<img src="https://e.com/x.png" alt="q">b</code></pre>');
        stripCodeHighlighting(el);
        expect(el.querySelector('img')).not.toBeNull();
    });
});

/**
 * A code block's lines separated by `<br>` -- what Shift+Enter, the editor's key
 * for a new line inside a block, inserts. `textContent` reads a `<br>` as
 * nothing, so every reader built on it lost the rows.
 */
describe('line breaks written as <br>', () => {
    const block = (inner: string): HTMLElement =>
        root(`<pre><code data-language="ts">${inner}</code></pre>`).querySelector('code') as HTMLElement;

    it('reads a <br> as a line break', () => {
        expect(codeTextOf(block('a<br>b<br>c'))).toBe('a\nb\nc');
    });

    it('reads a mix of <br> and newline characters, in order', () => {
        const lines = readCodeLines(block('a\nb<br>c\nd'));
        expect(lines.text).toBe('a\nb\nc\nd');
        expect(lines.breaks).toEqual(['newline', 'br', 'newline']);
    });

    it('reads a <br> a browser typed inside a coloured word', () => {
        expect(codeTextOf(block('<span class="token token-keyword">con<br>st</span> x'))).toBe('con\nst x');
    });

    it('does not count the <br> that only holds an empty last line open', () => {
        // Shift+Enter at the end leaves "a<br><br>": the second one renders no
        // line, it gives the caret somewhere to sit.
        const lines = readCodeLines(block('a<br><br>'));
        expect(lines.text).toBe('a\n');
        expect(lines.trailingBr).toBe(true);
    });

    it('colours a block whose lines are separated by <br>', () => {
        const code = block('const a = 1;<br>let b = 2;');
        expect(highlightCodeElement(code, 'ts')).toBe(true);
        expect(types(code)).toEqual(['keyword', 'number', 'keyword', 'number']);
    });

    it('keeps each break in the form it had, so no line collapses', () => {
        const code = block('const a = 1;<br>let b\n= 2;<br><br>');
        highlightCodeElement(code, 'ts');
        expect(code.querySelectorAll('br')).toHaveLength(3);
        expect(codeTextOf(code)).toBe('const a = 1;\nlet b\n= 2;\n');
    });

    it('is idempotent on a block with <br> breaks', () => {
        const code = block('const a = 1;<br>let b = 2;');
        highlightCodeElement(code, 'ts');
        const once = code.innerHTML;
        highlightCodeElement(code, 'ts');
        expect(code.innerHTML).toBe(once);
    });

    it('still refuses a block holding an image', () => {
        const code = block('a<br><img src="https://e.com/x.png" alt="q">');
        expect(highlightCodeElement(code, 'ts')).toBe(false);
        expect(code.querySelector('img')).not.toBeNull();
    });
});

describe('highlightCodeElementKeepingCaret', () => {
    /** Put a collapsed caret `offset` characters into `code`'s text and return the selection. */
    const caretAt = (code: HTMLElement, offset: number): Selection => {
        const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
        let seen = 0;
        for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
            if (seen + node.data.length >= offset) {
                const range = document.createRange();
                range.setStart(node, offset - seen);
                range.collapse(true);
                const selection = document.getSelection() as Selection;
                selection.removeAllRanges();
                selection.addRange(range);
                return selection;
            }
            seen += node.data.length;
        }
        throw new Error('offset past the block');
    };

    /** How many characters of `code`'s text sit before the collapsed caret. */
    const caretOffset = (code: HTMLElement, selection: Selection): number => {
        const range = selection.getRangeAt(0);
        const measure = document.createRange();
        measure.setStart(code, 0);
        measure.setEnd(range.startContainer, range.startOffset);
        return measure.toString().length;
    };

    const attached = (html: string): HTMLElement => {
        const host = root(html);
        document.body.appendChild(host);
        return host.querySelector('code') as HTMLElement;
    };

    it('leaves the caret at the same character it was on', () => {
        const code = attached('<pre><code data-language="ts">const a = 1; let b = 2;</code></pre>');
        const selection = caretAt(code, 13);

        expect(highlightCodeElementKeepingCaret(code, 'ts', selection)).toBe(true);
        expect(caretOffset(code, selection)).toBe(13);
        expect(code.contains(selection.getRangeAt(0).startContainer)).toBe(true);
        code.closest('div')?.remove();
    });

    /** Characters before the caret with each <br> counted as the newline it is. */
    const caretOffsetCountingBreaks = (code: HTMLElement, selection: Selection): number => {
        const range = selection.getRangeAt(0);
        const measure = document.createRange();
        measure.setStart(code, 0);
        measure.setEnd(range.startContainer, range.startOffset);
        return codeTextOf(measure.cloneContents()).length + (measure.cloneContents().lastChild?.nodeName === 'BR' ? 1 : 0);
    };

    const select = (place: (range: Range) => void): Selection => {
        const range = document.createRange();
        place(range);
        range.collapse(true);
        const selection = document.getSelection() as Selection;
        selection.removeAllRanges();
        selection.addRange(range);
        return selection;
    };

    it('keeps the caret on a line below a <br>', () => {
        // Range.toString() counts a <br> as nothing, so the caret was remembered
        // one character early per break above it and crept up the block.
        const code = attached('<pre><code data-language="ts">const a = 1;<br>let b = 2;</code></pre>');
        const secondLine = code.lastChild as Text;
        const selection = select((range) => range.setStart(secondLine, 3));

        expect(highlightCodeElementKeepingCaret(code, 'ts', selection)).toBe(true);
        const measure = document.createRange();
        measure.setStart(code, 0);
        measure.setEnd(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset);
        expect(codeTextOf(measure.cloneContents())).toBe('const a = 1;\nlet');
        code.closest('div')?.remove();
    });

    it('keeps the caret on the empty line a Shift+Enter just opened', () => {
        const code = attached('<pre><code data-language="ts">const a = 1;<br><br></code></pre>');
        const firstBreak = code.querySelector('br') as HTMLBRElement;
        const selection = select((range) => range.setStartAfter(firstBreak));

        expect(highlightCodeElementKeepingCaret(code, 'ts', selection)).toBe(true);
        expect(caretOffsetCountingBreaks(code, selection)).toBe('const a = 1;\n'.length);
        // Still in front of the placeholder, not after it, which would be a line
        // the author never opened.
        const range = selection.getRangeAt(0);
        expect(range.startContainer).toBe(code);
        expect(code.childNodes[range.startOffset]?.nodeName).toBe('BR');
        code.closest('div')?.remove();
    });

    it('keeps the caret at the very end of the block', () => {
        const code = attached('<pre><code data-language="ts">const a = 1;</code></pre>');
        const selection = caretAt(code, 12);

        highlightCodeElementKeepingCaret(code, 'ts', selection);
        expect(caretOffset(code, selection)).toBe(12);
        code.closest('div')?.remove();
    });

    it('leaves the caret and every node in place when the paint would change nothing', () => {
        // The shape a second keystroke in a word produces: the text grew, but
        // no token boundary moved. Asserting only that the Range OBJECT was the
        // same passed while the caret sat at offset 0 -- getRangeAt hands back
        // the same live object after the browser has collapsed it to the start.
        const code = attached('<pre><code data-language="ts">xexport <span class="token token-keyword">function</span> f</code></pre>');
        (code.firstChild as Text).data = 'xyexport ';
        const typedInto = code.firstChild;
        const selection = caretAt(code, 2);

        expect(highlightCodeElementKeepingCaret(code, 'ts', selection)).toBe(false);
        expect(caretOffset(code, selection)).toBe(2);
        expect(code.firstChild).toBe(typedInto);
        code.closest('div')?.remove();
    });

    it('keeps the caret across a run of keystrokes at the start of a block', () => {
        const code = attached('<pre><code data-language="ts">export function f() {}</code></pre>');
        highlightCodeElement(code, 'ts');
        let selection = caretAt(code, 0);

        for (const [index, ch] of Array.from('const ').entries()) {
            const range = selection.getRangeAt(0);
            (range.startContainer as Text).insertData(range.startOffset, ch);
            selection = caretAt(code, index + 1);
            highlightCodeElementKeepingCaret(code, 'ts', selection);
            expect(caretOffset(code, selection)).toBe(index + 1);
        }
        expect(code.textContent).toBe('const export function f() {}');
        code.closest('div')?.remove();
    });

    it('paints nothing, and reports so, for a language it does not know', () => {
        const code = attached('<pre><code data-language="klingon">const a = 1;</code></pre>');
        expect(highlightCodeElementKeepingCaret(code, 'klingon', document.getSelection())).toBe(false);
        expect(code.innerHTML).toBe('const a = 1;');
        code.closest('div')?.remove();
    });
});
