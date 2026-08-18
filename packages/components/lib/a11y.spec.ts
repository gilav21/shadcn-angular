import { describe, it, expect } from 'vitest';
import { hasInteractiveContent } from './a11y';

/**
 * Builds the shape every trigger/close wrapper renders: a host element whose
 * only child is the wrapper's own `<span>`, with the consumer's content
 * projected inside that span.
 */
function makeWrapper(projected: string, wrapperAttrs = 'role="button" tabindex="0"'): Element {
    const host = document.createElement('ui-trigger');
    host.innerHTML = `<span ${wrapperAttrs} data-slot="trigger">${projected}</span>`;
    return host;
}

describe('hasInteractiveContent', () => {
    it('ignores the wrapper span itself when the projected content is inert', () => {
        const host = makeWrapper('Open');

        expect(hasInteractiveContent(host)).toBe(false);
    });

    it('still ignores the wrapper when it carries only a tabindex', () => {
        const host = makeWrapper('Open', 'tabindex="0"');

        expect(hasInteractiveContent(host)).toBe(false);
    });

    it('detects a projected native control', () => {
        const host = makeWrapper('<button type="button">Open</button>');

        expect(hasInteractiveContent(host)).toBe(true);
    });

    it('detects a projected element carrying a widget role', () => {
        const host = makeWrapper('<div role="combobox">Open</div>');

        expect(hasInteractiveContent(host)).toBe(true);
    });

    it('detects a projected control nested deeper than one level', () => {
        const host = makeWrapper('<span><em><a href="#x">Open</a></em></span>');

        expect(hasInteractiveContent(host)).toBe(true);
    });

    it('treats a host with no element child as having no interactive content', () => {
        const bare = document.createElement('ui-trigger');
        bare.textContent = 'Open';

        expect(hasInteractiveContent(bare)).toBe(false);
    });

    it('is false for a null or undefined host', () => {
        expect(hasInteractiveContent(null)).toBe(false);
        expect(hasInteractiveContent(undefined)).toBe(false);
    });
});
