import { TestBed } from '@angular/core/testing';
import { RichTextPasteNormalizerService } from './index';
import { RichTextSanitizerService } from './index';
import { RichTextMarkdownService } from './index';
import { beforeEach, describe, expect, it } from 'vitest';

describe('RichTextPasteNormalizerService', () => {
    let service: RichTextPasteNormalizerService;
    let sanitizer: RichTextSanitizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                RichTextPasteNormalizerService,
                RichTextSanitizerService,
                RichTextMarkdownService,
            ],
        });
        service = TestBed.inject(RichTextPasteNormalizerService);
        sanitizer = TestBed.inject(RichTextSanitizerService);
    });

    const pipeline = (html: string | null, text: string): string => {
        const normalized = service.normalize(html, text);
        return sanitizer.sanitize(normalized);
    };

    // =========================================================================
    // SOURCE DETECTION
    // =========================================================================

    describe('detectSource', () => {
        it('should detect Microsoft Word HTML', () => {
            const html = '<p class="MsoNormal">Hello</p>';
            expect(service.detectSource(html, '')).toBe('msword');
        });

        it('should detect Word via mso- styles', () => {
            const html = '<p style="mso-line-height-rule:exactly">Text</p>';
            expect(service.detectSource(html, '')).toBe('msword');
        });

        it('should detect Word via o:p namespace', () => {
            const html = '<p>Text<o:p></o:p></p>';
            expect(service.detectSource(html, '')).toBe('msword');
        });

        it('should detect Word via conditional comments', () => {
            const html = '<!--[if gte mso 9]><xml></xml><![endif]--><p>Text</p>';
            expect(service.detectSource(html, '')).toBe('msword');
        });

        it('should detect Word via urn:schemas-microsoft', () => {
            const html = '<html xmlns:v="urn:schemas-microsoft-com:office"><body>Text</body></html>';
            expect(service.detectSource(html, '')).toBe('msword');
        });

        it('should detect Outlook HTML via WordSection1', () => {
            const html = '<div class="WordSection1"><p class="MsoNormal">Text</p></div>';
            expect(service.detectSource(html, '')).toBe('outlook');
        });

        it('should detect Outlook via VML elements', () => {
            const html = '<p class="MsoNormal">Text</p><v:shapetype id="_x0000_t75">';
            expect(service.detectSource(html, '')).toBe('outlook');
        });

        it('should detect Outlook via OfficeDocumentSettings', () => {
            const html = '<p class="MsoNormal">Text</p><o:OfficeDocumentSettings>';
            expect(service.detectSource(html, '')).toBe('outlook');
        });

        it('should detect Google Docs HTML', () => {
            const html = '<b id="docs-internal-guid-abc123"><span>Text</span></b>';
            expect(service.detectSource(html, '')).toBe('google-docs');
        });

        it('should detect Google Sheets HTML', () => {
            const html = '<table data-sheets-value="test"><tr><td>Cell</td></tr></table>';
            expect(service.detectSource(html, '')).toBe('google-docs');
        });

        it('should detect Apple Pages HTML', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body>Text</body></html>';
            expect(service.detectSource(html, '')).toBe('apple-pages');
        });

        it('should detect LibreOffice HTML', () => {
            const html = '<html><head><meta name="generator" content="LibreOffice 7.5"></head><body>Text</body></html>';
            expect(service.detectSource(html, '')).toBe('libreoffice');
        });

        it('should detect markdown in plain text', () => {
            const text = '# Heading\n\n**Bold** text\n\n- Item 1\n- Item 2';
            expect(service.detectSource(null, text)).toBe('markdown');
        });

        it('should detect markdown with code fences', () => {
            const text = '```javascript\nconst x = 1;\n```\nSome text';
            expect(service.detectSource(null, text)).toBe('markdown');
        });

        it('should detect markdown from a link alone', () => {
            const text = 'See [the docs](https://example.com) for details.';
            expect(service.detectSource(null, text)).toBe('markdown');
        });

        it('should not false-positive markdown for simple text', () => {
            const text = 'Just a normal sentence with a # hashtag.';
            expect(service.detectSource(null, text)).toBe('plain-text');
        });

        it('should not false-positive markdown for single asterisk', () => {
            const text = 'This is a * note about something.';
            expect(service.detectSource(null, text)).toBe('plain-text');
        });

        it('should detect generic HTML', () => {
            const html = '<p>Just some <strong>HTML</strong></p>';
            expect(service.detectSource(html, '')).toBe('html');
        });

        it('should detect plain text when no HTML', () => {
            expect(service.detectSource(null, 'Just plain text')).toBe('plain-text');
        });

        it('should detect plain text for empty HTML', () => {
            expect(service.detectSource('', 'Some text')).toBe('plain-text');
        });

        it('should detect plain text for whitespace-only HTML', () => {
            expect(service.detectSource('   ', 'Some text')).toBe('plain-text');
        });

        it('should return plain-text for empty inputs', () => {
            expect(service.detectSource(null, '')).toBe('plain-text');
        });

        it('should detect Excel via Office XML namespace', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>A</td></tr></table></body></html>';
            expect(service.detectSource(html, '')).toBe('excel');
        });

        it('should detect Excel via Generator meta tag', () => {
            const html = '<meta name="Generator" content="Microsoft Excel 16"><table><tr><td>Cell</td></tr></table>';
            expect(service.detectSource(html, '')).toBe('excel');
        });

        it('should detect Google Sheets as excel when google-sheets-html-origin and table present', () => {
            const html = '<google-sheets-html-origin><table><tr><td>Cell</td></tr></table></google-sheets-html-origin>';
            expect(service.detectSource(html, '')).toBe('excel');
        });

        it('should detect plain-text when HTML is minimal and text looks like PDF', () => {
            const html = '<span style="white-space: pre-wrap; font-size: 10pt;">This is the first line of a paragraph that\ncontinues on the next line because the PDF\nviewer wraps text at the column boundary.\nThis keeps going for a while so we have a\ngood amount of consistent-length lines to\ntrigger the PDF detection heuristic here.</span>';
            const text = [
                'This is the first line of a paragraph that',
                'continues on the next line because the PDF',
                'viewer wraps text at the column boundary.',
                'This keeps going for a while so we have a',
                'good amount of consistent-length lines to',
                'trigger the PDF detection heuristic here.',
            ].join('\n');
            expect(service.detectSource(html, text)).toBe('plain-text');
        });

        it('should detect html when HTML has semantic tags even if text looks like PDF', () => {
            const html = '<h1>Title</h1><p>This is the first line of a paragraph that continues on the next line.</p>';
            const text = [
                'Title',
                'This is the first line of a paragraph that',
                'continues on the next line because the PDF',
                'viewer wraps text at the column boundary.',
                'This keeps going for a while so we have a',
                'good amount of consistent-length lines to',
                'trigger the PDF detection heuristic here.',
            ].join('\n');
            expect(service.detectSource(html, text)).toBe('html');
        });
    });

    // =========================================================================
    // OFFICE NORMALIZER - WORD
    // =========================================================================

    describe('normalizeOffice - Word', () => {
        it('should strip conditional comments', () => {
            const html = '<p class="MsoNormal">Keep</p><!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]-->';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<!--[if');
            expect(result).not.toContain('<![endif]-->');
            expect(result).toContain('Keep');
        });

        it('should strip XML namespaced elements', () => {
            const html = '<p class="MsoNormal">Text<o:p>&nbsp;</o:p></p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<o:p>');
            expect(result).not.toContain('</o:p>');
            expect(result).toContain('Text');
        });

        it('should remove style blocks', () => {
            const html = '<style><!--.MsoNormal{font-family:Calibri}--></style><p class="MsoNormal">Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<style');
            expect(result).not.toContain('Calibri');
            expect(result).toContain('Text');
        });

        it('should remove mso-* style properties', () => {
            const html = '<p class="MsoNormal" style="mso-line-height-rule:exactly; color: red;">Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('mso-line-height-rule');
            expect(result).toContain('color: red');
        });

        it('should convert MsoHeading to h1-h6', () => {
            const html = '<p class="MsoHeading1">Title</p><p class="MsoHeading2">Subtitle</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<h1>');
            expect(result).toContain('Title');
            expect(result).toContain('<h2>');
            expect(result).toContain('Subtitle');
        });

        it('should convert headings via mso-outline-level', () => {
            const html = '<p class="MsoNormal" style="mso-outline-level:3">Heading 3</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<h3>');
            expect(result).toContain('Heading 3');
        });

        it('should convert MsoListParagraph to ul/li', () => {
            const html = [
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>Item 1</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>Item 2</p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>');
            expect(result).toContain('Item 1');
            expect(result).toContain('Item 2');
            expect(result).not.toContain('MsoListParagraph');
        });

        it('should convert ordered lists', () => {
            const html = [
                '<p class="MsoListParagraph" style="mso-list:l1 level1 lfo2">',
                '<span style="mso-list:Ignore">1. </span>First</p>',
                '<p class="MsoListParagraph" style="mso-list:l1 level1 lfo2">',
                '<span style="mso-list:Ignore">2. </span>Second</p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('<ol>');
            expect(result).toContain('First');
            expect(result).toContain('Second');
        });

        it('preserves a single-cell table pasted from Word', () => {
            // A table in the source is content. Word does use one-cell tables
            // as layout scaffolding, but the shape is indistinguishable from a
            // deliberate bordered callout or single-column list, so removing it
            // is drift from the original rather than a fix.
            const html = '<p class="MsoNormal">Before</p><table><tr><td><p class="MsoNormal">Cell content</p></td></tr></table>';
            const result = service.normalize(html, '');
            expect(result).toContain('Cell content');
            expect(result).toContain('<table>');
            expect(result).toContain('<td>');
        });

        it('should map mso-highlight to background-color', () => {
            const html = '<p class="MsoNormal"><span style="mso-highlight:yellow">Highlighted</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('background-color: yellow');
            expect(result).not.toContain('mso-highlight');
        });

        it('should preserve text color', () => {
            const html = '<p class="MsoNormal" style="color:blue; mso-fareast-font-family:Calibri">Text</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('color: blue');
            expect(result).not.toContain('mso-fareast');
        });

        it('should preserve text alignment', () => {
            const html = '<p class="MsoNormal" style="text-align:center; mso-style-name:Normal">Centered</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('text-align: center');
        });

        it('should remove empty paragraphs with only nbsp', () => {
            const html = '<p class="MsoNormal">Keep</p><p class="MsoNormal">&nbsp;</p><p class="MsoNormal">Also keep</p>';
            expect(service.normalize(html, '')).toBe('<p>Keep</p><p>Also keep</p>');
        });

        it('should handle mso-spacerun whitespace', () => {
            const html = '<p class="MsoNormal"><span style="mso-spacerun:yes">   </span>Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('mso-spacerun');
            expect(result).toContain('Text');
        });

        it('should convert font elements to spans with color', () => {
            const html = '<p class="MsoNormal"><font color="#FF0000">Red text</font></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('color: #FF0000');
            expect(result).toContain('Red text');
            expect(result).not.toContain('<font');
        });

        it('should convert font elements with size', () => {
            const html = '<p class="MsoNormal"><font color="blue" size="5">Big Blue</font></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('color: blue');
            expect(result).toContain('font-size: 24px');
            expect(result).toContain('Big Blue');
        });

        it('should strip Windows system color values', () => {
            const html = '<p class="MsoNormal" style="color:windowtext; mso-fareast-font-family:Calibri">Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('windowtext');
        });

        it('should map mso-style-textfill-fill-color to color', () => {
            const html = '<p class="MsoNormal"><span style="mso-style-textfill-fill-color:#FF6600">Orange</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('color: #FF6600');
        });

        it('should strip XML processing instructions', () => {
            // After the content: a leading one lands before <html>, never in the body.
            const html = '<p class="MsoNormal">Text</p><?xml version="1.0" encoding="UTF-8"?>';
            expect(service.normalize(html, '')).toBe('<p>Text</p>');
        });

        it('should strip class and id attributes', () => {
            const html = '<p class="MsoNormal" id="para1">Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('MsoNormal');
            expect(result).not.toContain('id=');
        });

        it('should map mso-bidi-font-weight to semantic bold', () => {
            const html = '<p class="MsoNormal"><span style="mso-bidi-font-weight:bold">Bold text</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<strong>');
            expect(result).toContain('Bold text');
        });

        it('should map mso-bidi-font-style to semantic italic', () => {
            const html = '<p class="MsoNormal"><span style="mso-bidi-font-style:italic">Italic text</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<em>');
            expect(result).toContain('Italic text');
        });

        it('should inline CSS class-based colors from style blocks', () => {
            const html = [
                '<style>span.Heading1Char { color: #2F5496; font-weight: bold; }</style>',
                '<p class="MsoNormal"><span class="Heading1Char">Blue Heading</span></p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('color: #2F5496');
            expect(result).toContain('Blue Heading');
        });

        it('should inline CSS class-based colors without overriding inline styles', () => {
            const html = [
                '<style>p.MsoNormal { color: #333333; }</style>',
                '<p class="MsoNormal" style="color: red;">Inline wins</p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('color: red');
            expect(result).not.toContain('#333333');
        });

        it('should handle comma-separated selectors in style blocks', () => {
            const html = [
                '<style>p.MsoNormal, li.MsoNormal { color: #444444; }</style>',
                '<p class="MsoNormal">Para</p><ul><li class="MsoNormal" style="mso-list:l0 level1">Item</li></ul>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('color: #444444');
        });

        it('should inline CSS from style blocks wrapped in HTML comments', () => {
            const html = [
                '<style><!--',
                'p.MsoHeading2 { color: #2F5496; font-size: 13.0pt; }',
                'span.Heading2Char { color: #2F5496; }',
                '--></style>',
                '<p class="MsoHeading2"><span class="Heading2Char">Blue Heading</span></p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('#2F5496');
            expect(result).toContain('Blue Heading');
        });

        it('should create separate lists when interrupted by non-list elements', () => {
            const html = [
                '<p class="MsoHeading3" style="mso-outline-level:3">Section A</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>Bullet A1</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>Bullet A2</p>',
                '<p class="MsoHeading3" style="mso-outline-level:3">Section B</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>Bullet B1</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>Bullet B2</p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('Section A');
            expect(result).toContain('Section B');
            expect(result).toContain('Bullet A1');
            expect(result).toContain('Bullet A2');
            expect(result).toContain('Bullet B1');
            expect(result).toContain('Bullet B2');
            const ulCount = (result.match(/<ul>/g) ?? []).length;
            expect(ulCount).toBe(2);
        });
    });

    // =========================================================================
    // OFFICE NORMALIZER - OUTLOOK
    // =========================================================================

    describe('normalizeOffice - Outlook', () => {
        it('should strip WordSection1 wrapper', () => {
            const html = '<div class="WordSection1"><p class="MsoNormal">Content</p></div>';
            expect(service.normalize(html, '')).toBe('<p>Content</p>');
        });

        it('should remove VML elements', () => {
            const html = '<div class="WordSection1"><p class="MsoNormal">Text</p><v:shape id="shape1">Drawing</v:shape></div>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('v:shape');
            expect(result).not.toContain('Drawing');
            expect(result).toContain('Text');
        });

        it('should preserve links from Outlook auto-detection', () => {
            const html = '<div class="WordSection1"><p class="MsoNormal"><a href="https://example.com">Link</a></p></div>';
            const result = service.normalize(html, '');
            expect(result).toContain('href="https://example.com"');
            expect(result).toContain('Link');
        });
    });

    // =========================================================================
    // GOOGLE DOCS NORMALIZER
    // =========================================================================

    describe('normalizeGoogleDocs', () => {
        it('should remove docs-internal-guid wrapper', () => {
            const html = '<b id="docs-internal-guid-abc123" style="font-weight:normal"><span style="font-size:11pt;">Text</span></b>';
            expect(service.normalize(html, '')).toBe('<span style="font-size: 11pt">Text</span>');
        });

        it('should simplify bloated span styles', () => {
            const html = '<span id="docs-internal-guid-x"><span style="font-size:11pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:400;font-style:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap">Text</span></span>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('font-family');
            expect(result).not.toContain('background-color: transparent');
            expect(result).not.toContain('font-weight: 400');
            expect(result).toContain('Text');
        });

        it('should convert bold spans to strong elements', () => {
            const html = '<b id="docs-internal-guid-x"><span style="font-weight:700">Bold text</span></b>';
            const result = service.normalize(html, '');
            expect(result).toContain('<strong>');
            expect(result).toContain('Bold text');
        });

        it('should convert italic spans to em elements', () => {
            const html = '<b id="docs-internal-guid-x"><span style="font-style:italic">Italic text</span></b>';
            const result = service.normalize(html, '');
            expect(result).toContain('<em>');
            expect(result).toContain('Italic text');
        });

        it('should convert underline spans to u elements', () => {
            const html = '<b id="docs-internal-guid-x"><span style="text-decoration:underline">Underlined</span></b>';
            const result = service.normalize(html, '');
            expect(result).toContain('<u>');
            expect(result).toContain('Underlined');
        });

        it('should preserve meaningful colors', () => {
            const html = '<span id="docs-internal-guid-x"><span style="color:#ff0000;font-size:14pt">Red text</span></span>';
            const result = service.normalize(html, '');
            expect(result).toContain('color');
            expect(result).toContain('#ff0000');
        });

        it('should handle Google Docs lists', () => {
            const html = '<span id="docs-internal-guid-x"><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px"><li style="list-style-type:disc;font-size:11pt;margin-left:-18pt"><span>Item</span></li></ul></span>';
            const result = service.normalize(html, '');
            expect(result).toContain('<ul>');
            expect(result).toContain('<li');
            expect(result).toContain('Item');
        });

        it('should handle Google Sheets table paste', () => {
            const html = '<table data-sheets-value="{&quot;1&quot;:2}" data-sheets-userformat="{&quot;2&quot;:1}"><tr><td>Cell</td></tr></table>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('data-sheets-');
            expect(result).toContain('<table>');
            expect(result).toContain('Cell');
        });

        it('should clean kix-line-break br tags', () => {
            const html = '<p id="docs-internal-guid-x">Line 1<br class="kix-line-break">Line 2</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('kix-line-break');
            expect(result).toContain('<br>');
        });

        it('should unwrap spans with no remaining meaningful styles', () => {
            const html = '<b id="docs-internal-guid-x"><span style="font-weight:400;font-style:normal;text-decoration:none;vertical-align:baseline;white-space:pre-wrap;color:#000000;background-color:transparent">Plain text</span></b>';
            const result = service.normalize(html, '');
            expect(result).toContain('Plain text');
            const spanCount = (result.match(/<span/g) ?? []).length;
            expect(spanCount).toBe(0);
        });
    });

    // =========================================================================
    // GENERIC OFFICE NORMALIZER (Apple Pages & LibreOffice)
    // =========================================================================

    describe('normalizeGenericOffice', () => {
        it('should strip Apple Pages meta tags', () => {
            // After the content, so the parser puts it in the body, not the head.
            const html = '<p>Text</p><meta name="Generator" content="Cocoa HTML Writer">';
            expect(service.normalize(html, '')).toBe('<p>Text</p>');
        });

        it('should strip vendor-prefixed styles', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><p style="-webkit-text-size-adjust:auto; -apple-text-decorations-in-effect:none; color:red">Text</p></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('-webkit-');
            expect(result).not.toContain('-apple-');
            expect(result).toContain('color: red');
        });

        it('should convert font elements to spans', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><font color="red" size="5">Big Red</font></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<font');
            expect(result).toContain('Big Red');
            expect(result).toContain('color: red');
        });

        it('should strip class and id attributes', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><p class="p1" id="x">Text</p></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('class=');
            expect(result).not.toContain('id=');
        });
    });

    // =========================================================================
    // GENERIC HTML NORMALIZER
    // =========================================================================

    describe('normalizeGenericHtml', () => {
        it('should strip class and id attributes', () => {
            const html = '<p class="custom-class" id="para-1">Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('class=');
            expect(result).not.toContain('id=');
            expect(result).toContain('Text');
        });

        it('should convert b to strong', () => {
            const html = '<b>Bold</b>';
            const result = service.normalize(html, '');
            expect(result).toContain('<strong>');
            expect(result).toContain('Bold');
        });

        it('should convert i to em', () => {
            const html = '<i>Italic</i>';
            const result = service.normalize(html, '');
            expect(result).toContain('<em>');
            expect(result).toContain('Italic');
        });

        it('should normalize div paragraphs to p', () => {
            const html = '<div>Simple paragraph</div>';
            const result = service.normalize(html, '');
            expect(result).toContain('<p>');
            expect(result).toContain('Simple paragraph');
        });

        it('should not convert divs with block children to p', () => {
            const html = '<div><p>Nested</p></div>';
            const result = service.normalize(html, '');
            expect(result).toContain('<div>');
            expect(result).toContain('<p>');
        });

        it('should strip meta tags', () => {
            // After the content, so the parser puts it in the body, not the head.
            const html = '<p>Text</p><meta charset="utf-8">';
            expect(service.normalize(html, '')).toBe('<p>Text</p>');
        });

        it('should preserve semantic formatting', () => {
            const html = '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<strong>');
            expect(result).toContain('<em>');
            expect(result).toContain('<u>');
        });

        it('should preserve tables', () => {
            const html = '<table><tr><td>A</td><td>B</td></tr></table>';
            const result = service.normalize(html, '');
            expect(result).toContain('<table>');
            expect(result).toContain('<td>');
        });

        it('should preserve links', () => {
            const html = '<a href="https://example.com">Link</a>';
            const result = service.normalize(html, '');
            expect(result).toContain('href="https://example.com"');
        });
    });

    // =========================================================================
    // EXCEL NORMALIZER
    // =========================================================================

    describe('normalizeExcel', () => {
        it('should preserve basic table structure from Excel', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).toContain('<table>');
            expect(result).toContain('<tr>');
            expect(result).toContain('<td>');
            expect(result).toContain('A1');
            expect(result).toContain('B1');
            expect(result).toContain('A2');
            expect(result).toContain('B2');
        });

        it('should unwrap google-sheets-html-origin wrapper', () => {
            const html = '<google-sheets-html-origin><table><tr><td>Cell</td></tr></table></google-sheets-html-origin>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('google-sheets-html-origin');
            expect(result).toContain('<table>');
            expect(result).toContain('Cell');
        });

        it('should convert bold cell content to semantic strong', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td style="font-weight:bold">Bold Cell</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).toContain('<strong>');
            expect(result).toContain('Bold Cell');
        });

        it('should convert italic cell content to semantic em', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td style="font-style:italic">Italic Cell</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).toContain('<em>');
            expect(result).toContain('Italic Cell');
        });

        it('should fill empty cells with br element', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>Data</td><td></td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).toContain('<td><br></td>');
        });

        it('should propagate column widths from col elements to cells', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><colgroup><col width="120"><col width="200"></colgroup><tr><td>A</td><td>B</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<col');
            expect(result).not.toContain('<colgroup>');
            expect(result).toContain('120px');
            expect(result).toContain('200px');
        });

        it('should remove XML-namespaced elements from Excel paste', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><x:ExcelWorkbook>ignored</x:ExcelWorkbook><table><tr><td>Data</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('ExcelWorkbook');
            expect(result).toContain('Data');
        });

        it('should remove style blocks from Excel paste', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><style>td{font-family:Calibri}</style><table><tr><td>Data</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<style');
            expect(result).not.toContain('Calibri');
        });

        it('should strip data-sheets-* attributes from Google Sheets cells', () => {
            const html = '<google-sheets-html-origin><table><tr><td data-sheets-value="{}" data-sheets-numberformat="General">42</td></tr></table></google-sheets-html-origin>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('data-sheets-');
            expect(result).toContain('42');
        });

        it('should strip class and id attributes from Excel table', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table class="xl65" id="table01"><tr><td class="xl66">Data</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('class=');
            expect(result).not.toContain('id=');
            expect(result).toContain('Data');
        });

        it('should remove conditional comments from Excel paste', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><!--[if gte mso 9]><xml></xml><![endif]--><table><tr><td>Data</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<!--');
            expect(result).toContain('Data');
        });

        it('should map mso-highlight to background-color in Excel cells', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td style="mso-highlight:yellow">Highlighted</td></tr></table></body></html>';
            const result = service.normalize(html, '');
            expect(result).toContain('background-color: yellow');
            expect(result).not.toContain('mso-highlight');
        });

    });

    // =========================================================================
    // PLAIN TEXT NORMALIZER
    // =========================================================================

    describe('normalizePlainText', () => {
        it('should escape HTML entities', () => {
            const result = service.normalize(null, '<script>alert(1)</script>');
            expect(result).toContain('&lt;script&gt;');
            expect(result).not.toContain('<script>');
        });

        it('should convert double newlines to paragraphs', () => {
            const result = service.normalize(null, 'Para 1\n\nPara 2');
            expect(result).toContain('<p>Para 1</p>');
            expect(result).toContain('<p>Para 2</p>');
        });

        it('should convert single newlines to br', () => {
            const result = service.normalize(null, 'Line 1\nLine 2');
            expect(result).toContain('Line 1<br>Line 2');
        });

        it('should auto-link URLs, including a query string', () => {
            const result = service.normalize(null, 'Visit https://example.com today');
            expect(result).toContain('<a href="https://example.com">https://example.com</a>');

            // A bare URL is the ONE shape where the &-truncation bug cannot
            // appear, so the test above could not fail for it. autoLinkUrls runs
            // on escaped text, where a real "&" is already "&amp;"; excluding
            // "&" from the URL class cut every multi-parameter link at its first
            // parameter, leaving a broken href and the rest as visible text.
            const query = service.normalize(null, 'see https://example.com/a?x=1&y=2 end');
            expect(query).toContain('href="https://example.com/a?x=1&amp;y=2"');
        });

        it('should auto-link http URLs', () => {
            const result = service.normalize(null, 'Visit http://example.com today');
            expect(result).toContain('<a href="http://example.com">http://example.com</a>');
        });

        it('keeps every entity that belongs INSIDE a url', () => {
            // The class runs on already-escaped text, so it must decide per
            // entity whether it continues a URL or ends one. The first fix
            // handled only &amp;, leaving an apostrophe to truncate the href --
            // a link to the WRONG page rather than a visibly broken one, which
            // is the worse failure. Slugs with apostrophes are ordinary in CMS
            // URLs.
            const hrefOf = (text: string): string | null => {
                const parsed = new DOMParser().parseFromString(service.normalize(null, text), 'text/html');
                return parsed.querySelector('a')?.getAttribute('href') ?? null;
            };

            expect(hrefOf('see https://e.com/a?x=1&y=2 end'))
                .toBe('https://e.com/a?x=1&y=2');
            expect(hrefOf("see https://e.com/it's-here end"))
                .toBe("https://e.com/it's-here");
            expect(hrefOf('multi https://e.com/a?x=1&y=2&z=3 end'))
                .toBe('https://e.com/a?x=1&y=2&z=3');
        });

        it('ends a url at a character that cannot appear unencoded in one', () => {
            // <, > and " are not legal unencoded in a URL and they delimit
            // markup, so a URL must not swallow the escaped tags around it.
            const hrefOf = (text: string): string | null => {
                const parsed = new DOMParser().parseFromString(service.normalize(null, text), 'text/html');
                return parsed.querySelector('a')?.getAttribute('href') ?? null;
            };

            expect(hrefOf('see https://e.com/a"b end')).toBe('https://e.com/a');
            expect(hrefOf('see https://e.com/a<b end')).toBe('https://e.com/a');
            expect(hrefOf('quoted "https://e.com/a" end')).toBe('https://e.com/a');
        });

        it('preserves the visible text whatever the href ends up being', () => {
            // Truncating the href must never eat the characters after it: the
            // reader should still see the whole URL they pasted.
            for (const text of [
                "see https://e.com/it's-here end",
                'see https://e.com/a"b end',
                'see https://e.com/a?x=1&y=2 end',
            ]) {
                const parsed = new DOMParser().parseFromString(service.normalize(null, text), 'text/html');
                expect(parsed.body.textContent).toBe(text);
            }
        });

        it('leaves a standalone ampersand entity alone', () => {
            // The URL class matches "&amp;" as a unit; a lone entity elsewhere in
            // the text must not be drawn into a link.
            const result = service.normalize(null, 'a & b');
            expect(result).not.toContain('<a ');
        });

        it('should not auto-link non-http URLs', () => {
            const result = service.normalize(null, 'Visit ftp://example.com today');
            expect(result).not.toContain('<a href="ftp://');
        });

        it('should return empty string for empty text', () => {
            expect(service.normalize(null, '')).toBe('');
        });

        it('should handle text with only whitespace', () => {
            const result = service.normalize(null, '   ');
            expect(result).toBe('   ');
        });

        it('should not wrap single-line text in paragraphs', () => {
            const result = service.normalize(null, 'Just a simple line');
            expect(result).toBe('Just a simple line');
            expect(result).not.toContain('<p>');
        });

        it('preserves the line breaks of a plain multi-line paste', () => {
            const multiLine = 'Line one.\nLine two.\nLine three.\nLine four.\nLine five.';
            const result = service.normalize(null, multiLine);
            // The old title claimed these lines were joined into ONE paragraph;
            // the code preserves them as <br> and the assertion (toContain
            // '<p>')) was true either way, so the contradiction went unnoticed.
            // Newlines the user pasted are content: they survive.
            expect(result).toBe('<p>Line one.<br>Line two.<br>Line three.<br>Line four.<br>Line five.</p>');
        });

        it('preserves every line of a structured plain-text paste', () => {
            // These replace 13 tests that asserted the REFLOW: any text passing
            // looksLikePdfText had its consecutive lines joined, on the theory
            // they were PDF column wrapping. That heuristic matches the shape of
            // most multi-line text, so each of these collapsed into one run-on
            // line -- and the address gained an <h2>, the diff lost its markers.
            const NLC = String.fromCodePoint(10);
            const cases: ReadonlyArray<readonly [string, readonly string[]]> = [
                ['csv', ['alice,30,engineer', 'bob,25,designer', 'carol,35,manager', 'dave,28,analyst']],
                ['address', ['John Smith', '123 Main Street', 'Springfield, IL 62704', 'United States']],
                ['sql', ['SELECT id, name FROM users', 'WHERE active = true', 'ORDER BY created_at DESC', 'LIMIT 100;']],
                ['shopping', ['Buy apples today', 'Buy oranges today', 'Buy bananas today', 'Buy grapes today']],
                ['lyrics', ['I walked along the empty street', 'beneath the pale and silver moon', 'and thought of all the words unsaid']],
            ];
            for (const [, lines] of cases) {
                const result = service.normalize(null, lines.join(NLC));
                // One <br> per line break: nothing joined, nothing dropped.
                expect(result.match(/<br>/g) ?? []).toHaveLength(lines.length - 1);
                for (const line of lines) {
                    expect(result).toContain(line);
                }
                // Nothing invented: no heading or list conjured from plain text.
                expect(result).not.toContain('<h2>');
                expect(result).not.toContain('<li>');
            }
        });

        it('keeps list markers instead of turning them into <li>', () => {
            // A pasted diff lost the leading '-' that carries its meaning: the
            // markers were stripped and rebuilt as <ul><li>.
            const NLC = String.fromCodePoint(10);
            const diff = ['- removed line one', '- removed line two', '- removed line three'].join(NLC);
            const result = service.normalize(null, diff);
            expect(result).not.toContain('<li>');
            expect(result).toContain('- removed line one');
            expect(result).toContain('- removed line two');
        });

        it('still splits paragraphs on a blank line', () => {
            // Blank-line paragraph splitting is real structure in the source and
            // is kept; only the guessed line JOINING is gone.
            const NLC = String.fromCodePoint(10);
            const result = service.normalize(null, 'First paragraph here.' + NLC + NLC + 'Second paragraph here.');
            expect(result.match(/<p>/g) ?? []).toHaveLength(2);
            expect(result).not.toContain('<br>');
        });
    });

    // =========================================================================
    // MARKDOWN NORMALIZER
    // =========================================================================

    describe('normalizeMarkdown', () => {
        it('should convert markdown headings to HTML', () => {
            const result = service.normalize(null, '# Heading 1\n\n## Heading 2\n\nSome text');
            expect(result).toContain('<h1>');
            expect(result).toContain('Heading 1');
            expect(result).toContain('<h2>');
        });

    });

    // =========================================================================
    // INTEGRATION TESTS
    // =========================================================================

    describe('integration - end to end', () => {
        it('should produce clean HTML from realistic Word paste', () => {
            const wordHtml = [
                '<!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]-->',
                '<style><!--.MsoNormal{font-family:Calibri}--></style>',
                '<p class="MsoHeading1" style="mso-outline-level:1">Title</p>',
                '<p class="MsoNormal" style="mso-line-height-rule:exactly; color:blue">',
                'A <span style="mso-bidi-font-weight:bold">bold</span> paragraph.</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>List item 1</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>List item 2</p>',
            ].join('');

            const result = pipeline(wordHtml, '');

            expect(result).toContain('<h1>');
            expect(result).toContain('Title');
            expect(result).toContain('<strong>');
            expect(result).toContain('bold');
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>');
            expect(result).toContain('List item 1');
            expect(result).not.toContain('MsoNormal');
            expect(result).not.toContain('mso-');
            expect(result).not.toContain('<!--');
            expect(result).not.toContain('<style');
        });

        it('should produce clean HTML from realistic Google Docs paste', () => {
            const gdocsHtml = [
                '<b id="docs-internal-guid-abc123" style="font-weight:normal">',
                '<span style="font-size:18pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:700;font-style:normal;text-decoration:none">Title</span>',
                '<br>',
                '<span style="font-size:11pt;font-family:Arial;color:#ff0000;background-color:transparent;font-weight:400;font-style:italic;text-decoration:none">Red italic text</span>',
                '</b>',
            ].join('');

            const result = pipeline(gdocsHtml, '');

            expect(result).toContain('<strong>');
            expect(result).toContain('Title');
            expect(result).toContain('<em>');
            expect(result).toContain('Red italic text');
            expect(result).toContain('#ff0000');
            expect(result).not.toContain('docs-internal-guid');
            expect(result).not.toContain('font-family');
            expect(result).not.toContain('background-color: transparent');
        });

    });

    // =========================================================================
    // SECURITY - WORD/OUTLOOK PASTE INJECTION
    // =========================================================================

    describe('Security - Word/Outlook paste injection', () => {
        it('should strip script hidden in conditional comments', () => {
            const html = '<p class="MsoNormal">Safe</p><!--[if gte mso 9]><script>alert(1)</script><![endif]-->';
            const result = pipeline(html, '');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert(1)');
            expect(result).toContain('Safe');
        });

        it('should remove event handlers on mso elements', () => {
            const html = '<p class="MsoNormal" onclick="alert(1)">Text</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('onclick');
            expect(result).not.toContain('alert(1)');
            expect(result).toContain('Text');
        });

        it('should strip javascript: URLs in Word hyperlinks', () => {
            const html = '<p class="MsoNormal"><a href="javascript:alert(1)" class="MsoHyperlink">Click</a></p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('javascript:');
            expect(result).toContain('Click');
        });

        it('should fully remove VML with embedded script', () => {
            const html = '<div class="WordSection1"><p class="MsoNormal">Safe</p><v:rect><v:textbox><script>alert(1)</script></v:textbox></v:rect></div>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert(1)');
            expect(result).not.toContain('v:rect');
            expect(result).toContain('Safe');
        });

        it('should strip mso-* style with expression()', () => {
            const html = '<p class="MsoNormal" style="mso-highlight: expression(alert(1))">Text</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('expression');
            expect(result).not.toContain('alert(1)');
        });

        it('should remove OLE object injection', () => {
            const html = '<p class="MsoNormal">Safe</p><o:OLEObject Type="Embed" ProgID="Shell.Explorer"></o:OLEObject>';
            const result = pipeline(html, '');
            expect(result).not.toContain('OLEObject');
            expect(result).not.toContain('Shell.Explorer');
            expect(result).toContain('Safe');
        });

        it('should block data URI XSS in Word image', () => {
            const html = '<p class="MsoNormal"><img src="data:text/html,<script>alert(1)</script>"></p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('data:text/html');
            expect(result).not.toContain('alert(1)');
        });

        it('should remove xml blocks with script content', () => {
            const html = '<xml><script>alert(1)</script></xml><p class="MsoNormal">Safe</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert(1)');
            expect(result).toContain('Safe');
        });

        it('should strip onload handler in Word image', () => {
            const html = '<p class="MsoNormal"><img src="pic.jpg" onload="alert(1)"></p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('onload');
            expect(result).not.toContain('alert(1)');
        });

        it('should strip style blocks containing malicious CSS', () => {
            // After the content, so the parser puts it in the body, not the head.
            // Both layers drop it on their own.
            const html = '<p class="MsoNormal">Text</p><style>body{background:url(javascript:alert(1))}</style>';
            expect(service.normalize(html, '')).toBe('<p>Text</p>');
            expect(pipeline(html, '')).toBe('<p>Text</p>');
        });

        it('should not inline disallowed CSS properties from style blocks', () => {
            const html = [
                '<style>span.Evil { position: absolute; top: 0; z-index: 9999; }</style>',
                '<p class="MsoNormal"><span class="Evil">Text</span></p>',
            ].join('');
            const result = pipeline(html, '');
            expect(result).not.toContain('position');
            expect(result).not.toContain('z-index');
            expect(result).toContain('Text');
        });

        it('should sanitize expression() inlined from style blocks', () => {
            const html = [
                '<style>span.Xss { color: expression(alert(1)); }</style>',
                '<p class="MsoNormal"><span class="Xss">Text</span></p>',
            ].join('');
            const result = pipeline(html, '');
            expect(result).not.toContain('expression');
            expect(result).not.toContain('alert');
        });
    });

    // =========================================================================
    // SECURITY - GOOGLE DOCS PASTE INJECTION
    // =========================================================================

    describe('Security - Google Docs paste injection', () => {
        it('should remove script inside docs-internal-guid wrapper', () => {
            const html = '<b id="docs-internal-guid-xxx"><script>alert(1)</script><span>Safe</span></b>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert(1)');
            expect(result).toContain('Safe');
        });

        it('should strip event handler on Google Docs span', () => {
            const html = '<b id="docs-internal-guid-xxx"><span style="font-size:11pt" onmouseover="alert(1)">Text</span></b>';
            const result = pipeline(html, '');
            expect(result).not.toContain('onmouseover');
            expect(result).not.toContain('alert(1)');
            expect(result).toContain('Text');
        });

        it('should remove javascript: URL in Google Docs link', () => {
            const html = '<b id="docs-internal-guid-xxx"><a href="javascript:void(0)" style="color:#1155cc">Link</a></b>';
            const result = pipeline(html, '');
            expect(result).not.toContain('javascript:');
            expect(result).toContain('Link');
        });

        it('should strip malicious data-sheets-* attribute payload', () => {
            const html = '<table data-sheets-value="<script>alert(1)</script>"><tr><td>Cell</td></tr></table>';
            const result = pipeline(html, '');
            expect(result).not.toContain('data-sheets-');
            expect(result).not.toContain('<script>');
            expect(result).toContain('Cell');
        });

        it('should block CSS url() injection via inline style', () => {
            const html = '<b id="docs-internal-guid-xxx"><span style="background:url(javascript:alert(1))">Text</span></b>';
            const result = pipeline(html, '');
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('url(');
        });

        it('should remove SVG injection within Google Docs paste', () => {
            const html = '<b id="docs-internal-guid-xxx"><svg onload="alert(1)"><circle r="10"/></svg><span>Safe</span></b>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<svg');
            expect(result).not.toContain('onload');
            expect(result).toContain('Safe');
        });

        it('should clean fake Google Docs wrapper around XSS payload', () => {
            const html = '<b id="docs-internal-guid-evil"><img src=x onerror="alert(1)"><script>alert(2)</script></b>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });

        it('should strip vbscript: URL in Google Docs link', () => {
            const html = '<b id="docs-internal-guid-xxx"><a href="vbscript:alert(1)">Link</a></b>';
            const result = pipeline(html, '');
            expect(result).not.toContain('vbscript:');
        });
    });

    // =========================================================================
    // SECURITY - APPLE PAGES / LIBREOFFICE PASTE INJECTION
    // =========================================================================

    describe('Security - Apple Pages / LibreOffice paste injection', () => {
        it('should remove script tag inside Pages HTML', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><script>alert(1)</script><p>Safe</p></body></html>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert(1)');
            expect(result).toContain('Safe');
        });

        it('should strip -apple-* style with expression()', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><p style="-apple-text-decorations-in-effect: expression(alert(1)); color: red">Text</p></body></html>';
            const result = pipeline(html, '');
            expect(result).not.toContain('expression');
            expect(result).not.toContain('-apple-');
            expect(result).toContain('color: red');
        });

        it('should strip event handler on font tag', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><font face="Arial" onerror="alert(1)">Text</font></body></html>';
            const result = pipeline(html, '');
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert(1)');
            expect(result).toContain('Text');
        });

        it('should remove object tag from LibreOffice paste', () => {
            const html = '<html><head><meta name="generator" content="LibreOffice 7.5"></head><body><object data="evil.swf"></object><p>Safe</p></body></html>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<object');
            expect(result).not.toContain('evil.swf');
            expect(result).toContain('Safe');
        });

        it('should remove embed tag from LibreOffice paste', () => {
            const html = '<html><head><meta name="generator" content="LibreOffice 7.5"></head><body><embed src="evil.swf"><p>Safe</p></body></html>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<embed');
        });

        it('should remove iframe from Pages paste', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><iframe src="https://evil.com"></iframe><p>Safe</p></body></html>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('evil.com');
        });
    });

    // =========================================================================
    // SECURITY - GENERIC HTML PASTE INJECTION
    // =========================================================================

    describe('Security - Generic HTML paste injection', () => {
        it('should strip img onerror handler', () => {
            const html = '<img src=x onerror=alert(1)>';
            const result = pipeline(html, '');
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert(1)');
        });

        it('should remove javascript: href', () => {
            const html = '<a href="javascript:alert(1)">Link</a>';
            const result = pipeline(html, '');
            expect(result).not.toContain('javascript:');
        });

        it('should block CSS url() with javascript:', () => {
            const html = '<div style="background:url(javascript:alert(1))">Text</div>';
            const result = pipeline(html, '');
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('url(');
        });

        it('should remove iframe entirely', () => {
            const html = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('evil.com');
            expect(result).toContain('Safe');
        });

        it('should remove SVG with script', () => {
            const html = '<svg><use xlink:href="data:text/html,<script>alert(1)</script>"></use></svg><p>Safe</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<svg');
            expect(result).not.toContain('<script>');
            expect(result).toContain('Safe');
        });

        it('should remove nested script tags', () => {
            const html = '<div><div><script>alert(1)</script></div></div>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert(1)');
        });

        it('should block CSS expression() in style', () => {
            const html = '<p style="width:expression(alert(1))">Text</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('expression');
            expect(result).not.toContain('alert(1)');
        });

        it('should remove meta refresh redirect', () => {
            // After the content, so the parser puts it in the body, not the head.
            // Both layers drop it on their own.
            const html = '<p>Safe</p><meta http-equiv="refresh" content="0;url=https://evil.com">';
            expect(service.normalize(html, '')).toBe('<p>Safe</p>');
            expect(pipeline(html, '')).toBe('<p>Safe</p>');
        });

        it('should remove base tag', () => {
            // After the content, so the parser puts it in the body, not the head.
            // Both layers drop it on their own.
            const html = '<p>Safe</p><base href="https://evil.com">';
            expect(service.normalize(html, '')).toBe('<p>Safe</p>');
            expect(pipeline(html, '')).toBe('<p>Safe</p>');
        });

        it('should strip event handlers after browser entity decoding', () => {
            const html = '<img src=x on&#101;rror=alert(1)>';
            const result = pipeline(html, '');
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });

        it('should remove form action with javascript:', () => {
            const html = '<form action="javascript:alert(1)"><input type="submit"></form>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<form');
            expect(result).not.toContain('javascript:');
        });

        it('should strip data: URI on links', () => {
            const html = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
            const result = pipeline(html, '');
            expect(result).not.toContain('data:text/html');
            expect(result).not.toContain('<script>');
        });

        it('should remove object and embed tags', () => {
            const html = '<object data="evil.swf"></object><embed src="evil2.swf"><p>Safe</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<object');
            expect(result).not.toContain('<embed');
            expect(result).toContain('Safe');
        });
    });

    // =========================================================================
    // SECURITY - PLAIN TEXT PASTE INJECTION
    // =========================================================================

    describe('Security - Plain text paste injection', () => {
        it('should double-escape HTML entities', () => {
            const result = pipeline(null, '&lt;script&gt;alert(1)&lt;/script&gt;');
            expect(result).toContain('&amp;lt;script&amp;gt;');
            expect(result).not.toContain('<script>');
        });

        it('should not auto-link javascript: protocol URLs', () => {
            const result = pipeline(null, 'javascript:alert(1)');
            expect(result).not.toContain('<a href="javascript:');
            expect(result).not.toContain('href="javascript:');
        });

        it('should escape embedded HTML in plain text', () => {
            const result = pipeline(null, 'Hello <img src=x onerror=alert(1)> world');
            expect(result).not.toContain('<img');
            expect(result).toContain('&lt;img');
            expect(result).not.toMatch(/<img\b/);
        });

        it('should not auto-link data: URIs', () => {
            const result = pipeline(null, 'data:text/html,<script>alert(1)</script>');
            expect(result).not.toContain('<a href="data:');
        });

        it('should not auto-link vbscript: protocol URLs', () => {
            const result = pipeline(null, 'Visit vbscript:alert(1) for more');
            expect(result).not.toContain('<a href="vbscript:');
        });
    });

    // =========================================================================
    // SECURITY - MARKDOWN PASTE INJECTION
    // =========================================================================

    describe('Security - Markdown paste injection', () => {
        it('should sanitize javascript: in markdown link', () => {
            const result = pipeline(null, '## Title\n\n[click](javascript:alert(1))');
            expect(result).not.toContain('javascript:');
            expect(result).toContain('click');
        });

        it('should remove script tag in markdown content', () => {
            const result = pipeline(null, '# Title\n\n<script>alert(1)</script>\n\n**bold text**');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert(1)');
        });

        it('should sanitize data URI XSS in markdown image', () => {
            const result = pipeline(null, '## Section\n\n![img](data:text/html,<script>alert(1)</script>)');
            expect(result).not.toContain('data:text/html');
            expect(result).not.toContain('<script>');
        });

        it('should handle code blocks containing script tags safely', () => {
            const result = pipeline(null, '```html\n<script>alert(1)</script>\n```\n\n**Important** note');
            expect(result).toContain('<code');
            expect(result).not.toMatch(/<script[\s>]/i);
        });

        it('should sanitize vbscript: in markdown link', () => {
            const result = pipeline(null, '## Test\n\n[click](vbscript:alert(1))');
            expect(result).not.toContain('vbscript:');
        });

        it('should handle raw HTML img with onerror in markdown', () => {
            const result = pipeline(null, '# Title\n\n<img src=x onerror=alert(1)>\n\n**text**');
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });
    });

    // =========================================================================
    // SECURITY - PIPELINE INTEGRATION
    // =========================================================================

    describe('Security - Pipeline integration', () => {
        it('should ensure normalizer output passes through sanitizer', () => {
            const normalized = service.normalize('<p class="MsoNormal"><script>alert(1)</script>Safe</p>', '');
            const sanitized = sanitizer.sanitize(normalized);
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('Safe');
        });

    });

    // =========================================================================
    // COVERAGE EDGE CASES
    // =========================================================================

    describe('detectSource - markdown scoring edges', () => {
        it('scores ordered lists and blockquotes toward markdown', () => {
            const text = '1. first\n2. second\n> a quote line\nmore body text';
            expect(service.detectSource(null, text)).toBe('markdown');
        });
    });

    describe('normalizeOffice - CSS style-block edges', () => {
        it('removes a <style> block that lives inside the body', () => {
            const html = '<p class="MsoNormal">Body</p><style>.MsoNormal{color:red}</style>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<style');
            expect(result).toContain('Body');
        });

        it('merges declarations when the same selector appears twice', () => {
            const html = [
                '<style>span.Dup { color: #112233; } span.Dup { font-weight: bold; }</style>',
                '<p class="MsoNormal"><span class="Dup">Text</span></p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('color: #112233');
            expect(result).toContain('<strong>');
        });

        it('detects a heading via mso-style-name', () => {
            const html = '<p class="MsoNormal" style="mso-style-name:Heading 2">Styled Title</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<h2>');
            expect(result).toContain('Styled Title');
        });
    });

    describe('normalizeOffice - list level edges', () => {
        it('closes deeper levels when returning to a shallower list level', () => {
            const html = [
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">· </span>One</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">o </span>One-A</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">· </span>Two</p>',
            ].join('');
            expect(service.normalize(html, ''))
                .toBe('<ul><li>One<ul><li>One-A</li></ul></li><li>Two</li></ul>');
        });

        it('creates a synthetic parent li when a list starts at a deeper level', () => {
            const html = [
                '<p class="MsoListParagraph" style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">o </span>Deep first</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">o </span>Deep second</p>',
            ].join('');
            const probe = document.createElement('div');
            probe.innerHTML = service.normalize(html, '');
            const parent = probe.querySelector(':scope > ul > li');
            expect(Array.from(parent?.childNodes ?? []).map((n) => n.nodeName)).not.toContain('#text');
            expect(Array.from(probe.querySelectorAll(':scope > ul > li > ul > li')).map((li) => li.textContent))
                .toEqual(['Deep first', 'Deep second']);
        });
    });

    describe('normalizeOffice - mso property mapping', () => {
        it('maps mso-ansi-font-size to font-size', () => {
            const html = '<p class="MsoNormal"><span style="mso-ansi-font-size:14.0pt">Sized</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('font-size: 14.0pt');
        });

        it('maps mso-bidi-font-size to font-size', () => {
            const html = '<p class="MsoNormal"><span style="mso-bidi-font-size:11.0pt">Sized</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('font-size: 11.0pt');
        });

        it('maps mso-text-underline to underline text-decoration', () => {
            const html = '<p class="MsoNormal"><span style="mso-text-underline:single">Underlined</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<u>');
            expect(result).toContain('Underlined');
        });

        it('maps mso-ansi-font-weight to font-weight', () => {
            const html = '<p class="MsoNormal"><span style="mso-ansi-font-weight:700">Heavy</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<strong>');
            expect(result).toContain('Heavy');
        });

        it('maps mso-font-kerning to letter-spacing', () => {
            const html = '<p class="MsoNormal"><span style="mso-font-kerning:1.0pt">Kerned</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('letter-spacing: 1.0pt');
        });

        it('maps mso-line-height-alt to line-height', () => {
            const html = '<p class="MsoNormal" style="mso-line-height-alt:15.0pt">Text</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('line-height: 15.0pt');
        });

        it('maps mso-text-raise to vertical-align', () => {
            const html = '<p class="MsoNormal"><span style="mso-text-raise:3.0pt">Raised</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('vertical-align: 3.0pt');
        });

        it('maps mso-border-alt to border, resolving windowtext', () => {
            const html = '<p class="MsoNormal" style="mso-border-alt:solid windowtext 1.0pt">Bordered</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('border:');
            expect(result).toContain('#000000');
        });

        it('maps mso-padding-alt to padding', () => {
            const html = '<p class="MsoNormal" style="mso-padding-alt:2.0pt 2.0pt 2.0pt 2.0pt">Padded</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('padding: 2.0pt 2.0pt 2.0pt 2.0pt');
        });

        it('maps a simple background color to background-color', () => {
            const html = '<p class="MsoNormal"><span style="background:#abcdef">Bg</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('background-color: #abcdef');
        });

        it('maps a background rgb() value to background-color', () => {
            const html = '<p class="MsoNormal"><span style="background:rgb(1,2,3)">Bg</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('background-color: rgb(1,2,3)');
        });

        it('maps a named background color to background-color', () => {
            const html = '<p class="MsoNormal"><span style="background:teal">Bg</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('background-color: teal');
        });

        it('keeps a non-color background value as-is (not a simple color)', () => {
            const html = '<p class="MsoNormal"><span style="background:none">Bg</span></p>';
            expect(service.normalize(html, '')).toBe('<p><span style="background: none">Bg</span></p>');
        });

        it('skips mso whitespace normalization inside pre elements', () => {
            const html = '<p class="MsoNormal">Text</p><pre class="MsoNormal">code  block</pre>';
            const result = service.normalize(html, '');
            expect(result).toContain('code');
        });

        it('collapses runs of non-breaking spaces in regular text', () => {
            const html = '<p class="MsoNormal">a&nbsp;&nbsp;&nbsp;b</p>';
            expect(service.normalize(html, '')).toBe('<p>a b</p>');
        });
    });

    describe('normalizeGoogleDocs - edges', () => {
        it('unwraps a nested bold element with font-weight:normal (no guid id)', () => {
            const html = '<b id="docs-internal-guid-x"><b style="font-weight:normal"><span style="color:red">Red</span></b></b>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<b');
            expect(result).toBe('<span style="color: red">Red</span>');
        });

        it('removes list-item styles that reduce to nothing', () => {
            const html = '<span id="docs-internal-guid-x"><ul><li style="margin-left:-18pt;padding-left:0"><span>Item</span></li></ul></span>';
            const result = service.normalize(html, '');
            expect(result).toContain('Item');
            expect(result).not.toContain('margin-left');
        });
    });

    describe('normalizeGenericOffice - edges', () => {
        it('removes a style attribute that only held vendor-prefixed props', () => {
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><p style="-webkit-text-size-adjust:auto">Text</p></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('style=');
            expect(result).toContain('Text');
        });
    });

    describe('normalizeGenericHtml - edges', () => {
        it('removes a <style> element that lives inside the body', () => {
            const html = '<p>Text</p><style>.a{color:red}</style>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<style');
            expect(result).toContain('Text');
        });

        it('wraps line-through text in a del element', () => {
            const html = '<p><span style="text-decoration:line-through">gone</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<del>');
            expect(result).toContain('gone');
        });
    });

    describe('looksLikePdfText - source routing only', () => {

        it('routes varied lines with a blank separator to the HTML path, not PDF text', () => {
            // The PDF heuristic is consulted only when the paste carries HTML;
            // with none, detectSource never reaches it.
            const lines = [
                'x',
                'a fairly long line of prose that keeps going on',
                '',
                'y',
                'another fairly long line of prose that continues',
                'z',
            ];
            const html = `<meta charset="utf-8"><span>${lines.join('<br>')}</span>`;
            expect(service.detectSource(html, lines.join('\n'))).toBe('html');
        });
    });

    describe('private helper edges (white-box)', () => {
        it('normalizeWhitespace strips mso-spacerun and keeps remaining style properties', () => {
            const container = document.createElement('div');
            const span = document.createElement('span');
            span.setAttribute('style', 'mso-spacerun:yes; color: red');
            span.textContent = '   ';
            container.appendChild(span);

            (service as unknown as { normalizeWhitespace: (c: HTMLElement) => void })
                .normalizeWhitespace(container);

            expect(span.getAttribute('style')).toBe('color: red');
            expect(span.textContent).toBe('   ');
        });

        it('normalizeWhitespace removes the style attribute when mso-spacerun was the only property', () => {
            const container = document.createElement('div');
            const span = document.createElement('span');
            span.setAttribute('style', 'mso-spacerun:yes');
            span.textContent = '  ';
            container.appendChild(span);

            (service as unknown as { normalizeWhitespace: (c: HTMLElement) => void })
                .normalizeWhitespace(container);

            expect(span.hasAttribute('style')).toBe(false);
            expect(span.textContent).toBe('  ');
        });

        it('normalizeOutlookSpecific removes lowercase v: elements (upstream generic namespace strip already catches uppercase ones)', () => {
            const container = document.createElement('div');
            container.innerHTML = '<p>Keep</p>';
            const shape = document.createElement('v:shape');
            shape.textContent = 'Drawing';
            Object.defineProperty(shape, 'tagName', { value: 'v:shape' });
            container.appendChild(shape);

            (service as unknown as { normalizeOutlookSpecific: (c: HTMLElement) => void })
                .normalizeOutlookSpecific(container);

            expect(container.contains(shape)).toBe(false);
            expect(container.textContent).toContain('Keep');
        });
    });
    // =========================================================================
    // BRANCH COVERAGE BOOST
    // =========================================================================

    describe('branch coverage boost', () => {
        it('Word list item without a level falls back to level 1 and default listId', () => {
            const html = '<p class="MsoListParagraph">Task alpha</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>Task alpha</li>');
        });

        it('Word list span with no style and non-Ignore span is handled', () => {
            const html =
                '<p class="MsoListParagraph"><span>keep</span> text</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('keep');
        });

        it('Word list item whose first child is an element (not text) is not marker-stripped', () => {
            // "i." reads as a roman-numeral marker; only a leading TEXT node is one.
            const html = '<p class="MsoListParagraph"><i>i.e.</i> the gist</p>';
            expect(service.normalize(html, '')).toBe('<ul><li><i>i.e.</i> the gist</li></ul>');
        });

        it('builds a nested ORDERED list when a deeper item is ordered', () => {
            const html =
                '<p class="MsoListParagraph" style="mso-list:l0 level1">Parent</p>' +
                '<p class="MsoListParagraph" style="mso-list:l0 level2">1) Child</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('<ol>');
            expect(result).toContain('Child');
        });

        it('maps color:auto to null (system color miss) without setting a value', () => {
            const html = '<p style="mso-x:1; background-color:red; background:blue; color:auto">x</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('color: auto');
            expect(result).toContain('background-color: red');
            expect(result).not.toContain('background: blue');
        });

        it('ignores non-mso vendor-prefixed style properties', () => {
            const html = '<p style="mso-x:1;-webkit-text-stroke:1px">x</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('-webkit-text-stroke');
        });

        it('does not overwrite an already-mapped font-size / font-weight / etc from mso-* props', () => {
            const html =
                '<p style="font-size:12pt; mso-ansi-font-size:14pt; ' +
                'font-weight:bold; mso-ansi-font-weight:300; ' +
                'line-height:1.5; mso-line-height-alt:2; ' +
                'border:1px solid; mso-border-alt:2px; ' +
                'padding:5px; mso-padding-alt:10px; ' +
                'color:green; mso-color-alt:blue">x</p>';
            const result = service.normalize(html, '');
            expect(result).toContain('font-size: 12pt');
            expect(result).toContain('color: green');
            expect(result).toContain('padding: 5px');
        });

        it('ignores mso-* props with non-triggering values', () => {
            const html =
                '<p style="mso-bidi-font-weight:normal; mso-bidi-font-style:normal; ' +
                'mso-text-underline:none; mso-font-kerning:0pt; mso-highlight:auto; ' +
                'mso-text-raise:0">x</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('font-weight: bold');
            expect(result).not.toContain('font-style: italic');
            expect(result).not.toContain('text-decoration: underline');
            expect(result).not.toContain('vertical-align');
        });

        it('leaves a Google Docs <b> without id/normal-weight in place', () => {
            const html =
                '<span id="docs-internal-guid-abc">wrap</span><b>bold text</b>';
            expect(service.normalize(html, '')).toBe('wrap<b>bold text</b>');
        });

        it('Google Docs span keeps other attributes after style is emptied', () => {
            const html =
                '<span id="docs-internal-guid-abc"></span>' +
                '<span style="font-family:Arial" title="tip">t</span>';
            const result = service.normalize(html, '');
            expect(result).toContain('title="tip"');
        });

        it('Google Docs list item without a style attribute is preserved', () => {
            const html =
                '<span id="docs-internal-guid-abc"></span><ul><li>item</li></ul>';
            const result = service.normalize(html, '');
            expect(result).toContain('<li>item</li>');
        });

        it('Google Sheets element retains non data-sheets- attributes', () => {
            const html =
                '<span data-sheets-value="1" title="keep">cell</span>';
            const result = service.normalize(html, '');
            expect(result).toContain('title="keep"');
            expect(result).not.toContain('data-sheets-value');
        });

        it('font element with unmapped size and no attributes produces a plain span', () => {
            const html =
                '<meta name="Generator" content="LibreOffice/7.0">' +
                '<font size="9">odd</font><font>bare</font>';
            const result = service.normalize(html, '');
            expect(result).toContain('odd');
            expect(result).toContain('bare');
            expect(result).not.toContain('font-size');
        });

        it('Excel column widths: bare col, existing cell width, and px passthrough', () => {
            const html =
                '<meta name="Generator" content="Microsoft Excel 15">' +
                '<table><colgroup>' +
                '<col width="50px"><col><col width="30">' +
                '</colgroup><tr>' +
                '<td>a</td><td>b</td><td style="width:99px">c</td>' +
                '</tr></table>';
            const result = service.normalize(html, '');
            expect(result).toContain('width: 50px');
            expect(result).toContain('width: 99px');
        });

        it('Excel conditional-comment filter ignores an ordinary comment', () => {
            const html =
                '<meta name="Generator" content="Microsoft Excel 15">' +
                '<table><tr><td>x</td></tr></table><!-- ordinary note -->';
            expect(service.normalize(html, ''))
                .toBe('<table><tbody><tr><td>x</td></tr></tbody></table><!-- ordinary note -->');
        });


        it('drops style declarations with an empty property or value', () => {
            const html = '<p class="MsoNormal"><span style="color:red; :orphan; empty:">x</span></p>';
            expect(service.normalize(html, '')).toBe('<p><span style="color: red">x</span></p>');
        });

        it('keeps an empty paragraph that is the only child of its parent', () => {
            const result = service.normalize('<p></p>', '');
            expect(result).toContain('<p>');
        });

        it('preserves non-underline/line-through text-decoration values', () => {
            const html = '<span style="text-decoration:overline">deco</span>';
            const result = service.normalize(html, '');
            expect(result).toContain('text-decoration: overline');
        });
    });
});
