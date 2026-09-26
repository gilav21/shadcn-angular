import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RichTextMarkdownService, RichTextPasteNormalizerService, RichTextSanitizerService } from './index';

/**
 * Browser-only paste-normalizer cases. Unwrapping Word's namespaced elements
 * relies on the browser's selector engine matching an escaped `o\:p` tag name;
 * jsdom's engine does not match it, so the element falls through to the
 * drop-namespaced-tags pass and its text is lost there. This runs in the
 * real-browser leg only; the portable (jsdom) leg and the shipped `testFiles`
 * exclude this file.
 */
describe('RichTextPasteNormalizerService', () => {
    let service: RichTextPasteNormalizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                RichTextPasteNormalizerService,
                RichTextSanitizerService,
                RichTextMarkdownService,
            ],
        });
        service = TestBed.inject(RichTextPasteNormalizerService);
    });

    describe('normalizeOffice - Word', () => {
        it('unwraps a Word <o:p> element, keeping its text', () => {
            const html = '<p class="MsoNormal">Text<o:p>kept</o:p></p>';
            expect(service.normalize(html, '')).toBe('<p>Textkept</p>');
        });
    });
});
