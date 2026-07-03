import { describe, it, expect } from 'vitest';
import { anchorOverlay, directionOf } from './preset-overlay.utils';

interface Rect { left: number; top: number; bottom: number; width: number; height: number; }

function anchorEl(rect: Rect): HTMLElement {
    return { getBoundingClientRect: () => rect } as unknown as HTMLElement;
}

function overlayEl(width: number, height: number, vw: number, vh: number): HTMLElement & { style: { left: string; top: string } } {
    const style = { left: '', top: '' };
    return {
        style,
        getBoundingClientRect: () => ({ width, height, left: 0, top: 0, bottom: 0, right: 0 }),
        ownerDocument: { documentElement: { clientWidth: vw, clientHeight: vh } },
    } as unknown as HTMLElement & { style: { left: string; top: string } };
}

describe('anchorOverlay', () => {
    it('places the overlay just below the anchor when it fits', () => {
        const overlay = overlayEl(200, 100, 1000, 600);
        anchorOverlay(overlay, anchorEl({ left: 100, top: 100, bottom: 120, width: 30, height: 20 }));
        expect(overlay.style.left).toBe('100px');
        expect(overlay.style.top).toBe('126px'); // bottom(120) + gap(6)
    });

    it('clamps horizontally so the overlay never overflows the right edge', () => {
        const overlay = overlayEl(200, 100, 1000, 600);
        anchorOverlay(overlay, anchorEl({ left: 950, top: 100, bottom: 120, width: 30, height: 20 }));
        // max left = vw(1000) - width(200) - margin(8) = 792
        expect(overlay.style.left).toBe('792px');
    });

    it('flips above the anchor when there is no room below', () => {
        const overlay = overlayEl(200, 100, 1000, 600);
        anchorOverlay(overlay, anchorEl({ left: 100, top: 550, bottom: 570, width: 30, height: 20 }));
        // below(576)+height(100) exceeds vh(600)-margin → flip: top(550) - gap(6) - height(100) = 444
        expect(overlay.style.top).toBe('444px');
    });

    it('clamps to the viewport when it fits neither below nor above', () => {
        const overlay = overlayEl(200, 590, 1000, 600);
        anchorOverlay(overlay, anchorEl({ left: 100, top: 300, bottom: 320, width: 30, height: 20 }));
        // Too tall to flip; clamp top into [8, vh-height-8] = [8, 2] → clamp() tolerates inverted range → 8
        expect(overlay.style.top).toBe('8px');
    });
});

describe('directionOf', () => {
    it('reads rtl from an element in an rtl subtree, ltr otherwise', () => {
        const rtl = document.createElement('div');
        rtl.dir = 'rtl';
        document.body.appendChild(rtl);
        const ltr = document.createElement('div');
        document.body.appendChild(ltr);
        try {
            expect(directionOf(rtl)).toBe('rtl');
            expect(directionOf(ltr)).toBe('ltr');
        } finally {
            rtl.remove();
            ltr.remove();
        }
    });
});
