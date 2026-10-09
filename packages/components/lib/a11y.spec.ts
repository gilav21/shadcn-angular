import { describe, it, expect } from 'vitest';
import * as a11y from './a11y';

const { hasInteractiveContent, tabbableElements } = a11y;

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

describe('tabbableElements', () => {
    const FORM = `
        <button id="enabled" type="button">Save</button>
        <button id="disabled" type="button" disabled>Delete</button>
        <fieldset disabled><legend>Billing</legend><input id="in-disabled-fieldset" aria-label="Card number"></fieldset>
        <button id="roving" type="button" tabindex="-1">3</button>
        <div id="focusable-div" tabindex="0">Order summary</div>
        <a id="link" href="#terms">Terms</a>
        <a id="placeholder-link">Not a link</a>
        <input id="hidden-attr" hidden aria-label="Coupon">
        <input id="hidden-type" type="hidden" value="42">
        <button id="display-none" type="button" style="display: none">Advanced</button>
        <button id="visibility-hidden" type="button" style="visibility: hidden">Undo</button>
        <div inert><button id="inert" type="button">Behind the sheet</button></div>
        <input id="size-s" type="radio" name="size" value="s" aria-label="Small">
        <input id="size-m" type="radio" name="size" value="m" aria-label="Medium" checked>
        <input id="size-l" type="radio" name="size" value="l" aria-label="Large">
        <input id="ship-standard" type="radio" name="ship" value="standard" aria-label="Standard">
        <input id="ship-express" type="radio" name="ship" value="express" aria-label="Express">
        <div id="notes" contenteditable="true">Notes</div>
    `;

    function mountForm(): HTMLElement {
        const panel = document.createElement('div');
        panel.innerHTML = FORM;
        document.body.appendChild(panel);
        return panel;
    }

    it('tabbableElements keeps only what Tab can reach', () => {
        const panel = mountForm();
        try {
            expect(tabbableElements(panel).map(el => el.id)).toEqual([
                'enabled', 'focusable-div', 'link', 'size-m', 'ship-standard', 'notes',
            ]);
        } finally {
            panel.remove();
        }
    });

    it('treats every element as visible where checkVisibility does not exist (jsdom)', () => {
        const panel = mountForm();
        const native = Object.getOwnPropertyDescriptor(Element.prototype, 'checkVisibility');
        Object.defineProperty(Element.prototype, 'checkVisibility', { configurable: true, value: undefined });
        try {
            // Layout-hidden controls stay in the ring (nothing can measure them); an attribute-only
            // filter such as `[hidden]` is allowed either way, so that element is not asserted.
            const ids = tabbableElements(panel).map(el => el.id).filter(id => id !== 'hidden-attr');
            expect(ids).toEqual([
                'enabled', 'focusable-div', 'link', 'display-none', 'visibility-hidden',
                'size-m', 'ship-standard', 'notes',
            ]);
        } finally {
            if (native) Object.defineProperty(Element.prototype, 'checkVisibility', native);
            panel.remove();
        }
    });
});
