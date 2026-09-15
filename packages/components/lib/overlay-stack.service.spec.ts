import { describe, expect, it } from 'vitest';
import { OverlayStackService } from './overlay-stack.service';

describe('OverlayStackService', () => {
    it('gives Escape to the innermost open overlay only', () => {
        const layers = new OverlayStackService();
        const dialog = {};
        const popover = {};
        layers.push(dialog);
        layers.push(popover);

        expect(layers.hasOverlayAbove(popover)).toBe(false);
        expect(layers.hasOverlayAbove(dialog)).toBe(true);

        layers.remove(popover);
        expect(layers.hasOverlayAbove(dialog)).toBe(false);
    });

    it('treats an overlay that never registered as outermost', () => {
        const layers = new OverlayStackService();
        const stray = {};
        expect(layers.hasOverlayAbove(stray)).toBe(false);
        expect(layers.hasOverlayAbove(null)).toBe(false);

        layers.push({});
        expect(layers.hasOverlayAbove(stray)).toBe(true);
    });

    it('re-pushing moves an overlay to the top rather than duplicating it', () => {
        const layers = new OverlayStackService();
        const a = {};
        const b = {};
        layers.push(a);
        layers.push(b);
        layers.push(a);
        expect(layers.hasOverlayAbove(a)).toBe(false);
        expect(layers.hasOverlayAbove(b)).toBe(true);
        layers.remove(a);
        expect(layers.hasOverlayAbove(b)).toBe(false);
    });
});
