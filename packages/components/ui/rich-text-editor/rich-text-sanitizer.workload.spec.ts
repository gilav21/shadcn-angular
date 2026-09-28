import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, it } from 'vitest';
import { RichTextMarkdownService, RichTextSanitizerService } from './index';

/**
 * How long the reader and the sanitizer take on about 100 KB of inline tags
 * left open or nested -- the shape that made both quadratic: an HTML parser
 * rebuilds an unclosed `<b>` in every later block, and the sanitizer walked each
 * inline wrapper's whole subtree again. A measurement, not a test: run with
 * `WORKLOAD=1 npx vitest --run <this file>` in the browser leg, where the
 * parser caps nesting as the page's does.
 */
describe('RichTextSanitizerService - workload: unclosed and nested inline tags', () => {
    let markdown: RichTextMarkdownService;
    let sanitizer: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextMarkdownService, RichTextSanitizerService] });
        markdown = TestBed.inject(RichTextMarkdownService);
        sanitizer = TestBed.inject(RichTextSanitizerService);
    });

    const KB = 1024;
    const toSize = (unit: string): string => unit.repeat(Math.ceil((100 * KB) / unit.length));

    const cases: ReadonlyArray<readonly [string, () => string]> = [
        ['markdown: an unclosed <b> in every paragraph', () => markdown.toHtml(toSize('use the <b> tag\n\n'))],
        ['markdown: unclosed <b> run together', () => markdown.toHtml(toSize('<b>'))],
        ['markdown: an unclosed <i> in every link', () => markdown.toHtml(toSize('[<i>](u) '))],
        ['markdown: an unclosed link before every heading', () => markdown.toHtml(toSize('See <a href="https://e.com/">here\n\n# Heading\n\n'))],
        ['markdown: an unclosed <div> in every paragraph', () => markdown.toHtml(toSize('a <div>b\n\n'))],
        ['markdown: an unclosed <div> block before every paragraph', () => markdown.toHtml(toSize('<div>\n\nx\n\n'))],
        ['markdown: a raw HTML block in every quote', () => markdown.toHtml(toSize('> <div>q</div>\n\n'))],
        ['markdown: a raw HTML block in every details block', () => markdown.toHtml(toSize(':::details T\n<div>x</div>\n:::\n\n'))],
        ['markdown: a raw HTML block in every list item', () => markdown.toHtml(toSize('- <div>x</div>\n'))],
        ['html: nested bold, italic and underline', () => sanitizer.sanitize(toSize('<b><i><u>x'))],
        ['html: unclosed bold with its own title before every paragraph', () => sanitizer.sanitize(toSize('<b title="k"><p>x'))],
        ['html: bold holding blocks, nested', () => sanitizer.sanitize(toSize('<b><div>x'))],
    ];

    it.each(cases)('%s', (_name, run) => {
        const started = performance.now();
        const out = run();
        // The measurement is this spec's whole output; stderr is the channel the
        // lint rules leave open for it.
        console.error(`${_name}: ${Math.round(performance.now() - started)} ms, ${out.length} chars out`);
    });
});
