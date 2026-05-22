import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFlip } from './flip';

interface AnimateCall {
    readonly element: HTMLElement;
    readonly keyframes: Keyframe[];
    readonly options: KeyframeAnimationOptions;
}

let animateCalls: AnimateCall[] = [];
let reduceMotion = false;

class FakeAnimation {
    readonly finished: Promise<void>;
    constructor() {
        this.finished = Promise.resolve();
    }
}

function installAnimateStub(): void {
    HTMLElement.prototype.animate = function (
        this: HTMLElement,
        keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
        options: number | KeyframeAnimationOptions,
    ): Animation {
        animateCalls.push({
            element: this,
            keyframes: keyframes as Keyframe[],
            options: typeof options === 'number' ? { duration: options } : options,
        });
        return new FakeAnimation() as unknown as Animation;
    };
}

function installMatchMediaStub(): void {
    globalThis.window.matchMedia = (query: string): MediaQueryList => ({
        matches: query.includes('reduce') && reduceMotion,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
    });
}

function makeItem(rects: DOMRect[]): HTMLElement {
    const el = document.createElement('div');
    let i = 0;
    el.getBoundingClientRect = (): DOMRect => rects[Math.min(i++, rects.length - 1)];
    return el;
}

function rect(x: number, y: number, w = 100, h = 30): DOMRect {
    return new DOMRect(x, y, w, h);
}

describe('createFlip', () => {
    beforeEach(() => {
        animateCalls = [];
        reduceMotion = false;
        installAnimateStub();
        installMatchMediaStub();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('animates elements that moved between measure and play', async () => {
        const a = makeItem([rect(0, 0), rect(0, 100)]);
        const b = makeItem([rect(0, 50), rect(0, 0)]);
        const flip = createFlip(() => [a, b]);

        flip.measure();
        await flip.play(200);

        expect(animateCalls).toHaveLength(2);
        expect(animateCalls[0].keyframes[0].transform).toBe('translate(0px, -100px)');
        expect(animateCalls[1].keyframes[0].transform).toBe('translate(0px, 50px)');
        expect(animateCalls[0].options.duration).toBe(200);
    });

    it('skips elements that moved less than 1px', async () => {
        const stationary = makeItem([rect(10, 10), rect(10.2, 10.5)]);
        const flip = createFlip(() => [stationary]);

        flip.measure();
        await flip.play(200);

        expect(animateCalls).toHaveLength(0);
    });

    it('skips elements not present in the previous snapshot', async () => {
        const a = makeItem([rect(0, 0), rect(0, 100)]);
        const b = makeItem([rect(0, 0), rect(0, 200)]);
        let visible: HTMLElement[] = [a];
        const flip = createFlip(() => visible);

        flip.measure();
        visible = [a, b];
        await flip.play(200);

        expect(animateCalls).toHaveLength(1);
        expect(animateCalls[0].element).toBe(a);
    });

    it('forces 0ms duration under prefers-reduced-motion (no animations run)', async () => {
        reduceMotion = true;
        const a = makeItem([rect(0, 0), rect(0, 100)]);
        const flip = createFlip(() => [a]);

        flip.measure();
        await flip.play(200);

        expect(animateCalls).toHaveLength(0);
    });

    it('play() without measure() is a no-op', async () => {
        const a = makeItem([rect(0, 0)]);
        const flip = createFlip(() => [a]);

        await flip.play(200);
        expect(animateCalls).toHaveLength(0);
    });

    it('clears snapshot after play so the next play needs a fresh measure', async () => {
        const a = makeItem([rect(0, 0), rect(0, 100), rect(0, 100)]);
        const flip = createFlip(() => [a]);

        flip.measure();
        expect(flip.hasSnapshot()).toBe(true);
        await flip.play(200);
        expect(flip.hasSnapshot()).toBe(false);

        animateCalls = [];
        await flip.play(200);
        expect(animateCalls).toHaveLength(0);
    });

    it('reset() drops the snapshot without animating', async () => {
        const a = makeItem([rect(0, 0), rect(0, 100)]);
        const flip = createFlip(() => [a]);

        flip.measure();
        flip.reset();
        await flip.play(200);

        expect(animateCalls).toHaveLength(0);
    });

    it('clamps negative duration to 0', async () => {
        const a = makeItem([rect(0, 0), rect(0, 100)]);
        const flip = createFlip(() => [a]);

        flip.measure();
        await flip.play(-50);

        expect(animateCalls).toHaveLength(0);
    });

    it('uses a cubic-bezier easing', async () => {
        const a = makeItem([rect(0, 0), rect(0, 100)]);
        const flip = createFlip(() => [a]);

        flip.measure();
        await flip.play(200);

        expect(animateCalls[0].options.easing).toContain('cubic-bezier');
    });
});
