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
            // The dangerous scheme is rejected and the text kept. The stray ")"
            // that used to trail it came from the link regex stopping at the first
            // ")"; balanced parens are matched now, so nothing is left behind.
            expect(service.toHtml('[click](javascript:alert(1))')).toBe('<p>click</p>');
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

        it('merges consecutive top-level items into one list', () => {
            // Was locked in as a "known quirk": sibling items each flushed to
            // their own list, so an ordered list renumbered from 1 on every row.
            expect(service.toHtml('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
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
            // Was locked in as a "known quirk": the leading ">" was escaped
            // before the blockquote pass ran, so the first line rendered as
            // literal text and the test asserted that as correct — while its own
            // title said it joined the lines. It does now.
            expect(service.toHtml('> line1\n> line2'))
                .toBe('<blockquote>line1<br>line2</blockquote>');
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
    describe('blockquote at the very start of a document', () => {
        it('quotes a single opening line', () => {
            // The lookbehind deciding whether a bare '>' is markup has no
            // character to test at index 0, so it escaped the '>' before the
            // blockquote pass ran. A note that opens with a quote — the most
            // common way to open one — lost the blockquote entirely.
            expect(service.toHtml('> only line')).toContain('<blockquote>');
        });

        it('quotes both lines of an opening multi-line quote', () => {
            const html = service.toHtml('> line1\n> line2');
            expect(html).not.toContain('&gt; line1');
            expect(html).toContain('line1');
            expect(html).toContain('line2');
        });

        it('still escapes a greater-than that is not markup', () => {
            expect(service.toHtml('a > b')).toBe('<p>a &gt; b</p>');
            expect(service.toHtml('5 > 3 is true')).toContain('&gt;');
        });
    });

    describe('tables', () => {
        it('parses a GFM table back into a real table', () => {
            // toMarkdown emits GFM tables but toHtml had no pass to read them
            // back, so saving and reloading in markdown mode — the documented
            // default — turned every table into inert paragraph text.
            const html = service.toHtml('| Name | Age |\n| --- | --- |\n| Alice | 30 |');
            const parsed = new DOMParser().parseFromString(html, 'text/html');

            expect(parsed.querySelectorAll('table')).toHaveLength(1);
            expect(parsed.querySelectorAll('th')).toHaveLength(2);
            expect(parsed.querySelectorAll('tbody td')).toHaveLength(2);
            expect(parsed.querySelector('th')?.textContent).toBe('Name');
            expect(parsed.querySelector('tbody td')?.textContent).toBe('Alice');
        });

        it('round-trips a table through markdown and back', () => {
            const original = '| Name | Age |\n| --- | --- |\n| Alice | 30 |';
            expect(service.toMarkdown(service.toHtml(original)).trim()).toBe(original);
        });

        it('leaves a lone pipe line as ordinary text', () => {
            const html = service.toHtml('not | a table');
            expect(html).not.toContain('<table');
        });
    });

    describe('content that must survive a round trip', () => {
        it('keeps bare text inside a details block', () => {
            // Third instance of the same root cause the lists had: a NODE handed
            // to nodeToMarkdown, which walks that node's own children — nothing
            // for a bare text node. Reachable from pasted or programmatic HTML.
            expect(service.toMarkdown('<details><summary>Title</summary>bare body</details>'))
                .toContain('bare body');
        });

        it('separates block children inside a details block', () => {
            const md = service.toMarkdown(
                '<details><summary>T</summary><p>one</p><p>two</p></details>',
            );
            expect(md).not.toContain('onetwo');
        });

        it('does not rewrite markdown characters inside a link URL', () => {
            // parseLinks runs before the emphasis passes, which then regex over
            // the whole string INCLUDING href values — so a '*' in a query
            // string became <em> and the link pointed somewhere else entirely.
            const html = service.toHtml('[text](https://x.com/?a=*b*)');
            const parsed = new DOMParser().parseFromString(html, 'text/html');

            expect(parsed.querySelector('a')?.getAttribute('href'))
                .toBe('https://x.com/?a=*b*');
        });

        it('keeps parentheses inside a link URL', () => {
            // Wikipedia-style URLs are not adversarial input.
            const html = service.toHtml('[Rabbit](https://en.wikipedia.org/wiki/Rabbit_(zodiac))');
            const parsed = new DOMParser().parseFromString(html, 'text/html');

            expect(parsed.querySelector('a')?.getAttribute('href'))
                .toBe('https://en.wikipedia.org/wiki/Rabbit_(zodiac)');
            expect(parsed.body.textContent).not.toContain(')');
        });
    });

    describe('list round-trips', () => {
        it('keeps list item text when serializing to markdown', () => {
            // extractListItemContent handed each of an <li>'s child NODES to
            // nodeToMarkdown, which iterates that node's OWN children — right for
            // an element, empty for the bare text node a plain <li> holds. So a
            // saved document lost every bullet's text while the HTML looked fine.
            expect(service.toMarkdown('<ul><li>alpha</li><li>beta</li></ul>'))
                .toBe('- alpha\n- beta');
        });

        it('keeps numbered list item text too', () => {
            expect(service.toMarkdown('<ol><li>first</li><li>second</li></ol>'))
                .toBe('1. first\n2. second');
        });

        it('merges adjacent markdown list lines into one list', () => {
            // Each line became its own single-item list, so an ordered list
            // restarted at "1." on every row and a screen reader announced
            // "list, 1 item" repeatedly.
            const html = service.toHtml('1. first\n2. second\n3. third');
            const parsed = new DOMParser().parseFromString(html, 'text/html');

            expect(parsed.querySelectorAll('ol')).toHaveLength(1);
            expect(parsed.querySelectorAll('li')).toHaveLength(3);
        });

        it('merges adjacent bullets into one list', () => {
            const html = service.toHtml('- one\n- two');
            const parsed = new DOMParser().parseFromString(html, 'text/html');

            expect(parsed.querySelectorAll('ul')).toHaveLength(1);
            expect(parsed.querySelectorAll('li')).toHaveLength(2);
        });
    });

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

        it('keeps bare text-node li content', () => {
            // Was locked in as a "known bug": the cause was understood and
            // written down, and the broken output asserted as correct rather than
            // fixed — so every save from markdown mode dropped plain bullet text.
            expect(service.toMarkdown('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b');
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
            // The separator row is part of the contract, not noise: without it
            // parseTables refuses the text and the table comes back as a
            // paragraph of pipes. This test used to assert the separator-less
            // output, locking in that data loss.
            expect(service.toMarkdown(html)).toBe('| a' + String.raw`\|` + 'b |\n| --- |');
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

    describe('round-trip fidelity (regressions found by the round-15 audit)', () => {
        it('keeps <u> intact across repeated markdown round-trips', () => {
            // The corruption compounded: each save/load cycle appended another
            // visible "</u>", because the escape pass let "<u" through (u is \w)
            // but escaped "</u" (/ is not). Markdown is the default mode and
            // underline is a default toolbar button, so this ate user data on
            // every persist.
            let html = service.toHtml('<u>hello</u>');
            expect(html).toBe('<p><u>hello</u></p>');
            for (let i = 0; i < 3; i++) {
                html = service.toHtml(service.toMarkdown(html));
                expect(html).toBe('<p><u>hello</u></p>');
            }
        });

        it('does not double-escape a closing tag inside a fenced code block', () => {
            const md = '```\nif (a < b) { return "</div>"; }\n```';
            expect(service.toHtml(md)).toBe(
                '<pre><code>if (a &lt; b) { return "&lt;/div&gt;"; }</code></pre>',
            );
        });

        it('treats fenced code as inert text, not live markup', () => {
            // protectRawTags used to lift <span> out of the source before the
            // fence body was escaped and put it back afterwards, so markup
            // hidden in a code fence became a real element. With data-mention
            // that forges an identity claim in any app that trusts it.
            const md = '```\n<span data-mention data-mention-id="admin">@admin</span>\n```';
            const html = service.toHtml(md);
            expect(html).toContain('&lt;span');
            // The escaped text legitimately contains the attribute spelling, so
            // assert on the parsed DOM: what matters is that no live element
            // carries the identity claim.
            const probe = document.createElement('div');
            probe.innerHTML = html;
            expect(probe.querySelector('[data-mention-id]')).toBeNull();
            expect(probe.querySelector('pre code')?.textContent).toBe(
                '<span data-mention data-mention-id="admin">@admin</span>',
            );
        });
    });

    describe('table round-trip (round-15 audit)', () => {
        it('survives a table that has no header row', () => {
            // tableToMarkdown only emitted the separator when a row contained a
            // <th>. Without it parseTables refuses to parse the text back, so a
            // headerless table came home as a paragraph of literal pipes.
            const html = '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>';
            const md = service.toMarkdown(html);
            const back = service.toHtml(md);
            expect(back).toContain('<table');
            expect(back).not.toContain('| a |');
        });

        it('keeps a colspan table as a table rather than literal pipe text', () => {
            const html = '<table><tbody><tr><td colspan="2">wide</td></tr><tr><td>a</td><td>b</td></tr></tbody></table>';
            const back = service.toHtml(service.toMarkdown(html));
            expect(back).toContain('<table');
            expect(back).not.toContain('| wide |');
        });

        it('keeps an escaped pipe inside one cell', () => {
            // The escape branch compared a character against the two-character
            // string '\\', so it never fired: "x\|y" split into two cells and
            // left the backslash visible, giving a 3-column body row under a
            // 2-column header.
            const md = '| a | b |\n| --- | --- |\n| x' + String.raw`\|` + 'y | z |';
            const html = service.toHtml(md);
            const probe = document.createElement('div');
            probe.innerHTML = html;
            const cells = Array.from(probe.querySelectorAll('tbody td')).map((c) => c.textContent);
            expect(cells).toEqual(['x|y', 'z']);
        });

        it('round-trips a cell containing a pipe', () => {
            const html = '<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>x|y</td></tr></tbody></table>';
            const back = service.toHtml(service.toMarkdown(html));
            const probe = document.createElement('div');
            probe.innerHTML = back;
            expect(probe.querySelector('tbody td')?.textContent).toBe('x|y');
        });
    });




    describe('angle brackets in prose (round-16 audit)', () => {
        it('keeps text after a "<" that is not a real tag', () => {
            // "<y" satisfied the "looks like a tag" lookahead (y matches \w), so
            // DOMParser treated it as an unterminated tag and swallowed the rest
            // of the line. Anyone writing about code lost their sentence, in the
            // documented default mode, with nothing in the console.
            expect(service.toHtml('if (x<y) { return; }')).toBe('<p>if (x&lt;y) { return; }</p>');
        });

        it('keeps a whole sentence mixing comparisons', () => {
            expect(service.toHtml('2 < 3 and 4 <5 and x <y z')).toBe(
                '<p>2 &lt; 3 and 4 &lt;5 and x &lt;y z</p>',
            );
        });

        it('escapes a tag the sanitizer would strip rather than eating the line', () => {
            // <foo> is not an allowed tag, so it is prose. What matters is that
            // the rest of the sentence survives -- it used to be swallowed.
            const html = service.toHtml('Use the <foo bar=1> syntax carefully.');
            expect(html).toContain('&lt;foo bar=1&gt;');
            expect(html).toContain('syntax carefully.');
        });

        it('round-trips any inline tag the sanitizer keeps, not a hand-picked few', () => {
            // The passthrough list covered u|sub|sup|mark|kbd|ins|del only, so
            // every other kept tag hit the asymmetric-escape bug: "<b>x</b>"
            // rendered a literal "</b>" on the page and corrupted permanently
            // on round-trip.
            for (const tag of ['b', 'strong', 'em', 'i', 'code', 'small', 's']) {
                const html = service.toHtml(`<${tag}>x</${tag}>`);
                expect(html).toBe(`<p><${tag}>x</${tag}></p>`);
            }
        });

        it('keeps bold stable across a markdown round-trip', () => {
            expect(service.toMarkdown(service.toHtml('<b>bold</b>'))).toBe('**bold**');
        });

        it('escapes a closing tag the sanitizer would strip', () => {
            // Allowed tags stay markup on purpose -- HTML in markdown is a
            // supported input. An unknown one is text.
            expect(service.toHtml('the </foo> marker')).toContain('&lt;/foo&gt;');
        });
    });

    describe('code-fence token forgery (round-16 audit)', () => {
        it('ignores fence delimiters the author typed', () => {
            const OPEN = String.fromCodePoint(0xe110);
            const CLOSE = String.fromCodePoint(0xe111);
            const html = service.toHtml('```\nSECRET\n```\n\n' + OPEN + '0' + CLOSE);
            expect(html.match(/SECRET/g) ?? []).toHaveLength(1);
        });

        it('does not let a forged token erase surrounding text', () => {
            const OPEN = String.fromCodePoint(0xe110);
            const CLOSE = String.fromCodePoint(0xe111);
            const html = service.toHtml('before ' + OPEN + '99' + CLOSE + ' after');
            expect(html).toContain('before');
            expect(html).toContain('after');
        });
    });
});
