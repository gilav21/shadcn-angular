import { DestroyRef, ElementRef } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeChartWidth } from './chart-responsive';

/** A DestroyRef whose teardown the test fires by hand. */
function manualDestroyRef(): { ref: DestroyRef; destroy: () => void } {
    const callbacks: (() => void)[] = [];
    const ref = { onDestroy: (cb: () => void) => { callbacks.push(cb); return () => undefined; } } as unknown as DestroyRef;
    return { ref, destroy: () => callbacks.forEach((cb) => cb()) };
}

function chartHost(width: number): ElementRef<HTMLElement> {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
    return new ElementRef(el);
}

describe('observeChartWidth', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('keeps the width it measured once where ResizeObserver is unavailable', () => {
        vi.stubGlobal('ResizeObserver', undefined);
        const { ref, destroy } = manualDestroyRef();

        const width = observeChartWidth(chartHost(480), ref);

        expect(width()).toBe(480);
        expect(destroy).not.toThrow();
    });
});
