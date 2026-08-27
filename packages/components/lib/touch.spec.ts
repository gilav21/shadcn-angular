import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTouchDevice, hasHover, onLongPress, onDoubleTap, onPointerDrag } from './touch';

type TouchCallback = (event: TouchEvent) => void;
type MoveCallback = (clientX: number, clientY: number, event: MouseEvent | TouchEvent) => void;
type EndCallback = (event: MouseEvent | TouchEvent) => void;

/**
 * The code under test reads only `touches[n].clientX/clientY` and
 * `touches.length`, so a plain event carrying a `touches` array exercises it
 * faithfully — and unlike `new TouchEvent(...)` it needs no `Touch` constructor,
 * which not every engine running this suite exposes.
 */
function touchEvent(
    type: string,
    points: Array<{ clientX: number; clientY: number }> = [],
    changed: Array<{ clientX: number; clientY: number }> = [],
): TouchEvent {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: points, configurable: true });
    // A `touchend` reports the finger that LEFT in `changedTouches`; `touches`
    // by then holds only the fingers still down.
    Object.defineProperty(event, 'changedTouches', { value: changed, configurable: true });
    return event as TouchEvent;
}

/** One finger down at a point, then up at (optionally) another. */
function tap(
    element: HTMLElement,
    from: { clientX: number; clientY: number },
    to: { clientX: number; clientY: number } = from,
): void {
    element.dispatchEvent(touchEvent('touchstart', [from], [from]));
    if (to !== from) element.dispatchEvent(touchEvent('touchmove', [to], [to]));
    element.dispatchEvent(touchEvent('touchend', [], [to]));
}

function stubMatchMedia(matches: (query: string) => boolean): void {
    Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: (query: string) => ({ matches: matches(query), media: query }) as MediaQueryList,
    });
}

describe('isTouchDevice / hasHover', () => {
    it('reports a touch device when the pointer is coarse', () => {
        stubMatchMedia(q => q.includes('coarse'));
        expect(isTouchDevice()).toBe(true);
    });

    it('reports no touch device when the pointer is fine', () => {
        stubMatchMedia(() => false);
        expect(isTouchDevice()).toBe(false);
    });

    it('reports hover support from the hover query', () => {
        stubMatchMedia(q => q.includes('hover'));
        expect(hasHover()).toBe(true);
    });

    it('reports no hover when the query does not match', () => {
        stubMatchMedia(() => false);
        expect(hasHover()).toBe(false);
    });
});

describe('onLongPress', () => {
    let element: HTMLElement;
    let callback: ReturnType<typeof vi.fn<TouchCallback>>;
    let dispose: () => void;

    beforeEach(() => {
        vi.useFakeTimers();
        element = document.createElement('div');
        document.body.appendChild(element);
        callback = vi.fn<TouchCallback>();
        dispose = onLongPress(element, callback, 500);
    });

    afterEach(() => {
        dispose();
        element.remove();
        vi.useRealTimers();
    });

    it('fires once the touch is held for the full duration', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));

        vi.advanceTimersByTime(499);
        expect(callback).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('cancels when the finger moves more than 10px', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        element.dispatchEvent(touchEvent('touchmove', [{ clientX: 8, clientY: 8 }]));

        vi.advanceTimersByTime(1000);

        // hypot(8, 8) ≈ 11.3 — past the threshold, so the press is abandoned.
        expect(callback).not.toHaveBeenCalled();
    });

    it('tolerates a small drift within the 10px threshold', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        element.dispatchEvent(touchEvent('touchmove', [{ clientX: 3, clientY: 4 }]));

        vi.advanceTimersByTime(500);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('cancels when the finger lifts before the duration', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        element.dispatchEvent(touchEvent('touchend'));

        vi.advanceTimersByTime(1000);

        expect(callback).not.toHaveBeenCalled();
    });

    it('cancels when the gesture is interrupted by touchcancel', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        element.dispatchEvent(touchEvent('touchcancel'));

        vi.advanceTimersByTime(1000);

        expect(callback).not.toHaveBeenCalled();
    });

    /*
     * Reported from a phone: two fingers on the canvas, and the context menu
     * opens anyway.
     *
     * `touchstart` fires again for every finger that joins, and the handler
     * assigned a fresh timer over the top of the pending one. The first was
     * never cleared, so nothing could reach it: not the move handler, not the
     * lift, not a third finger. It simply fired 500ms later, whatever the hand
     * was doing by then.
     */
    it('does not fire when a second finger joins the gesture', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        element.dispatchEvent(
            touchEvent('touchstart', [
                { clientX: 0, clientY: 0 },
                { clientX: 200, clientY: 200 },
            ]),
        );

        vi.advanceTimersByTime(2000);

        expect(callback).not.toHaveBeenCalled();
    });

    /** Two fingers mean pan and zoom. There is no press to wait for. */
    it('never starts a press for a gesture that begins with two fingers', () => {
        element.dispatchEvent(
            touchEvent('touchstart', [
                { clientX: 0, clientY: 0 },
                { clientX: 200, clientY: 200 },
            ]),
        );

        vi.advanceTimersByTime(2000);

        expect(callback).not.toHaveBeenCalled();
    });

    /** The pinch continues; the leaked timer used to survive all of it. */
    it('stays cancelled while a two-finger gesture moves', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        element.dispatchEvent(
            touchEvent('touchstart', [
                { clientX: 0, clientY: 0 },
                { clientX: 200, clientY: 200 },
            ]),
        );
        element.dispatchEvent(
            touchEvent('touchmove', [
                { clientX: 40, clientY: 40 },
                { clientX: 260, clientY: 260 },
            ]),
        );

        vi.advanceTimersByTime(2000);

        expect(callback).not.toHaveBeenCalled();
    });

    /** One finger lifting out of a pinch must not leave a press running. */
    it('does not fire after a second finger has come and gone', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        element.dispatchEvent(
            touchEvent('touchstart', [
                { clientX: 0, clientY: 0 },
                { clientX: 200, clientY: 200 },
            ]),
        );
        element.dispatchEvent(touchEvent('touchend', [{ clientX: 0, clientY: 0 }]));

        vi.advanceTimersByTime(2000);

        expect(callback).not.toHaveBeenCalled();
    });

    it('ignores a move that arrives without a press in flight', () => {
        element.dispatchEvent(touchEvent('touchmove', [{ clientX: 50, clientY: 50 }]));

        vi.advanceTimersByTime(1000);

        expect(callback).not.toHaveBeenCalled();
    });

    it('drops a pending press and detaches on cleanup', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        dispose();

        vi.advanceTimersByTime(1000);
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        vi.advanceTimersByTime(1000);

        expect(callback).not.toHaveBeenCalled();
    });
});

describe('onDoubleTap', () => {
    let element: HTMLElement;
    let callback: ReturnType<typeof vi.fn<TouchCallback>>;
    let dispose: () => void;

    beforeEach(() => {
        vi.useFakeTimers();
        element = document.createElement('div');
        document.body.appendChild(element);
        callback = vi.fn<TouchCallback>();
        dispose = onDoubleTap(element, callback, 300);
    });

    afterEach(() => {
        dispose();
        element.remove();
        vi.useRealTimers();
    });

    it('fires on a second tap inside the window, and suppresses the default', () => {
        element.dispatchEvent(touchEvent('touchend'));
        vi.advanceTimersByTime(100);

        const second = touchEvent('touchend');
        element.dispatchEvent(second);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(second.defaultPrevented).toBe(true);
    });

    it('does not fire when the taps are too far apart', () => {
        element.dispatchEvent(touchEvent('touchend'));
        vi.advanceTimersByTime(400);
        element.dispatchEvent(touchEvent('touchend'));

        expect(callback).not.toHaveBeenCalled();
    });

    it('needs a fresh pair after firing, so a third tap does not re-fire', () => {
        element.dispatchEvent(touchEvent('touchend'));
        vi.advanceTimersByTime(100);
        element.dispatchEvent(touchEvent('touchend'));
        expect(callback).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        element.dispatchEvent(touchEvent('touchend'));

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('detaches on cleanup', () => {
        dispose();

        element.dispatchEvent(touchEvent('touchend'));
        vi.advanceTimersByTime(100);
        element.dispatchEvent(touchEvent('touchend'));

        expect(callback).not.toHaveBeenCalled();
    });

    /*
     * From a phone, dragging a node on the canvas.
     *
     * Two taps close in TIME were enough, wherever they landed and whatever
     * the finger did in between — so two attempts to drag something, a moment
     * apart, were read as a double tap and opened the node palette. On the
     * node editor that arrived on top of the context menu the same hold had
     * already opened.
     */
    it('does not fire for two taps in different places', () => {
        tap(element, { clientX: 20, clientY: 20 });
        vi.advanceTimersByTime(100);
        tap(element, { clientX: 300, clientY: 400 });

        expect(callback).not.toHaveBeenCalled();
    });

    it('still fires for two taps in the same place', () => {
        tap(element, { clientX: 50, clientY: 50 });
        vi.advanceTimersByTime(100);
        tap(element, { clientX: 53, clientY: 48 });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    /** A finger that travelled was dragging, and a drag is not half a double tap. */
    it('does not count a drag as a tap', () => {
        tap(element, { clientX: 20, clientY: 20 }, { clientX: 120, clientY: 20 });
        vi.advanceTimersByTime(100);
        tap(element, { clientX: 20, clientY: 20 }, { clientX: 120, clientY: 20 });

        expect(callback).not.toHaveBeenCalled();
    });

    /** Two fingers mean pan and zoom, so lifting one of them is not a tap. */
    it('does not count a finger lifting out of a two-finger gesture', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 10, clientY: 10 }]));
        element.dispatchEvent(
            touchEvent('touchend', [{ clientX: 90, clientY: 90 }], [{ clientX: 10, clientY: 10 }]),
        );
        vi.advanceTimersByTime(100);
        tap(element, { clientX: 10, clientY: 10 });

        expect(callback).not.toHaveBeenCalled();
    });
});

describe('onPointerDrag', () => {
    let onMove: ReturnType<typeof vi.fn<MoveCallback>>;
    let onEnd: ReturnType<typeof vi.fn<EndCallback>>;
    let dispose: () => void;

    beforeEach(() => {
        onMove = vi.fn<MoveCallback>();
        onEnd = vi.fn<EndCallback>();
        dispose = onPointerDrag(onMove, onEnd);
    });

    afterEach(() => {
        dispose();
    });

    it('reports mouse movement', () => {
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 12, clientY: 34 }));

        expect(onMove).toHaveBeenCalledWith(12, 34, expect.any(MouseEvent));
    });

    it('reports touch movement from the first touch point', () => {
        globalThis.dispatchEvent(touchEvent('touchmove', [{ clientX: 56, clientY: 78 }]));

        expect(onMove).toHaveBeenCalledWith(56, 78, expect.any(Event));
    });

    it('ignores a touchmove that carries no touch points', () => {
        globalThis.dispatchEvent(touchEvent('touchmove', []));

        expect(onMove).not.toHaveBeenCalled();
    });

    it('ends the drag on mouseup and stops tracking', () => {
        globalThis.dispatchEvent(new MouseEvent('mouseup'));
        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }));

        expect(onEnd).toHaveBeenCalledTimes(1);
        expect(onMove).not.toHaveBeenCalled();
    });

    it('ends the drag on touchend and stops tracking', () => {
        globalThis.dispatchEvent(touchEvent('touchend'));
        globalThis.dispatchEvent(touchEvent('touchmove', [{ clientX: 5, clientY: 5 }]));

        expect(onEnd).toHaveBeenCalledTimes(1);
        expect(onMove).not.toHaveBeenCalled();
    });

    it('ends the drag on touchcancel', () => {
        globalThis.dispatchEvent(touchEvent('touchcancel'));

        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('stops tracking after an explicit cleanup', () => {
        dispose();

        globalThis.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 1 }));
        globalThis.dispatchEvent(new MouseEvent('mouseup'));

        expect(onMove).not.toHaveBeenCalled();
        expect(onEnd).not.toHaveBeenCalled();
    });
});
