import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextMarkdownService, RichTextSanitizerService } from './index';

/**
 * Round-trip stability corpus.
 *
 * Four of the audit's findings were the same defect in different clothes: a
 * document that changed a little on every save -- a backslash gained, a space
 * lost, a paragraph fused -- with no single test that would notice, because
 * every existing test asserted one direction of one shape. This spec asserts
 * the property those findings all violated: once a document has been through
 * the editor once, saving it again changes nothing.
 *
 * The first cycle is allowed to normalise (hand-written markdown is not
 * always in the editor's canonical form); the second must be a fixed point.
 * Add a shape here whenever a round-trip bug is fixed, so it stays fixed.
 */
describe('RichTextMarkdownService - round-trip fixed point', () => {
    let service: RichTextMarkdownService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextMarkdownService, RichTextSanitizerService] });
        service = TestBed.inject(RichTextMarkdownService);
    });

    const cycle = (md: string): string => service.toMarkdown(service.toHtml(md));

    const corpus: ReadonlyArray<readonly [string, string]> = [
        ['heading and paragraph', '# Title\n\nSome **bold** and *italic* text.'],
        ['nested bullet list', '- one\n  - one.a\n  - one.b\n- two'],
        ['numbered list with an empty item', '1. first\n2. \n3. third'],
        ['task list', '- [ ] open\n- [x] done'],
        ['nested blockquote', '> outer\n> > inner\n> back out'],
        ['quoted heading and list', '> ## Quoted\n> - a\n> - b'],
        ['fence with a longer inner fence', '````md\n```\ncode\n```\n````'],
        ['fence in a list item', '- item\n\n  ```js\n  const x = 1;\n  ```'],
        ['inline code with backslash and backtick', 'Use `` a`b `` and `C:\\temp` here.'],
        ['backslash escapes', 'literal \\*stars\\* and \\# not a heading and a \\\\ backslash'],
        ['gfm table with escaped pipe', '| a | b |\n| --- | --- |\n| x\\|y | z |'],
        ['image and link with parens', '![alt (x)](https://example.com/a(1).png) [text [1]](https://en.wikipedia.org/wiki/A_(b))'],
        ['hard line break', 'line one  \nline two'],
        ['horizontal rule between paragraphs', 'before\n\n---\n\nafter'],
        ['details block', ':::details Summary\nbody text\n\n- with a list\n:::'],
        ['verbatim inline tags', 'a <mark>marked</mark> <sub>sub</sub> <sup>sup</sup> <u>under</u> word'],
        ['styled span', 'a <span style="color: red">red</span> word'],
        ['strikethrough and code span', '~~gone~~ and `kept`'],
        ['list followed by prose', '- a\n- b\n\nA paragraph after the list.'],
        ['paragraph with asterisks', '2 * 3 * 4 = 24'],
        ['prose that starts with a year', '2024. A good year for the team.'],
        ['prose about markup', 'Use the <b> element for bold, and <br> for a break.'],
        ['heading followed directly by prose', '# Title\nBody text on the next line'],
        ['quote followed directly by prose', '> quoted\nBody after the quote'],
        ['spaced thematic break', 'above\n\n* * *\n\nbelow'],
    ];

    it.each(corpus)('%s is stable after one normalising cycle', (_name, md) => {
        const once = cycle(md);
        const twice = cycle(once);
        expect(twice).toBe(once);
    });

    it.each(corpus)('%s keeps its visible text through the round trip', (_name, md) => {
        // A weaker property, but one that also holds on the FIRST cycle: no
        // words are lost or invented. Markup characters are stripped from both
        // sides so only the prose is compared.
        const letters = (html: string): string => {
            const body = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
            return body.replaceAll(/[^\p{L}\p{N}]/gu, '');
        };
        expect(letters(service.toHtml(cycle(md)))).toBe(letters(service.toHtml(md)));
    });
});

describe('RichTextMarkdownService - shapes the round-trip used to corrupt (fine-comb review)', () => {
    let service: RichTextMarkdownService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextMarkdownService, RichTextSanitizerService] });
        service = TestBed.inject(RichTextMarkdownService);
    });

    const parse = (md: string): HTMLElement => new DOMParser().parseFromString(service.toHtml(md), 'text/html').body;

    it('keeps "2024. A good year" as prose across a save', () => {
        const md = service.toMarkdown('<p>2024. A good year for the team</p>');
        const body = parse(md);
        expect(body.querySelector('ol')).toBeNull();
        expect(body.textContent).toBe('2024. A good year for the team');
    });

    it('keeps a literal <b> in prose as text across a save', () => {
        const md = service.toMarkdown('<p>Use the &lt;b&gt; element</p>');
        const body = parse(md);
        expect(body.querySelector('b')).toBeNull();
        expect(body.textContent).toBe('Use the <b> element');
    });

    it('wraps prose that directly follows a heading, a quote or a table in a paragraph', () => {
        expect(parse('# Title\nBody text').querySelector('p')?.textContent).toBe('Body text');
        expect(parse('> q\nBody').querySelector('blockquote + p')?.textContent).toBe('Body');
        expect(parse('| a |\n| --- |\n| b |\nAfter').querySelector('p')?.textContent).toBe('After');
        expect(parse('- item\nAfter').querySelector('p')?.textContent).toBe('After');
    });

    it('reads a spaced thematic break as a rule, not a bullet', () => {
        expect(parse('* * *').querySelector('hr')).not.toBeNull();
        expect(parse('- - -').querySelector('ul')).toBeNull();
        expect(parse('- - -').querySelector('hr')).not.toBeNull();
    });
});

describe('RichTextMarkdownService - a nested block keeps what it holds through a save', () => {
    let service: RichTextMarkdownService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextMarkdownService, RichTextSanitizerService] });
        service = TestBed.inject(RichTextMarkdownService);
    });

    const saved = (html: string): string => service.toHtml(service.toMarkdown(html));
    const read = (html: string): HTMLElement => {
        const holder = document.createElement('div');
        holder.innerHTML = html;
        return holder;
    };

    it('keeps a rule inside a list item a rule, not the text "---"', () => {
        const out = read(saved('<ul><li><p>a</p><hr><p>b</p></li></ul>'));

        expect(out.querySelector('li hr')).not.toBeNull();
        expect(out.textContent).not.toContain('---');
        expect(Array.from(out.querySelector('li')!.children).map((el) => `${el.tagName}:${el.textContent}`))
            .toEqual(['P:a', 'HR:', 'P:b']);
    });

    it('turns a rule inside a table cell into a line break, never the text "---"', () => {
        const out = read(saved('<table><tbody><tr><td><p>a</p><hr><p>b</p></td></tr></tbody></table>'));
        const cell = out.querySelector('td, th')!;

        expect(cell.textContent).toBe('ab');
        expect(cell.querySelector('br')).not.toBeNull();
    });

    it('keeps a details block inside a quote at one quote level through two saves', () => {
        const once = saved('<blockquote><details><summary>s</summary><p>b</p></details></blockquote>');

        expect(saved(once)).toBe(once);
        expect(read(once).querySelectorAll('blockquote')).toHaveLength(1);
        expect(read(once).querySelector('blockquote > details > summary')?.textContent).toBe('s');
    });

    it('never pairs a quoted details opener with a closer outside the quote', () => {
        // An unquoted ":::" later in the document closed a block opened inside
        // the quote, so the quote's lines became a details body.
        const out = read(service.toHtml('> :::details s\n> body\n\nafter\n\n:::'));

        // Taken across the quote, the block swallowed the paragraph after it.
        expect(out.querySelector('details')).toBeNull();
        expect(Array.from(out.querySelectorAll('p')).some((p) => p.textContent === 'after' && !p.closest('blockquote, details'))).toBe(true);
    });

    it('keeps the blank row and trailing spaces inside a quoted code block', () => {
        const out = read(saved('<blockquote><pre><code>x  \n\ny</code></pre></blockquote>'));

        expect(out.querySelector('blockquote pre code')?.textContent).toBe('x  \n\ny');
    });

    it('saves bold inside bold as bold, with no stray asterisks', () => {
        const out = read(saved('<p><b><b>x</b> y</b></p>'));

        expect(out.textContent).toBe('x y');
        expect(out.querySelector('strong, b')?.textContent).toBe('x y');
    });

    it('saves italic inside italic as italic, with no stray asterisks', () => {
        const out = read(saved('<p><i>a <em>b</em></i></p>'));

        expect(out.textContent).toBe('a b');
        expect(out.querySelector('em, i')?.textContent).toBe('a b');
    });

    it('keeps the formatting and the image in a details summary', () => {
        const out = read(saved('<details><summary>see <b>this</b> <img src="https://example.com/a.png" alt="pic"></summary><p>body</p></details>'));
        const summary = out.querySelector('summary')!;

        expect(summary.querySelector('strong, b')?.textContent).toBe('this');
        expect(summary.querySelector('img')?.getAttribute('alt')).toBe('pic');
    });

    it('keeps a numbered list starting number through a save', () => {
        const markdown = service.toMarkdown('<ol start="4"><li>four</li><li>five</li></ol>');

        expect(markdown.trim()).toBe('4. four\n5. five');
        expect(read(service.toHtml(markdown)).querySelector('ol')?.getAttribute('start')).toBe('4');
    });

    it.each([
        ['a heading', '<ul><li><h2>title</h2></li></ul>', 'li > h2'],
        ['a code block', '<ul><li><pre><code>x = 1</code></pre></li></ul>', 'li > pre'],
        ['a table', '<ol><li><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table></li></ol>', 'li table'],
        ['a rule', '<ul><li><hr></li><li>next</li></ul>', 'li > hr'],
        ['a quote', '<ul><li><blockquote><p>q</p></blockquote></li></ul>', 'li > blockquote'],
    ])('keeps an item that opens with %s inside its list', (_name, html, selector) => {
        // Written on the marker line, none of these read back: the heading,
        // fence and table became literal characters and a rule left the list.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector(selector)).not.toBeNull();
        expect(out.textContent).not.toMatch(/##|```|\||---/);
        expect(saved(once)).toBe(once);
    });

    it('keeps a details block inside another, each with its own body', () => {
        const once = saved('<details><summary>outer</summary><details><summary>inner</summary><p>deep</p></details><p>after</p></details>');
        const out = read(once);

        expect(out.querySelector('details > details > summary')?.textContent).toBe('inner');
        expect(out.querySelector('details > details > p')?.textContent).toBe('deep');
        expect(out.textContent).not.toContain(':::');
        expect(saved(once)).toBe(once);
    });

    it('reads bold around two italics as bold holding two italics', () => {
        const out = read(saved('<p><b><i>x</i> <i>y</i></b></p>'));

        expect(out.textContent).toBe('x y');
        expect(Array.from(out.querySelectorAll('strong em, b i, b em, strong i')).map((el) => el.textContent)).toEqual(['x', 'y']);
    });

    it('still reads a single bold-italic run', () => {
        expect(read(service.toHtml('***both***')).querySelector('strong > em')?.textContent).toBe('both');
    });

    it('keeps a quote holding code inside a list item', () => {
        const once = saved('<ul><li><blockquote><pre><code>x = 1</code></pre></blockquote></li></ul>');
        const out = read(once);

        expect(out.querySelector('li > blockquote > pre > code')?.textContent).toBe('x = 1');
        expect(out.textContent).not.toContain('```');
        expect(saved(once)).toBe(once);
    });

    it('gives loose text in a details body paragraphs, beside a rule, and settles', () => {
        const once = saved('<details><summary>s</summary><div><p>a</p><p>b</p><hr><p>c</p></div></details>');
        const out = read(once);
        const details = out.querySelector('details')!;

        expect(Array.from(details.children).slice(1).map((el) => `${el.tagName}:${el.textContent}`))
            .toEqual(['P:a', 'P:b', 'HR:', 'P:c']);
        expect(out.querySelector('p:empty')).toBeNull();
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['italic', '<p>a<i> x</i> b</p>', 'em, i'],
        ['bold', '<p>a <b>x </b>b</p>', 'strong, b'],
        ['strikethrough', '<p>a<s> x </s>b</p>', 'del, s'],
    ])('keeps %s that starts or ends with a space as that emphasis, with no stray delimiters', (_name, html, selector) => {
        // Markdown opens emphasis only before a non-space: the delimiters were
        // written around the space and read back as literal characters.
        const out = read(saved(html));

        // Beside a letter the emphasis is kept as its tag, space and all.
        expect(out.querySelector(selector)?.textContent?.trim()).toBe('x');
        expect(out.textContent).not.toMatch(/[*~]/);
    });

    it('reads italic around bold at its edge back as the same nesting, and settles', () => {
        const once = saved('<p><i><b>x</b> y</i></p>');
        const out = read(once);

        expect(out.querySelector('em > strong, i > b, em > b, i > strong')?.textContent).toBe('x');
        expect(out.querySelector('em, i')?.textContent).toBe('x y');
        expect(saved(once)).toBe(once);
    });

    it('keeps two tables side by side inside a quote as two tables', () => {
        // The quote dropped the blank line between them, so the second table's
        // header and separator read back as rows of the first.
        const table = (a: string, b: string): string =>
            `<table><tbody><tr><td>${a}</td><td>${b}</td></tr><tr><td>${a}2</td><td>${b}2</td></tr></tbody></table>`;
        const once = saved(`<blockquote>${table('a', 'b')}${table('c', 'd')}</blockquote>`);
        const out = read(once);

        expect(out.querySelectorAll('blockquote > table')).toHaveLength(2);
        expect(out.textContent).not.toContain('---');
        expect(saved(once)).toBe(once);
    });

    it('keeps every sub-list of an item that holds two, in order', () => {
        const once = saved('<ul><li>a<ul><li>b</li></ul><ol><li>c</li></ol></li><li>d</li></ul>');
        const out = read(once);

        expect(out.querySelector('ul > li > ul > li')?.textContent).toBe('b');
        expect(out.querySelector('ul > li > ol > li')?.textContent).toBe('c');
        expect(out.textContent).toBe('abcd');
        expect(saved(once)).toBe(once);
    });

    it('keeps a code block with a blank row inside a details block inside a list item', () => {
        const once = saved('<ul><li><details><summary>s</summary><pre><code>x\n\ny</code></pre></details></li></ul>');
        const out = read(once);

        expect(out.querySelector('li details pre code')?.textContent).toBe('x\n\ny');
        expect(out.textContent).not.toContain('```');
        expect(saved(once)).toBe(once);
    });

    it('keeps the heading and the quote of a details block inside a list item', () => {
        const once = saved('<ul><li><details><summary>s</summary><p>a</p><h2>h</h2><blockquote><p>q</p></blockquote></details></li></ul>');
        const out = read(once);

        expect(out.querySelector('li details h2')?.textContent).toBe('h');
        expect(out.querySelector('li details blockquote p')?.textContent).toBe('q');
        expect(out.textContent).not.toMatch(/##|>/);
        expect(saved(once)).toBe(once);
    });

    it('keeps a details block with an empty summary inside a quote', () => {
        const once = saved('<blockquote><details><summary><br></summary><p>b</p></details></blockquote>');
        const out = read(once);

        expect(out.querySelector('blockquote details')).not.toBeNull();
        expect(out.textContent).not.toContain(':::');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['a rule', '<ul><li><p>a</p><hr><p>b</p></li></ul>'],
        ['a table after two paragraphs', '<ul><li><p>a</p><p>x</p><table><tbody><tr><td>c</td></tr></tbody></table></li></ul>'],
    ])('keeps an item holding %s whole, with no empty paragraph inside or after it', (_name, html) => {
        const once = saved(html);
        const out = read(once);

        expect(Array.from(out.children).map((el) => el.tagName)).toEqual(['UL']);
        expect(out.querySelector('p:empty, p table, p hr')).toBeNull();
        expect(saved(once)).toBe(once);
    });

    it('takes the summary that belongs to a details block, not a nested block\'s', () => {
        const out = read(saved('<details><details><summary>i</summary><p>y</p></details><summary>o</summary></details>'));

        expect(out.querySelector(':scope > details > summary')?.textContent).toBe('o');
        expect(out.querySelector(':scope > details > details > summary')?.textContent).toBe('i');
        expect(out.textContent).toContain('y');
    });

    it.each([
        '2024.', '-', '+', '>50%', '---', '~~a~~', '~~~', ':::details x', '[t](https://example.com/)',
        '# tag', '#', '[x] done', '2 * 3 * 4', 'a\\b',
    ])('keeps the text %j as text through a save, in a paragraph and in a list item', (text) => {
        // Each is a shape the parser reads as syntax without a following space,
        // and each came back as a list, a quote, a rule, strikethrough, a code
        // block, a details block, a link, a heading or a task row.
        for (const wrap of [(inner: string) => `<p>${inner}</p>`, (inner: string) => `<ul><li>${inner}</li></ul>`]) {
            const holder = document.createElement('span');
            holder.textContent = text;
            const out = read(saved(wrap(holder.innerHTML)));

            expect(out.textContent).toBe(text);
            expect(out.querySelector('ol, ul ul, blockquote, hr, del, pre, details, a, h1, h2, em, strong, input')).toBeNull();
        }
    });

    it('keeps a details opener and closer typed as paragraphs as text', () => {
        // A lone opener pairs with nothing, so only a closer after it shows
        // whether the keyword was escaped.
        const once = saved('<p>:::details x</p><p>body</p><p>:::</p>');
        const out = read(once);

        expect(out.querySelector('details')).toBeNull();
        expect(Array.from(out.querySelectorAll('p')).map((p) => p.textContent)).toEqual([':::details x', 'body', ':::']);
        expect(saved(once)).toBe(once);
    });

    it('reads a details opener indented under a list item as the item block, with its closer at the margin', () => {
        // Taken at document level, the indented opener paired with the closer
        // and pulled the block out of its item.
        const out = read(service.toHtml('- item\n  :::details s\n  body\n:::'));

        expect(out.querySelector(':scope > details')).toBeNull();
        expect(out.querySelector('li details > summary')?.textContent).toBe('s');
        expect(out.textContent).not.toContain(':::');
    });

    it('keeps a details block with no summary a details block through two saves', () => {
        // Saved as a bare keyword line with no title, which the reader must
        // still take as an opener.
        const once = saved('<details><p>hidden</p></details>');
        const out = read(once);

        expect(out.querySelector('details > p')?.textContent).toBe('hidden');
        expect(out.textContent).not.toContain(':::');
        expect(saved(once)).toBe(once);
    });

    it('gives a details block with no summary of its own no title, not the title of a block inside it', () => {
        const once = saved('<details><p>a</p><details><summary>i</summary><p>y</p></details></details>');
        const out = read(once);

        expect(out.querySelector(':scope > details > summary')?.textContent ?? '').toBe('');
        expect(out.querySelector(':scope > details > details > summary')?.textContent).toBe('i');
        expect(out.textContent).toBe('aiy');
        expect(saved(once)).toBe(once);
    });

    it('keeps a code block after the second paragraph of a list item in its place', () => {
        // The fence arrives as a parked token; glued onto the item first line
        // it jumped ahead of the paragraph before it.
        const once = saved('<ul><li><p>a</p><p>b</p><pre><code>x = 1</code></pre></li><li>c</li></ul>');
        const out = read(once);

        expect(out.querySelector('li')?.textContent).toBe('abx = 1');
        expect(out.querySelector('li > pre > code')?.textContent).toBe('x = 1');
        expect(out.querySelectorAll(':scope > ul > li')).toHaveLength(2);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['bold', '<ul><li><strong>a<br>b</strong> c</li></ul>', 'li > strong', 'ab c'],
        ['italic beside a link', '<ol><li><a href="https://example.com/">l</a> <em>x<br>y</em></li></ol>', 'li > em', 'l xy'],
        ['italic before a sub-list', '<ul><li><em>a<br>b</em> c<ul><li>d</li></ul></li></ul>', 'li > em', 'ab cd'],
    ])('keeps a line break inside %s on the line of a list item, and settles', (_name, html, selector, text) => {
        // Written as a hard break, the second half read back as a paragraph of
        // the item, splitting the emphasis and losing the space beside it.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector(`${selector} br`)).not.toBeNull();
        expect(out.querySelector('li p')).toBeNull();
        expect(out.querySelector('li')?.textContent).toBe(text);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['inside emphasis', '<ol><li><p><em>a<br>b</em> c</p></li><li>d</li></ol>', 'abcd'],
        ['between runs, before a second paragraph', '<ul><li><p>a<br>b</p><p>c</p></li></ul>', 'abc'],
    ])('keeps a line break in the first paragraph of a list item, %s, and settles', (_name, html, text) => {
        // The first paragraph is written on the marker line, where a hard break
        // ended the line and the rest read back as a paragraph of its own.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector('li br')).not.toBeNull();
        expect(out.textContent?.replaceAll(/\s/g, '')).toBe(text);
        expect(saved(once)).toBe(once);
    });

    it('keeps the words of a list item whose last paragraph holds only a break, and settles', () => {
        // Enter leaves this shape. Writing the empty paragraph's padding break as
        // the tag joined the item's lines, and the space between the code span
        // and the link went with it.
        const once = saved('<ul><li><p><code>a</code> <a href="https://example.com/">b</a> c</p><p><br></p></li><li>d</li></ul>');
        const out = read(once);

        expect(out.querySelector('li')?.textContent).toContain('a b c');
        expect(saved(once)).toBe(once);
    });

    it('keeps a line break inside emphasis in a paragraph of a list item, and settles', () => {
        const once = saved('<ul><li><p>a</p><p><em>x<br>y</em> z</p></li></ul>');
        const out = read(once);

        expect(out.querySelector('li em br')).not.toBeNull();
        expect(out.querySelector('li')?.textContent).toBe('axy z');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['only text', '<blockquote><p><strong>a<br>b</strong> c</p></blockquote>'],
        ['a code block too', '<blockquote><p><strong>a<br>b</strong> c</p><pre><code>x  \n\ny</code></pre></blockquote>'],
        ['a nested quote too', '<blockquote><p><strong>a<br>b</strong> c</p><blockquote><p>d</p></blockquote></blockquote>'],
    ])('keeps a line break inside bold in a quote holding %s, and settles', (_name, html) => {
        // Written as a line ending, which bold cannot close across. Beside a
        // block the bold came back as literal asterisks.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector('blockquote > p > strong br')).not.toBeNull();
        expect(out.querySelector('blockquote > p > strong')?.textContent).toBe('ab');
        expect(out.textContent).not.toContain('*');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['after a paragraph', '<blockquote><p>a</p><p>b<br>c</p></blockquote>', 'abc'],
        ['after a task list with a sub-list', '<blockquote><ul data-task-list=""><li data-task="" data-checked="false">'
            + '<input type="checkbox"><span>x</span><ul data-task-list=""><li data-task="" data-checked="false">'
            + '<input type="checkbox"><span>y</span></li></ul></li></ul><p>b<br>c</p></blockquote>', 'xybc'],
        ['in a span inside a details block', '<blockquote><details><summary>s</summary><p>a <span>b<br>c</span></p></details></blockquote>', 'sabc'],
    ])('keeps every word of a quoted paragraph with a break between runs, %s, and settles after one save', (_name, html, text) => {
        // A quote reads each of its lines as a line of its own. Written as the
        // tag, a break between runs read back as two lines, and the next save
        // wrote something else. A span is no formatting: it is written as its
        // text alone.
        const once = saved(html);

        expect(read(once).textContent?.replaceAll(/\s/g, '')).toBe(text);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['after it', '<p>c <span><em>x y</em></span>z</p>', 'c x yz'],
        ['before it', '<p>c<span><u><em>x</em></u></span> z</p>', 'cx z'],
    ])('keeps emphasis inside a wrapper that touches a word %s as emphasis, and settles', (_name, html, text) => {
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector('em')).not.toBeNull();
        expect(out.textContent).toBe(text);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['italic before bold', '<p><em>x</em><b>y</b> z</p>', 'em, i', 'strong, b'],
        ['bold before italic', '<p><strong>x</strong><i>y</i> z</p>', 'strong, b', 'em, i'],
    ])('keeps emphasis against another emphasis with no space between, %s, and settles', (_name, html, first, second) => {
        // Only a text neighbour counted as a word, so the two runs were written
        // as `*x***y**`, whose asterisks the reader paired the wrong way.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector(first)?.textContent).toBe('x');
        expect(out.querySelector(second)?.textContent).toBe('y');
        expect(out.textContent).toBe('xy z');
        expect(saved(once)).toBe(once);
    });

    it('keeps bold ending in italic beside bold opening with italic as the two runs, and settles', () => {
        const once = saved('<p><strong>a <em>h</em></strong> <b><em>f</em> g</b></p>');
        const out = read(once);

        expect(Array.from(out.querySelectorAll('strong, b')).map((el) => el.textContent)).toEqual(['a h', 'f g']);
        expect(Array.from(out.querySelectorAll('em, i')).map((el) => el.textContent)).toEqual(['h', 'f']);
        expect(out.textContent).toBe('a h f g');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['a heading', '<h2>One\nTwo</h2>', 'h2', 'One Two'],
        ['a pretty-printed heading', '<h2>\n  Title\n</h2>', 'h2', 'Title'],
        ['a task row', '<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>a\nb</span></li></ul>', 'li[data-task] > span', 'a b'],
        ['bold in a quote beside a list', '<blockquote><p><strong>a\nb</strong></p><ul><li>x</li></ul></blockquote>', 'blockquote strong', 'a b'],
    ])('reads a newline inside the text of %s as the space it shows, and settles', (_name, html, selector, text) => {
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector(selector)?.textContent?.trim()).toBe(text);
        expect(out.textContent).not.toMatch(/[*~]/);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['a link split by bold', '<p>[see <b>this</b>](https://example.com)</p>', '[see this](https://example.com)'],
        ['a task marker split by a span', '<ul><li>[<span>x</span>] done</li></ul>', '[x] done'],
        ['a number split by a span', '<p>2024<span>.</span> x</p>', '2024. x'],
        ['a number split by a span in a list item', '<ul><li>2024<span>.</span> x</li></ul>', '2024. x'],
        ['nested brackets', '<p>see [note [1]](http://x)</p>', 'see [note [1]](http://x)'],
        ['a table written as text', '<p>| a | b |<br>|---|---|</p>', '| a | b ||---|---|'],
        ['a bare table written as text', '<p>a|b<br>-|-</p>', 'a|b-|-'],
        ['a separator split by a span', '<p>| a |<br>|<span>---</span>|</p>', '| a ||---|'],
        ['entity-shaped text', '<p>Use &amp;lt; and &amp;copy; and &amp;#169;</p>', 'Use &lt; and &copy; and &#169;'],
    ])('keeps %s as text through a save, and settles', (_name, html, text) => {
        // Each is syntax the reader recognises only across element boundaries,
        // or a shape no single-node escape covered.
        const once = saved(html);
        const out = read(once);

        expect(out.textContent).toBe(text);
        expect(out.querySelector('a, ol, ul ul, table, input')).toBeNull();
        expect(saved(once)).toBe(once);
    });

    it('keeps the paragraph after a table in a list item inside a quote a paragraph, and settles', () => {
        const once = saved('<blockquote><ul><li><table><tbody><tr><td>a</td></tr></tbody></table><p>x | y</p></li></ul></blockquote>');
        const out = read(once);

        expect(out.querySelectorAll('td, th')).toHaveLength(1);
        expect(out.textContent).toContain('x | y');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['inline code holding a backtick run', '<blockquote><p><code>a``b</code></p><p>c</p></blockquote>'],
        ['strikethrough that starts with a tilde', '<blockquote><p><del>~x</del></p><p>c</p></blockquote>'],
    ])('keeps a quote holding %s to its two lines, and settles', (_name, html) => {
        // Taken for a fence, the quote kept its blank lines and grew on every save.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelectorAll('blockquote > p')).toHaveLength(2);
        expect(saved(once)).toBe(once);
    });

    it('saves strikethrough inside strikethrough as one run, with no stray tildes', () => {
        const once = saved('<p><s>a <del>b</del></s></p>');
        const out = read(once);

        expect(out.querySelector('del, s')?.textContent).toBe('a b');
        expect(out.textContent).toBe('a b');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['at the top', '<blockquote><table><tbody><tr><td>a</td></tr></tbody></table><p>x</p></blockquote>'],
        ['in a list item', '<ul><li><p>a</p><blockquote><table><tbody><tr><td>a</td></tr></tbody></table><p>x</p></blockquote></li></ul>'],
        ['in a details block', '<details><summary>s</summary><blockquote><table><tbody><tr><td>a</td></tr></tbody></table><p>x</p></blockquote></details>'],
    ])('leaves no empty paragraph after a quoted table followed by text, %s, and settles', (_name, html) => {
        // The quote returned its loose text bare, and the paragraph pass split
        // the quote's markup at the blank line that ends the table.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector('blockquote > p')?.textContent).toBe('x');
        expect(out.querySelector('p:empty')).toBeNull();
        expect(saved(once)).toBe(once);
    });

    it('gives loose text after a blank line in a nested quote a paragraph inside the quote', () => {
        const out = read(service.toHtml('> > a\n>\n> x'));

        expect(out.querySelector(':scope > blockquote > p')?.textContent).toBe('x');
        expect(out.querySelector('p:empty, :scope > p')).toBeNull();
    });

    it.each([
        ['emphasis inside a word', '<p>un<em>a<br><br>b</em>c</p>', 'em'],
        ['bold inside a word', '<p>a<strong>b<br><br>c</strong>d</p>', 'strong'],
        ['an underline', '<p>a <u>b<br><br>c</u> d</p>', 'u'],
        ['a styled span', '<p>a <span style="color: red">b<br><br>c</span> d</p>', 'span[style]'],
    ])('keeps two line breaks inside %s written as tags, and settles', (_name, html, selector) => {
        // A blank line between the breaks put the two tags in different blocks,
        // so neither counted as paired and both came back as text.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelectorAll(`${selector} br`)).toHaveLength(2);
        expect(out.textContent).not.toContain('<');
        expect(saved(once)).toBe(once);
    });

    it('keeps an unclosed details opener in a list item to that item, and the rest of the document outside it', () => {
        const out = read(service.toHtml('- a\n  :::details T\n  body\n\n# H\n\npara\n\n- next'));

        expect(out.querySelector(':scope > h1')?.textContent).toBe('H');
        expect(Array.from(out.querySelectorAll(':scope > p')).map((p) => p.textContent)).toContain('para');
        expect(out.querySelector('li h1, li li, details')).toBeNull();
    });

    it.each([
        ['a heading', '<h2>one<br><br>two</h2>', 'h2'],
        ['a task row', '<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>one<br><br>two</span></li></ul>', 'li[data-task] > span'],
    ])('keeps two line breaks in a row inside %s, and settles', (_name, html, selector) => {
        // The blanks after the first break were taken with it, so the second was
        // written as a newline that ended the line.
        const once = saved(html);
        const out = read(once);

        expect(out.querySelectorAll(`${selector} br`)).toHaveLength(2);
        expect(out.querySelector(selector)?.textContent).toBe('onetwo');
        expect(saved(once)).toBe(once);
    });

    it('writes a newline between two inline runs of a list item as a space, keeping both on the item line', () => {
        // Kept, it put the second run at the start of a line of its own, where it
        // read back as a paragraph after the list.
        const once = saved('<ul><li><b>x</b>\n<i>y</i></li><li>z</li></ul>');
        const out = read(once);

        expect(out.querySelector('ul > li > strong')?.textContent).toBe('x');
        expect(out.querySelector('ul > li > em')?.textContent).toBe('y');
        expect(out.querySelector('li p, :scope > p')).toBeNull();
        expect(saved(once)).toBe(once);
    });

    it('keeps a list item holding two paragraphs with blank text between them whole, and settles', () => {
        const once = saved('<ul><li><p>a</p>\n<p>b</p></li><li>c</li></ul>');
        const out = read(once);

        expect(out.querySelectorAll(':scope > ul > li')).toHaveLength(2);
        expect(out.querySelector(':scope > ul > li')?.textContent?.replaceAll(/\s/g, '')).toBe('ab');
        expect(saved(once)).toBe(once);
    });

    it('keeps a details block with only a summary without a body, and settles', () => {
        // The empty body read back as an empty paragraph the author never wrote.
        const once = saved('<details><summary>s</summary></details><p>after</p>');
        const out = read(once);

        expect(out.querySelector('details > summary')?.textContent).toBe('s');
        expect(out.querySelector('p:empty')).toBeNull();
        expect(saved(once)).toBe(once);
    });

    it('writes blanks before a newline in paragraph text as nothing, not as a break the page never showed', () => {
        const once = saved('<p>a  \nb</p>');
        const out = read(once);

        expect(out.querySelector('br')).toBeNull();
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['an empty span', '<p><em>x</em><span></span>y</p>'],
        ['an empty underline', '<p><em>x</em><u></u>y</p>'],
    ])('keeps emphasis that touches a word past %s as emphasis, and settles', (_name, html) => {
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector('em')?.textContent).toBe('x');
        expect(out.textContent).toBe('xy');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['a fence split by spans', '<p>~<span>~</span>~</p><p>code</p><p>~<span>~</span>~</p>', '~~~code~~~', 'pre'],
        ['an entity split by a span', '<p>a <span>&amp;</span>lt; b</p>', 'a &lt; b', 'b, strong'],
        ['a tag split by spans', '<p><span>&lt;</span>b&gt;x<span>&lt;</span>/b&gt; y</p>', '<b>x</b> y', 'b, strong'],
    ])('keeps %s, whose text nodes each looked harmless, as text, and settles', (_name, html, text, selector) => {
        // Escaped one text node at a time, the syntax only formed once the
        // nodes were written next to each other.
        const once = saved(html);
        const out = read(once);

        expect(out.textContent?.replaceAll('\n', '')).toBe(text);
        expect(out.querySelector(selector)).toBeNull();
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['&copy 2024', '&amp;copy 2024'],
        ['a &lt b', 'a &amp;lt b'],
        ['&#169 x', '&amp;#169 x'],
        ['AT&T&amp', 'AT&amp;T&amp;amp'],
    ])('keeps the entity-looking text %j with no semicolon as text through a save', (text, html) => {
        // The page decodes legacy names and numbers without a semicolon.
        const once = saved(`<p>${html}</p>`);

        expect(read(once).textContent).toBe(text);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['blanks in a span before a newline', '<p><span>a  </span>\nb</p>', 'a b', 0],
        ['a blank after bold beside a newline', '<p><b>a </b> \nb</p>', 'a b', 0],
        ['a newline after a line break', '<p>a<br>\nb</p>', 'ab', 1],
    ])('writes %s as the page shows it, and settles', (_name, html, text, breaks) => {
        // Trimmed one text node at a time, blanks from another node invented a
        // line break, or the second save differed from the first.
        const once = saved(html);
        const out = read(once);

        expect(out.textContent).toBe(text);
        expect(out.querySelectorAll('p')).toHaveLength(1);
        expect(out.querySelectorAll('br')).toHaveLength(breaks);
        expect(saved(once)).toBe(once);
    });

    it('keeps the spaces and newlines inside inline code and a code block as written', () => {
        const once = saved('<p>a <code>x  y</code> b</p><pre><code>one  \n\n  two</code></pre>');
        const out = read(once);

        expect(out.querySelector('p code')?.textContent).toBe('x  y');
        expect(out.querySelector('pre code')?.textContent).toBe('one  \n\n  two');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['prose that starts with a pipe', '<blockquote><p>| a</p><p>b</p></blockquote>', 2],
        ['a code block and the text after it', '<blockquote><pre><code>c</code></pre><p>x</p></blockquote>', 1],
        ['a list and two paragraphs', '<blockquote><ul><li>a</li></ul><p>x</p><p>y</p></blockquote>', 2],
        ['a heading and two paragraphs', '<blockquote><h2>h</h2><p>x</p><p>y</p></blockquote>', 2],
        ['two paragraphs and a list', '<blockquote><p>x</p><p>y</p><ul><li>a</li></ul></blockquote>', 2],
        ['a paragraph with a break beside a list', '<blockquote><ul><li>a</li></ul><p>b<br>c</p></blockquote>', 2],
    ])('keeps every paragraph of a quote holding %s apart, with no empty line, and settles', (_name, html, paragraphs) => {
        // The quote wrote its blocks with no blank line between them: beside a
        // block, two paragraphs read back as one, or an empty line was added.
        const once = saved(html);
        const quoteParagraphs = Array.from(read(once).querySelectorAll('blockquote > p'));

        expect(quoteParagraphs.filter((p) => (p.textContent ?? '').trim() !== '')).toHaveLength(paragraphs);
        expect(quoteParagraphs.filter((p) => (p.textContent ?? '').trim() === '' && !p.querySelector('img'))).toHaveLength(0);
        expect(saved(once)).toBe(once);
    });

    it('keeps a hard break nested inside a quote a line break', () => {
        // The quote trimmed its line ends, and the break's two spaces with them.
        const once = saved('<blockquote><details><summary>s</summary><p>a<br>b</p></details></blockquote>');

        expect(read(once).querySelector('blockquote details p br')).not.toBeNull();
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['a sibling item', '- a\n  :::details T\n  body\n\n- b\n  :::', ':scope > ul > li', 2],
        ['a sibling item with no blank line before it', '- a\n  :::details T\n  body\n- b\n  :::', ':scope > ul > li', 2],
        ['a paragraph after a blank line', '- a\n  :::details T\n  body\n\npara\n\n:::', ':scope > p', 2],
    ])('keeps an unclosed details opener in a list item as text when a closer follows %s', (_name, markdown, selector, count) => {
        // Paired across the item's end, the block took in a sibling item or a
        // top-level paragraph.
        const out = read(service.toHtml(markdown));

        expect(out.querySelector('details')).toBeNull();
        expect(out.querySelectorAll(selector)).toHaveLength(count);
        expect(out.textContent).toContain(':::details T');
    });

    it('still closes a details block in a list item with a closer at the margin right after its body', () => {
        const out = read(service.toHtml('- item\n  :::details s\n  body\n:::'));

        expect(out.querySelector('li details > summary')?.textContent).toBe('s');
    });

    it.each([
        ['after a period', '<p><i><b>x.</b></i><i>.y</i></p>', 'x..y'],
        ['after an exclamation mark', '<p><i><b>x!</b></i><i>(y)</i></p>', 'x!(y)'],
    ])('keeps two italic runs side by side %s as italic, with no stray asterisks', (_name, html, text) => {
        const once = saved(html);
        const out = read(once);

        expect(out.querySelectorAll('em, i')).toHaveLength(2);
        expect(out.textContent).toBe(text);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['a heading', '<h2><code>a  \nb</code></h2>', 'h2 code'],
        ['a paragraph, across a blank line', '<p>x <code>a\n\nb</code> y</p>', 'p code'],
    ])('keeps the spaces and newlines of code written as a tag inside %s, and settles', (_name, html, selector) => {
        const source = read(html).querySelector('code')!.textContent;
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector(selector)?.textContent).toBe(source);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['c++', 'c++'],
        ['c#', 'c#'],
        ['objective-c', 'objective-c'],
        ['c sharp', null],
    ])('keeps a code block whose language is %j, blank row and all, and settles', (language, kept) => {
        const once = saved(`<pre><code data-language="${language}">a\n\nb</code></pre>`);
        const out = read(once);

        expect(out.querySelector('pre code')?.textContent).toBe('a\n\nb');
        expect(out.querySelector('pre code')?.getAttribute('data-language') ?? null).toBe(kept);
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['a closing bracket', 'a]b'],
        ['brackets and a backslash', 'x\\y [z]'],
    ])('keeps an image whose alt text holds %s', (_name, alt) => {
        const holder = document.createElement('p');
        const image = document.createElement('img');
        image.setAttribute('alt', alt);
        image.setAttribute('src', 'https://x.test/a.png');
        holder.appendChild(image);
        const once = saved(holder.outerHTML);

        expect(read(once).querySelector('img')?.getAttribute('alt')).toBe(alt);
        expect(saved(once)).toBe(once);
    });

    it('keeps emphasis inside a word as emphasis, with no stray asterisks', () => {
        const once = saved('<p>un<em>believ</em>able</p>');
        const out = read(once);

        expect(out.querySelector('p > em')?.textContent).toBe('believ');
        expect(out.textContent).toBe('unbelievable');
        expect(saved(once)).toBe(once);
    });

    it.each([
        ['with a space after its marker', '## \n\nPara'],
        ['with nothing after its marker', '##\n\nPara'],
    ])('reads a hand-written empty heading %s as empty, leaving the paragraph after it', (_name, markdown) => {
        // The editor writes an empty heading with a break tag, so only markdown
        // typed by hand has a marker with nothing after it.
        const out = read(service.toHtml(markdown));

        expect(out.querySelector('h2')?.textContent ?? '').toBe('');
        expect(out.querySelector('p')?.textContent).toBe('Para');
    });

    it('keeps the paragraph after an empty heading a paragraph', () => {
        const out = read(saved('<h2><br></h2><p>Para</p>'));

        expect(out.querySelector('p')?.textContent).toBe('Para');
        expect(out.querySelector('h2')?.textContent).not.toContain('Para');
    });

    it('keeps a numbered list that starts at the largest number markdown writes', () => {
        const out = read(saved('<ol start="999999999"><li>a</li><li>b</li></ol>'));

        expect(out.querySelector('ol')?.getAttribute('start')).toBe('999999999');
        expect(out.querySelectorAll('ol > li')).toHaveLength(2);
        expect(out.textContent).toBe('ab');
    });

    it('keeps the paragraph after a quoted table a paragraph, pipe and all', () => {
        const out = read(saved('<blockquote><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table><p>x | y</p></blockquote>'));

        expect(out.querySelector('blockquote > p')?.textContent).toBe('x | y');
        expect(out.querySelectorAll('blockquote tr')).toHaveLength(1);
    });

    it.each([
        ['a heading', '<h2>one<br>two</h2>', 'h2'],
        ['a task row', '<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>one<br>two</span></li></ul>', 'li[data-task] > span'],
        ['a summary', '<details><summary>one<br>two</summary><p>body</p></details>', 'summary'],
    ])('keeps a line break inside %s, which is one line in markdown', (_name, html, selector) => {
        const once = saved(html);
        const out = read(once);

        expect(out.querySelector(`${selector} br`)).not.toBeNull();
        expect(out.querySelector(selector)?.textContent).toBe('onetwo');
        expect(saved(once)).toBe(once);
    });

    it('keeps bold with a line break inside a heading as one bold run', () => {
        const out = read(saved('<h2><strong>one<br>two</strong></h2>'));

        expect(out.querySelector('h2 strong')?.textContent).toBe('onetwo');
        expect(out.textContent).not.toContain('*');
    });

    it('keeps a details block inside a list item inside another details block', () => {
        const once = saved('<details><summary>outer</summary><ol><li>a</li><li><details><summary>inner</summary><p>b</p></details></li></ol></details>');
        const out = read(once);

        expect(out.querySelector('details ol li details > summary')?.textContent).toBe('inner');
        expect(out.textContent).not.toContain(':::');
        expect(saved(once)).toBe(once);
    });

    it('keeps a numbered list inside a details block inside a list item a list of that block', () => {
        // A list-looking line inside the block was read as the outer list's
        // next item, which cut the block off from its closer.
        const once = saved('<ul><li><details><summary>s</summary><ol><li>a</li></ol><p>b</p></details></li><li>c</li></ul>');
        const out = read(once);

        expect(out.querySelector(':scope > ul > li > details ol > li')?.textContent).toBe('a');
        expect(out.querySelector(':scope > ul > li > details > p')?.textContent).toBe('b');
        expect(out.querySelectorAll(':scope > ul > li')).toHaveLength(2);
        expect(out.textContent).not.toContain(':::');
        expect(saved(once)).toBe(once);
    });

    it('writes no start attribute for a list that counts from one', () => {
        expect(read(service.toHtml('1. one\n2. two')).querySelector('ol')?.hasAttribute('start')).toBe(false);
    });
});
