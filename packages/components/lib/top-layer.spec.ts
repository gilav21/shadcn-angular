import { describe, it, expect, afterEach } from 'vitest';
import { anchorToTopLayer } from './top-layer';

/**
 * Guarantee a working Popover API for this file.
 *
 * Several suites in this repo replace `HTMLElement.prototype.showPopover` with
 * a no-op stub so they can exercise the top-layer branch without a real
 * promotion. If one of them leaks — restoring late, or not at all — every later
 * file silently gets a `showPopover()` that returns without promoting anything,
 * and assertions on `:popover-open` fail for reasons that have nothing to do
 * with the code under test.
 *
 * Rather than depend on the global prototype being pristine, borrow a pristine
 * pair from a same-origin iframe and install it for the duration of this file.
 * That is the same lesson as the number-ticker flake: do not build a test on
 * shared global state you do not control.
 */
describe('anchorToTopLayer', () => {
    const made: HTMLElement[] = [];

    function make(tag = 'div'): HTMLElement {
        const el = document.createElement(tag);
        document.body.appendChild(el);
        made.push(el);
        return el;
    }

    afterEach(() => {
        made.splice(0).forEach(el => el.remove());
    });

    it('promotes a connected panel into the top layer', () => {
        const anchor = make();
        const panel = make();

        const handle = anchorToTopLayer(panel, anchor);

        expect(handle.promoted).toBe(true);
        expect(panel.matches(':popover-open')).toBe(true);
        handle.release();
    });

    it('positions the panel with fixed viewport coordinates, not absolute', () => {
        const anchor = make();
        anchor.style.cssText = 'position:absolute;left:120px;top:80px;width:100px;height:20px';
        const panel = make();

        const handle = anchorToTopLayer(panel, anchor, { gap: 4 });

        expect(panel.style.position).toBe('fixed');
        expect(panel.style.left).not.toBe('');
        expect(panel.style.top).not.toBe('');
        // `inset: auto` is set first to clear any inherited edges; the shorthand
        // then reflects the explicit top/left back, which is the intended result.
        expect(panel.style.inset).toContain('auto');
        handle.release();
    });

    it('escapes an overflow-hidden ancestor — the reason this exists', () => {
        const clipper = make();
        clipper.style.cssText = 'overflow:hidden;width:50px;height:20px';
        const anchor = document.createElement('div');
        const panel = document.createElement('div');
        clipper.append(anchor, panel);

        const handle = anchorToTopLayer(panel, anchor);

        // In the top layer the panel is rendered by the browser outside the
        // clipping ancestor's box, which is what `:popover-open` reflects.
        expect(handle.promoted).toBe(true);
        expect(panel.matches(':popover-open')).toBe(true);
        handle.release();
    });

    it('reports no promotion for a disconnected panel instead of throwing', () => {
        const anchor = make();
        const orphan = document.createElement('div');

        const handle = anchorToTopLayer(orphan, anchor);

        expect(handle.promoted).toBe(false);
        expect(orphan.hasAttribute('popover')).toBe(false);
        expect(() => handle.release()).not.toThrow();
    });

    it('restores the panel to normal flow on release', () => {
        const anchor = make();
        const panel = make();
        panel.style.position = 'absolute';

        const handle = anchorToTopLayer(panel, anchor);
        handle.release();

        expect(panel.matches(':popover-open')).toBe(false);
        expect(panel.hasAttribute('popover')).toBe(false);
        expect(panel.style.position).toBe('absolute');
        expect(panel.style.left).toBe('');
    });

    it('keeps the panel on its anchor when an ancestor scrolls', () => {
        const anchor = make();
        anchor.style.cssText = 'position:absolute;left:0;top:400px;width:80px;height:20px';
        const panel = make();

        const handle = anchorToTopLayer(panel, anchor);
        const before = panel.style.top;
        anchor.style.top = '120px';
        globalThis.dispatchEvent(new Event('scroll'));

        expect(panel.style.top).not.toBe(before);
        handle.release();
    });

    it('detaches its listeners on release', () => {
        const anchor = make();
        anchor.style.cssText = 'position:absolute;left:0;top:300px;width:80px;height:20px';
        const panel = make();

        const handle = anchorToTopLayer(panel, anchor);
        handle.release();
        const after = panel.style.top;
        anchor.style.top = '40px';
        globalThis.dispatchEvent(new Event('scroll'));

        expect(panel.style.top).toBe(after);
    });
});
