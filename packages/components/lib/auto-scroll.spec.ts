import { describe, it, expect, beforeEach } from 'vitest';
import { startAutoScroll } from './auto-scroll';

interface ScrollCall {
    readonly target: HTMLElement | Window;
    readonly left: number;
    readonly top: number;
}

let scrollCalls: ScrollCall[];
let frameCallbacks: Array<() => void>;
let rafCounter: number;
let rafCancelled: Set<number>;

function makeFakeWindow(elementAt: (x: number, y: number) => Element | null): Window {
    const win = {
        innerWidth: 1024,
        innerHeight: 768,
        document: {
            elementFromPoint: elementAt,
            defaultView: undefined as unknown as Window,
        } as unknown as Document,
        requestAnimationFrame(cb: () => void): number {
            const id = ++rafCounter;
            frameCallbacks.push(() => {
                if (!rafCancelled.has(id)) cb();
            });
            return id;
        },
        cancelAnimationFrame(id: number): void {
            rafCancelled.add(id);
        },
        scrollBy(opts: { left: number; top: number }): void {
            scrollCalls.push({ target: win as unknown as Window, left: opts.left, top: opts.top });
        },
        getComputedStyle(): CSSStyleDeclaration {
            return { overflowX: 'visible', overflowY: 'visible' } as CSSStyleDeclaration;
        },
    } as unknown as Window;
    (win.document as { defaultView: Window }).defaultView = win;
    return win;
}

function makeScrollableEl(rect: DOMRect, scrollH = 2000, scrollW = 2000): HTMLElement {
    const el = {
        scrollHeight: scrollH,
        clientHeight: rect.height,
        scrollWidth: scrollW,
        clientWidth: rect.width,
        ownerDocument: {
            defaultView: {
                getComputedStyle: (): CSSStyleDeclaration => ({
                    overflowX: 'auto',
                    overflowY: 'auto',
                } as CSSStyleDeclaration),
            },
        },
        getBoundingClientRect: (): DOMRect => rect,
        scrollBy(opts: { left: number; top: number }): void {
            scrollCalls.push({ target: el as unknown as HTMLElement, left: opts.left, top: opts.top });
        },
        parentElement: null,
    } as unknown as HTMLElement;
    Object.setPrototypeOf(el, HTMLElement.prototype);
    return el;
}

function flushFrames(times = 1): void {
    for (let i = 0; i < times; i++) {
        const callbacks = frameCallbacks;
        frameCallbacks = [];
        for (const cb of callbacks) cb();
    }
}

describe('startAutoScroll', () => {
    beforeEach(() => {
        scrollCalls = [];
        frameCallbacks = [];
        rafCounter = 0;
        rafCancelled = new Set();
    });

    it('scrolls down when pointer is near the bottom edge of a scrollable ancestor', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        scroller.update(200, 280);
        flushFrames(1);

        expect(scrollCalls).toHaveLength(1);
        expect(scrollCalls[0].target).toBe(container);
        expect(scrollCalls[0].top).toBeGreaterThan(0);
        expect(scrollCalls[0].left).toBe(0);
    });

    it('scrolls up when pointer is near the top edge', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        scroller.update(200, 10);
        flushFrames(1);

        expect(scrollCalls[0].top).toBeLessThan(0);
    });

    it('scrolls horizontally when pointer is near a horizontal edge', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        scroller.update(395, 150);
        flushFrames(1);

        expect(scrollCalls[0].left).toBeGreaterThan(0);
        expect(scrollCalls[0].top).toBe(0);
    });

    it('does not scroll when pointer is comfortably inside the container', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        scroller.update(200, 150);
        flushFrames(1);

        expect(scrollCalls).toHaveLength(0);
    });

    it('scales speed proportional to proximity to the edge', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 12 });

        scroller.update(200, 280);
        flushFrames(1);
        const farFromEdge = scrollCalls[0].top;

        scroller.update(200, 299);
        flushFrames(1);
        const nearEdge = scrollCalls[1].top;

        expect(nearEdge).toBeGreaterThan(farFromEdge);
    });

    it('falls back to scrolling the window when there is no scrollable ancestor', () => {
        const win = makeFakeWindow(() => null);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        scroller.update(500, 760);
        flushFrames(1);

        expect(scrollCalls).toHaveLength(1);
        expect(scrollCalls[0].target).toBe(win);
        expect(scrollCalls[0].top).toBeGreaterThan(0);
    });

    it('keeps the rAF loop running while update() is being called', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        scroller.update(200, 280);
        flushFrames(1);
        flushFrames(1);
        flushFrames(1);

        expect(scrollCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('stop() cancels the rAF loop', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        scroller.update(200, 280);
        flushFrames(1);
        scroller.stop();
        flushFrames(2);

        expect(scrollCalls.length).toBe(1);
    });

    it('stop() is idempotent', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        expect(() => scroller.stop()).not.toThrow();
        expect(() => scroller.stop()).not.toThrow();

        scroller.update(200, 280);
        flushFrames(1);
        scroller.stop();
        expect(() => scroller.stop()).not.toThrow();
    });

    it('update() after stop() restarts the loop', () => {
        const container = makeScrollableEl(new DOMRect(0, 0, 400, 300));
        const win = makeFakeWindow(() => container);
        const scroller = startAutoScroll({ win, edge: 40, maxSpeed: 10 });

        scroller.update(200, 280);
        flushFrames(1);
        scroller.stop();
        scrollCalls = [];

        scroller.update(200, 280);
        flushFrames(1);
        expect(scrollCalls.length).toBeGreaterThan(0);
    });
});
