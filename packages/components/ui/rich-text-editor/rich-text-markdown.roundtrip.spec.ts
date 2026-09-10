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
