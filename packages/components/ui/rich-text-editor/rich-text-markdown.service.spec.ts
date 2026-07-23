import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextMarkdownService } from './rich-text-markdown.service';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';

describe('RichTextMarkdownService', () => {
    let service: RichTextMarkdownService;
    let sanitizer: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextMarkdownService, RichTextSanitizerService] });
        service = TestBed.inject(RichTextMarkdownService);
        sanitizer = TestBed.inject(RichTextSanitizerService);
    });

    // =====================================================================
    // MARKDOWN -> HTML
    // =====================================================================
    describe('toHtml', () => {
        it('returns empty string for empty input', () => {
            expect(service.toHtml('')).toBe('');
        });

        it('normalizes CRLF line endings', () => {
            expect(service.toHtml('a\r\n\r\nb')).toBe('<p>a</p>\n<p>b</p>');
        });

        it('converts headings of every level', () => {
            expect(service.toHtml('# H1')).toBe('<h1>H1</h1>');
            expect(service.toHtml('### H3')).toBe('<h3>H3</h3>');
            expect(service.toHtml('###### H6')).toBe('<h6>H6</h6>');
        });

        it('converts bold with ** and __', () => {
            expect(service.toHtml('**bold**')).toBe('<p><strong>bold</strong></p>');
            expect(service.toHtml('__bold__')).toBe('<p><strong>bold</strong></p>');
        });

        it('converts italic with * and _', () => {
            expect(service.toHtml('*it*')).toBe('<p><em>it</em></p>');
            expect(service.toHtml('_it_')).toBe('<p><em>it</em></p>');
        });

        it('converts bold-italic with *** and ___', () => {
            expect(service.toHtml('***x***')).toBe('<p><strong><em>x</em></strong></p>');
            expect(service.toHtml('___x___')).toBe('<p><strong><em>x</em></strong></p>');
        });

        it('converts strikethrough', () => {
            expect(service.toHtml('~~gone~~')).toBe('<p><del>gone</del></p>');
        });

        it('converts inline code', () => {
            expect(service.toHtml('`code`')).toBe('<p><code>code</code></p>');
        });

        it('converts a link with safe url', () => {
            expect(service.toHtml('[txt](https://example.com)')).toBe(
                '<p><a href="https://example.com" rel="noopener noreferrer">txt</a></p>'
            );
        });

        it('drops unsafe link url but keeps text', () => {
            // The link regex stops at the first ")", leaving the "(1)" tail as text.
            expect(service.toHtml('[click](javascript:alert(1))')).toBe('<p>click)</p>');
        });

        it('converts an image with safe src', () => {
            expect(service.toHtml('![alt](https://example.com/i.png)')).toBe(
                '<p><img src="https://example.com/i.png" alt="alt"></p>'
            );
        });

        it('removes an image with unsafe src, leaving an empty paragraph', () => {
            // parseParagraphs wraps the line before parseImages strips the image.
            expect(service.toHtml('![alt](javascript:evil)')).toBe('<p></p>');
        });

        it('converts a fenced code block with language', () => {
            const md = '```js\nconst x = 1;\n```';
            expect(service.toHtml(md)).toBe(
                '<pre><code data-language="js" class="language-js">const x = 1;</code></pre>'
            );
        });

        it('converts a tilde-fenced code block without language', () => {
            const md = '~~~\nplain\n~~~';
            expect(service.toHtml(md)).toBe('<pre><code>plain</code></pre>');
        });

        it('escapes angle brackets and ampersands inside code blocks', () => {
            // Quotes are not re-escaped here because escapeHtmlInContent already ran.
            const md = '```\n<div> & "q"\n```';
            expect(service.toHtml(md)).toBe('<pre><code>&lt;div&gt; &amp; "q"</code></pre>');
        });

        it('converts a single unordered list item', () => {
            expect(service.toHtml('- a')).toBe('<ul><li>a</li></ul>');
        });

        it('emits a separate <ul> per consecutive top-level item (known quirk)', () => {
            // BUG: sibling items at the same indent each flush to their own list.
            expect(service.toHtml('- a\n- b')).toBe('<ul><li>a</li></ul>\n<ul><li>b</li></ul>');
        });

        it('converts a single ordered list item', () => {
            expect(service.toHtml('1. a')).toBe('<ol><li>a</li></ol>');
        });

        it('converts a nested list', () => {
            const md = '- a\n  - b';
            expect(service.toHtml(md)).toBe('<ul><li>a<ul><li>b</li></ul></li></ul>');
        });

        it('converts a single task-list item with checkbox markup', () => {
            // Output is normalized by the sanitizer (attributes serialized as ="").
            expect(service.toHtml('- [x] done')).toBe(
                '<ul data-task-list=""><li data-task="" data-checked="true">' +
                '<input type="checkbox" checked=""><span>done</span></li></ul>'
            );
        });

        it('reflects checkbox state for an unchecked task item', () => {
            expect(service.toHtml('- [ ] todo')).toBe(
                '<ul data-task-list=""><li data-task="" data-checked="false">' +
                '<input type="checkbox"><span>todo</span></li></ul>'
            );
        });

        it('converts a multi-line blockquote, joining lines with <br>', () => {
            // The "> " at the very start of the string is escaped to "&gt; " by
            // escapeHtmlInContent before parseBlockquotes runs, so only the
            // newline-preceded ">" lines are treated as a blockquote (known quirk).
            expect(service.toHtml('> line1\n> line2')).toBe(
                '<p>&gt; line1\n</p><blockquote>line2</blockquote><p></p>'
            );
        });

        it('converts horizontal rules', () => {
            expect(service.toHtml('---')).toBe('<hr>');
            expect(service.toHtml('***')).toBe('<hr>');
            expect(service.toHtml('___')).toBe('<hr>');
        });

        it('wraps plain text in a paragraph', () => {
            expect(service.toHtml('hello world')).toBe('<p>hello world</p>');
        });

        it('converts a toggle/details block', () => {
            const md = ':::details Title\nbody\n:::';
            // Surrounding empty paragraphs come from parseParagraphs splitting on blank lines.
            expect(service.toHtml(md)).toBe(
                '<p></p><details open=""><summary>Title</summary><p>body</p></details><p></p>'
            );
        });

        it('strips multiple spaces/tabs after :::details before the title (linear regex)', () => {
            const md = ':::details   Spaced Title\nbody\n:::';
            expect(service.toHtml(md)).toBe(
                '<p></p><details open=""><summary>Spaced Title</summary><p>body</p></details><p></p>'
            );
        });

        it('keeps an empty toggle title when no title text follows', () => {
            const md = ':::details \nbody\n:::';
            expect(service.toHtml(md)).toBe(
                '<p></p><details open=""><summary></summary><p>body</p></details><p></p>'
            );
        });

        it('collapses multiple spaces after heading hashes (linear regex)', () => {
            expect(service.toHtml('##   Spaced')).toBe('<h2>Spaced</h2>');
        });

        it('converts two trailing-space line break into <br>', () => {
            expect(service.toHtml('a  \nb')).toBe('<p>a<br>\nb</p>');
        });

        it('escapes stray angle brackets that are not markdown/html', () => {
            expect(service.toHtml('1 < 2')).toBe('<p>1 &lt; 2</p>');
        });
    });

    // =====================================================================
    // HTML -> MARKDOWN
    // =====================================================================
    describe('toMarkdown', () => {
        it('returns empty string for empty input', () => {
            expect(service.toMarkdown('')).toBe('');
        });

        it('converts headings', () => {
            expect(service.toMarkdown('<h1>Title</h1>')).toBe('# Title');
            expect(service.toMarkdown('<h4>Sub</h4>')).toBe('#### Sub');
        });

        it('converts strong/b to **', () => {
            expect(service.toMarkdown('<strong>x</strong>')).toBe('**x**');
            expect(service.toMarkdown('<b>x</b>')).toBe('**x**');
        });

        it('converts em/i to *', () => {
            expect(service.toMarkdown('<em>x</em>')).toBe('*x*');
            expect(service.toMarkdown('<i>x</i>')).toBe('*x*');
        });

        it('converts del/s to ~~', () => {
            expect(service.toMarkdown('<del>x</del>')).toBe('~~x~~');
            expect(service.toMarkdown('<s>x</s>')).toBe('~~x~~');
        });

        it('keeps underline as <u>', () => {
            expect(service.toMarkdown('<u>x</u>')).toBe('<u>x</u>');
        });

        it('converts inline code', () => {
            expect(service.toMarkdown('<code>x</code>')).toBe('`x`');
        });

        it('converts code inside pre without backticks', () => {
            expect(service.toMarkdown('<pre><code>line</code></pre>')).toBe('```\nline\n```');
        });

        it('converts pre with language data attribute', () => {
            const html = '<pre><code data-language="ts">const a=1;</code></pre>';
            expect(service.toMarkdown(html)).toBe('```ts\nconst a=1;\n```');
        });

        it('converts anchors to link syntax', () => {
            const html = '<a href="https://x.com">link</a>';
            expect(service.toMarkdown(html)).toBe('[link](https://x.com)');
        });

        it('converts images', () => {
            const html = '<img src="https://x.com/a.png" alt="pic">';
            expect(service.toMarkdown(html)).toBe('![pic](https://x.com/a.png)');
        });

        it('converts mention span to @name', () => {
            const html = '<span data-mention="bob">Bob</span>';
            expect(service.toMarkdown(html)).toBe('@bob');
        });

        it('converts tag span to #name', () => {
            const html = '<span data-tag="news">News</span>';
            expect(service.toMarkdown(html)).toBe('#news');
        });

        it('returns inner text for plain span', () => {
            expect(service.toMarkdown('<span>plain</span>')).toBe('plain');
        });

        it('converts an unordered list (li content wrapped in inline elements)', () => {
            const html = '<ul><li><span>a</span></li><li><span>b</span></li></ul>';
            expect(service.toMarkdown(html)).toBe('- a\n- b');
        });

        it('loses bare text-node li content (known bug)', () => {
            // BUG: nodeToMarkdown is called on the li's text node itself, which has
            // no child nodes, so the text is dropped. Wrapped content (above) works.
            expect(service.toMarkdown('<ul><li>a</li><li>b</li></ul>')).toBe('- \n-');
        });

        it('converts an ordered list with numbering', () => {
            const html = '<ol><li><span>a</span></li><li><span>b</span></li></ol>';
            expect(service.toMarkdown(html)).toBe('1. a\n2. b');
        });

        it('converts a task list with checkbox state', () => {
            const html =
                '<ul data-task-list>' +
                '<li data-checked="true"><input type="checkbox"><span>done</span></li>' +
                '<li data-checked="false"><input type="checkbox"><span>todo</span></li>' +
                '</ul>';
            expect(service.toMarkdown(html)).toBe('- [x] done\n- [ ] todo');
        });

        it('converts a nested list with indentation', () => {
            const html = '<ul><li><span>a</span><ul><li><span>b</span></li></ul></li></ul>';
            expect(service.toMarkdown(html)).toBe('- a\n  - b');
        });

        it('converts a nested ordered list', () => {
            const html = '<ul><li><span>a</span><ol><li><span>b</span></li></ol></li></ul>';
            expect(service.toMarkdown(html)).toBe('- a\n  1. b');
        });

        it('converts a nested task list detected via data-task-list', () => {
            const html = '<ul data-task-list><li><span>a</span>'
                + '<ul data-task-list><li data-checked="true"><span>b</span></li></ul></li></ul>';
            expect(service.toMarkdown(html)).toBe('- [ ] a\n  - [x] b');
        });

        it('converts a blockquote prefixing each line with >', () => {
            // <br> becomes a "  \n" (trailing double-space) line break in markdown.
            const html = '<blockquote>line1<br>line2</blockquote>';
            expect(service.toMarkdown(html)).toBe('> line1  \n> line2');
        });

        it('converts a details block to :::details', () => {
            const html = '<details><summary>More</summary><p>hidden</p></details>';
            expect(service.toMarkdown(html)).toBe(':::details More\nhidden\n:::');
        });

        it('uses default summary when details has no summary', () => {
            const html = '<details><p>hidden</p></details>';
            expect(service.toMarkdown(html)).toBe(':::details Toggle\nhidden\n:::');
        });

        it('converts hr to ---', () => {
            expect(service.toMarkdown('<p>a</p><hr><p>b</p>')).toBe('a\n\n---\n\nb');
        });

        it('converts br to a trailing double space line break', () => {
            expect(service.toMarkdown('x<br>y')).toBe('x  \ny');
        });

        it('converts a table with header separator', () => {
            const html =
                '<table><tr><th>H1</th><th>H2</th></tr>' +
                '<tr><td>a</td><td>b</td></tr></table>';
            expect(service.toMarkdown(html)).toBe(
                '| H1 | H2 |\n| --- | --- |\n| a | b |'
            );
        });

        it('escapes pipe characters in table cells', () => {
            const html = '<table><tr><td>a|b</td></tr></table>';
            expect(service.toMarkdown(html)).toBe(String.raw`| a\|b |`);
        });

        it('returns empty for a table with no rows', () => {
            expect(service.toMarkdown('<table></table>')).toBe('');
        });
    });

    // =====================================================================
    // ROUND TRIPS
    // =====================================================================
    describe('round trips', () => {
        it('preserves bold through html -> markdown', () => {
            const html = service.toHtml('**hi**');
            expect(service.toMarkdown(html)).toBe('**hi**');
        });

        it('preserves a heading round trip', () => {
            const html = service.toHtml('## Section');
            expect(service.toMarkdown(html)).toBe('## Section');
        });

        it('preserves a link round trip', () => {
            const html = service.toHtml('[a](https://x.com)');
            expect(service.toMarkdown(html)).toBe('[a](https://x.com)');
        });

        it('preserves a strikethrough round trip', () => {
            const html = service.toHtml('~~bye~~');
            expect(service.toMarkdown(html)).toBe('~~bye~~');
        });
    });

    // =====================================================================
    // UTILITY METHODS
    // =====================================================================
    describe('hasMarkdownSyntax', () => {
        it('detects headings, bold, lists, code, links', () => {
            expect(service.hasMarkdownSyntax('# Title')).toBe(true);
            expect(service.hasMarkdownSyntax('**bold**')).toBe(true);
            expect(service.hasMarkdownSyntax('- item')).toBe(true);
            expect(service.hasMarkdownSyntax('1. item')).toBe(true);
            expect(service.hasMarkdownSyntax('> quote')).toBe(true);
            expect(service.hasMarkdownSyntax('```')).toBe(true);
            expect(service.hasMarkdownSyntax('`code`')).toBe(true);
            expect(service.hasMarkdownSyntax('[a](b)')).toBe(true);
        });

        it('returns false for plain text', () => {
            expect(service.hasMarkdownSyntax('just words here')).toBe(false);
        });
    });

    describe('applyFormat', () => {
        it('wraps selection in bold markers', () => {
            const r = service.applyFormat('hello world', 0, 5, 'bold');
            expect(r.text).toBe('**hello** world');
            expect(r.selectionStart).toBe(2);
            expect(r.selectionEnd).toBe(7);
        });

        it('wraps selection in code markers', () => {
            const r = service.applyFormat('abc', 0, 3, 'code');
            expect(r.text).toBe('`abc`');
        });

        it('removes formatting when selection already wrapped', () => {
            const r = service.applyFormat('**bold**', 0, 8, 'bold');
            expect(r.text).toBe('bold');
            expect(r.selectionEnd).toBe(4);
        });

        it('removes formatting from surrounding markers', () => {
            const r = service.applyFormat('**bold**', 2, 6, 'bold');
            expect(r.text).toBe('bold');
            expect(r.selectionStart).toBe(0);
            expect(r.selectionEnd).toBe(4);
        });

        it('applies italic with single marker', () => {
            const r = service.applyFormat('x', 0, 1, 'italic');
            expect(r.text).toBe('*x*');
        });

        it('applies strikethrough', () => {
            const r = service.applyFormat('x', 0, 1, 'strikethrough');
            expect(r.text).toBe('~~x~~');
        });
    });

    describe('insertLink', () => {
        it('inserts a markdown link at position', () => {
            const r = service.insertLink('go ', 3, 'home', 'https://x.com');
            expect(r.text).toBe('go [home](https://x.com)');
            expect(r.position).toBe(3 + '[home](https://x.com)'.length);
        });

        it('does nothing when url is unsafe', () => {
            const r = service.insertLink('go ', 3, 'home', 'javascript:alert(1)');
            expect(r.text).toBe('go ');
            expect(r.position).toBe(3);
        });
    });

    describe('insertImage', () => {
        it('inserts a markdown image at position', () => {
            const r = service.insertImage('', 0, 'pic', 'https://x.com/a.png');
            expect(r.text).toBe('![pic](https://x.com/a.png)');
            expect(r.position).toBe('![pic](https://x.com/a.png)'.length);
        });

        it('does nothing when src is unsafe', () => {
            const r = service.insertImage('x', 1, 'pic', 'javascript:evil');
            expect(r.text).toBe('x');
            expect(r.position).toBe(1);
        });
    });

    describe('insertHeading', () => {
        it('adds heading markers at line start', () => {
            expect(service.insertHeading('text', 0, 2)).toBe('## text');
        });

        it('replaces an existing heading marker', () => {
            expect(service.insertHeading('# text', 0, 3)).toBe('### text');
        });

        it('inserts at a non-zero line start', () => {
            expect(service.insertHeading('a\nb', 2, 1)).toBe('a\n# b');
        });
    });

    describe('insertCodeBlock', () => {
        it('inserts a fenced code block with language', () => {
            const r = service.insertCodeBlock('', 0, 'ts');
            expect(r.text).toBe('\n```ts\n\n```\n');
            expect(r.position).toBe(0 + 4 + 'ts'.length + 1);
        });

        it('inserts a fenced code block without language', () => {
            const r = service.insertCodeBlock('', 0);
            expect(r.text).toBe('\n```\n\n```\n');
            expect(r.position).toBe(5);
        });
    });

    describe('span-serializer extension', () => {
        const actionSerializer = {
            serialize(el: HTMLElement, inner: string): string | null {
                const hasAction = Object.keys(el.dataset).some((k) => k.startsWith('action'));
                if (!hasAction) return null;
                const clone = el.cloneNode(false) as HTMLElement;
                clone.innerHTML = inner;
                return clone.outerHTML;
            },
        };

        it('serializes an action span as inline HTML with inner markdown preserved', () => {
            const offSpan = service.registerSpanSerializer(actionSerializer);
            const offRules = sanitizer.registerAttributeRules([
                { tag: '*', attr: 'data-action-click', validate: (v) => v },
            ]);
            const html = '<p>hi <span data-action-click="a"><strong>bold</strong></span></p>';
            const md = service.toMarkdown(html);
            expect(md).toContain('data-action-click="a"');
            expect(md).toContain('**bold**');
            offRules();
            offSpan();
        });

        it('leaves mention/tag spans to the built-in handler (regression)', () => {
            const off = service.registerSpanSerializer(actionSerializer);
            expect(service.toMarkdown('<p><span data-mention="alice">Alice</span></p>'))
                .toContain('@alice');
            off();
        });

        it('round-trips html->md->html losslessly for an action span', () => {
            const offSpan = service.registerSpanSerializer(actionSerializer);
            const offRules = sanitizer.registerAttributeRules([
                { tag: '*', attr: 'data-action-click', validate: (v) => v },
                {
                    tag: '*', attr: 'data-action-click-params', requiresAttr: 'data-action-click',
                    validate: (v) => v,
                },
            ]);
            const html = '<p><span data-action-click="a" data-action-click-params=\'{"x":1}\'>word</span></p>';
            const md = service.toMarkdown(html);
            const back = service.toHtml(md);
            expect(back).toContain('data-action-click="a"');
            expect(back).toContain('data-action-click-params');
            expect(back).toContain('word');
            offRules();
            offSpan();
        });

        it('keeps inner markdown semantics inside an actioned span through toHtml', () => {
            const offSpan = service.registerSpanSerializer(actionSerializer);
            const offRules = sanitizer.registerAttributeRules([
                { tag: '*', attr: 'data-action-click', validate: (v) => v },
            ]);
            const html = '<p><span data-action-click="a"><strong>bold</strong></span></p>';
            const back = service.toHtml(service.toMarkdown(html));
            expect(back).toContain('<strong>bold</strong>');
            expect(back).toContain('data-action-click="a"');
            offRules();
            offSpan();
        });
    });

    // =====================================================================
    // COVERAGE EDGE CASES
    // =====================================================================
    describe('coverage edge cases', () => {
        it('closes a mid-text blockquote when a non-quote line follows', () => {
            // A ">" preceded by a newline survives escapeHtmlInContent, so the
            // middle line becomes a blockquote and the following plain line
            // triggers the "flush blockquote then push line" branch.
            const html = service.toHtml('para\n> quoted\nafter');
            expect(html).toContain('<blockquote>quoted</blockquote>');
            expect(html).toContain('after');
        });

        it('skips a whitespace-only paragraph block', () => {
            // The " " block between the double newlines trims to empty and is
            // dropped by parseParagraphs.
            const html = service.toHtml('a\n\n \n\nb');
            expect(html).toContain('<p>a</p>');
            expect(html).toContain('<p>b</p>');
        });
    });
});
