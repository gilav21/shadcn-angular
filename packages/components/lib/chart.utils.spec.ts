import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { easingFunctions, animateValue } from './chart.utils';

describe('easingFunctions', () => {
    const names = ['linear', 'easeOut', 'easeInOut', 'easeOutQuart'] as const;

    it.each(names)('%s is pinned at both ends of the curve', name => {
        expect(easingFunctions[name](0)).toBeCloseTo(0, 10);
        expect(easingFunctions[name](1)).toBeCloseTo(1, 10);
    });

    it.each(names)('%s rises monotonically across its domain', name => {
        const fn = easingFunctions[name];
        // Exact tenths: accumulating `t += 0.1` drifts past 1, and the curves
        // are only defined on [0, 1] — easeOutQuart turns back down beyond it.
        for (let i = 0; i < 10; i++) {
            expect(fn((i + 1) / 10)).toBeGreaterThanOrEqual(fn(i / 10));
        }
    });

    it('linear returns the input unchanged', () => {
        expect(easingFunctions.linear(0.25)).toBe(0.25);
    });

    it('easeOut front-loads its progress', () => {
        // Decelerating: half the time has already covered most of the distance.
        expect(easingFunctions.easeOut(0.5)).toBeGreaterThan(0.5);
    });

    it('easeInOut is symmetric about its midpoint', () => {
        // Exercises both sides of the t < 0.5 split.
        expect(easingFunctions.easeInOut(0.5)).toBeCloseTo(0.5, 10);
        expect(easingFunctions.easeInOut(0.25)).toBeCloseTo(1 - easingFunctions.easeInOut(0.75), 10);
    });
});

describe('animateValue', () => {
    let frames: FrameRequestCallback[];
    let cancelled: number[];
    let nextId: number;

    beforeEach(() => {
        frames = [];
        cancelled = [];
        nextId = 1;
        // Drive frames by hand. A real `requestAnimationFrame` would make these
        // assertions depend on how promptly the browser schedules — and this
        // suite backgrounds all but one iframe, where frames are throttled.
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => {
            frames.push(cb);
            return nextId++;
        });
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => {
            cancelled.push(id);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Run the queued frame at `timestamp`, as the browser would. */
    function tick(timestamp: number): void {
        const frame = frames.shift();
        expect(frame).toBeDefined();
        frame!(timestamp);
    }

    it('interpolates from start to end and reports completion once', () => {
        const onUpdate = vi.fn();
        const onComplete = vi.fn();

        animateValue(0, 100, 1000, 'linear', onUpdate, onComplete);

        tick(0);
        expect(onUpdate).toHaveBeenLastCalledWith(0);
        tick(500);
        expect(onUpdate).toHaveBeenLastCalledWith(50);
        expect(onComplete).not.toHaveBeenCalled();

        tick(1000);
        expect(onUpdate).toHaveBeenLastCalledWith(100);
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('measures elapsed time from the first frame, not from the call', () => {
        const onUpdate = vi.fn();

        animateValue(0, 10, 100, 'linear', onUpdate);

        // The first timestamp becomes the baseline, so a late first frame does
        // not skip the animation forward.
        tick(5000);
        expect(onUpdate).toHaveBeenLastCalledWith(0);
        tick(5050);
        expect(onUpdate).toHaveBeenLastCalledWith(5);
    });

    it('clamps progress so a late frame cannot overshoot the end value', () => {
        const onUpdate = vi.fn();
        const onComplete = vi.fn();

        animateValue(0, 100, 100, 'linear', onUpdate, onComplete);

        tick(0);
        tick(999);

        expect(onUpdate).toHaveBeenLastCalledWith(100);
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('counts down when the end value is below the start', () => {
        const onUpdate = vi.fn();

        animateValue(100, 0, 1000, 'linear', onUpdate);

        tick(0);
        tick(250);

        expect(onUpdate).toHaveBeenLastCalledWith(75);
    });

    it('applies the named easing rather than interpolating linearly', () => {
        const onUpdate = vi.fn();

        animateValue(0, 100, 1000, 'easeOut', onUpdate);

        tick(0);
        tick(500);

        expect(onUpdate).toHaveBeenLastCalledWith(100 * easingFunctions.easeOut(0.5));
    });

    it('completes without an onComplete callback', () => {
        const onUpdate = vi.fn();

        animateValue(0, 1, 10, 'linear', onUpdate);

        tick(0);
        expect(() => tick(10)).not.toThrow();
        expect(onUpdate).toHaveBeenLastCalledWith(1);
    });

    it('stops the animation when the returned canceller is called', () => {
        const onUpdate = vi.fn();
        const onComplete = vi.fn();

        const cancel = animateValue(0, 100, 1000, 'linear', onUpdate, onComplete);
        tick(0);
        const pending = frames.length;
        cancel();

        expect(cancelled).toHaveLength(1);
        // The frame the animation queued is abandoned, so nothing further runs.
        expect(pending).toBe(1);
        expect(onComplete).not.toHaveBeenCalled();
    });
});
