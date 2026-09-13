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

    it('writes no start attribute for a list that counts from one', () => {
        expect(read(service.toHtml('1. one\n2. two')).querySelector('ol')?.hasAttribute('start')).toBe(false);
    });
});
