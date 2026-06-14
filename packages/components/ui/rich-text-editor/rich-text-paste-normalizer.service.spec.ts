import { TestBed } from '@angular/core/testing';
import { RichTextPasteNormalizerService } from './rich-text-paste-normalizer.service';
import { RichTextSanitizerService } from './rich-text-sanitizer.service';
import { RichTextMarkdownService } from './rich-text-markdown.service';
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

        it('should prefer Outlook over generic Word when both signals present', () => {
            const html = '<div class="WordSection1"><p class="MsoNormal" style="mso-list:l0 level1">Text</p></div>';
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

        it('should detect markdown with links and headings', () => {
            const text = '## Title\n[Click here](https://example.com)';
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

        it('should handle nested list levels', () => {
            const html = [
                '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1">',
                '<span style="mso-list:Ignore">\u00B7 </span>Parent</p>',
                '<p class="MsoListParagraph" style="mso-list:l0 level2 lfo1">',
                '<span style="mso-list:Ignore">o </span>Child</p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('<ul>');
            expect(result).toContain('Parent');
            expect(result).toContain('Child');
            const liCount = (result.match(/<li>/g) ?? []).length;
            expect(liCount).toBeGreaterThanOrEqual(2);
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

        it('should unwrap single-cell layout tables', () => {
            const html = '<p class="MsoNormal">Before</p><table><tr><td><p class="MsoNormal">Cell content</p></td></tr></table>';
            const result = service.normalize(html, '');
            expect(result).toContain('Cell content');
            expect(result).not.toContain('<table>');
        });

        it('should preserve real data tables', () => {
            const html = '<p class="MsoNormal">Text</p><table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>';
            const result = service.normalize(html, '');
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
            const result = service.normalize(html, '');
            expect(result).toContain('Keep');
            expect(result).toContain('Also keep');
        });

        it('should handle mso-spacerun whitespace', () => {
            const html = '<p class="MsoNormal"><span style="mso-spacerun:yes">   </span>Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('mso-spacerun');
            expect(result).toContain('Text');
        });

        it('should preserve color on span with mso-spacerun', () => {
            const html = '<p class="MsoNormal"><span style="color:red; mso-spacerun:yes"> </span><span style="color:red">Colored</span></p>';
            const result = service.normalize(html, '');
            expect(result).toContain('color: red');
            expect(result).not.toContain('mso-spacerun');
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
            const html = '<?xml version="1.0" encoding="UTF-8"?><p class="MsoNormal">Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<?xml');
            expect(result).toContain('Text');
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

        it('should inline CSS from multiple selectors', () => {
            const html = [
                '<style>',
                'span.RedText { color: #FF0000; }',
                'span.BlueBold { color: #0000FF; font-weight: bold; }',
                '</style>',
                '<p class="MsoNormal"><span class="RedText">Red</span> and <span class="BlueBold">Blue Bold</span></p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('color: #FF0000');
            expect(result).toContain('color: #0000FF');
        });

        it('should handle comma-separated selectors in style blocks', () => {
            const html = [
                '<style>p.MsoNormal, li.MsoNormal { color: #444444; }</style>',
                '<p class="MsoNormal">Para</p><ul><li class="MsoNormal" style="mso-list:l0 level1">Item</li></ul>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('color: #444444');
        });

        it('should inline background-color from style blocks', () => {
            const html = [
                '<style>span.Highlight { background-color: yellow; }</style>',
                '<p class="MsoNormal"><span class="Highlight">Highlighted text</span></p>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('background-color: yellow');
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
            const result = service.normalize(html, '');
            expect(result).not.toContain('WordSection1');
            expect(result).toContain('Content');
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
            const result = service.normalize(html, '');
            expect(result).not.toContain('docs-internal-guid');
            expect(result).toContain('Text');
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

        it('should remove default/transparent styles', () => {
            const html = '<span id="docs-internal-guid-x"><span style="color:#000000;background-color:transparent">Text</span></span>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('#000000');
            expect(result).not.toContain('transparent');
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
            const html = '<html><head><meta name="Generator" content="Cocoa HTML Writer"></head><body><p>Text</p></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<meta');
            expect(result).toContain('Text');
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

        it('should strip LibreOffice meta tags', () => {
            const html = '<html><head><meta name="generator" content="LibreOffice 7.5"></head><body><p>Text</p></body></html>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<meta');
            expect(result).toContain('Text');
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
            const html = '<meta charset="utf-8"><p>Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<meta');
            expect(result).toContain('Text');
        });

        it('should strip style blocks', () => {
            const html = '<style>.foo{color:red}</style><p>Text</p>';
            const result = service.normalize(html, '');
            expect(result).not.toContain('<style');
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

        it('should handle realistic multi-row Excel paste with mixed formatting', () => {
            const html = [
                '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body>',
                '<table>',
                '<tr><td style="font-weight:bold">Header 1</td><td style="font-weight:bold">Header 2</td></tr>',
                '<tr><td>Value A</td><td style="font-style:italic">Value B</td></tr>',
                '<tr><td></td><td>Value D</td></tr>',
                '</table>',
                '</body></html>',
            ].join('');
            const result = service.normalize(html, '');
            expect(result).toContain('<strong>');
            expect(result).toContain('Header 1');
            expect(result).toContain('<em>');
            expect(result).toContain('Value B');
            expect(result).toContain('<br>');
            expect(result).toContain('Value D');
        });

        it('should produce clean table HTML through the full pipeline', () => {
            const html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><style>.xl65{color:red}</style><table class="xl65"><tr><td class="xl65">42</td></tr></table></body></html>';
            const result = pipeline(html, '');
            expect(result).toContain('<table>');
            expect(result).toContain('42');
            expect(result).not.toContain('mso-');
            expect(result).not.toContain('<style');
            expect(result).not.toContain('class=');
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

        it('should auto-link URLs', () => {
            const result = service.normalize(null, 'Visit https://example.com today');
            expect(result).toContain('<a href="https://example.com">https://example.com</a>');
        });

        it('should auto-link http URLs', () => {
            const result = service.normalize(null, 'Visit http://example.com today');
            expect(result).toContain('<a href="http://example.com">http://example.com</a>');
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

        it('should wrap multi-line text joined into one paragraph in <p> tags', () => {
            const multiLine = 'Line one.\nLine two.\nLine three.\nLine four.\nLine five.';
            const result = service.normalize(null, multiLine);
            expect(result).toContain('<p>');
        });

        it('should join PDF column-wrapped lines into paragraphs', () => {
            const pdfText = [
                'This is the first line of a paragraph that',
                'continues on the next line because the PDF',
                'viewer wraps text at the column boundary.',
                'This keeps going for a while so we have a',
                'good amount of consistent-length lines to',
                'trigger the PDF detection heuristic here.',
                '',
                'This is a second paragraph that also wraps',
                'across multiple lines in the PDF document.',
                'It should be separate from the first one.',
                'And it continues with more wrapped content.',
                'The lines are roughly the same length here.',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            expect(result).toContain('<p>');
            const paragraphCount = (result.match(/<p>/g) ?? []).length;
            expect(paragraphCount).toBe(2);
        });

        it('should preserve list items in PDF text as ul/li elements', () => {
            const pdfText = [
                'Here is some introduction text that goes',
                'across multiple lines in the PDF document.',
                'It keeps going for consistent line length.',
                'And more text to trigger the PDF detection.',
                '',
                '- First item in the list',
                '- Second item in the list',
                '- Third item in the list',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>First item in the list</li>');
            expect(result).toContain('<li>Second item in the list</li>');
            expect(result).toContain('<li>Third item in the list</li>');
            expect(result).toContain('</ul>');
        });

        it('should detect paragraph boundaries via column width in PDF text', () => {
            const pdfText = [
                'This is the first paragraph that wraps at the column',
                'boundary and continues here on the next line of the',
                'document until it ends.',
                'The second paragraph starts on a new line and wraps',
                'at the column boundary with consistent line lengths',
                'throughout this document as well.',
                'Third paragraph here also wraps at the column width',
                'boundary and continues for a while to fill the line.',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            const paragraphCount = (result.match(/<p>/g) ?? []).length;
            expect(paragraphCount).toBeGreaterThanOrEqual(2);
        });

        it('should convert PDF headings to h2 elements', () => {
            const pdfText = [
                'INTRODUCTION',
                '',
                'This is a paragraph under the heading that',
                'continues across lines in the PDF document.',
                'It keeps going for consistent line length.',
                'And more text to reach the detection limit.',
                '',
                'CONCLUSION',
                '',
                'This is the conclusion paragraph that also',
                'wraps across multiple lines because of the',
                'column width limitation in the PDF format.',
                'More filler text to trigger the heuristic.',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            expect(result).toContain('<h2>INTRODUCTION</h2>');
            expect(result).toContain('<h2>CONCLUSION</h2>');
            const paragraphCount = (result.match(/<p>/g) ?? []).length;
            expect(paragraphCount).toBe(2);
        });

        it('should convert PDF numbered list items to ol/li elements', () => {
            const pdfText = [
                'Here is some introduction text that goes',
                'across multiple lines in the PDF document.',
                'It keeps going for consistent line length.',
                'And more text to trigger the PDF detection.',
                'This paragraph continues with more content.',
                'We need enough lines for heuristic to work.',
                '',
                '1) First step in the process',
                '2) Second step in the process',
                '3) Third step in the process',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            expect(result).toContain('<ol>');
            expect(result).toContain('<li>First step in the process</li>');
            expect(result).toContain('<li>Second step in the process</li>');
            expect(result).toContain('<li>Third step in the process</li>');
            expect(result).toContain('</ol>');
        });

        it('should handle mixed headings, paragraphs, and lists in PDF text', () => {
            const pdfText = [
                'GETTING STARTED',
                '',
                'This is an introductory paragraph that spans',
                'multiple lines in the PDF and should be joined',
                'into a single paragraph element by the parser.',
                'More text to reach detection threshold length.',
                '',
                'REQUIREMENTS',
                '',
                '• Node.js version 18 or higher',
                '• A package manager like npm or yarn',
                '• A modern web browser for testing',
                '',
                'INSTALLATION STEPS',
                '',
                '1) Clone the repository from source',
                '2) Run the install command for deps',
                '3) Start the development server now',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            expect(result).toContain('<h2>GETTING STARTED</h2>');
            expect(result).toContain('<h2>REQUIREMENTS</h2>');
            expect(result).toContain('<h2>INSTALLATION STEPS</h2>');
            expect(result).toContain('<p>');
            expect(result).toContain('<ul>');
            expect(result).toContain('<ol>');
            expect(result).toContain('<li>Node.js version 18 or higher</li>');
            expect(result).toContain('<li>Clone the repository from source</li>');
        });

        it('should auto-link URLs within PDF paragraphs', () => {
            const pdfText = [
                'Visit our website at https://example.com for',
                'more details about the project and features.',
                'Documentation is at https://docs.example.com',
                'and the source code is available to everyone.',
                'More lines to trigger the PDF heuristic well.',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            expect(result).toContain('<a href="https://example.com">https://example.com</a>');
        });

        it('should escape HTML entities in PDF text content', () => {
            const pdfText = [
                'The <script> tag is used for JavaScript and',
                'should always be escaped in HTML documents.',
                'Using < and > operators in code is common.',
                'More text here to reach the detection limit.',
                'And some more filler text for good measure.',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should produce structured HTML from PDF text even when minimal HTML is on clipboard', () => {
            const html = '<span style="white-space: pre-wrap;">INTRODUCTION\n\nThis is the first line of a paragraph that\ncontinues on the next line because the PDF\nviewer wraps text at the column boundary.\nThis keeps going for a while so we have a\ngood amount of consistent-length lines to\ntrigger the PDF detection heuristic here.\n\n- First item in the list\n- Second item in the list</span>';
            const text = [
                'INTRODUCTION',
                '',
                'This is the first line of a paragraph that',
                'continues on the next line because the PDF',
                'viewer wraps text at the column boundary.',
                'This keeps going for a while so we have a',
                'good amount of consistent-length lines to',
                'trigger the PDF detection heuristic here.',
                '',
                '- First item in the list',
                '- Second item in the list',
            ].join('\n');
            const result = service.normalize(html, text);
            expect(result).toContain('<h2>INTRODUCTION</h2>');
            expect(result).toContain('<p>');
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>First item in the list</li>');
        });

        it('should switch list type when markers change from bullets to numbers', () => {
            const pdfText = [
                'Here is some introduction text that goes',
                'across multiple lines in the PDF document.',
                'It keeps going for consistent line length.',
                'And more text to trigger the PDF detection.',
                'This paragraph continues with more content.',
                'We need enough lines for heuristic to work.',
                '',
                '• Unordered item one in the list',
                '• Unordered item two in the list',
                '',
                '1) Ordered item one in the list',
                '2) Ordered item two in the list',
            ].join('\n');
            const result = service.normalize(null, pdfText);
            expect(result).toContain('<ul>');
            expect(result).toContain('</ul>');
            expect(result).toContain('<ol>');
            expect(result).toContain('</ol>');
            expect(result).toContain('<li>Unordered item one in the list</li>');
            expect(result).toContain('<li>Ordered item one in the list</li>');
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

        it('should convert bold/italic markdown to HTML', () => {
            const result = service.normalize(null, '**Bold** and *italic* text\n\n- list item');
            expect(result).toContain('<strong>');
            expect(result).toContain('Bold');
            expect(result).toContain('<em>');
        });

        it('should convert markdown lists to HTML', () => {
            const result = service.normalize(null, '# Title\n\n- Item 1\n- Item 2\n- Item 3');
            expect(result).toContain('<li>');
        });

        it('should convert code blocks to HTML', () => {
            const result = service.normalize(null, '```javascript\nconst x = 1;\n```\n\nSome **bold** text');
            expect(result).toContain('<code');
            expect(result).toContain('const x = 1;');
        });

        it('should convert markdown links to HTML', () => {
            const result = service.normalize(null, '## Links\n\n[Example](https://example.com)');
            expect(result).toContain('<a');
            expect(result).toContain('https://example.com');
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

        it('should handle empty clipboard data', () => {
            expect(pipeline(null, '')).toBe('');
        });

        it('should handle null html with text fallback', () => {
            const result = pipeline(null, 'Just plain text');
            expect(result).toContain('Just plain text');
        });

        it('should handle markdown text when no html', () => {
            const result = pipeline(null, '# Hello\n\n**World**\n\n- Item');
            expect(result).toContain('<h1>');
            expect(result).toContain('<strong>');
            expect(result).toContain('<li>');
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

        it('should strip nested conditional comments with iframe', () => {
            const html = '<p class="MsoNormal">Safe</p><!--[if mso]><iframe src="https://evil.com"></iframe><![endif]-->';
            const result = pipeline(html, '');
            expect(result).not.toContain('<iframe');
            expect(result).not.toContain('evil.com');
            expect(result).toContain('Safe');
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
            const html = '<style>body{background:url(javascript:alert(1))}</style><p class="MsoNormal">Text</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<style');
            expect(result).not.toContain('javascript:');
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
            const html = '<meta http-equiv="refresh" content="0;url=https://evil.com"><p>Safe</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<meta');
            expect(result).not.toContain('evil.com');
        });

        it('should remove base tag', () => {
            const html = '<base href="https://evil.com"><p>Safe</p>';
            const result = pipeline(html, '');
            expect(result).not.toContain('<base');
            expect(result).not.toContain('evil.com');
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
        it('should escape script tags in plain text', () => {
            const result = pipeline(null, '<script>alert(1)</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

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

        it('should escape svg tags in plain text', () => {
            const result = pipeline(null, '<svg onload="alert(1)">');
            expect(result).not.toContain('<svg');
            expect(result).toContain('&lt;svg');
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

        it('should verify double-sanitization is idempotent', () => {
            const html = '<p style="color: red"><strong>Bold</strong></p>';
            const once = sanitizer.sanitize(html);
            const twice = sanitizer.sanitize(once);
            expect(once).toBe(twice);
        });

        it('should handle null html without throwing', () => {
            expect(() => service.normalize(null, '')).not.toThrow();
        });

        it('should handle empty string html without throwing', () => {
            expect(() => service.normalize('', '')).not.toThrow();
        });

        it('should handle both null html and empty text', () => {
            const result = pipeline(null, '');
            expect(result).toBe('');
        });

        it('should handle undefined-like values gracefully', () => {
            const result = pipeline(null, undefined as unknown as string);
            expect(result).toBeDefined();
        });

        it('should never produce executable script from any source', () => {
            const sources: [string | null, string][] = [
                ['<p class="MsoNormal"><script>alert(1)</script></p>', ''],
                ['<b id="docs-internal-guid-x"><script>alert(1)</script></b>', ''],
                ['<meta name="Generator" content="Cocoa HTML Writer"><script>alert(1)</script>', ''],
                [null, '# Title\n\n<script>alert(1)</script>\n\n**bold**'],
                ['<script>alert(1)</script>', ''],
            ];

            for (const [html, text] of sources) {
                const result = pipeline(html, text);
                expect(result).not.toMatch(/<script[\s>]/i);
            }

            const plainTextResult = pipeline(null, '<script>alert(1)</script>');
            expect(plainTextResult).not.toMatch(/<script[\s>]/i);
            expect(plainTextResult).toContain('&lt;script&gt;');
        });
    });
});
