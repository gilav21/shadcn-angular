import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextMarkdownService } from './index';
import { RichTextSanitizerService } from './index';

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

        it('converts a multi-line blockquote into one <p> line per quoted line', () => {
            // Was locked in as a "known quirk": the leading ">" was escaped
            // before the blockquote pass ran, so the first line rendered as
            // literal text and the test asserted that as correct — while its own
            // title said it joined the lines.
            //
            // The lines are `<p>` blocks, not bare text joined with `<br>`: the
            // editor leaves a quote from a blank LINE block, and the bare shape
            // gave it no line to leave from, so a quote loaded from markdown
            // could not be escaped with Enter.
            expect(service.toHtml('> line1\n> line2'))
                .toBe('<blockquote><p>line1</p><p>line2</p></blockquote>');
        });

        it('round-trips a multi-line quote as a fixed point', () => {
            // Two lines of a quote are two paragraphs in the editor, written with a
            // blank quote line between them, as markdown keeps paragraphs apart:
            // without it a markdown reader takes them as one. The first save
            // writes that form, and the next one keeps it.
            const md = '> line1\n> line2';
            const once = service.toMarkdown(service.toHtml(md));
            expect(once).toBe('> line1\n>\n> line2');
            expect(service.toMarkdown(service.toHtml(once))).toBe(once);
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
            // The stray leading/trailing <p></p> these used to assert came from
            // parseParagraphs not knowing <details> is a block. It is markup
            // the reader sees, so asserting it locked in the defect.
            const md = ':::details Title\nbody\n:::';
            expect(service.toHtml(md)).toBe(
                '<details open=""><summary>Title</summary><p>body</p></details>'
            );
        });

        it('strips multiple spaces/tabs after :::details before the title (linear regex)', () => {
            const md = ':::details   Spaced Title\nbody\n:::';
            expect(service.toHtml(md)).toBe(
                '<details open=""><summary>Spaced Title</summary><p>body</p></details>'
            );
        });

        it('keeps an empty toggle title when no title text follows', () => {
            const md = ':::details \nbody\n:::';
            expect(service.toHtml(md)).toBe(
                '<details open=""><summary></summary><p>body</p></details>'
            );
        });

        it('collapses multiple spaces after heading hashes (linear regex)', () => {
            expect(service.toHtml('##   Spaced')).toBe('<h2>Spaced</h2>');
        });

        it('converts two trailing-space line break into <br>', () => {
            // No newline after the <br>. Keeping one made toMarkdown emit a
            // BLANK line -- a paragraph break -- so the hard break did not
            // survive a second save. The newline was only cosmetic in the HTML;
            // the round trip is the contract.
            expect(service.toHtml('a  \nb')).toBe('<p>a<br>b</p>');
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
            // No trailing spaces. This asserted "> line1  " -- two trailing
            // spaces, i.e. a HARD break -- because parseBlockquotes joins a
            // quote's soft lines with <br> and this is the reverse of that join.
            // Emitting the hard-break form meant every multi-line quote stopped
            // being a round-trip fixed point. Each line is its own paragraph,
            // separated by a blank quote line: without it, beside a list or a
            // heading in the same quote, two paragraphs read back as one.
            const html = '<blockquote><p>line1</p><p>line2</p></blockquote>';
            expect(service.toMarkdown(html)).toBe('> line1\n>\n> line2');
            // The bare shape older documents carry: a break on a quote line ends it.
            expect(service.toMarkdown('<blockquote>line1<br>line2</blockquote>')).toBe('> line1\n>\n> line2');
        });

        it('converts a details block to :::details', () => {
            const html = '<details><summary>More</summary><p>hidden</p></details>';
            expect(service.toMarkdown(html)).toBe(':::details More\nhidden\n:::');
        });

        it('uses default summary when details has no summary', () => {
            const html = '<details><p>hidden</p></details>';
            // No title rather than an invented one: "Toggle" was a word the author
            // never wrote, and it came back as the summary's text.
            expect(service.toMarkdown(html)).toBe(':::details\nhidden\n:::');
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
            expect(html).toContain('<blockquote><p>quoted</p></blockquote>');
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

    describe('toggle blocks (round-16 audit)', () => {
        it('keeps the body out of the summary', () => {
            const md = ':::details Title\nbody text\n:::';
            const html = service.toHtml(md);
            const probe = document.createElement('div');
            probe.innerHTML = html;
            const summary = probe.querySelector('summary');
            expect(summary?.textContent?.trim()).toBe('Title');
            expect(summary?.querySelector('p')).toBeNull();
            expect(probe.querySelector('details > p')?.textContent).toContain('body text');
        });

        it('keeps the body out of the summary when the title holds markup', () => {
            const md = ':::details ![x](https://e.com/a.png)\nbody text\n:::';
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);
            expect(probe.querySelector('summary p')).toBeNull();
            expect(probe.querySelector('details > p')?.textContent).toContain('body text');
        });

        it('does not wrap a details block in stray empty paragraphs', () => {
            const html = service.toHtml(':::details T\nbody\n:::');
            expect(html).not.toContain('<p></p>');
        });
    });

    describe('table cell content (round-16 audit)', () => {
        it('does not put a raw newline inside a table row', () => {
            // A <br> inside a cell emitted a literal newline, which splits the
            // row: a one-row table came back as a TWO-row table on reload.
            const html = '<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>line1<br>line2</td></tr></tbody></table>';
            const md = service.toMarkdown(html);
            const rows = md.split('\n').filter((l) => l.trim().startsWith('|'));
            expect(rows).toHaveLength(3);

            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);
            expect(probe.querySelectorAll('tbody tr')).toHaveLength(1);
        });

        it('sizes the separator so header and body agree, padding never cutting', () => {
            // This asserted the HEADER's width, which is what made truncation
            // look necessary -- and truncation deleted the extra cells. GFM only
            // requires header and separator to agree; the honest way to reach
            // that with a wider body row is to widen, since padding is lossless
            // and cutting is not.
            const html = '<table><thead><tr><th>a</th><th>b</th></tr></thead>'
                + '<tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>';
            const md = service.toMarkdown(html);
            const rows = md.split('\n').filter((l) => l.trim().startsWith('|'));
            const counts = rows.map((l) => l.split('|').slice(1, -1).length);
            expect(new Set(counts).size).toBe(1);
            expect(md).toContain('3');
        });
    });

    describe('prose that mentions tag names (round-17 audit)', () => {
        it('keeps a sentence about HTML readable', () => {
            // The allowlist rule passed ANY allowed tag through verbatim, so a
            // sentence naming <table>/<tr>/<td> became a real table: the words
            // vanished and the paragraph nested inside a cell.
            const html = service.toHtml('The <table> element has <tr> and <td> children.');
            expect(html).toContain('element has');
            expect(html).toContain('children.');
            const probe = document.createElement('div');
            probe.innerHTML = html;
            expect(probe.querySelector('table')).toBeNull();
        });

        it('keeps a genuinely unpaired block tag as text', () => {
            // The previous version of this test named an UNPAIRED tag but used
            // "<p>hello</p>", which is paired -- and asserted only a trailing
            // substring, so it passed whether the tag became markup or stayed
            // text. It could not fail for the reason it existed, and that is why
            // the cross-block pairing bug below shipped.
            const html = service.toHtml('To make a paragraph, type <p> in the editor.');
            expect(html).toContain('&lt;p&gt;');
            expect(html).toContain('in the editor.');
        });

        it('does not pair tag halves that sit in unrelated blocks', () => {
            // A lone stray closing tag is unpaired in BOTH blocks, so this
            // passes under a whole-document union too. Kept as a boundary case,
            // with the realistic shape covered by the test below.
            const html = service.toHtml('Use the <table> element.\n\nUnrelated later: </table>');
            const probe = document.createElement('div');
            probe.innerHTML = html;
            expect(probe.querySelector('table')).toBeNull();
        });

        it('keeps a prose mention as text when the SAME tag is paired elsewhere', () => {
            // The realistic shape, and the one that was still broken: pairing was
            // computed per block and then unioned into one document-wide set, so
            // a genuine <b>bold</b> anywhere re-promoted every prose mention of
            // <b> to markup and the words were silently deleted.
            const html = service.toHtml(
                'To make text bold, wrap it in <b> tags.\n\nLike this: <b>bold</b>',
            );
            const probe = document.createElement('div');
            probe.innerHTML = html;
            expect(probe.textContent).toContain('wrap it in <b> tags.');
            expect(probe.querySelector('b')?.textContent).toBe('bold');
        });

        it('does not fabricate content across repeated round-trips of such a document', () => {
            const source = 'To make text bold, wrap it in <b> tags.\n\nLike this: <b>bold</b>';
            let md = service.toMarkdown(service.toHtml(source));
            const first = md;
            for (let i = 0; i < 4; i++) {
                md = service.toMarkdown(service.toHtml(md));
            }
            expect(md).toBe(first);
            expect(md).not.toContain('---');
        });

        it('still renders a genuinely paired inline tag', () => {
            expect(service.toHtml('<b>bold</b>')).toBe('<p><b>bold</b></p>');
        });

        it('still renders paired block markup written as HTML', () => {
            expect(service.toHtml('<p>Hello <b>World</b></p>')).toBe('<p>Hello <b>World</b></p>');
        });
    });

    describe('fences inside other blocks (round-17 audit)', () => {
        it('does not bake quote markers into a fence body', () => {
            // Fences are lifted out before blockquote parsing, so the "> "
            // markers ended up INSIDE the code, and each round-trip added
            // another level -- the compounding corruption the lift was meant
            // to stop, reintroduced for the quoted case.
            const md = '> Note:\n> ```\n> code line\n> ```\n> Done.';
            const html = service.toHtml(md);
            const probe = document.createElement('div');
            probe.innerHTML = html;
            const code = probe.querySelector('pre code');
            expect(code?.textContent).toBe('code line');
        });

        it('keeps a quoted fence stable across a round-trip', () => {
            const md = '> ```\n> code line\n> ```';
            const once = service.toMarkdown(service.toHtml(md));
            const twice = service.toMarkdown(service.toHtml(once));
            expect(twice).toBe(once);
        });

        it('keeps an indented fence inside its list item', () => {
            // The fence used to land OUTSIDE the list, splitting it in two. The
            // parked token is now carried by the item it is indented under.
            const md = '- step one\n  ```\n  npm install\n  ```\n- step two';
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);
            expect(probe.querySelectorAll('ul')).toHaveLength(1);
            expect(probe.querySelectorAll('li')).toHaveLength(2);
            expect(probe.querySelector('li pre code')?.textContent).toBe('npm install');
        });
    });

    describe('colspan in a header row (round-17 audit)', () => {
        it('emits a header and separator that agree on width', () => {
            // A 1-cell header over a 2-dash separator is invalid GFM, and the
            // second round-trip narrowed the separator too, so the table
            // degraded a little more each cycle.
            const html = '<table><thead><tr><th colspan="2">wide</th></tr></thead>'
                + '<tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
            const md = service.toMarkdown(html);
            const rows = md.split('\n');
            // Count the delimited slots, not the non-empty ones -- a padded
            // cell is legitimately blank.
            const cellCount = (row: string): number => row.split('|').slice(1, -1).length;
            expect(cellCount(rows[0])).toBe(cellCount(rows[1]));
        });

        it('stops degrading after the first round-trip', () => {
            const html = '<table><thead><tr><th colspan="2">wide</th></tr></thead>'
                + '<tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
            const once = service.toMarkdown(service.toHtml(service.toMarkdown(html)));
            const twice = service.toMarkdown(service.toHtml(once));
            expect(twice).toBe(once);
        });
    });

    describe('nested list inside a blockquote (round-18 audit)', () => {
        it('keeps a quoted nested list as a list', () => {
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml('> - a\n>   - b');
            expect(probe.querySelector('blockquote ul')).toBeTruthy();
        });

        it('does not grow on every round-trip', () => {
            // The document gained two characters of trailing whitespace per
            // save/load, forever -- the compounding class this series keeps
            // turning up.
            let md = '> - a\n>   - b';
            const first = service.toMarkdown(service.toHtml(md));
            md = first;
            for (let i = 0; i < 5; i++) {
                md = service.toMarkdown(service.toHtml(md));
            }
            expect(md).toBe(first);
        });
    });

    describe('round-trip fixed points (round-19 audit)', () => {
        it('keeps an indented fence in its item across TWO passes', () => {
            // The single-pass test passed while toMarkdown emitted the fence
            // unindented, so INDENTED_FENCE_TOKEN stopped matching and the
            // fence escaped the list on the second pass.
            const md = '- item\n  ```\n  code\n  ```';
            const once = service.toMarkdown(service.toHtml(md));
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(once);
            expect(probe.querySelector('li pre code')).toBeTruthy();
        });

        it('does not grow a phantom cell on a padded table', () => {
            const md = '| a | b |\n| --- | --- |\n| wide |';
            const once = service.toMarkdown(service.toHtml(md));
            const twice = service.toMarkdown(service.toHtml(once));
            expect(twice).toBe(once);
        });

        it('parses a doubly-nested blockquote as nested quotes', () => {
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml('> outer\n> > deeper');
            expect(probe.querySelector('blockquote blockquote')).toBeTruthy();
            expect(probe.textContent).not.toContain('&gt;');
        });
    });

    describe('same-block pairing and composed prefixes (round-20 audit)', () => {
        it('keeps a prose mention as text when real markup shares its PARAGRAPH', () => {
            // Per-block pairing narrowed the blast radius from document to
            // paragraph; it did not fix the class. The previous tests put prose
            // and markup in SEPARATE blocks -- the shape the fix already handled.
            const html = service.toHtml('Use <b> to bold. Like <b>this</b>.');
            const probe = document.createElement('div');
            probe.innerHTML = html;
            expect(probe.textContent).toContain('Use <b> to bold.');
            expect(probe.querySelectorAll('b')).toHaveLength(1);
        });

        it('does not eject cell text when a table name is mentioned in the same block', () => {
            const html = service.toHtml('The <table> element is nice. <table>x</table>');
            const probe = document.createElement('div');
            probe.innerHTML = html;
            expect(probe.textContent).toContain('The <table> element is nice.');
        });

        it('handles a fence inside a list inside a quote', () => {
            // FENCE_PATTERN allowed indentation only BEFORE the quote markers,
            // so quote-then-indent never matched and the fence became literal
            // backticks. The prior tests covered quote-alone and list-alone --
            // the two homogeneous prefixes, never the composed one.
            const md = '> - item\n>   ```js\n>   code();\n>   ```';
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);
            expect(probe.querySelector('blockquote pre code')?.textContent).toBe('code();');
            expect(probe.textContent).not.toContain('```');
        });
    });

    describe('colspan amplification (round-20 audit)', () => {
        it('does not expand a hostile colspan into megabytes', () => {
            // colspan arrives from paste and the sanitizer keeps it verbatim.
            // Uncapped, one cell produced ~900 KB of markdown -- 887x
            // amplification, a DoS through ordinary clipboard content.
            const html = '<table><tbody><tr><td colspan="99999">x</td></tr></tbody></table>';
            const md = service.toMarkdown(html);
            expect(md.length).toBeLessThan(20000);
        });

        it('still round-trips an ordinary span', () => {
            const html = '<table><tbody><tr><td colspan="2">wide</td></tr><tr><td>a</td><td>b</td></tr></tbody></table>';
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(service.toMarkdown(html));
            expect(probe.querySelector('table')).toBeTruthy();
        });
    });

    describe('hard line breaks (round-24 audit)', () => {
        it('survives two save/load cycles', () => {
            // toHtml emits <br> plus a real newline; toMarkdown then emits
            // "line1  " + newline + newline -- a BLANK line, which is a
            // paragraph break, not a hard break. By the second cycle the <br>
            // is gone for good. Shift+Enter is a first-class gesture.
            const md = 'line1  \nline2';
            const once = service.toMarkdown(service.toHtml(md));
            const twice = service.toMarkdown(service.toHtml(once));
            expect(twice).toBe(once);

            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(twice);
            expect(probe.querySelector('br')).toBeTruthy();
        });

        it('reads back its own toHtml output', () => {
            // The guarding test used 'x<br>y' -- no whitespace after the <br> --
            // the one shape where the bug cannot manifest. The service's own
            // output was never among the inputs it was tested on.
            const html = service.toHtml('line1  \nline2');
            expect(service.toMarkdown(html)).toBe('line1  \nline2');
        });

    });

    describe('rowspan (round-24 audit)', () => {
        it('does not file a cell under the wrong column', () => {
            // colspan is handled everywhere; rowspan nowhere. A rowspan cell
            // occupies a column in the rows BELOW it, so every later cell must
            // shift right. Instead the value landed one column left: a Q figure
            // filed under Region, and saving made that permanent. Every
            // count-based table test passes, because the cell COUNT is right.
            const html =
                '<table><tr><th>Region</th><th>Q</th></tr>' +
                '<tr><td rowspan="2">US</td><td>10</td></tr>' +
                '<tr><td>20</td></tr></table>';
            const md = service.toMarkdown(html);
            const rows = md.split(String.fromCodePoint(10)).filter((l) => l.startsWith('|'));
            // The third body row's value belongs in the SECOND column.
            const lastCells = rows[rows.length - 1].split('|').slice(1, -1).map((c) => c.trim());
            expect(lastCells[1]).toBe('20');
        });
    });

    describe('inline code (round-25 audit)', () => {
        it('does not rewrite markdown metacharacters inside a code span', () => {
            // parseInlineCode ran AFTER the emphasis and line-break passes and
            // never escaped its body, so documenting markdown or HTML inside
            // backticks corrupted it on the first save.
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml('Use `<b>x</b>` here');
            expect(probe.querySelector('code')?.textContent).toBe('<b>x</b>');
            expect(probe.querySelector('code b')).toBeNull();
        });

        it('round-trips a code span containing markup', () => {
            const md = 'Use `<br>` for breaks';
            expect(service.toMarkdown(service.toHtml(md))).toBe(md);
        });
    });

    describe('resource bounds (round-21 audit)', () => {
        it('does not hang on a deeply nested blockquote', () => {
            // Two independent bounds were missing. buildBlockquote recursed with
            // no depth guard, AND FENCE_PATTERN's quote-marker group backtracked
            // catastrophically over a run of markers -- 59ms at depth 20, 385ms
            // at 26, doubling per level. A 120-byte document froze the tab, and
            // it arrives from paste, file import and <ui-rich-text-view [value]>.
            const md = '> '.repeat(60) + 'x';
            const started = performance.now();
            const html = service.toHtml(md);
            expect(performance.now() - started).toBeLessThan(1000);
            expect(html).toContain('x');
        });

        it.each([
            ['list items', (lines: string[], level: number) => [`:::details s${level}`, `- a${level}`, ...lines.map((line) => `  ${line}`), ':::']],
            ['quotes', (lines: string[], level: number) => [`> :::details s${level}`, ...lines.map((line) => `> ${line}`), '> :::']],
            // The inner quote sits in a list item, so its lines are indented and it
            // is read as a quote holding no nested quote marker of its own.
            ['quotes inside list items', (lines: string[], level: number) =>
                [`> :::details s${level}`, `> - a${level}`, ...lines.map((line) => `>   ${line}`), '> :::']],
        ])('caps details blocks nested through %s at the same depth as directly nested ones', (_name, wrap) => {
            // Counted apart, the depth started again inside a list item or a quote,
            // so 64 levels built 64 details blocks. Written as markdown: a save
            // unwraps what lies past the cap before the reader ever sees it.
            let lines = ['x'];
            for (let level = 0; level < 64; level++) lines = wrap(lines, level);
            const out = service.toHtml(lines.join('\n'));

            expect((out.match(/<details/g) ?? []).length).toBeGreaterThan(8);
            expect((out.match(/<details/g) ?? []).length).toBeLessThanOrEqual(32);
        });

        const PAST_THE_CAP: [string, (inner: string, level: number) => string][] = [
            ['list items', (inner, level) => `<details><summary>s${level}</summary><ul><li>a${level}${inner}</li></ul></details>`],
            ['quotes', (inner, level) => `<blockquote><details><summary>s${level}</summary>${inner}</details></blockquote>`],
            ['details blocks', (inner, level) => `<details><summary>s${level}</summary>${inner}</details>`],
            ['quotes holding paragraphs', (inner, level) => `<blockquote><p>q${level}</p>${inner}</blockquote>`],
        ];

        it.each(PAST_THE_CAP.flatMap(([name, wrap]) => [17, 40, 64].map((levels) => [name, levels, wrap] as const)))(
            'saves %s nested %i deep so the second save equals the first, every word kept in order',
            (_name, levels, wrap) => {
                // Written whole, the markers past the reader's cap came back as text,
                // were escaped on the next save, and a quote's inner markers showed.
                const words = (html: string): string =>
                    (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '').replaceAll(/\s+/g, '');
                let html = '<p>x y</p>';
                for (let level = 0; level < levels; level++) html = wrap(html, level);
                const first = service.toMarkdown(html);
                const loaded = service.toHtml(first);

                expect(service.toMarkdown(loaded)).toBe(first);
                expect(words(loaded)).toBe(words(html));
            },
        );

        it('does not take the square of the nesting on deeply nested details blocks', () => {
            // Each level re-sliced and re-paired its whole body: 17ms, 53ms and
            // 161ms for 250, 500 and 1000 levels. Past the cap the rest is text.
            const md = ':::details\n'.repeat(3000) + ':::\n'.repeat(3000);
            const started = performance.now();
            const html = service.toHtml(md);

            expect(performance.now() - started).toBeLessThan(1500);
            expect((html.match(/<details/g) ?? []).length).toBeLessThanOrEqual(32);
        });

        it('reads an item holding thousands of details openers whose closers lie past it once', () => {
            // Each opener scanned ahead to its closer, stopping at the next item,
            // so the same lines were read once per opener: 1.5s for 4000.
            const md = '- a\n' + '  :::details x\n'.repeat(8000) + '- b\n' + '  :::\n'.repeat(8000);
            const started = performance.now();
            const holder = document.createElement('div');
            holder.innerHTML = service.toHtml(md);

            expect(performance.now() - started).toBeLessThan(1000);
            expect(holder.querySelectorAll('li')).toHaveLength(2);
        });

        it('keeps a details block under forty nested bullets a details block through saves', () => {
            // A sub-list adds no level when read, but the save counted every list
            // item, so it unwrapped a details block the reader had kept.
            let html = '<details><summary>deep</summary><p>body</p></details>';
            for (let level = 0; level < 40; level++) html = `<ul><li>l${level}${html}</li></ul>`;
            const first = service.toMarkdown(html);
            const holder = document.createElement('div');
            holder.innerHTML = service.toHtml(first);

            expect(holder.querySelector('details > summary')?.textContent).toBe('deep');
            expect(service.toMarkdown(holder.innerHTML)).toBe(first);
        });

        it('reads a staircase of nested items each opening a details block that closes past its item in linear time', () => {
            // A cache per list still rescanned from every opener when each one sat
            // in a list of its own: 4.3s for 250 KB.
            const levels = 300;
            let md = '';
            for (let level = 0; level < levels; level++) md += ' '.repeat(level) + '- a\n' + ' '.repeat(level + 2) + ':::details x\n';
            md += 'x\n'.repeat(20000) + '\ny\n' + ':::\n'.repeat(levels);
            const started = performance.now();
            service.toHtml(md);

            expect(performance.now() - started).toBeLessThan(600);
        });

        it('does not hang on a deeply nested TIGHT blockquote', () => {
            // The spaced form above was bounded, but the tight form never
            // reached the recursion at all -- the escaping defect turned every
            // marker after the first into text. Now that it parses, it is a
            // genuinely new path through the same exponential recursion and
            // needs its own bound.
            const md = '>'.repeat(60) + ' x';
            const started = performance.now();
            const html = service.toHtml(md);
            expect(performance.now() - started).toBeLessThan(1000);
            expect(html).toContain('x');
        });



        it('keeps every cell when a body row is wider than the header', () => {
            // The round-22 truncation traded invalid GFM for DATA LOSS: cells
            // past row 0's width were deleted outright. Its guarding test
            // asserted only that all rows had EQUAL cell counts, which
            // truncation and widening satisfy identically -- so the test could
            // not steer the fix away from destroying content.
            const html = '<table><tr><th>H</th></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>';
            const md = service.toMarkdown(html);
            expect(md).toContain('b');
            expect(md).toContain('c');
            const counts = md
                .split('\n')
                .filter((l) => l.trim().startsWith('|'))
                .map((l) => l.split('|').slice(1, -1).length);
            expect(new Set(counts).size).toBe(1);
        });

        it('serializes a table whose first row has no cells', () => {
            // columnCount came from rows[0] unconditionally, so an empty first
            // row made the limit 0 and every row emitted nothing.
            const html = '<table><tr></tr><tr><td>a</td><td>b</td></tr></table>';
            const md = service.toMarkdown(html);
            expect(md).toContain('a');
            expect(md).toContain('b');
        });

        it('does not hoist a nested table into its parent', () => {
            // querySelectorAll('tr') is an unscoped DESCENDANT query, so the
            // nested table's row was emitted BOTH inside the cell and as a row
            // of the outer table.
            const html =
                '<table><tr><th>H1</th><th>H2</th></tr>' +
                '<tr><td>x</td><td><table><tr><td>n1</td><td>n2</td></tr></table></td></tr></table>';
            const md = service.toMarkdown(html);
            const bodyRows = md.split('\n').filter((l) => l.trim().startsWith('|')).length;
            // header + separator + one body row
            expect(bodyRows).toBe(3);
        });


        it('keeps the neighbours of a colspan cell instead of dropping them', () => {
            // "The truncation line is gone, so no cell can be dropped" -- but
            // padToWidth still breaks at the column limit, so a row whose
            // colspans SUM past it loses every later cell. Padding blanks were
            // emitted in preference to real content.
            const html = '<table><tr><td colspan="1000">A</td><td>B</td><td>C</td></tr></table>';
            const md = service.toMarkdown(html);
            expect(md).toContain('B');
            expect(md).toContain('C');
        });


        it('keeps every row of a many-narrow-rows table, and stays fast', () => {
            // This asserted a 1MB output ceiling, which the cell budget met by
            // DELETING rows -- 5000 rows became 953, silently, and saving made
            // it permanent. The budget was hiding a quadratic walk in
            // elementToMarkdown, not preventing a hang; with that fixed this
            // shape converts in ~100ms.
            //
            // Output size is deliberately NOT asserted. colspan=1000 x 5000
            // rows genuinely amplifies 88x (166KB -> 14.3MB) because markdown
            // has to pad every row to the table's width -- but it is malformed
            // input, and a REAL wide table shrinks instead (196KB -> 84KB).
            // Bounding that output is an open product decision; losing the
            // user's rows to meet a number is not.
            const row = '<tr><td colspan="1000">a</td></tr>';
            const html = '<table><tbody>' + row.repeat(5000) + '</tbody></table>';

            const started = performance.now();
            const md = service.toMarkdown(html);
            const elapsed = performance.now() - started;

            // 5000 data rows + 1 separator; none dropped.
            expect(md.split(String.fromCodePoint(10))).toHaveLength(5001);
            expect(md).not.toContain('truncated');
            expect(elapsed).toBeLessThan(5000);
        });

        it('converts nested details blocks and lists once, not once per level', () => {
            // <details>, <ul> and <ol> walk their own children, but each subtree
            // was converted first and thrown away: 4x per level, 7s at nine.
            let html = '<p>x</p>';
            for (let level = 0; level < 9; level++) {
                html = `<details><summary>s${level}</summary><ul><li>a${level}${html}</li></ul></details>`;
            }
            const started = performance.now();
            const md = service.toMarkdown(html);

            expect(performance.now() - started).toBeLessThan(1000);
            expect(md).toContain('s8');
            expect(md).toContain('x');
        });

        it('converts a nested table subtree once, not once per level', () => {
            // elementToMarkdown computed `inner` for EVERY element before the
            // switch chose a renderer -- but <table> discards it and re-walks
            // its own cells, so each level converted its subtree twice and
            // nested tables doubled per level: 5, 9, 15, 27, 54ms at depths
            // 9-13, minutes by depth 25 from a 430-byte document. The node
            // budget hid it by cutting such input before conversion.
            //
            // Timing is asserted as a RATIO, not a threshold: depth 13 costs
            // only ~53ms even when quadratic, so any absolute bound loose
            // enough to be stable passes with the bug present. Doubling the
            // depth must not explode the cost.
            const nest = (d: number): string =>
                '<table><tr><td>'.repeat(d) + 'x' + '</td></tr></table>'.repeat(d);

            const time = (html: string): number => {
                const started = performance.now();
                service.toMarkdown(html);
                return performance.now() - started;
            };

            time(nest(8));
            const shallow = Math.max(time(nest(10)), 1);
            const deep = time(nest(20));

            // Linear: depth 20 is ~2x depth 10. Quadratic: ~1000x.
            expect(deep / shallow).toBeLessThan(20);
            expect(service.toMarkdown(nest(20))).toContain('x');
        });


        it('puts the real header first when <thead> follows <tbody>', () => {
            // A single :scope query returns rows in DOCUMENT order, so a table
            // written tbody-before-thead -- valid HTML, and what some editors
            // emit -- placed a BODY row above the separator and the real header
            // below it, inverting the table.
            const html =
                '<table><tbody><tr><td>b</td></tr></tbody>' +
                '<thead><tr><th>H</th></tr></thead></table>';
            const rows = service.toMarkdown(html).split(String.fromCodePoint(10));
            expect(rows[0]).toContain('H');
            expect(rows[2]).toContain('b');
        });

        it('widens the table to the widest row, keeping every cell', () => {
            // This asserted only that all rows had the same cell COUNT -- a
            // property a TRUNCATING implementation satisfies identically while
            // deleting c and d. Its title still said "truncates" although the
            // code was changed to pad, so it described the opposite of the
            // behaviour and guarded neither. Assert the content, not the shape.
            const html = '<table><tr><td>a</td></tr><tr><td>b</td><td>c</td><td>d</td></tr></table>';
            const md = service.toMarkdown(html);

            expect(md).toContain('c');
            expect(md).toContain('d');

            const counts = md
                .split('\n')
                .filter((l) => l.trim().startsWith('|'))
                .map((l) => l.split('|').slice(1, -1).length);
            expect(new Set(counts).size).toBe(1);
            expect(counts[0]).toBe(3);
        });

        it('bounds table amplification per ROW, not just per cell', () => {
            // clampSpan caps one cell at 1000, but nothing bounded columns per
            // row: 50 rows x 50 cells of colspan="1000" turned 63KB of pasted
            // HTML into 7.8MB of markdown. The existing test used a SINGLE cell
            // -- the one shape a per-cell cap already handles.
            const cell = '<td colspan="1000">x</td>';
            const row = '<tr>' + cell.repeat(50) + '</tr>';
            const html = '<table><tbody>' + row.repeat(50) + '</tbody></table>';
            const md = service.toMarkdown(html);
            expect(md.length).toBeLessThan(500000);
        });
    });

    describe('inline code boundaries (self-review)', () => {
        it('ignores delimiters the author typed', () => {
            // protectInlineCode did not strip its own U+E112/U+E113 pair, so a
            // document carrying them forged a token and the span rendered twice.
            // The identical defect was fixed for fences in an earlier round and
            // reintroduced here -- a store added without copying the guard the
            // sibling store already had.
            const OPEN = String.fromCodePoint(0xe112);
            const CLOSE = String.fromCodePoint(0xe113);
            const html = service.toHtml('`SPAN` ' + OPEN + '0' + CLOSE);
            expect(html.match(/SPAN/g) ?? []).toHaveLength(1);
        });


        it('keeps a code span in alt text as plain text', () => {
            // An alt attribute cannot hold markup, so a parked code span
            // restored in there landed as the literal "<code>x</code>".
            //
            // The audit reported this as "the image is DELETED" using
            // http://x/i.png -- but sanitizeImageSrc rejects plain http for
            // images by policy, so that probe was blocked rather than broken.
            // With an allowed scheme the image renders; only the alt was wrong.
            const html = service.toHtml('![`alt`](https://x/i.png)');
            expect(html).toContain('alt="alt"');
            expect(html).not.toContain('code&gt;');
            expect(service.toMarkdown(html)).toBe('![alt](https://x/i.png)');
        });



        it('reads a quote line whose marker has no space after it', () => {
            // The space after ">" is optional in CommonMark. Requiring it meant
            // ">> b" was not a quote line at all: a nested quote in the tight
            // form lost a level, and ">> b" on its own produced NO blockquote.
            //
            // DEPTH is asserted, not just the fixed point. A second defect sat
            // upstream: the lookbehind that escapes a stray ">" to text did not
            // treat ">" as a safe preceding character, so in ">>" the SECOND
            // marker became "&gt;" before the parser ran. The tight form then
            // collapsed to one level and drifted on every save. A fixed-point
            // assertion alone could not see it -- a collapsed quote is a stable
            // fixed point too, so this test passed throughout.
            const NLC = String.fromCodePoint(10);
            const depthOf = (md: string): number => {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                return probe.querySelectorAll('blockquote').length;
            };

            expect(depthOf('>> b')).toBe(2);
            expect(depthOf('>>> c')).toBe(3);

            // The tight and spaced forms are the same document.
            expect(depthOf('> a' + NLC + '>> b')).toBe(depthOf('> a' + NLC + '> > b'));
            expect(depthOf('>>> c')).toBe(depthOf('> > > c'));

            // A ">" that is not a quote marker is still escaped to text.
            expect(depthOf('a > b')).toBe(0);

            // And the tight nested form reaches a round-trip fixed point.
            const once = service.toMarkdown(service.toHtml('> a' + NLC + '>> b'));
            expect(service.toMarkdown(service.toHtml(once))).toBe(once);
        });

        it('does not inject hard breaks into a multi-line quote', () => {
            // parseBlockquotes joins a quote's lines with <br>, and <br>
            // serializes to two spaces plus a newline -- so every multi-line
            // quote came back with two trailing spaces on each line, turning
            // into hard breaks and breaking the round-trip fixed point.
            const NLC = String.fromCodePoint(10);
            const md = '> a' + NLC + '> b';
            const once = service.toMarkdown(service.toHtml(md));
            // Its two lines are paragraphs, kept apart by a blank quote line, with
            // no trailing spaces on either.
            expect(once).toBe('> a' + NLC + '>' + NLC + '> b');
            expect(once).not.toContain('  ' + NLC);
            expect(service.toMarkdown(service.toHtml(once))).toBe(once);
        });

        it('keeps a hard break that is followed by content', () => {
            const html = service.toHtml('a  ' + String.fromCodePoint(10) + 'b');
            expect(html).toContain('<br>');
        });

        it('does not emit a break before a block boundary', () => {
            // Two trailing spaces before a heading are not a hard break: the
            // block boundary already ends the line, and inserting one strands a
            // <br> in an empty paragraph.
            const NLC = String.fromCodePoint(10);
            const html = service.toHtml('a  ' + NLC + NLC + '# H');
            expect(html).not.toContain('<p></p>');
        });

        it('pairs bold across a hard break', () => {
            // Moving parseLineBreaks ahead of parseParagraphs fixed this as a
            // side effect: the ** pairing used to be broken by the inserted
            // <br>, leaving a literal asterisk on each side.
            const html = service.toHtml('**a  ' + String.fromCodePoint(10) + 'b**');
            expect(html).toContain('<strong>');
            expect(html).not.toContain('*<em>');
        });
    });

    describe('fenced code blocks longer than three characters (round-26 audit)', () => {
        const NLC = String.fromCodePoint(10);
        const T = String.fromCodePoint(96);

        it('treats a 4-backtick fence as a fence', () => {
            // FENCE_PATTERN matched exactly ``` or ~~~, but CommonMark allows
            // three OR MORE. A 4-backtick fence was not a fence at all: its
            // lines were parsed as ordinary markdown and the round trip never
            // reached a fixed point, gaining newlines over the first few saves.
            const md = T.repeat(4) + NLC + 'let x = 1;' + NLC + T.repeat(4);
            const html = service.toHtml(md);
            expect(html).toContain('<pre>');
            expect(html).toContain('let x = 1;');
        });

        it('round-trips a code block that CONTAINS a fence', () => {
            // This is the whole reason longer fences exist. The serializer
            // hardcoded three backticks, so the inner fence closed the outer
            // block and the remainder was re-parsed as markdown -- the content
            // changed on every save. The emitted fence must exceed the longest
            // backtick run in the body.
            const md = [T.repeat(4), T.repeat(3), 'x', T.repeat(3), T.repeat(4)].join(NLC);
            const once = service.toMarkdown(service.toHtml(md));
            expect(once).toBe(md);
            expect(service.toMarkdown(service.toHtml(once))).toBe(once);
        });

        it('reaches a fixed point for every fence width', () => {
            // Each case pairs the markdown with the body text that must survive,
            // so the assertion cannot pass on a block whose content was eaten.
            const cases: ReadonlyArray<readonly [string, string]> = [
                [T.repeat(3) + NLC + 'code' + NLC + T.repeat(3), 'code'],
                [T.repeat(5) + NLC + 'code' + NLC + T.repeat(5), 'code'],
                ['~~~~' + NLC + 'code' + NLC + '~~~~', 'code'],
                [T.repeat(4) + 'ts' + NLC + 'const a = 1;' + NLC + T.repeat(4), 'const a = 1;'],
            ];
            for (const [md, body] of cases) {
                const once = service.toMarkdown(service.toHtml(md));
                expect(once).toContain(body);
                expect(service.toMarkdown(service.toHtml(once))).toBe(once);
            }
        });
    });

    describe('block content inside a list item (round-26 audit)', () => {
        const NLC = String.fromCodePoint(10);

        it('keeps a quote, heading, table or code block inside its item', () => {
            // These were emitted at column 0, so they ESCAPED the list on save:
            // '- Alpha' + a quote line reads back as a list followed by a
            // separate quote. The text survived; the nesting did not.
            const cases: ReadonlyArray<readonly [string, string]> = [
                ['<ul><li>Alpha<blockquote>Bravo</blockquote></li></ul>', 'blockquote'],
                ['<ul><li>Alpha<h2>Bravo</h2></li></ul>', 'h2'],
                ['<ul><li>Alpha<table><tr><td>B</td></tr></table></li></ul>', 'table'],
                ['<ul><li>Alpha<pre><code>Bravo</code></pre></li></ul>', 'pre'],
            ];
            for (const [html, tag] of cases) {
                const md = service.toMarkdown(html);
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                const li = probe.querySelector('li');
                expect(li?.querySelector(tag)).toBeTruthy();
                // And it is a fixed point, so it does not drift on later saves.
                expect(service.toMarkdown(service.toHtml(md))).toBe(md);
            }
        });

        it('keeps a DEEP block in its own item, even with a sibling after it', () => {
            // The four cases above are all single-level, which is the one depth
            // where a hardcoded two-space continuation indent is correct -- they
            // could not catch a depth bug. Two independent ones lived here:
            // indentContinuation emitted a fixed 2 spaces while nested items sit
            // at 2 x depth, and the parser resolved the owning item at FLUSH
            // time, by which point a following sibling had already popped the
            // deeper levels. A third-level heading surfaced in its grandparent.
            const html = '<ul><li>A<ul><li>B<ul><li>C<h2>H</h2></li></ul></li><li>B2</li></ul></li></ul>';
            const md = service.toMarkdown(html);
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);

            const items = Array.from(probe.querySelectorAll('li'));
            const owner = items.find((li) => li.querySelector(':scope > h2'));
            expect(owner?.firstChild?.textContent).toBe('C');
            expect(items.map((li) => li.firstChild?.textContent)).toEqual(['A', 'B', 'C', 'B2']);
            expect(service.toMarkdown(service.toHtml(md))).toBe(md);
        });

        it('keeps a second paragraph as its own block', () => {
            // A continuation that parsed to loose text was returned bare and
            // concatenated onto the item's first line, so on each save the last
            // word of one paragraph fused with the first of the next --
            // compounding: a third paragraph was consumed a save later.
            const html = '<ul><li><p>Alpha</p><p>Second</p><p>Third</p></li></ul>';
            const md = service.toMarkdown(html);
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);
            const li = probe.querySelector('li');
            expect(li?.textContent).toContain('Alpha');
            expect(li?.textContent).toContain('Second');
            expect(li?.textContent).toContain('Third');
            // Asserted structurally, not on textContent: textContent never puts
            // a separator between block elements, so 'AlphaSecond' there is
            // normal DOM behaviour. What was broken is that the paragraphs were
            // not separate ELEMENTS at all -- they were fused into one text run.
            expect(li?.querySelectorAll('p').length).toBeGreaterThanOrEqual(2);
            // Stable from the SECOND save on. The first pass normalises the
            // blank lines between the paragraphs; what matters is that it then
            // settles and no content is consumed -- the defect was that each
            // save ate another word, compounding without bound.
            const second = service.toMarkdown(service.toHtml(md));
            expect(service.toMarkdown(service.toHtml(second))).toBe(second);
            const settled = document.createElement('div');
            settled.innerHTML = service.toHtml(second);
            for (const word of ['Alpha', 'Second', 'Third']) {
                expect(settled.textContent).toContain(word);
            }
        });

        it('parses a hand-written CommonMark continuation', () => {
            // parseBlockquotes and parseHeadings run BEFORE parseLists, so an
            // indented '> b' was consumed at document level and rendered as
            // literal text -- valid markdown a user typed by hand did not work.
            for (const [src, tag] of [
                ['- Alpha' + NLC + '  > Bravo', 'blockquote'],
                ['- Alpha' + NLC + '  ## Bravo', 'h2'],
            ] as ReadonlyArray<readonly [string, string]>) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(src);
                expect(probe.querySelector('li')?.querySelector(tag)).toBeTruthy();
                expect(probe.textContent).not.toContain('>' + ' Bravo');
            }
        });

        it('still ends the list at an unindented line, as a PARAGRAPH', () => {
            // The continuation rule must not swallow ordinary text after a list.
            //
            // The <p> is asserted, not just the text. This test used
            // toContain('Outside') on textContent, which is true whether the text
            // is a paragraph or a bare node -- so it passed while the paragraph
            // after EVERY list silently lost its <p> on the first save, on the
            // commonest document shape there is. It never recovered: a stable
            // fixed point.
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml('- Alpha' + NLC + NLC + 'Outside');
            expect(probe.querySelectorAll('li')).toHaveLength(1);
            expect(probe.querySelector('li')?.textContent).toBe('Alpha');
            expect(probe.querySelectorAll('p')).toHaveLength(1);
            expect(probe.querySelector('p')?.textContent).toBe('Outside');
        });

        it('keeps the paragraph after a list, for every list type', () => {
            for (const html of [
                '<ul><li>Alpha</li></ul><p>Outside</p>',
                '<ol><li>Alpha</li></ol><p>Outside</p>',
                '<ul><li>Alpha</li></ul><p>One</p><p>Two</p>',
            ]) {
                const before = new DOMParser().parseFromString(html, 'text/html');
                const md = service.toMarkdown(html);
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelectorAll('p')).toHaveLength(
                    before.querySelectorAll('p').length,
                );
                // Stable from the SECOND save: the first pass normalises the
                // blank line between the list and the paragraph, then it holds.
                const second = service.toMarkdown(service.toHtml(md));
                expect(service.toMarkdown(service.toHtml(second))).toBe(second);
            }
        });

        it('keeps the paragraph after a list that HAS a continuation', () => {
            // The tests above all use a list with NO continuation, which is the
            // one shape where this cannot appear: the first fix populated
            // orphanBlanks only when continuation.length === 0, conflating "no
            // continuation at all" with "no blanks left over". A list that HAD a
            // continuation still dropped the blank after it, so the same loss
            // survived one indirection away and shipped again.
            //
            // This is the third round of one bug class (list fused with its
            // neighbour), so the neighbours are enumerated rather than sampled.
            const NLC = String.fromCodePoint(10);
            const withCont = '- Alpha' + NLC + NLC + '  Cont' + NLC + NLC;
            for (const [after, sel] of [
                ['Outside', 'p'],
                ['# Head', 'h1'],
                ['> Quote', 'blockquote'],
                ['- Second list', 'ul'],
            ] as ReadonlyArray<readonly [string, string]>) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(withCont + after);
                // The following block is a SIBLING of the list, not swallowed by
                // it. (A continuation legitimately puts a <p> inside the item, so
                // the test is where the trailing block landed, not whether the
                // list contains any element of that kind.)
                const list = probe.querySelector('ul');
                expect(list).toBeTruthy();
                const trailing = Array.from(probe.querySelectorAll(sel))
                    .find((el) => (el.textContent ?? '').includes(after.replace(/^[#>-]+ /, '')));
                expect(trailing).toBeTruthy();
                expect(trailing?.closest('li')).toBeNull();
            }
        });

        it('keeps all three paragraphs of list-with-continuation then prose', () => {
            // The editor's own path: HTML in, markdown out, HTML back.
            const html = '<ul><li><p>Alpha</p><p>Second</p></li></ul><p>Outside</p>';
            const md = service.toMarkdown(html);
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);

            // Outside is a PARAGRAPH, not a bare text node fused onto the list.
            const outside = Array.from(probe.querySelectorAll('p'))
                .find((el) => el.textContent === 'Outside');
            expect(outside).toBeTruthy();
            expect(outside?.closest('li')).toBeNull();

            // And nothing was lost on the way.
            for (const word of ['Alpha', 'Second', 'Outside']) {
                expect(probe.textContent).toContain(word);
            }

            const second = service.toMarkdown(service.toHtml(md));
            expect(service.toMarkdown(service.toHtml(second))).toBe(second);
        });
    });

    describe('inline tags markdown cannot express (round-28 audit)', () => {
        it('keeps every sanitizer-allowed inline tag across a save', () => {
            // mode defaults to 'markdown', so toMarkdown runs on EVERY save. The
            // sanitizer admits mark/sub/sup/small/ins, but only <u> had a case in
            // inlineTagToMarkdown -- the other five fell through to bare `inner`,
            // so <mark>X</mark> became X and the formatting was gone for good.
            // <u> was already emitted verbatim; this is that same precedent.
            for (const tag of ['u', 'mark', 'sub', 'sup', 'small', 'ins']) {
                const md = service.toMarkdown(`<p>A<${tag}>X</${tag}>B</p>`);
                expect(md).toBe(`A<${tag}>X</${tag}>B`);

                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelector(tag)).toBeTruthy();
                // Stable, so it does not decay on later saves either.
                expect(service.toMarkdown(service.toHtml(md))).toBe(md);
            }
        });

        it('keeps them when they wrap other markup', () => {
            for (const html of [
                '<p><mark>A<strong>B</strong>C</mark></p>',
                '<p>x<sup>2</sup> + y<sub>1</sub></p>',
            ]) {
                const md = service.toMarkdown(html);
                expect(service.toMarkdown(service.toHtml(md))).toBe(md);
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.textContent).toBe(
                    new DOMParser().parseFromString(html, 'text/html').body.textContent,
                );
            }
        });
    });

    describe('empty list items and horizontal rules (round-29 audit)', () => {

        it('keeps an empty item inside its list', () => {
            // toMarkdown emits an empty item as "- " (one trailing space), but
            // parseListLine required whitespace THEN a non-space, so that line was
            // not a list item at all: it ended the list, split it in two, and left
            // a literal "- " in the prose. <li><br></li> is what the browser makes
            // when a user opens a bullet and clicks away, so this was an everyday
            // keystroke, and for <ol> the second list renumbered from 1.
            for (const [html, tag] of [
                ['<ul><li>A</li><li></li><li>B</li></ul>', 'ul'],
                ['<ul><li>A</li><li><br></li><li>B</li></ul>', 'ul'],
                ['<ol><li>A</li><li></li><li>B</li></ol>', 'ol'],
            ] as ReadonlyArray<readonly [string, string]>) {
                const md = service.toMarkdown(html);
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelectorAll(tag)).toHaveLength(1);
                expect(probe.querySelectorAll('li')).toHaveLength(3);
                expect(probe.textContent).not.toContain('- ');
                expect(service.toMarkdown(service.toHtml(md))).toBe(md);
            }
        });

        it('still reads a rule, not a list item, for --- and friends', () => {
            // Widening the item pattern must not swallow a rule: it has no space
            // after the marker, which is what separates the two.
            for (const rule of ['---', '***', '___', '----']) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(rule);
                expect(probe.querySelector('hr')).toBeTruthy();
                expect(probe.querySelector('li')).toBeNull();
            }
        });

        it('keeps the paragraph after a rule wrapped', () => {
            // Under /m, \s* matches the line terminator, so it greedily ate the
            // BLANK LINE after the rule -- the separator parseParagraphs needs.
            // The rule and the next paragraph fused into one block, which matched
            // the "already block-level" guard, so the paragraph was never wrapped
            // and came back as a bare text node.
            //
            // The existing rule tests had NOTHING after the rule, which is the one
            // shape where this cannot appear, and there was no hr round-trip test
            // at all.
            const md = service.toMarkdown('<p>Intro</p><hr><p>Body text</p>');
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);
            expect(probe.querySelectorAll('p')).toHaveLength(2);
            expect(probe.querySelectorAll('hr')).toHaveLength(1);
            expect(probe.querySelectorAll('p')[1].textContent).toBe('Body text');
        });

        it('settles after one save for a document with rules', () => {
            // One blank line is added on the first pass, then it holds. Asserted
            // from the SECOND save so the assertion is about stability, not about
            // blessing the exact whitespace.
            const first = service.toMarkdown('<p>a</p><hr><p>b</p><hr><p>c</p>');
            const second = service.toMarkdown(service.toHtml(first));
            expect(service.toMarkdown(service.toHtml(second))).toBe(second);

            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(second);
            expect(probe.querySelectorAll('p')).toHaveLength(3);
            expect(probe.querySelectorAll('hr')).toHaveLength(2);
            expect(probe.querySelectorAll('p')[0].textContent).toBe('a');
            expect(probe.querySelectorAll('p')[1].textContent).toBe('b');
            expect(probe.querySelectorAll('p')[2].textContent).toBe('c');
        });
    });

    describe('styled spans survive a save (colour and highlight)', () => {
        it('keeps colour, highlight and font on a round trip', () => {
            // mode defaults to 'markdown', so toMarkdown runs on every save. The
            // sanitizer preserves a styled <span> -- the colour and highlight
            // toolbar buttons produce exactly that -- but spanToMarkdown returned
            // only `inner`, so the user's formatting went plain on the next save
            // with no warning. Emitted verbatim now, like u/mark/sub/sup.
            for (const [style, html] of [
                ['color: red', '<p>a <span style="color: red">RED</span> b</p>'],
                ['background-color: yellow', '<p><span style="background-color: yellow">HL</span></p>'],
                ['font-size: 20px', '<p><span style="font-size: 20px">big</span></p>'],
            ] as ReadonlyArray<readonly [string, string]>) {
                const md = service.toMarkdown(html);
                expect(md).toContain(style);

                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelector('span')?.getAttribute('style')).toBe(style);
                expect(service.toMarkdown(service.toHtml(md))).toBe(md);
            }
        });

        it('keeps markdown nested inside a styled span', () => {
            const md = service.toMarkdown('<p><span style="color: red">a <strong>b</strong></span></p>');
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(md);
            const span = probe.querySelector('span');
            expect(span?.getAttribute('style')).toBe('color: red');
            expect(span?.querySelector('strong')?.textContent).toBe('b');
        });

        it('cannot break out of the style attribute', () => {
            // The span is emitted as raw HTML into markdown, so quoting matters.
            //
            // The smuggled value `color: red" onmouseover="alert(1)` is refused
            // whole by the sanitizer's CSS function allowlist (`alert(` is not a
            // function a style may call), so the span reaches markdown with no
            // style and is flattened to its text. Before that allowlist the
            // junk survived INSIDE the style value and this test asserted a
            // `style` attribute was still present; the property that matters --
            // no second attribute is ever produced, on either side of the
            // round trip -- is the one asserted now.
            const entityRoute = '<p><span style="color: red&quot; onmouseover=&quot;alert(1)">x</span></p>';
            const markdown = service.toMarkdown(entityRoute);
            expect(markdown).not.toContain('onmouseover');

            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(markdown);
            expect(probe.querySelector('[onmouseover]')).toBeNull();
            expect(probe.textContent).toBe('x');
            for (const el of Array.from(probe.querySelectorAll('*'))) {
                expect(Array.from(el.attributes).map((a) => a.name).filter((n) => n !== 'style')).toEqual([]);
            }
        });

        it('leaves an unstyled span alone', () => {
            expect(service.toMarkdown('<p>a <span>plain</span> b</p>')).toBe('a plain b');
        });
    });

    describe('backslash escapes (CommonMark)', () => {
        const BS = String.fromCodePoint(92);

        it('treats escaped punctuation as literal, not syntax', () => {
            // Both halves were broken: the escape was ignored AND the backslash
            // rendered, so "2 \\* 3 \\* 4" came out as "2 \\ 3 \\ 4" in italics.
            const cases: ReadonlyArray<readonly [string, string]> = [
                ['a ' + BS + '* not em ' + BS + '* b', 'a * not em * b'],
                ['a ' + BS + '_ not em ' + BS + '_ b', 'a _ not em _ b'],
                [BS + '# not a heading', '# not a heading'],
                [BS + '- not a list', '- not a list'],
                [BS + '[not a link]', '[not a link]'],
                ['a ' + BS + '`not code' + BS + '` b', 'a `not code` b'],
                ['path C:' + BS + BS + 'temp', 'path C:' + BS + 'temp'],
            ];
            for (const [src, want] of cases) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(src);
                expect(probe.textContent).toBe(want);
                expect(probe.querySelectorAll('em, strong')).toHaveLength(0);
            }
        });

        it('leaves a backslash inside a code span alone', () => {
            // CommonMark: escapes do NOT apply inside a code span. protectEscapes
            // copies a span whole for this reason -- `\\d+` and `C:\\temp` are
            // the common case and must survive untouched, while an escaped
            // backtick OUTSIDE a span must not open one. Both rules hold at once
            // only because the scan handles them in the same pass.
            for (const [src, want] of [
                ['use `' + BS + 'd+' + BS + 's*` here', BS + 'd+' + BS + 's*'],
                ['use `C:' + BS + 'temp` here', 'C:' + BS + 'temp'],
                ['use `a ' + BS + '* b` here', 'a ' + BS + '* b'],
            ] as ReadonlyArray<readonly [string, string]>) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(src);
                expect(probe.querySelector('code')?.textContent).toBe(want);
            }
        });

        it('escapes literal punctuation on the way OUT', () => {
            // The serializer emitted text nodes raw, so plain prose corrupted on
            // save: "2 * 3 * 4" came back "2  3  4" in italics and a line
            // starting "# " became a heading. Measured across every ASCII
            // punctuation character in both positions; these are the only eight
            // shapes that change meaning, so only these are escaped.
            for (const text of [
                '2 * 3 * 4',
                'a _b_ c',
                'a `b` c',
                '# not a heading',
                '- not a list',
                '+ not a list',
                '> not a quote',
            ]) {
                const host = document.createElement('p');
                host.textContent = text;
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(service.toMarkdown(host.outerHTML));
                expect(probe.textContent).toBe(text);
            }
        });

        it('never escapes the contents of a code span', () => {
            // The test above sets host.textContent, so its paragraph holds ONE
            // TEXT NODE and no elements -- it never reaches the <code> path where
            // the escaping was wrong. Its 'a `b` c' case looks like it covers code
            // spans but is a literal backtick in prose, which is exactly the shape
            // where the bug is absent. Sabotaging escapeMarkdownText turns it red,
            // so it reads healthy while a live defect ships.
            //
            // A code span is inert text: nothing inside it is ever escaped. The
            // read side enforced that by copying spans whole; the write side did
            // not, so a backslash accrued on EVERY save without bound
            // (foo_bar -> foo\_bar -> foo\\_bar), and an escaped backtick closed
            // the span early, spilling the tail into the paragraph.
            //
            // Asserted over three cycles on the <code> element itself, because
            // one cycle cannot see growth and textContent cannot see the element
            // boundary breaking.
            const BT = String.fromCodePoint(96);
            for (const content of [
                'foo_bar',
                'a*b',
                '- x',
                '> y',
                'C:' + BS + 'temp',
                'use ' + BT + 'z' + BT + ' here',
            ]) {
                const host = document.createElement('p');
                const code = document.createElement('code');
                code.textContent = content;
                host.append(document.createTextNode('x '), code, document.createTextNode(' y'));

                let md = service.toMarkdown(host.outerHTML);
                for (let cycle = 0; cycle < 3; cycle++) {
                    const probe = document.createElement('div');
                    probe.innerHTML = service.toHtml(md);
                    expect(probe.querySelector('code')?.textContent).toBe(content);
                    md = service.toMarkdown(service.toHtml(md));
                }
            }
        });

        it('reads back a code span that contains a backtick', () => {
            // handleCodeTag emits a delimiter run longer than any run inside the
            // content, per CommonMark. protectInlineCode matched only single
            // backticks, so it closed at the first inner tick and the rest of the
            // code escaped the element into the surrounding prose.
            const BT = String.fromCodePoint(96);
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml('x ' + BT + BT + 'use ' + BT + 'z' + BT + ' here' + BT + BT + ' y');
            expect(probe.querySelectorAll('code')).toHaveLength(1);
            expect(probe.querySelector('code')?.textContent).toBe('use ' + BT + 'z' + BT + ' here');
            expect(probe.textContent).toBe('x use ' + BT + 'z' + BT + ' here y');
        });

        it('does not escape punctuation that needs no escaping', () => {
            // The escape set is deliberately minimal: over-escaping would litter
            // documents with backslashes nobody typed.
            const host = document.createElement('p');
            host.textContent = 'Hello, world! (see: item 1.) 50% ~ 100%';
            expect(service.toMarkdown(host.outerHTML)).not.toContain(BS);
        });
    });

    describe('empty inline elements emit nothing', () => {
        it('does not turn an emptied bold or code run into visible punctuation', () => {
            // Deleting the text inside a bold or code run leaves <strong></strong>
            // or <code></code>, and the delimiters were emitted around the empty
            // body: **** and `` appeared in the document as literal characters the
            // author never typed, and neither parses back, so the noise stuck.
            for (const tag of ['code', 'em', 'strong', 'del', 'mark', 'u']) {
                const host = document.createElement('p');
                host.append(
                    document.createTextNode('a '),
                    document.createElement(tag),
                    document.createTextNode(' b'),
                );
                const md = service.toMarkdown(host.outerHTML);
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                // One space: the two around the emptied run show as one on the
                // page, and the save writes what the page shows.
                expect(probe.textContent).toBe('a b');
                expect(service.toMarkdown(service.toHtml(md))).toBe(md);
            }
        });

        it('still emits tags that are meaningfully empty', () => {
            // The rule is an ALLOWLIST of body-wrapping tags, not "empty
            // textContent": <br> and <img> are empty too but mean something on
            // their own. A first attempt keyed off empty textContent alone and
            // swallowed every line break in the document -- caught only because
            // the existing <br> tests were there.
            expect(service.toMarkdown('<p>x<br>y</p>')).toContain('x');
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(service.toMarkdown('<p>x<br>y</p>'));
            expect(probe.querySelector('br')).toBeTruthy();

            const img = service.toMarkdown('<p><img src="https://e.com/i.png" alt="z"></p>');
            expect(img).toContain('https://e.com/i.png');
        });

        it('keeps an inline whose only content is an image or a space', () => {
            const withImg = service.toMarkdown('<p><strong><img src="https://e.com/i.png" alt="z"></strong></p>');
            expect(withImg).toContain('https://e.com/i.png');
            expect(withImg).toContain('**');

            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(service.toMarkdown('<p>a <code> </code> c</p>'));
            expect(probe.querySelector('code')?.textContent).toBe(' ');
        });
    });

    describe('backslashes and code spans (round-33 audit)', () => {
        const BSC = String.fromCodePoint(92);
        const TICK = String.fromCodePoint(96);
        const NLC = String.fromCodePoint(10);

        const cycleText = (html: string, times: number): string[] => {
            let md = service.toMarkdown(html);
            const seen: string[] = [];
            for (let i = 0; i < times; i++) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                seen.push(probe.textContent ?? '');
                md = service.toMarkdown(service.toHtml(md));
            }
            return seen;
        };

        it('keeps a trailing backslash inside a verbatim tag', () => {
            // escapeMarkdownText did not escape the backslash, and the verbatim
            // and styled-span paths emit a raw closing tag right after the text,
            // so a trailing one parked the closing bracket of the tag itself.
            // The tag was decapitated into literal text and the content was gone
            // a cycle later; <u> lost the whole paragraph by cycle 2.
            const seen = cycleText('<p>Copy to <mark>C:' + BSC + 'Users' + BSC + '</mark> now</p>', 3);
            for (const text of seen) {
                expect(text).toBe('Copy to C:' + BSC + 'Users' + BSC + ' now');
            }

            for (const html of ['<p><u>' + BSC + '</u></p>',
                                '<p><span style="color: red">' + BSC + '</span></p>']) {
                expect(cycleText(html, 3)).toEqual([BSC, BSC, BSC]);
            }
        });

        it('does not erode a double backslash in prose', () => {
            // protectEscapes consumes a backslash before ASCII punctuation on the
            // way back, and the backslash is itself escapable, so a doubled one
            // lost a character on the FIRST save and kept eroding. A document of
            // regexes or Windows paths bled a backslash per save.
            for (const want of ['a' + BSC + BSC + 'b', BSC + BSC, 'regex ' + BSC + BSC + 'd']) {
                const host = document.createElement('p');
                host.textContent = want;
                for (const text of cycleText(host.outerHTML, 3)) {
                    expect(text).toBe(want);
                }
            }
        });

        it('keeps backslashes inside a MULTI-tick code span', () => {
            // protectEscapes claimed to copy a span whole but used indexOf on a
            // single backtick, so for a two-tick span it copied the openers and
            // scanned the BODY as prose, dropping backslashes in exactly the
            // spans that hold a backtick. Every existing case here was a
            // SINGLE-tick span, the one shape where the bug cannot appear.
            for (const content of ['a ' + BSC + TICK + ' b', 'x ' + BSC + '* ' + TICK + 'y' + TICK]) {
                const host = document.createElement('p');
                const code = document.createElement('code');
                code.textContent = content;
                host.append(code);
                const md = service.toMarkdown(host.outerHTML);
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelector('code')?.textContent).toBe(content);
            }
        });

        it('keeps two adjacent code elements apart', () => {
            // Two spans written back to back join into one, and four characters
            // nobody typed enter the content. The verbatim form keeps them
            // separate without inventing a space.
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(
                service.toMarkdown('<p><code>a</code><code>b</code></p>'),
            );
            expect(probe.querySelectorAll('code')).toHaveLength(2);
            expect(probe.textContent).toBe('ab');
        });

        it('keeps a code span that holds a newline', () => {
            // A code span cannot cross a line, so the emitted backticks could not
            // be read back: the element was lost and its delimiters became
            // visible text, splitting the paragraph when the line was blank.
            const probe = document.createElement('div');
            probe.innerHTML = service.toHtml(
                service.toMarkdown('<p><code>a' + NLC + 'b</code></p>'),
            );
            expect(probe.querySelector('code')?.textContent).toBe('a' + NLC + 'b');
        });

        it('does not erode padding spaces inside a code span', () => {
            // stripCodeSpanPadding removes one pair on the way back, but padding
            // was only added for a leading or trailing BACKTICK, so a space was
            // eaten from each side on every save until none were left.
            const host = document.createElement('p');
            const code = document.createElement('code');
            code.textContent = '  a  ';
            host.append(code);
            let md = service.toMarkdown(host.outerHTML);
            for (let i = 0; i < 3; i++) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelector('code')?.textContent).toBe('  a  ');
                md = service.toMarkdown(service.toHtml(md));
            }
        });

        it('does not accumulate padding on an all-space code span', () => {
            // The padding fix had its own bug: CommonMark keeps a span of only
            // spaces as-is, so the strip declines and added padding accumulates.
            // Caught by a test written an hour earlier for a different reason.
            const host = document.createElement('p');
            const code = document.createElement('code');
            code.textContent = ' ';
            host.append(code);
            let md = service.toMarkdown(host.outerHTML);
            for (let i = 0; i < 3; i++) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelector('code')?.textContent).toBe(' ');
                md = service.toMarkdown(service.toHtml(md));
            }
        });
    });


    describe('narrow-input findings (input-class audit)', () => {
        const NLC = String.fromCodePoint(10);

        it('keeps block content inside a toggle block', () => {
            // Every :::details test used a body of plain inline prose, the one
            // sub-class where a blind <p> wrap loses nothing. parseToggleBlocks
            // runs BEFORE the block passes, so a list, heading, quote or table in
            // a toggle was frozen as literal text -- and a table swallowed the
            // whole <details> element into a header cell.
            const cases: ReadonlyArray<readonly [string, string]> = [
                [':::details T' + NLC + '- a' + NLC + '- b' + NLC + ':::', 'ul'],
                [':::details T' + NLC + '## H' + NLC + ':::', 'h2'],
                [':::details T' + NLC + '> quote' + NLC + ':::', 'blockquote'],
                [':::details T' + NLC + '| a | b |' + NLC + '| --- | --- |' + NLC + '| 1 | 2 |' + NLC + ':::', 'table'],
            ];
            for (const [src, tag] of cases) {
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(src);
                const details = probe.querySelector('details');
                expect(details).toBeTruthy();
                expect(details?.querySelector(tag)).toBeTruthy();
            }
        });

        it('keeps a heading or rule inside a blockquote', () => {
            // buildBlockquote ran only parseLists over its body, and every test
            // used plain lines or a list -- the one block type that survived. A
            // quoted heading or divider was demoted to literal characters on the
            // first save, as a stable fixed point.
            const cases: ReadonlyArray<readonly [string, string]> = [
                ['<blockquote><h2>Q</h2></blockquote>', 'h2'],
                ['<blockquote><p>a</p><hr></blockquote>', 'hr'],
                ['<blockquote><ul><li>x</li></ul></blockquote>', 'ul'],
            ];
            for (const [html, tag] of cases) {
                const md = service.toMarkdown(html);
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelector('blockquote')?.querySelector(tag)).toBeTruthy();
            }
        });

        it('keeps style on a verbatim inline tag', () => {
            // The verbatim-tag test used bare tags with no attributes; the styling
            // test covered only <span>. The two conditions were never combined, so
            // a user who highlighted text and then coloured it lost the colour on
            // save -- the flattened-span defect, one element away.
            for (const tag of ['u', 'mark', 'sub', 'sup', 'small', 'ins']) {
                const md = service.toMarkdown(
                    '<p>A<' + tag + ' style="color: red">X</' + tag + '>B</p>',
                );
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelector(tag)?.getAttribute('style')).toBe('color: red');
                expect(service.toMarkdown(service.toHtml(md))).toBe(md);
            }
        });

        it('keeps a link or image whose TEXT contains brackets', () => {
            // The URL half of this pattern was hardened across several rounds
            // (parentheses, * and _), but link TEXT was always bracket-free -- and
            // the text class explicitly excluded "]", so "see [1]" or "[Draft]
            // spec" destroyed the anchor and showed its markdown source as text.
            const cases: ReadonlyArray<readonly [string, string]> = [
                ['<p><a href="https://e.com">see [1]</a></p>', 'a'],
                ['<p><a href="https://e.com">[Draft] spec</a></p>', 'a'],
                ['<p><img src="https://e.com/a.png" alt="fig [1]"></p>', 'img'],
                ['<p><a href="https://e.com">a (b)</a></p>', 'a'],
            ];
            for (const [html, tag] of cases) {
                const md = service.toMarkdown(html);
                const probe = document.createElement('div');
                probe.innerHTML = service.toHtml(md);
                expect(probe.querySelector(tag)).toBeTruthy();
            }
        });
    });


    describe('list item continuations (round-3 audit)', () => {
        const readMarkdown = (markdown: string): HTMLElement => {
            const holder = document.createElement('div');
            holder.innerHTML = service.toHtml(markdown);
            return holder;
        };

        it.each([
            ['a details block', '1. a\n   :::details X\n   body\n   :::\n2. b', 'ol > li details > summary', 'X'],
            ['a details block holding a list', '1. a\n   :::details X\n   - c\n   :::\n2. b', 'ol > li details li', 'c'],
            // A paragraph first: a continuation of one line is trimmed, which hid
            // the indent a wrong dedent leaves in front of the quote.
            ['a quote under a two-digit number', '10. a\n    p\n\n    > q\n11. b', 'ol > li > blockquote', 'q'],
            ['a quote under a bullet with three spaces after it', '-   a\n    p\n\n    > q\n-   b', 'ul > li > blockquote', 'q'],
        ])('reads %s indented to its item\'s content as the item\'s block', (_name, markdown, selector, text) => {
            // A continuation lost two spaces whatever the marker, so under "1. "
            // one space was left and neither a details block nor a quote opened.
            const out = readMarkdown(markdown);

            expect(out.querySelector(selector)?.textContent).toBe(text);
            expect(out.querySelectorAll(':scope > ol > li, :scope > ul > li')).toHaveLength(2);
            expect(out.textContent).not.toContain(':::');
        });

        it.each([
            ['a details block, then a paragraph at two spaces', '1. a\n\n   :::details X\n   body\n   :::\n\n  tail', 'li > details > summary', 'X', 'tail'],
            ['a heading and a quote, then a paragraph at two spaces', '10. a\n\n    ## h\n\n    > q\n    > r\n\n  t', 'li > blockquote', 'qr', 't'],
            ['a quote, then a lazy line at two spaces', '-   a\n    b\n\n    > q\n    > r\n  c', 'li > blockquote', 'qr', 'c'],
        ])('reads %s under a wide marker as blocks of the item', (_name, markdown, selector, text, last) => {
            // Dedented by its least indented line, one later line at two spaces
            // left the block's quotes and details blocks one or two spaces in,
            // where neither opens, and their markers showed as text.
            const out = readMarkdown(markdown);

            expect(out.querySelector(selector)?.textContent).toBe(text);
            expect(out.textContent).not.toContain(':::');
            expect(out.textContent).not.toContain('>');
            expect(out.querySelector('li')?.textContent).toContain(last);
        });

        it.each([
            ['a quote', '- a\n\n    > q\n    > r', 'li > blockquote', 'qr', 1],
            ['a quote under a number', '1. a\n\n     > q\n     > r', 'li > blockquote', 'qr', 1],
            ['two headings', '- a\n\n    ## h\n    ## g', 'li > h2', 'h', 2],
            ['a details block', '- a\n\n    :::details X\n    body\n    :::', 'li > details > summary', 'X', 1],
        ])('reads %s indented past the item\'s content column as blocks of the item', (_name, markdown, selector, text, count) => {
            // Capped at the column, the dedent left extra spaces the trim took off
            // the first line only, so later quote lines, headings and closers were text.
            const out = readMarkdown(markdown);

            expect(out.querySelector(selector)?.textContent).toBe(text);
            expect(out.querySelectorAll(selector)).toHaveLength(count);
            expect(out.textContent).not.toContain('>');
            expect(out.textContent).not.toContain(':::');
            expect(out.textContent).not.toContain('#');
        });

        it.each([
            ['backticks in a link target', '[x](https://a.test/`b`c)', 'a', '/%60b%60c'],
            ['backticks in an image target', '![p](https://a.test/`b`.png)', 'img', '/%60b%60.png'],
            ['a "<" in a link target', '[a](https://e.com/?q=<b>)', 'a', '?q=%3Cb%3E'],
            ['a tag inside a link target', '[a](https://e.com/a<b>c)', 'a', '/a%3Cb%3Ec'],
            ['a "<" in an image target', '![p](https://a.test/<b>.png)', 'img', '/%3Cb%3E.png'],
        ])('reads %s as the characters typed, and settles', (_name, markdown, element, ending) => {
            // CommonMark reads a target from its characters. A parked code span made
            // it text, and an escaped "<" was escaped again into "&lt;" in the address.
            const out = readMarkdown(markdown);
            const node = out.querySelector(element) as (HTMLAnchorElement & HTMLImageElement) | null;
            const address = element === 'a' ? node?.href : node?.src;
            const once = service.toMarkdown(out.innerHTML);

            expect(address?.slice(-ending.length)).toBe(ending);
            expect(out.textContent).not.toContain('`');
            expect(service.toMarkdown(service.toHtml(once))).toBe(once);
        });

        it.each([
            ['a raw tag in a link target', '[x](https://a.test/<span title="q">y</span>)', 'a'],
            ['a raw tag in an image target', '![p](https://a.test/<span title="q">y</span>.png)', 'img'],
            ['a code span with a space in a link target', '[x](https://a.test/`b c`)', 'a'],
        ])('reads %s holding a space as text, not a link or image, and settles', (_name, markdown, element) => {
            // A target with a space is no target. Taken as one, the parked token was
            // restored inside the attribute, breaking it.
            const out = readMarkdown(markdown);
            const once = service.toMarkdown(out.innerHTML);

            expect(out.querySelector(element)).toBeNull();
            expect(out.textContent).not.toContain('noopener');
            expect(service.toMarkdown(service.toHtml(once))).toBe(once);
        });

        it('keeps a raw tag written in image alt text as the alt text', () => {
            // The parked tag was restored after the attribute was written, so its
            // quotes ended the attribute and the rest of the tag showed on the page.
            const out = readMarkdown('![<span style="color:red">x</span>](https://x.test/a.png)');

            expect(out.querySelectorAll('img')).toHaveLength(1);
            expect(out.querySelector('img')?.getAttribute('alt')).toBe('<span style="color:red">x</span>');
            expect(out.textContent).toBe('');
        });

        it('gives a line after a blank, indented short of a sub-list\'s items, to the item holding the sub-list', () => {
            const out = readMarkdown('- a\n  - b\n\n  c');

            expect(out.querySelector('li li')?.textContent).toBe('b');
            expect(out.querySelector(':scope > ul > li > ul + p')?.textContent).toBe('c');
        });

        it('keeps a line with no blank before it in the sub-list\'s item', () => {
            expect(readMarkdown('- a\n  - b\n  c').querySelector('li li')?.textContent).toContain('c');
        });

        it('keeps a paragraph after a list with a sub-list outside the list', () => {
            const out = readMarkdown('- a\n  - b\n\nc');

            expect(out.querySelector(':scope > p')?.textContent).toBe('c');
            expect(out.querySelector(':scope > ul')?.textContent).toBe('ab');
        });
    });
});

describe('RichTextMarkdownService - attribute values cannot break out of their attribute (fine-comb review)', () => {
    let service: RichTextMarkdownService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextMarkdownService, RichTextSanitizerService] });
        service = TestBed.inject(RichTextMarkdownService);
    });

    const parse = (md: string): HTMLElement =>
        new DOMParser().parseFromString(service.toHtml(md), 'text/html').body;

    it('a quote in a relative image target stays inside src', () => {
        // A relative target is returned verbatim by sanitizeImageSrc, so the
        // quote reached the attribute unescaped and opened a second one.
        const img = parse('![x](./a"b.png)').querySelector('img');
        expect(img?.getAttribute('src')).toBe('./a"b.png');
        expect(img?.attributes).toHaveLength(2);
    });

    it('a quote in a relative link target stays inside href', () => {
        const a = parse('[x](/docs/a"b)').querySelector('a');
        expect(a?.getAttribute('href')).toBe('/docs/a"b');
        expect(a?.hasAttribute('style')).toBe(false);
    });

    it('an attempted attribute injection writes no attribute', () => {
        const img = parse('![x](./a" style="color:red)').querySelector('img');
        expect(img?.hasAttribute('style')).toBe(false);
        expect(img?.getAttribute('src')).toBe('./a" style="color:red');
    });

    it('an ampersand in a target survives the round trip', () => {
        const a = parse('[x](https://example.com/?a=1&b=2)').querySelector('a');
        expect(a?.getAttribute('href')).toBe('https://example.com/?a=1&b=2');
    });
});
