import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RichTextViewComponent } from './rich-text-view.component';

/**
 * What the reader sees: the shared prose typography resolved to computed style.
 * Deleting an entry from RICH_TEXT_PROSE_CLASSES shows up here, where a
 * class-list comparison against the same constant cannot notice it.
 */
describe('RichTextViewComponent typography (browser)', () => {
    let fixture: ComponentFixture<RichTextViewComponent>;

    const content = (): HTMLElement =>
        (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-slot="rich-text-view"]')!;
    const styleOf = (selector: string): CSSStyleDeclaration =>
        getComputedStyle(content().querySelector(selector)!);
    const px = (value: string): number => Number.parseFloat(value);

    beforeEach(() => {
        fixture = TestBed.createComponent(RichTextViewComponent);
        fixture.componentRef.setInput('mode', 'html');
    });

    it('styles the document elements the prose classes claim to cover', () => {
        fixture.componentRef.setInput('value', [
            '<h1>Release notes</h1>',
            '<h2>Highlights</h2>',
            '<p>The editor now ships <a href="https://example.com">a view</a> and <code>size</code>.</p>',
            '<blockquote><p>Quoted feedback from the beta.</p></blockquote>',
            '<ul><li>Faster paste</li><li>Tables</li></ul>',
            '<ol><li>Install</li><li>Import</li></ol>',
            '<pre><code>npm run build</code></pre>',
            '<table><tbody><tr><th>Key</th><td>Value</td></tr></tbody></table>',
            '<details><summary>More</summary><p>Hidden body</p></details>',
        ].join(''));
        fixture.detectChanges();

        const p = styleOf('p');
        const h1 = styleOf('h1');
        expect(px(h1.fontSize)).toBeGreaterThan(px(p.fontSize));
        expect(Number(h1.fontWeight)).toBeGreaterThanOrEqual(700);
        expect(px(styleOf('h2').fontSize)).toBeGreaterThan(px(p.fontSize));

        const quote = styleOf('blockquote');
        expect(quote.borderInlineStartWidth).toBe('4px');
        expect(quote.fontStyle).toBe('italic');

        expect(styleOf('ul').listStyleType).toBe('disc');
        expect(styleOf('ol').listStyleType).toBe('decimal');
        expect(styleOf('a').textDecorationLine).toBe('underline');
        expect(styleOf('p code').fontFamily).toContain('monospace');
        expect(styleOf('pre').overflowX).toBe('auto');
        expect(styleOf('table').borderCollapse).toBe('collapse');
        expect([styleOf('td').borderTopWidth, styleOf('th').borderTopWidth]).toEqual(['1px', '1px']);
        expect(styleOf('details').borderTopWidth).toBe('1px');
    });

    it('orders the text size presets sm < default < lg', () => {
        fixture.componentRef.setInput('value', '<p>Body text</p>');
        const sizeFor = (size: 'sm' | 'default' | 'lg'): number => {
            fixture.componentRef.setInput('size', size);
            fixture.detectChanges();
            return px(getComputedStyle(content()).fontSize);
        };

        const sm = sizeFor('sm');
        const base = sizeFor('default');
        const lg = sizeFor('lg');
        expect(sm).toBeLessThan(base);
        expect(base).toBeLessThan(lg);
    });
});
