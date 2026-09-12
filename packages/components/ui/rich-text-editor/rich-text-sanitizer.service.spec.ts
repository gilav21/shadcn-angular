import { TestBed } from '@angular/core/testing';
import { DEFAULT_LINK_SCHEMES, RichTextSanitizerService } from './index';
import { beforeEach, describe, expect, it } from 'vitest';

/** The `style` attribute the sanitizer kept for a declaration, or null. */
function sanitizedStyle(service: RichTextSanitizerService, decl: string): string | null {
    const out = service.sanitize('<p style="' + decl + '">T</p>');
    const parsed = new DOMParser().parseFromString(out, 'text/html');
    return parsed.querySelector('p')?.getAttribute('style') ?? null;
}

describe('RichTextSanitizerService — task row shape', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    const rowOf = (html: string): HTMLElement => {
        const holder = document.createElement('div');
        holder.innerHTML = service.sanitize(html);
        return holder.querySelector('li[data-task]')!;
    };

    it('wraps a task row whose text sits bare beside the checkbox', () => {
        // The PDF import path emits this shape; the checked-row strike and
        // every caret rule key off the span, so a bare row lost both.
        const row = rowOf('<ul data-task-list><li data-task data-checked="true"><input type="checkbox">done</li></ul>');

        expect(row.querySelector(':scope > span')?.textContent).toBe('done');
        expect(row.childNodes).toHaveLength(2);
        expect(row.firstChild?.nodeName).toBe('INPUT');
    });

    it('keeps the inline markup of a bare row inside the new span', () => {
        const row = rowOf('<ul data-task-list><li data-task><input type="checkbox">read <b>the</b> docs</li></ul>');

        expect(row.querySelector(':scope > span')?.innerHTML).toBe('read <b>the</b> docs');
    });

    it('leaves a row that already has its span alone', () => {
        const row = rowOf('<ul data-task-list><li data-task><input type="checkbox"><span>todo</span></li></ul>');

        expect(row.querySelectorAll('span')).toHaveLength(1);
        expect(row.querySelector(':scope > span')?.textContent).toBe('todo');
    });

    it('puts the span before a nested list and leaves that list nested', () => {
        const row = rowOf('<ul data-task-list><li data-task><input type="checkbox">parent'
            + '<ul data-task-list><li data-task><input type="checkbox">child</li></ul></li></ul>');

        expect(Array.from(row.children).map((el) => el.tagName)).toEqual(['INPUT', 'SPAN', 'UL']);
        expect(row.querySelector(':scope > span')?.textContent).toBe('parent');
        expect(row.querySelector(':scope > ul > li[data-task] > span')?.textContent).toBe('child');
    });

    it('gives a row with no text a span to hold the caret', () => {
        const row = rowOf('<ul data-task-list><li data-task><input type="checkbox"></li></ul>');

        expect(row.querySelector(':scope > span')).not.toBeNull();
    });
});

describe('RichTextSanitizerService — an element holds a line or holds blocks', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    const clean = (html: string): HTMLElement => {
        const holder = document.createElement('div');
        holder.innerHTML = service.sanitize(html);
        return holder;
    };

    it('gives an item that also holds a block a line of its own for its text', () => {
        // Such text belongs to no line, and a block command given the item
        // reached out to the whole list and destroyed every line in it.
        const out = clean('<ul><li>own text<blockquote><p>deep</p></blockquote></li></ul>');
        const item = out.querySelector('li')!;

        expect(Array.from(item.children).map((el) => el.tagName)).toEqual(['P', 'BLOCKQUOTE']);
        expect(item.querySelector(':scope > p')?.textContent).toBe('own text');
        expect(Array.from(item.childNodes).every((n) => n.nodeType === Node.ELEMENT_NODE)).toBe(true);
    });

    it('leaves an item whose only block child is its own sub-list alone', () => {
        // A sub-list does not end its item's line, exactly as the line model
        // has it; wrapping here would make every nested row a container.
        const out = clean('<ul><li>own text<ul><li>sub</li></ul></li></ul>');
        const item = out.querySelector('li')!;

        expect(item.firstChild?.textContent).toBe('own text');
        expect(item.querySelector(':scope > p')).toBeNull();
        expect(item.querySelector(':scope > ul > li')?.textContent).toBe('sub');
    });

    it('gives a cell that also holds a block a line of its own for its text', () => {
        const out = clean('<table><tbody><tr><td>text<p>para</p></td></tr></tbody></table>');
        const cell = out.querySelector('td')!;

        expect(Array.from(cell.children).map((el) => el.tagName)).toEqual(['P', 'P']);
        expect(cell.querySelector('p')?.textContent).toBe('text');
    });

    it('wraps each run between blocks, not just the first', () => {
        const out = clean('<ul><li>before<p>middle</p>after</li></ul>');
        const item = out.querySelector('li')!;

        expect(Array.from(item.children).map((el) => el.textContent)).toEqual(['before', 'middle', 'after']);
    });

    it.each([
        ['a quote holding a paragraph', '<blockquote><p>quoted</p></blockquote>', 'introquoted'],
        ['a quote holding bare text, which the quote pass turns into a paragraph', '<blockquote>quoted</blockquote>', 'introquoted'],
        ['a quote holding two paragraphs', '<blockquote><p>one</p><p>two</p></blockquote>', 'introonetwo'],
        ['a div holding a list', '<div><ul><li>item</li></ul></div>', 'introitem'],
        ['a table', '<table><tbody><tr><td>cell</td><td>next</td></tr></tbody></table>', 'introcellnext'],
    ])('finishes unwrapping %s inside a task row', (_name, block, text) => {
        // Draining a block that held a block looped forever: the emptied inner
        // block stayed in place and the outer loop kept finding it. The single
        // level input the first test used could not show that.
        const out = clean(`<ul><li data-task><input type="checkbox">intro${block}</li></ul>`);
        const span = out.querySelector('li[data-task] > span')!;

        expect(span.textContent).toBe(text);
        expect(span.querySelector('blockquote, p, div, ul, ol, li, table, tr, td, th')).toBeNull();
    });

    it('unwraps a block inside a task row rather than nesting it in the span', () => {
        // The PDF-import shape named in the docstring. Wrapping the block into
        // the span left the row owning a line and the block owning one too, and
        // the pass that repairs that shape has no `span` among its hosts, so it
        // was stable rather than fixed.
        const out = clean('<ul><li data-task><input type="checkbox">intro<blockquote>quoted</blockquote></li></ul>');
        const span = out.querySelector('li[data-task] > span')!;

        expect(span.querySelector('blockquote, p, h1, div')).toBeNull();
        expect(span.textContent).toBe('introquoted');
        expect(Array.from(out.querySelector('li[data-task]')!.children).map((el) => el.tagName))
            .toEqual(['INPUT', 'SPAN']);
    });

    it('leaves a sub-list where it is when wrapping an item that also holds a block', () => {
        // Honouring the sub-list exception when deciding where a run STOPS but
        // not when collecting it moved the list into the new paragraph: a <ul>
        // inside a <p>, which the parser then takes apart.
        const out = clean('<ul><li>text<ul><li>sub</li></ul><p>para</p></li></ul>');
        const item = out.querySelector('li')!;

        expect(item.querySelector('p ul')).toBeNull();
        expect(item.querySelector(':scope > ul > li')?.textContent).toBe('sub');
        expect(Array.from(item.children).map((el) => el.tagName)).toEqual(['P', 'UL', 'P']);
        expect(item.querySelector(':scope > p')?.textContent).toBe('text');
    });

    it('is a fixed point: sanitizing its own output changes nothing', () => {
        // The wrapped sub-list added one more empty paragraph on every pass, so
        // a document drifted a little each time it was saved.
        for (const input of [
            '<ul><li>text<ul><li>sub</li></ul><p>para</p></li></ul>',
            '<ul><li>own<blockquote><p>deep</p></blockquote></li></ul>',
            '<div>stray<p>para</p></div>',
            '<table><tbody><tr><td>text<p>para</p></td></tr></tbody></table>',
            '<details><summary>head</summary><p>body</p></details>',
        ]) {
            const once = service.sanitize(input);
            expect(service.sanitize(once), input).toBe(once);
        }
    });

    it('gives stray text in a div its own line', () => {
        // DIV became a container in the line model, which created exactly the
        // shape this pass exists to remove.
        const out = clean('<div>stray<p>para</p></div>');
        const div = out.querySelector('div')!;

        expect(Array.from(div.children).map((el) => el.textContent)).toEqual(['stray', 'para']);
        expect(Array.from(div.childNodes).every((n) => n.nodeType === Node.ELEMENT_NODE)).toBe(true);
    });

    it('leaves a task row alone, whose checkbox is structure and not a stray run', () => {
        const out = clean('<ul data-task-list><li data-task><input type="checkbox"><span>todo</span></li></ul>');
        const row = out.querySelector('li[data-task]')!;

        expect(Array.from(row.children).map((el) => el.tagName)).toEqual(['INPUT', 'SPAN']);
    });
});

describe('RichTextSanitizerService', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [RichTextSanitizerService],
        });
        service = TestBed.inject(RichTextSanitizerService);
    });

    describe('sanitize', () => {
        it('should return empty string for null/undefined', () => {
            expect(service.sanitize(null as unknown as string)).toBe('');
            expect(service.sanitize(undefined as unknown as string)).toBe('');
            expect(service.sanitize('')).toBe('');
        });

        it('should preserve allowed block elements', () => {
            const html = '<p>Hello</p><div>World</div><h1>Title</h1>';
            expect(service.sanitize(html)).toBe('<p>Hello</p><div>World</div><h1>Title</h1>');
        });

        it('should preserve inline formatting elements', () => {
            const html = '<strong>Bold</strong> <em>Italic</em> <u>Underline</u>';
            expect(service.sanitize(html)).toBe('<strong>Bold</strong> <em>Italic</em> <u>Underline</u>');
        });

        it('should preserve code blocks', () => {
            const html = '<pre><code>const x = 1;</code></pre>';
            expect(service.sanitize(html)).toBe('<pre><code>const x = 1;</code></pre>');
        });

        it('should preserve lists', () => {
            const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            expect(service.sanitize(html)).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
        });

        it('preserves pdf-readable side-by-side columns with a nested table', () => {
            const html =
                '<table style="border-collapse:collapse;width:100%" dir="rtl"><tr>' +
                '<td style="vertical-align:top;width:55.6%;padding:0 6pt">' +
                '<table style="border-collapse:collapse;"><tr><td>A</td><td>B</td></tr></table>' +
                '</td>' +
                '<td style="vertical-align:top;width:44.4%;padding:0 6pt"><p>Left</p></td>' +
                '</tr></table>';
            const result = service.sanitize(html).replaceAll(': ', ':');
            expect(result).toContain('vertical-align:top');
            expect(result).toContain('width:55.6%');
            expect(result).toContain('border-collapse:collapse');
            expect(result).toContain('dir="rtl"');
            // nested table and its cells survive
            expect(result.match(/<table/g) ?? []).toHaveLength(2);
            expect(result).toContain('<td>A</td>');
        });

        it('keeps the pdf-readable `background` shorthand alongside its text colour', () => {
            const html = '<p style="background:#4a86e8;color:#ffffff">Total</p>';
            const result = service.sanitize(html).replaceAll(': ', ':');
            expect(result).toContain('background:#4a86e8');
            expect(result).toContain('color:#ffffff');
        });

        it('still rejects a url() payload in the `background` shorthand', () => {
            const html = '<p style="background:url(javascript:alert(1))">x</p>';
            expect(service.sanitize(html)).not.toContain('url(');
        });
    });

    describe('XSS prevention - script injection', () => {
        it('should remove script tags completely', () => {
            const html = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
            const result = service.sanitize(html);
            expect(result).not.toContain('<script');
            expect(result).not.toContain('alert');
            expect(result).toContain('<p>Hello</p>');
            expect(result).toContain('<p>World</p>');
        });

        it('should remove inline script elements', () => {
            const html = '<script type="text/javascript">document.cookie</script>';
            expect(service.sanitize(html)).toBe('');
        });

        it('should remove scripts in attributes via event handlers', () => {
            const html = '<img src="x" onerror="alert(1)">';
            const result = service.sanitize(html);
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });
    });

    describe('XSS prevention - event handlers', () => {
        it('should remove onclick handlers', () => {
            const html = '<button onclick="evil()">Click</button>';
            const result = service.sanitize(html);
            expect(result).not.toContain('onclick');
        });

        it('should remove onmouseover handlers', () => {
            const html = '<div onmouseover="evil()">Hover</div>';
            const result = service.sanitize(html);
            expect(result).not.toContain('onmouseover');
        });

        it('should remove onload handlers from images', () => {
            const html = '<img src="valid.jpg" onload="evil()">';
            const result = service.sanitize(html);
            expect(result).not.toContain('onload');
        });

        it('should remove onerror handlers from images', () => {
            const html = '<img src="invalid" onerror="alert(document.cookie)">';
            const result = service.sanitize(html);
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });

        it('should remove onfocus/onblur handlers', () => {
            const html = '<input onfocus="evil()" onblur="evil2()">';
            const result = service.sanitize(html);
            expect(result).not.toContain('onfocus');
            expect(result).not.toContain('onblur');
        });
    });

    describe('XSS prevention - javascript: URLs', () => {
        it('should remove javascript: in href', () => {
            const html = '<a href="javascript:alert(1)">Click</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('javascript:');
        });

        it('should remove javascript: with whitespace variations', () => {
            const html = '<a href="  javascript:alert(1)">Click</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('javascript');
        });

        it('should remove javascript: in image src', () => {
            const html = '<img src="javascript:alert(1)">';
            const result = service.sanitize(html);
            expect(result).not.toContain('javascript:');
        });

        it('should remove vbscript: URLs', () => {
            const html = '<a href="vbscript:msgbox(1)">Click</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('vbscript');
        });
    });

    describe('XSS prevention - data: URLs', () => {
        it('should allow safe data:image URLs', () => {
            const html = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA">';
            const result = service.sanitize(html);
            expect(result).toContain('data:image/png');
        });

        it('should block data:text/html URLs', () => {
            const html = '<img src="data:text/html,<script>alert(1)</script>">';
            const result = service.sanitize(html);
            expect(result).not.toContain('data:text/html');
        });

        it('should block data: URLs in links', () => {
            const html = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('data:text/html');
        });
    });

    describe('image src sanitization', () => {
        it('should allow https image URLs', () => {
            const result = service.sanitizeImageSrc('https://example.com/image.jpg');
            expect(result).toBe('https://example.com/image.jpg');
        });

        it('should allow relative image URLs', () => {
            expect(service.sanitizeImageSrc('/images/photo.jpg')).toBe('/images/photo.jpg');
            expect(service.sanitizeImageSrc('./photo.jpg')).toBe('./photo.jpg');
            expect(service.sanitizeImageSrc('../photo.jpg')).toBe('../photo.jpg');
        });

        it('should block http image URLs (except localhost)', () => {
            expect(service.sanitizeImageSrc('http://evil.com/image.jpg')).toBeNull();
            expect(service.sanitizeImageSrc('http://localhost/image.jpg')).toBe('http://localhost/image.jpg');
        });

        it('should block javascript: in image src', () => {
            expect(service.sanitizeImageSrc('javascript:alert(1)')).toBeNull();
        });

        it('should allow data:image/png with valid content', () => {
            const pngBytes = String.fromCodePoint(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00);
            const src = `data:image/png;base64,${btoa(pngBytes)}`;
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should allow data:image/jpeg with valid content', () => {
            const jpegBytes = String.fromCodePoint(0xFF, 0xD8, 0xFF, 0xE0, 0x00);
            const src = `data:image/jpeg;base64,${btoa(jpegBytes)}`;
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should allow data:image/gif with valid content', () => {
            const gifBytes = String.fromCodePoint(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
            const src = `data:image/gif;base64,${btoa(gifBytes)}`;
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should allow data:image/webp with valid content', () => {
            const webpBytes = String.fromCodePoint(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
            const src = `data:image/webp;base64,${btoa(webpBytes)}`;
            expect(service.sanitizeImageSrc(src)).toBe(src);
        });

        it('should allow a PERCENT-ENCODED raster image, like the base64 form', () => {
            // Every accept-path test above is base64, so the percent-encoded
            // accept path was entirely untested -- and that is exactly where the
            // bug lived: decodeURIComponent decodes to a UTF-8 STRING and throws
            // on any non-UTF-8 sequence, which every binary magic number is
            // (PNG, ÿØ). Percent-encoded PNGs and JPEGs were rejected
            // and, in a document, deleted -- the <img> kept its alt and lost its
            // src. GIF and WebP passed only because their magic bytes are ASCII,
            // which is why a GIF-only test would still have looked healthy.
            for (const src of [
                'data:image/png,%89PNG%0D%0A%1A%0A',
                'data:image/jpeg,%FF%D8%FF%E0',
                'data:image/gif,GIF89a%00%00',
                'data:image/webp,RIFF%00%00%00%00WEBP',
            ]) {
                expect(service.sanitizeImageSrc(src)).toBe(src);
            }
        });

        it('keeps a percent-encoded image in a document', () => {
            // The failure mode was deletion, not refusal: the src was stripped
            // and the image vanished with no warning and no way back.
            const html = '<p>before</p><img src="data:image/png,%89PNG%0D%0A%1A%0A" alt="chart"><p>after</p>';
            const out = service.sanitize(html);
            expect(out).toContain('src="data:image/png,%89PNG%0D%0A%1A%0A"');
        });

        it('rejects a non-image percent-encoded payload in either encoding', () => {
            // Widening the decode must not reopen the hole: content still decides
            // the verdict, and both encodings still agree.
            for (const payload of ['<script>alert(1)</script>', 'not an image at all']) {
                expect(service.sanitizeImageSrc('data:image/png,' + encodeURIComponent(payload))).toBeNull();
                expect(service.sanitizeImageSrc('data:image/png;base64,' + btoa(payload))).toBeNull();
            }
            // A malformed %XX escape is not a usable image either.
            expect(service.sanitizeImageSrc('data:image/png,%ZZ')).toBeNull();
        });

        it('scrubs SVG hidden inside a percent-encoded png payload', () => {
            const hidden = service.sanitizeImageSrc(
                'data:image/png,' + encodeURIComponent('<svg onload="alert(1)"></svg>'),
            );
            expect(hidden).not.toBeNull();
            expect(hidden).not.toContain('onload');
        });

        it('rejects a payload that only LOOKS like an image after truncation', () => {
            // Uint8Array takes a code point mod 256, so a run of multi-byte
            // characters collapsed into valid PNG magic bytes and a data: URL
            // holding no image at all passed the content check. U+0189 U+010D
            // U+010A U+011A truncate to 0x89 0x0D 0x0A 0x1A.
            const spoof = 'data:image/png,' + String.fromCodePoint(0x189) + 'PNG'
                + String.fromCodePoint(0x10D, 0x10A, 0x11A, 0x10A) + 'X';
            expect(service.sanitizeImageSrc(spoof)).toBeNull();

            // An astral character is two code units; codePointAt with a ++ loop
            // re-read the low surrogate and desynced the length.
            expect(service.sanitizeImageSrc('data:image/png,' + String.fromCodePoint(0x1F600))).toBeNull();

            // Genuine percent-encoded images are unaffected.
            for (const src of [
                'data:image/png,%89PNG%0D%0A%1A%0A',
                'data:image/jpeg,%FF%D8%FF%E0',
            ]) {
                expect(service.sanitizeImageSrc(src)).toBe(src);
            }
        });

        it('should allow data:image/svg+xml with valid SVG and sanitize content', () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
            const src = `data:image/svg+xml;base64,${btoa(svg)}`;
            const result = service.sanitizeImageSrc(src);
            expect(result).not.toBeNull();
            expect(result).toContain('data:image/svg+xml;base64,');
        });

        it('should return null for data:image/svg+xml with invalid base64', () => {
            const src = 'data:image/svg+xml;base64,!!!invalid!!!';
            expect(service.sanitizeImageSrc(src)).toBeNull();
        });

        it('should block non-image data URLs', () => {
            expect(service.sanitizeImageSrc('data:text/html,<script>alert(1)</script>')).toBeNull();
            expect(service.sanitizeImageSrc('data:application/javascript,alert(1)')).toBeNull();
        });
    });

    describe('URL sanitization', () => {
        it('should allow safe URLs', () => {
            expect(service.sanitizeUrl('https://example.com')).toBe('https://example.com');
            expect(service.sanitizeUrl('http://example.com')).toBe('http://example.com');
            expect(service.sanitizeUrl('/path/to/page')).toBe('/path/to/page');
        });

        it('should block javascript URLs', () => {
            expect(service.sanitizeUrl('javascript:alert(1)')).toBeNull();
        });

        it('should block vbscript URLs', () => {
            expect(service.sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
        });
    });

    describe('link handling', () => {
        it('should preserve safe links', () => {
            const html = '<a href="https://example.com">Link</a>';
            const result = service.sanitize(html);
            expect(result).toContain('href="https://example.com"');
        });

        it('should add rel="noopener noreferrer" to links', () => {
            const html = '<a href="https://example.com">Link</a>';
            const result = service.sanitize(html);
            expect(result).toContain('rel="noopener noreferrer"');
        });

        it('should preserve target="_blank" only', () => {
            const html = '<a href="https://example.com" target="_blank">Link</a>';
            const result = service.sanitize(html);
            expect(result).toContain('target="_blank"');
        });

        it('should strip other target values', () => {
            const html = '<a href="https://example.com" target="_top">Link</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('target="_top"');
        });
    });

    describe('disallowed elements are unwrapped', () => {
        it('should unwrap style tags but preserve text', () => {
            const html = '<p>Hello <style>.evil{}</style>World</p>';
            const result = service.sanitize(html);
            expect(result).not.toContain('<style');
            expect(result).toContain('Hello');
            expect(result).toContain('World');
        });

        it('should unwrap custom/unknown elements', () => {
            const html = '<custom-element>Content</custom-element>';
            const result = service.sanitize(html);
            expect(result).not.toContain('custom-element');
            expect(result).toContain('Content');
        });

        it('should unwrap form elements', () => {
            const html = '<form action="/evil"><input type="text">Submit</form>';
            const result = service.sanitize(html);
            expect(result).not.toContain('<form');
            expect(result).not.toContain('<input');
            expect(result).toContain('Submit');
        });

        it('should remove iframe elements entirely', () => {
            const html = '<iframe src="https://evil.com">Fallback</iframe>';
            const result = service.sanitize(html);
            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('Fallback');
        });
    });

    describe('attribute sanitization', () => {
        it('should remove disallowed style attributes', () => {
            const html = '<p style="position: fixed">Text</p>';
            const result = service.sanitize(html);
            expect(result).not.toContain('style=');
        });

        it('should preserve allowed style attributes', () => {
            const html = '<p style="color: red; text-align: center">Text</p>';
            const result = service.sanitize(html);
            expect(result).toContain('style="color: red; text-align: center"');
        });

        it('should remove class attributes except allowed patterns', () => {
            const html = '<p class="evil-class custom-style">Text</p>';
            const result = service.sanitize(html);
            expect(result).not.toContain('evil-class');
        });

        it('should preserve language- class for code highlighting', () => {
            const html = '<code class="language-javascript">code</code>';
            const result = service.sanitize(html);
            expect(result).toContain('class="language-javascript"');
        });

        it('should preserve data-mention attributes', () => {
            const html = '<span data-mention="john" data-mention-id="123">@john</span>';
            const result = service.sanitize(html);
            expect(result).toContain('data-mention="john"');
            expect(result).toContain('data-mention-id="123"');
        });

        it('should preserve data-tag attributes', () => {
            const html = '<span data-tag="angular" data-tag-id="456">#angular</span>';
            const result = service.sanitize(html);
            expect(result).toContain('data-tag="angular"');
            expect(result).toContain('data-tag-id="456"');
        });
    });

    describe('table handling', () => {
        it('should preserve allowed table structure', () => {
            const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>';
            const result = service.sanitize(html);
            expect(result).toContain('<table>');
            expect(result).toContain('<thead>');
            expect(result).toContain('<tbody>');
            expect(result).toContain('<tr>');
            expect(result).toContain('<th>');
            expect(result).toContain('<td>');
        });

        it('should preserve colspan/rowspan on cells', () => {
            const html = '<table><tr><td colspan="2" rowspan="3">Merged</td></tr></table>';
            const result = service.sanitize(html);
            expect(result).toContain('colspan="2"');
            expect(result).toContain('rowspan="3"');
        });
    });

    describe('stripTags', () => {
        it('should return plain text from HTML', () => {
            const html = '<p>Hello <strong>World</strong>!</p>';
            expect(service.stripTags(html)).toBe('Hello World!');
        });

        it('should handle empty input', () => {
            expect(service.stripTags('')).toBe('');
            expect(service.stripTags(null as unknown as string)).toBe('');
        });

        it('should handle nested elements', () => {
            const html = '<div><p>Line 1</p><p>Line 2</p></div>';
            expect(service.stripTags(html)).toBe('Line 1Line 2');
        });
    });

    describe('sanitizeToFragment', () => {
        it('should return a DocumentFragment', () => {
            const html = '<p>Hello</p>';
            const fragment = service.sanitizeToFragment(html);
            expect(fragment).toBeInstanceOf(DocumentFragment);
            expect(fragment.firstChild?.textContent).toBe('Hello');
        });
    });

    describe('font-family style quote normalization', () => {
        it('should use single quotes for font-family names with spaces', () => {
            const html = '<span style="font-family: &quot;Comic Sans MS&quot;">Text</span>';
            const result = service.sanitize(html);
            expect(result).toContain("font-family: 'Comic Sans MS'");
            expect(result).not.toContain('&quot;');
        });

        it('should handle multiple quoted font families', () => {
            const html = '<span style="font-family: &quot;Times New Roman&quot;">Text</span>';
            const result = service.sanitize(html);
            expect(result).toContain("font-family: 'Times New Roman'");
            expect(result).not.toContain('&quot;');
        });

        it('should preserve unquoted font-family names', () => {
            const html = '<span style="font-family: Arial">Text</span>';
            const result = service.sanitize(html);
            expect(result).toContain('font-family: Arial');
        });

        it('should handle font-family with other styles', () => {
            const html = '<span style="font-family: &quot;Comic Sans MS&quot;; color: red; font-size: 14px">Text</span>';
            const result = service.sanitize(html);
            expect(result).toContain("font-family: 'Comic Sans MS'");
            expect(result).toContain('color: red');
            expect(result).toContain('font-size: 14px');
            expect(result).not.toContain('&quot;');
        });
    });

    describe('complex XSS vectors', () => {
        it('should handle SVG XSS vectors', () => {
            const html = '<svg onload="alert(1)"><script>evil()</script></svg>';
            const result = service.sanitize(html);
            expect(result).not.toContain('onload');
            expect(result).not.toContain('<script');
            expect(result).not.toContain('alert');
        });

        it('should handle malformed HTML gracefully', () => {
            const html = '<p>Unclosed <b>tags <i>here';
            const result = service.sanitize(html);
            // Should not throw, should return valid HTML
            expect(result).toContain('Unclosed');
        });

        it('should handle HTML entities', () => {
            const html = '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>';
            const result = service.sanitize(html);
            expect(result).toContain('&lt;script&gt;');
            expect(result).not.toContain('<script>');
        });

        it('should handle URL encoding in javascript:', () => {
            const html = '<a href="java&#115;cript:alert(1)">XSS</a>';
            // After HTML parsing, entities are decoded
            const result = service.sanitize(html);
            expect(result).not.toContain('href="javascript:');
        });

        it('should handle mixed case javascript:', () => {
            const html = '<a href="JaVaScRiPt:alert(1)">XSS</a>';
            const result = service.sanitize(html);
            expect(result).not.toContain('javascript');
        });
    });

    describe('attribute-rule contribution API', () => {
        const idRule = {
            tag: '*', attr: 'data-action-click',
            validate: (v: string) => (/^\w[\w.-]*$/.test(v) ? v : null),
        };
        const paramsRule = {
            tag: '*', attr: 'data-action-click-params', requiresAttr: 'data-action-click',
            validate: (v: string) => {
                try {
                    const o = JSON.parse(v);
                    const ok = o && typeof o === 'object' && !Array.isArray(o) &&
                        Object.values(o).every((x) => ['string', 'number', 'boolean'].includes(typeof x));
                    return ok ? JSON.stringify(o) : null;
                } catch { return null; }
            },
        };

        it('allows a contributed attribute on a span', () => {
            const off = service.registerAttributeRules([idRule]);
            expect(service.sanitize('<span data-action-click="open-dialog">x</span>'))
                .toBe('<span data-action-click="open-dialog">x</span>');
            off();
        });

        it('strips a contributed attribute whose validator rejects the value', () => {
            const off = service.registerAttributeRules([idRule]);
            expect(service.sanitize('<span data-action-click="bad id!">x</span>'))
                .toBe('<span>x</span>');
            off();
        });

        it('keeps the id attr but strips invalid params JSON, then drops orphan params', () => {
            const off = service.registerAttributeRules([idRule, paramsRule]);
            const out = service.sanitize(
                '<span data-action-click="a" data-action-click-params="{bad">x</span>');
            expect(out).toBe('<span data-action-click="a">x</span>');
            off();
        });

        it('strips a params attribute with no matching id attribute (companion rule)', () => {
            const off = service.registerAttributeRules([idRule, paramsRule]);
            expect(service.sanitize('<span data-action-click-params=\'{"a":1}\'>x</span>'))
                .toBe('<span>x</span>');
            off();
        });

        it('ref-counts: rule survives until the last teardown', () => {
            const off1 = service.registerAttributeRules([idRule]);
            const off2 = service.registerAttributeRules([idRule]);
            off1();
            expect(service.sanitize('<span data-action-click="a">x</span>'))
                .toBe('<span data-action-click="a">x</span>');
            off2();
            expect(service.sanitize('<span data-action-click="a">x</span>')).toBe('<span>x</span>');
        });

        it('throws when a rule targets a locked attribute (case-insensitive)', () => {
            for (const attr of ['onclick', 'ONCLICK', 'onMouseOver', 'href', 'HREF', 'src', 'style', 'STYLE', 'class', 'Class']) {
                expect(() => service.registerAttributeRules([{ tag: '*', attr }])).toThrow();
            }
        });

        it('still strips on* handlers from an element that also carries a contributed attr', () => {
            const off = service.registerAttributeRules([idRule]);
            const out = service.sanitize('<span data-action-click="a" onclick="alert(1)">x</span>');
            expect(out).toBe('<span data-action-click="a">x</span>');
            off();
        });

        it('preserves a safe inline style on an action span (v2 starter-style discovery)', () => {
            const off = service.registerAttributeRules([idRule, paramsRule]);
            const html =
                '<span style="color:#2563eb;text-decoration:underline dotted" ' +
                'data-action-click="dictionary" data-action-click-params=\'{"value":"sla"}\'>SLA</span>';
            const out = service.sanitize(html);
            off();
            expect(out).toContain('data-action-click="dictionary"');
            expect(out.toLowerCase()).toContain('color');
            expect(out.toLowerCase()).toContain('#2563eb');
        });

        it('tolerates calling the teardown twice (no entry on the second call)', () => {
            const off = service.registerAttributeRules([idRule]);
            off();
            expect(() => off()).not.toThrow();
            expect(service.sanitize('<span data-action-click="a">x</span>')).toBe('<span>x</span>');
        });
    });

    describe('isUrlSafe', () => {
        it('returns false for empty or non-string input', () => {
            expect(service.isUrlSafe('')).toBe(false);
            expect(service.isUrlSafe(null as unknown as string)).toBe(false);
        });

        it('returns true for a plain safe url', () => {
            expect(service.isUrlSafe('https://example.com')).toBe(true);
        });
    });

    describe('sanitizeImageSrc edge cases', () => {
        it('returns null for empty or non-string input', () => {
            expect(service.sanitizeImageSrc('')).toBeNull();
            expect(service.sanitizeImageSrc(null as unknown as string)).toBeNull();
        });

        it('rejects protocol-relative URLs', () => {
            expect(service.sanitizeImageSrc('//evil.com/x.png')).toBeNull();
            expect(service.sanitizeImageSrc('/\\evil.com/x.png')).toBeNull();
        });

        it('rejects a data:image/png whose bytes are not a real image', () => {
            const bogus = `data:image/png;base64,${btoa('not-a-png-header')}`;
            expect(service.sanitizeImageSrc(bogus)).toBeNull();
        });

        it('rejects a non-base64 data:image/png whose payload is not an image', () => {
            // This asserted the OPPOSITE, and its own title said why:
            // "(unchecked bytes)". Skipping validation when ';base64,' is
            // absent meant the encoding decided the verdict rather than the
            // content -- the same bytes were rejected once base64-encoded.
            expect(service.sanitizeImageSrc('data:image/png,rawplaceholder')).toBeNull();
        });

        it('rejects a data:image/png with an empty base64 payload', () => {
            expect(service.sanitizeImageSrc('data:image/png;base64,')).toBeNull();
        });

        it('rejects a data:image/png with invalid base64 that throws on decode', () => {
            expect(service.sanitizeImageSrc('data:image/png;base64,@@@@@@@@')).toBeNull();
        });
    });

    describe('sanitizeSvgDataUrl edge cases', () => {
        it('sanitizes a non-base64 payload instead of dropping it', () => {
            // This used to assert null -- the deletion of every URL-encoded SVG
            // locked in as correct behaviour. What matters is that the result is
            // scrubbed, not that it is discarded.
            const out = service.sanitizeSvgDataUrl('data:image/svg+xml,<svg></svg>');
            expect(out).not.toBeNull();
            expect(decodeURIComponent(out ?? '')).toContain('<svg');
        });

        it('returns null when the base64 payload is empty', () => {
            expect(service.sanitizeSvgDataUrl('data:image/svg+xml;base64,')).toBeNull();
        });

        it('returns null when the base64 payload throws on decode', () => {
            expect(service.sanitizeSvgDataUrl('data:image/svg+xml;base64,@@@@@@@@')).toBeNull();
        });

        it('returns null when the decoded payload is not an <svg> document', () => {
            const src = `data:image/svg+xml;base64,${btoa('<div>not svg</div>')}`;
            expect(service.sanitizeSvgDataUrl(src)).toBeNull();
        });
    });

    describe('dir attribute handling', () => {
        it('keeps a valid dir value', () => {
            expect(service.sanitize('<p dir="rtl">x</p>')).toContain('dir="rtl"');
            expect(service.sanitize('<p dir="ltr">x</p>')).toContain('dir="ltr"');
            expect(service.sanitize('<p dir="auto">x</p>')).toContain('dir="auto"');
        });

        it('strips an invalid dir value', () => {
            expect(service.sanitize('<p dir="sideways">x</p>')).not.toContain('dir=');
        });
    });

    describe('style attribute edge cases', () => {
        it('drops an empty style attribute', () => {
            expect(service.sanitize('<p style="">x</p>')).toBe('<p>x</p>');
        });

        it('skips a declaration with no colon', () => {
            const out = service.sanitize('<p style="color:red;bogusdeclaration">x</p>');
            expect(out).toContain('color: red');
            expect(out).not.toContain('bogusdeclaration');
        });
    });
});

describe('RichTextSanitizerService — structural size ceiling', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(RichTextSanitizerService);
    });

    it('keeps every cell of a large table, and stays fast', () => {
        // This asserted the OPPOSITE: that content past a 20k node budget was
        // dropped. The budget existed to hide a quadratic walk in
        // elementToMarkdown (every <table> subtree was converted twice, so
        // nested tables doubled per level -- 5, 9, 15, 27, 54ms at depths
        // 9-13). With that fixed, the budget only destroyed large-but-
        // legitimate pastes: a 5000-row spreadsheet lost 4000 rows in
        // silence, and saving made it permanent. Slow beats destroyed -- and
        // nothing here is slow.
        const cells = Array.from({ length: 40000 }, () => '<td>x</td>').join('');
        const huge = `<table><tbody><tr>${cells}</tr></tbody></table>`;

        const started = performance.now();
        const out = service.sanitize(huge);
        const elapsed = performance.now() - started;
        const parsed = new DOMParser().parseFromString(out, 'text/html');

        expect(parsed.querySelectorAll('td')).toHaveLength(40000);
        expect(parsed.body.textContent).toHaveLength(40000);
        expect(elapsed).toBeLessThan(5000);
    });

    it('leaves an ordinary document untouched', () => {
        const normal = '<p>hello</p><table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';
        const out = service.sanitize(normal);
        const parsed = new DOMParser().parseFromString(out, 'text/html');

        expect(parsed.querySelectorAll('td')).toHaveLength(2);
        expect(parsed.body.textContent).toBe('helloab');
    });

    describe('data: URLs in href (round-15 audit)', () => {
        it('rejects a scriptable SVG data: URL used as a link target', () => {
            // isAllowedDataUrl returned true unconditionally for
            // data:image/svg+xml. The src path compensates by routing through
            // sanitizeSvgDataUrl; the href path never did, so a link could carry
            // an SVG document with an onload handler straight into the content.
            expect(
                service.isUrlSafe('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),
            ).toBe(false);
            expect(
                service.isUrlSafe(
                    'data:image/svg+xml;base64,' +
                        btoa('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),
                ),
            ).toBe(false);
        });

        it('rejects every data: href, including image types that are fine as src', () => {
            // No legitimate editor content needs a data: link target, so the
            // whole scheme is refused here rather than scrubbed -- while the
            // same payload stays valid for an image src.
            // A real PNG payload: passes the magic-byte check, so this proves
            // the href refusal, not an unrelated failure of that check.
            const png =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            expect(service.sanitizeImageSrc(png)).toBe(png);
            expect(service.isUrlSafe(png)).toBe(false);
        });

        it('strips the href when a link carries a data: URL', () => {
            const html = service.sanitize(
                '<a href="data:image/svg+xml,<svg onload=alert(1)>">click</a>',
            );
            expect(html).not.toContain('data:image/svg+xml');
        });
    });

    describe('link scheme allowlist (round-16 audit)', () => {
        it('refuses schemes that are not ordinary links', () => {
            // The check was a blocklist of javascript:/vbscript:/data:, so
            // anything not named passed. These all reached a live href.
            for (const url of [
                'blob:https://evil.example/x',
                'filesystem:https://evil.example/x',
                'view-source:https://evil.example',
                'about:blank',
                'ws://evil.example',
                'file:///etc/passwd',
            ]) {
                expect(service.isUrlSafe(url)).toBe(false);
            }
        });

        it('refuses a protocol-relative URL, which looks relative but is not', () => {
            // sanitizeImageSrc already rejected these; the href path did not.
            expect(service.isUrlSafe('//evil.example/x')).toBe(false);
        });

        it('still allows the schemes real links use', () => {
            for (const url of [
                'https://example.com/a?b=1#c',
                'http://example.com',
                'mailto:someone@example.com',
                'tel:+15551234567',
                '/relative/path',
                'relative/path',
                '#anchor',
                '?query=1',
            ]) {
                expect(service.isUrlSafe(url)).toBe(true);
            }
        });
    });

    describe('SVG smuggled under a raster label (round-16 audit)', () => {
        const svgPayload = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>';

        it('scrubs an SVG declared as image/png', () => {
            // The decision to scrub was made from the MIME LABEL, while the
            // magic-byte check accepts SVG content whatever the label says. So
            // mislabelled SVG skipped scrubbing entirely and unsanitized,
            // script-bearing markup was stored in content the library calls
            // clean.
            const url = 'data:image/png;base64,' + btoa(svgPayload);
            const out = service.sanitizeImageSrc(url);
            expect(out === null || !atob(out.split(',')[1]).includes('onload')).toBe(true);
        });

        it('scrubs an SVG declared as image/jpeg in plain (non-base64) form', () => {
            const url = 'data:image/jpeg,' + encodeURIComponent(svgPayload);
            const out = service.sanitizeImageSrc(url);
            expect(out === null || !decodeURIComponent(out).includes('onload')).toBe(true);
        });

        it('still accepts a genuine raster data URL', () => {
            const png =
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            expect(service.sanitizeImageSrc(png)).toBe(png);
        });
    });

    describe('backslash forms of a protocol-relative URL (round-17 audit)', () => {
        it('refuses the backslash variants browsers normalize to //host', () => {
            // isUrlSafe rejected "//host" but not "/\\host" or "\\\\host",
            // which browsers treat identically. The surviving anchor resolved
            // off-origin and was decorated with rel=noopener, so it read as a
            // vetted link. sanitizeImageSrc already guarded this; href did not.
            expect(service.isUrlSafe('/\\evil.example/steal')).toBe(false);
            expect(service.isUrlSafe('\\\\evil.example/steal')).toBe(false);
            expect(service.isUrlSafe('\\/evil.example/steal')).toBe(false);
        });

        it('refuses every off-origin authority form, not just two-character ones', () => {
            // The previous version tested only two-character leads (\, /\, \/),
            // which is where the bug is ABSENT. A single backslash and three
            // slashes both reach evil.example too -- verified in a browser by
            // reading the resolved .href of a real anchor.
            for (const url of [
                'https:\\\\evil.example/x',
                'https:\\evil.example/x',
                'https:///evil.example/x',
                'https:////evil.example/x',
                'https:/\\evil.example/x',
                'https:\\/evil.example/x',
                'http:\\evil.example',
                '//evil.example/x',
                '/\\evil.example/x',
            ]) {
                expect(service.isUrlSafe(url)).toBe(false);
                expect(service.sanitizeImageSrc(url)).toBeNull();
            }
        });



        it('still allows ordinary same-origin and absolute URLs', () => {
            for (const url of [
                'https://example.com/a',
                'https://user@example.com/a',
                'http://localhost:4200/x',
                '/docs/page',
                './rel',
                '#anchor',
            ]) {
                expect(service.isUrlSafe(url)).toBe(true);
            }
        });

        it('still allows an ordinary absolute URL', () => {
            expect(service.isUrlSafe('https://example.com/a')).toBe(true);
        });

        it('rewrites such an href to the explicit absolute URL in a full sanitize pass', () => {
            // Not dropped: an explicit https link to the same host is allowed,
            // so dropping the shorthand deleted legitimate links while
            // protecting nothing. What must not survive is the RELATIVE-LOOKING
            // spelling, which a reader cannot tell is off-origin.
            const html = service.sanitize('<a href="/\\evil.example/steal">click</a>');
            expect(html).not.toContain('/\\evil.example');
            // Resolved against THIS page: either dropped, or stored as an
            // explicit absolute URL -- never as the relative-looking spelling.
            const href = /href="([^"]*)"/.exec(html)?.[1];
            expect(href === undefined || /^https?:\/\//.test(href)).toBe(true);
        });

        it('still allows an ordinary rooted path', () => {
            expect(service.isUrlSafe('/docs/page')).toBe(true);
        });
    });

    describe('non-base64 SVG data URLs (round-18 audit)', () => {
        const benign = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>';

        it('keeps a URL-encoded SVG instead of deleting it', () => {
            // sanitizeSvgDataUrl bailed unless it found ";base64,", so an
            // ordinary spec-legal inline SVG was silently dropped -- fail-closed,
            // so not a security hole, but it deleted valid user images.
            const url = 'data:image/svg+xml,' + encodeURIComponent(benign);
            const out = service.sanitizeImageSrc(url);
            expect(out).not.toBeNull();
            expect(decodeURIComponent(out ?? '')).toContain('<svg');
        });

        it('keeps a plain (unencoded) SVG data URL', () => {
            const out = service.sanitizeImageSrc('data:image/svg+xml,' + benign);
            expect(out).not.toBeNull();
        });

        it('still scrubs a scriptable non-base64 SVG rather than passing it', () => {
            const hostile =
                'data:image/svg+xml,' +
                encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
            const out = service.sanitizeImageSrc(hostile);
            expect(out === null || !decodeURIComponent(out).includes('onload')).toBe(true);
        });
    });
});

describe('RichTextSanitizerService — data: URL encoding parity (round-26 audit)', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(RichTextSanitizerService);
    });

    const srcOf = (url: string): string | null => {
        const out = service.sanitize('<img src="' + url + '">');
        const parsed = new DOMParser().parseFromString(out, 'text/html');
        return parsed.querySelector('img')?.getAttribute('src') ?? null;
    };

    it('judges a payload by its content, not by its encoding', () => {
        // isAllowedDataUrl returned true as soon as ';base64,' was absent, so
        // the percent-encoded form skipped magic-byte validation entirely:
        // 'data:image/png,<script>...' was kept verbatim while the SAME bytes
        // base64-encoded were rejected. The encoding decided the verdict.
        for (const payload of [
            '<script>alert(1)</script>',
            '<html><body onload=alert(1)></body></html>',
            'hello world, not an image at all',
        ]) {
            expect(srcOf('data:image/png,' + encodeURIComponent(payload))).toBeNull();
            expect(srcOf('data:image/png;base64,' + btoa(payload))).toBeNull();
        }
    });

    it('still accepts a real PNG in either encoding', () => {
        // The bound must not over-reject: both forms of a genuine image pass.
        //
        // The percent form is built from BYTE escapes, not from
        // encodeURIComponent(String.fromCodePoint(...)) -- that produces the
        // UTF-8 encoding of U+0089 ("%C2%89"), two bytes, not the single 0x89 a
        // real PNG carries. The old input round-tripped through the same UTF-8
        // assumption the implementation made, so it agreed with the bug instead
        // of testing for it.
        const bytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];
        const percent = bytes
            .map((b) => '%' + b.toString(16).padStart(2, '0').toUpperCase())
            .join('');
        const raw = bytes.map((b) => String.fromCodePoint(b)).join('');
        expect(srcOf('data:image/png,' + percent)).toContain('data:image/png');
        expect(srcOf('data:image/png;base64,' + btoa(raw))).toContain('data:image/png');
    });
});

describe('RichTextSanitizerService - CSS escapes in style values', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(RichTextSanitizerService);
    });

    const styleOf = (decl: string): string | null => sanitizedStyle(service, decl);

    it('blocks an ESCAPED url() outright, whatever the host', () => {
        // CSS lets any identifier character be written as a hex escape, so a
        // browser resolves "\75rl(...)" as url() while the raw text spells
        // nothing a substring check looks for. Verified live before the fix:
        // getComputedStyle reported url("https://tracker.example/p.png") from
        // the sanitizer's own output -- a paste could plant a tracking pixel
        // that fires for every later viewer.
        //
        // These are refused even when the host WOULD be allowed. The decoder
        // agrees with the browser today, but storing an obfuscated URL means the
        // document stays safe only while the two keep agreeing -- and that
        // divergence is exactly what the bypass was. An author with a legitimate
        // URL has no reason to escape it.
        const B = String.fromCodePoint(92);
        service.setRemoteHostPolicy(['tracker.example']);
        for (const decl of [
            'background: ' + B + '75rl(https://tracker.example/p.png)',
            'background: ' + B + '000075rl(https://tracker.example/p.png)',
            'background: u' + B + '72 l(https://tracker.example/p.png)',
            'background: ur' + B + '6c(https://tracker.example/p.png)',
        ]) {
            expect(styleOf(decl)).toBeNull();
        }
    });

    it('judges a plainly spelled url() by host', () => {
        // url() is no longer banned outright: it is judged like an <img> src,
        // because the same tracker reaches a document through <img> regardless
        // and a background from an allowlisted host is legitimate content.
        const spellings = [
            'background: url(https://cdn.trusted.com/p.png)',
            'background: URL(https://cdn.trusted.com/p.png)',
            'background: url (https://cdn.trusted.com/p.png)',
            'background: url/**/(https://cdn.trusted.com/p.png)',
            // Single quotes inside the value: a double-quoted url() cannot
            // survive a double-quoted style attribute, and is truncated by HTML
            // parsing long before the sanitizer sees it.
            "background: url('https://cdn.trusted.com/p.png')",
        ];

        // No policy: REFUSED, exactly as before this feature existed. The ban
        // was first relaxed here on the argument that <img> lets a tracker
        // through anyway -- but an <img> is visible content the author placed,
        // while a CSS background beacon is invisible. Relaxing it opened a
        // channel that was closed for every existing consumer, on upgrade, with
        // no code change.
        for (const decl of spellings) {
            expect(styleOf(decl)).toBeNull();
        }

        // With a policy: the listed host passes, an unlisted one does not --
        // including the userinfo form, whose real host is evil.com.
        service.setRemoteHostPolicy(['cdn.trusted.com']);
        for (const decl of spellings) {
            expect(styleOf(decl)).not.toBeNull();
        }
        expect(styleOf('background: url(https://tracker.example/p.png)')).toBeNull();
        expect(styleOf('background: url(https://cdn.trusted.com@evil.com/p.png)')).toBeNull();
    });

    it('blocks expression() and script schemes the same way', () => {
        const B = String.fromCodePoint(92);
        for (const decl of [
            'width: expression(alert(1))',
            'width: ' + B + '65xpression(alert(1))',
            'color: javascript:alert(1)',
            'color: ' + B + '6aavascript:alert(1)',
        ]) {
            expect(styleOf(decl)).toBeNull();
        }
    });

    it('keeps ordinary styles, including the ones Word pastes', () => {
        // The guard rejects any value carrying a backslash, so this asserts the
        // cost of that is nil for real content.
        for (const decl of [
            'color: red',
            'color: rgb(255, 0, 0)',
            'color: rgba(0, 0, 0, 0.5)',
            'background-color: yellow',
            'font-size: 20px',
            'font-family: monospace',
            "font-family: 'Segoe UI', sans-serif",
            'text-align: center',
            'border: 1pt solid #4472C4',
            'padding: 0in 5.4pt',
            'text-decoration: underline',
        ]) {
            expect(styleOf(decl)).toBe(decl);
        }
    });
});

describe('RichTextSanitizerService - remote host policy', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });
    const styleOf = (decl: string): string | null => sanitizedStyle(service, decl);

    it('allows any https host when no policy is set', () => {
        // The default preserves today's behaviour exactly. An empty allowlist
        // means "no policy", never "deny all", and there is deliberately no
        // built-in provider list to fall back on.
        expect(service.sanitizeImageSrc('https://tracker.example/p.png'))
            .toBe('https://tracker.example/p.png');
    });

    it('allows only listed hosts once a policy is set', () => {
        service.setRemoteHostPolicy(['cdn.trusted.com']);
        expect(service.sanitizeImageSrc('https://cdn.trusted.com/a.png'))
            .toBe('https://cdn.trusted.com/a.png');
        expect(service.sanitizeImageSrc('https://tracker.example/p.png')).toBeNull();
    });

    it('rejects the userinfo bypass through the sanitizer, not just the matcher', () => {
        // Everything before "@" is credentials; the request goes to evil.com.
        service.setRemoteHostPolicy(['cdn.trusted.com']);
        expect(service.sanitizeImageSrc('https://cdn.trusted.com@evil.com/a.png')).toBeNull();
    });

    it('exempts data: and relative image sources from the policy', () => {
        // data: cannot contact anyone and is how a Word paste carries its
        // images; a relative URL is same-origin. Blocking either would break
        // ordinary content for anyone who sets an allowlist.
        service.setRemoteHostPolicy(['cdn.trusted.com']);
        expect(service.sanitizeImageSrc('data:image/png,%89PNG%0D%0A%1A%0A'))
            .toBe('data:image/png,%89PNG%0D%0A%1A%0A');
        expect(service.sanitizeImageSrc('/local.png')).toBe('/local.png');

        // The CSS path is where the exemption actually does work. In
        // sanitizeImageSrc these two return at earlier branches and never reach
        // the host check at all, so asserting only there cannot fail -- the
        // first version of this test passed with the exemption deleted.
        expect(styleOf('background: url(/local.png)')).not.toBeNull();
        expect(styleOf('background: url(./local.png)')).not.toBeNull();
    });

    it('records a decision for every remote reference, allowed or not', () => {
        // Allowed references are recorded too, with reason 'no-policy' when
        // nothing is configured. That is what lets a developer see their real
        // exposure before deciding whether to set an allowlist.
        service.sanitizeImageSrc('https://tracker.example/p.png');
        expect(service.drainResourceDecisions()).toEqual([
            {
                url: 'https://tracker.example/p.png',
                host: 'tracker.example',
                kind: 'image',
                allowed: true,
                reason: 'no-policy',
            },
        ]);

        service.setRemoteHostPolicy(['cdn.trusted.com']);
        service.sanitizeImageSrc('https://cdn.trusted.com/a.png');
        service.sanitizeImageSrc('https://tracker.example/p.png');
        expect(service.drainResourceDecisions().map((d) => [d.host, d.reason])).toEqual([
            ['cdn.trusted.com', 'allowlisted'],
            ['tracker.example', 'blocked'],
        ]);
    });

    it('drains decisions, so a second read does not repeat them', () => {
        service.sanitizeImageSrc('https://tracker.example/p.png');
        expect(service.drainResourceDecisions()).toHaveLength(1);
        expect(service.drainResourceDecisions()).toHaveLength(0);
    });

    it('does not record a decision for an exempt source', () => {
        service.sanitizeImageSrc('/local.png');
        service.sanitizeImageSrc('data:image/png,%89PNG%0D%0A%1A%0A');
        expect(service.drainResourceDecisions()).toHaveLength(0);
    });

    it('applies one policy to both images and CSS backgrounds', () => {
        service.setRemoteHostPolicy(['cdn.trusted.com']);

        expect(service.sanitizeImageSrc('https://cdn.trusted.com/a.png')).not.toBeNull();
        expect(styleOf('background: url(https://cdn.trusted.com/a.png)')).not.toBeNull();

        expect(service.sanitizeImageSrc('https://tracker.example/p.png')).toBeNull();
        expect(styleOf('background: url(https://tracker.example/p.png)')).toBeNull();
    });

    it('still refuses code constructs whatever the allowlist says', () => {
        // The host policy narrows tracking; it never widens what may execute.
        service.setRemoteHostPolicy(['cdn.trusted.com', 'tracker.example']);
        expect(styleOf('width: expression(alert(1))')).toBeNull();
        expect(styleOf('background: url(javascript:alert(1))')).toBeNull();
        expect(service.sanitizeImageSrc('javascript:alert(1)')).toBeNull();
        expect(service.sanitizeImageSrc('data:text/html,<script>alert(1)</script>')).toBeNull();
    });
});



describe('RichTextSanitizerService - CSS functions that fetch without url() (fine-comb review)', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    const styleOf = (decl: string): string | null => sanitizedStyle(service, decl);
    const B = String.fromCodePoint(0x5c);

    // Probed in headless Chrome 151: each of these resolved to url() in the
    // computed style AND issued a network request, while containing no "url("
    // for the substring test to see. The bare-string image-set form is the one
    // that needs no url() at all.
    const spellings = [
        'background: image-set("https://tracker.example/p.png" 1x)',
        'background: -webkit-image-set(url("https://tracker.example/p.png") 1x)',
        'background: image-set(url("https://tracker.example/p.png") 1x)',
        'background: image("https://tracker.example/p.png")',
        'background: cross-fade(url(https://tracker.example/a.png), url(https://tracker.example/b.png), 50%)',
        'background: ' + B + '69mage-set("https://tracker.example/p.png" 1x)',
        'background: red image-set("https://tracker.example/p.png" 1x)',
    ];

    it('refuses them with no policy', () => {
        for (const decl of spellings) expect(styleOf(decl), decl).toBeNull();
    });

    it('refuses them even when the host is allowlisted', () => {
        // The allowlist governs url() only. Every other image function is
        // refused outright, so an allowlisted host cannot be reached through a
        // spelling the host check does not parse.
        service.setRemoteHostPolicy(['tracker.example']);
        for (const decl of spellings) expect(styleOf(decl), decl).toBeNull();
    });

    it('keeps the fetch-free functions authors actually use', () => {
        for (const decl of [
            'color: rgb(10, 20, 30)',
            'background: linear-gradient(red, blue)',
            'width: calc(100% - 2rem)',
            'color: var(--primary)',
            'background-color: color-mix(in oklab, red 40%, blue)',
        ]) {
            expect(styleOf(decl), decl).not.toBeNull();
        }
    });
});

describe('RichTextSanitizerService - data-blocked-src is re-judged, never copied (fine-comb review)', () => {
    let service: RichTextSanitizerService;
    const TRACKER = 'https://tracker.example/p.png';

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    const imgOf = (html: string): HTMLImageElement | null =>
        new DOMParser().parseFromString(service.sanitize(html), 'text/html').querySelector('img');

    it('restores the image when its host is allowed now', () => {
        // The saved HTML form of a blocked image has no src. This is the only
        // way the URL comes back on the HTML path, so it must go through the
        // same gate a src does -- and reversibility in HTML mode depends on it.
        service.setRemoteHostPolicy(['tracker.example']);
        const img = imgOf(`<p><img data-blocked-src="${TRACKER}" alt="c"></p>`);
        expect(img?.getAttribute('src')).toBe(TRACKER);
        expect(img?.hasAttribute('data-blocked-src')).toBe(false);
    });

    it('restores it under no policy, matching the markdown path', () => {
        const img = imgOf(`<p><img data-blocked-src="${TRACKER}" alt="c"></p>`);
        expect(img?.getAttribute('src')).toBe(TRACKER);
    });

    it('keeps the marker while the host is still blocked', () => {
        service.setRemoteHostPolicy(['cdn.trusted.com']);
        const img = imgOf(`<p><img data-blocked-src="${TRACKER}" alt="c"></p>`);
        expect(img?.hasAttribute('src')).toBe(false);
        expect(img?.getAttribute('data-blocked-src')).toBe(TRACKER);
    });

    it('drops an UNSAFE marker outright instead of carrying it verbatim', () => {
        for (const bad of ['javascript:alert(1)', '//evil.example/p.png', 'data:text/html,<script>']) {
            const img = imgOf(`<p><img data-blocked-src="${bad}" alt="c"></p>`);
            expect(img?.hasAttribute('src'), bad).toBe(false);
            expect(img?.hasAttribute('data-blocked-src'), bad).toBe(false);
        }
    });

    it('reads a policy reader live, so a list changed after the handover is honoured', () => {
        const hosts: string[] = ['cdn.trusted.com'];
        service.setRemoteHostPolicy(() => hosts);
        expect(service.sanitizeImageSrc(TRACKER)).toBeNull();
        hosts.push('tracker.example');
        expect(service.sanitizeImageSrc(TRACKER)).toBe(TRACKER);
    });
});

describe('RichTextSanitizerService - references resolved from the page (fine-comb review)', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    const styleOf = (decl: string): string | null => sanitizedStyle(service, decl);

    it('judges a protocol-relative CSS url() by its real host', () => {
        // `//evil.com` could not be parsed without a base, read as "relative",
        // and walked past the allowlist unjudged and unreported.
        service.setRemoteHostPolicy(['cdn.trusted.com']);
        expect(styleOf('background: url(//evil.com/p.png)')).toBeNull();
        expect(styleOf('background: url(///evil.com/p.png)')).toBeNull();
        expect(styleOf('background: url(//cdn.trusted.com/p.png)')).not.toBeNull();
        const blocked = service.drainResourceDecisions().filter((d) => !d.allowed);
        expect(blocked.map((d) => d.host)).toEqual(['evil.com', 'evil.com']);
    });

    it('keeps a same-origin link whose query holds another URL', () => {
        // The authority check split on the first colon anywhere, so a path
        // with `file:///` in its query looked like an `https:///` authority.
        for (const href of ['/search?q=file:///etc/hosts', '/proxy?src=c:\\images\\a.png', '/redirect?to=https://x']) {
            const html = service.sanitize(`<a href="${href}">x</a>`);
            expect(html, href).toContain('href="');
        }
        expect(service.sanitizeImageSrc('/proxy?src=c:\\images\\a.png')).toBe('/proxy?src=c:\\images\\a.png');
    });

    it('rewrites a protocol-relative link to the explicit absolute URL', () => {
        // A scheme-less form takes the page's scheme; an explicit one keeps its own.
        expect(service.sanitizeUrl('//cdn.example.com/whitepaper.pdf')).toBe(`${location.protocol}//cdn.example.com/whitepaper.pdf`);
        expect(service.sanitizeUrl('https:\\\\evil.example/x')).toBe('https://evil.example/x');
        // Whatever the browser resolves a backslash form to, the stored value
        // is never the relative-looking spelling.
        const stored = service.sanitizeUrl('\\\\evil.example/steal');
        expect(stored === null || /^https?:\/\//.test(stored)).toBe(true);
        // Still refused when the resolved scheme is not a link scheme.
        expect(service.sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    it('does not carry a stale policy block onto the next unsafe image', () => {
        service.setRemoteHostPolicy(['cdn.trusted.com']);
        expect(service.sanitizeImageSrc('https://tracker.example/p.png')).toBeNull();
        // Nobody took the marker. The next refusal is for an UNSAFE source.
        expect(service.sanitizeImageSrc('javascript:alert(1)')).toBeNull();
        expect(service.takeBlockedByPolicy()).toBeNull();
    });

    it('never keeps both src and data-blocked-src, whatever the attribute order', () => {
        service.setRemoteHostPolicy(['cdn.acme.com']);
        for (const html of [
            '<img data-blocked-src="https://tracker.example/p.png" src="https://cdn.acme.com/a.png" alt="a">',
            '<img src="https://cdn.acme.com/a.png" data-blocked-src="https://tracker.example/p.png" alt="a">',
        ]) {
            const img = new DOMParser().parseFromString(service.sanitize(html), 'text/html').querySelector('img');
            expect(img?.getAttribute('src'), html).toBe('https://cdn.acme.com/a.png');
            expect(img?.hasAttribute('data-blocked-src'), html).toBe(false);
        }
    });

    it('caps the undrained decision buffer', () => {
        for (let i = 0; i < 300; i++) service.sanitizeImageSrc(`https://h${i}.example/p.png`);
        const drained = service.drainResourceDecisions();
        expect(drained.length).toBeLessThanOrEqual(256);
        expect(drained.at(-1)?.host).toBe('h299.example');
    });
});

describe('RichTextSanitizerService - link schemes: a curated base list plus the consumer\'s own (follow-up F6)', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    const hrefOf = (href: string): string | null =>
        new DOMParser().parseFromString(service.sanitize(`<a href="${href}">x</a>`), 'text/html')
            .querySelector('a')?.getAttribute('href') ?? null;

    it('keeps well-known application schemes by default', () => {
        for (const href of [
            'slack://channel?team=T1&id=C1', 'msteams://teams.microsoft.com/l/chat/0/0',
            'skype:echo123?call', 'zoommtg://zoom.us/join?confno=1', 'whatsapp://send?text=hi',
            'tg://resolve?domain=x', 'geo:31.7,35.2', 'webcal://example.com/cal.ics',
            'xmpp:user@host', 'sip:alice@example.com', 'ssh://git@example.com/repo',
        ]) {
            expect(hrefOf(href), href).toBe(href);
        }
    });

    it('refuses a scheme nobody listed, then keeps it once the consumer lists it', () => {
        expect(hrefOf('acme-crm://contact/42')).toBeNull();
        service.setLinkSchemePolicy(['acme-crm', 'ACME-ERP:']);
        expect(hrefOf('acme-crm://contact/42')).toBe('acme-crm://contact/42');
        expect(hrefOf('acme-erp://order/7')).toBe('acme-erp://order/7');
        expect(hrefOf('other://x')).toBeNull();
    });

    it('reads the consumer list live, so a signal handed over is honoured as it changes', () => {
        const extra: string[] = [];
        service.setLinkSchemePolicy(() => extra);
        expect(hrefOf('acme-crm://contact/42')).toBeNull();
        extra.push('acme-crm');
        expect(hrefOf('acme-crm://contact/42')).toBe('acme-crm://contact/42');
    });

    it('never lets a listed forbidden scheme through', () => {
        // The allowlist widens what a link may point at, not what may run.
        service.setLinkSchemePolicy(['javascript', 'data', 'file', 'blob', 'ms-msdt']);
        for (const href of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'blob:https://x/y', 'ms-msdt:/id PCWDiagnostic']) {
            expect(hrefOf(href), href).toBeNull();
        }
    });

    it('exports the base list so a consumer can see what is already covered', () => {
        expect(DEFAULT_LINK_SCHEMES).toContain('https');
        expect(DEFAULT_LINK_SCHEMES).toContain('slack');
        expect(DEFAULT_LINK_SCHEMES).not.toContain('javascript');
    });
});

describe('RichTextSanitizerService - SVG data URLs decoded byte-wise (follow-up F3)', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    it('keeps a percent-encoded SVG that carries a byte decodeURIComponent would throw on', () => {
        // %FF is not valid UTF-8 on its own; decodeURIComponent threw and the
        // catch dropped the whole image for one stray byte.
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><title>caf%FF</title><rect width="1" height="1"/></svg>';
        const out = service.sanitizeSvgDataUrl(`data:image/svg+xml,${encodeURIComponent(svg).replace('%25FF', '%FF')}`);
        expect(out).not.toBeNull();
        expect(decodeURIComponent(out ?? '')).toContain('<rect');
    });

    it('still scrubs script from such an SVG', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect/></svg>';
        const out = service.sanitizeSvgDataUrl(`data:image/svg+xml,${encodeURIComponent(svg)}`);
        expect(out).not.toBeNull();
        expect(decodeURIComponent(out ?? '')).not.toContain('script');
        expect(decodeURIComponent(out ?? '')).not.toContain('onload');
    });
});

describe('RichTextSanitizerService - style values judged as the browser reads them (follow-up F1)', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    const styleOf = (decl: string): string | null => sanitizedStyle(service, decl);

    it('keeps ordinary values, shorthands included, in their original spelling', () => {
        for (const decl of ['border: 1px solid red', 'background: #4a86e8', "font-family: 'Comic Sans MS', cursive", 'margin: 0 auto', 'text-decoration: underline dotted']) {
            expect(styleOf(decl), decl).toContain(decl.split(':')[1].trim());
        }
    });

    it('refuses a value the browser reads as a fetch even when the raw text hides it', () => {
        // Judged twice -- raw and canonical -- and either refusal wins.
        const B = String.fromCodePoint(0x5c);
        service.setRemoteHostPolicy(['cdn.trusted.com']);
        expect(styleOf('background: ' + B + '69mage-set("https://tracker.example/p.png" 1x)')).toBeNull();
        expect(styleOf('background: image-set(url(https://tracker.example/p.png) 1x)')).toBeNull();
        expect(styleOf('background: url(https://cdn.trusted.com/p.png)')).not.toBeNull();
    });
});

describe('RichTextSanitizerService - a blockquote holds line blocks, never bare text', () => {
    let service: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [RichTextSanitizerService] });
        service = TestBed.inject(RichTextSanitizerService);
    });

    it('groups bare and inline children into <p> lines, one per <br>', () => {
        // The editor leaves a quote from a blank LINE block. Bare text gave it
        // no line to leave from, so Enter fell to the browser and opened a
        // sibling quote per keypress; markdown, paste and older documents all
        // arrive in the bare shape.
        expect(service.sanitize('<blockquote>a <b>bold</b><br>b</blockquote>'))
            .toBe('<blockquote><p>a <b>bold</b></p><p>b</p></blockquote>');
    });

    it('keeps a blank line only where a <br> ended it, and never a trailing one', () => {
        expect(service.sanitize('<blockquote>a<br><br>b<br></blockquote>'))
            .toBe('<blockquote><p>a</p><p><br></p><p>b</p></blockquote>');
    });

    it('passes block children through and drops the whitespace between them', () => {
        expect(service.sanitize('<blockquote><h2>H</h2>\n<ul><li>x</li></ul>\ntail</blockquote>'))
            .toBe('<blockquote><h2>H</h2><ul><li>x</li></ul><p>tail</p></blockquote>');
        expect(service.sanitize('<blockquote><blockquote>in</blockquote>out</blockquote>'))
            .toBe('<blockquote><blockquote><p>in</p></blockquote><p>out</p></blockquote>');
    });

    it('is a fixed point on an already well-formed quote', () => {
        const once = service.sanitize('<blockquote>a<br>b</blockquote>');
        expect(service.sanitize(once)).toBe(once);
        expect(service.sanitize('<blockquote><p>a</p><p><br></p></blockquote>')).toBe('<blockquote><p>a</p><p><br></p></blockquote>');
    });
});
