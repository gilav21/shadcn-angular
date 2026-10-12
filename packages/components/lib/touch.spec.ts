import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    isTouchDevice,
    hasHover,
    onLongPress,
    onDoubleTap,
    onPointerDrag,
    onContextGesture,
    dismissOnOutsideTouch,
    type ContextGesture,
} from './touch';
import { prefersReducedMotion } from './media';

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
    // The window is shared by every later file in the worker: put it back.
    let own: PropertyDescriptor | undefined;
    beforeEach(() => {
        own = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
    });
    afterEach(() => {
        if (own) Object.defineProperty(globalThis, 'matchMedia', own);
        else Reflect.deleteProperty(globalThis, 'matchMedia');
    });

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

describe('media-query helpers where matchMedia does not exist', () => {
    /*
     * jsdom and SSR have no matchMedia; a consumer's own tests run there.
     * Every helper must answer its documented default instead of throwing.
     */
    it('fall back to their defaults', () => {
        const own = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
        Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: undefined });
        try {
            expect(isTouchDevice()).toBe(false);
            expect(hasHover()).toBe(true);
            expect(prefersReducedMotion()).toBe(false);
        } finally {
            if (own) Object.defineProperty(globalThis, 'matchMedia', own);
            else Reflect.deleteProperty(globalThis, 'matchMedia');
        }
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

    /*
     * "A finger arriving mid-press is handled by `onTouchStart`; this is the
     * belt to that braces, for a platform that reports the extra contact only
     * on the move."
     *
     * That belt had no test: neutering the move-path finger check left all 31
     * specs green, because every other two-finger test announces the second
     * finger with a `touchstart` the primary guard already catches. On a
     * platform that only reports it on the move, the menu would open under a
     * pinch — the exact bug the two-finger rule exists to prevent.
     */
    it('cancels when a second finger appears only on the move', () => {
        element.dispatchEvent(touchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        element.dispatchEvent(
            touchEvent('touchmove', [
                { clientX: 0, clientY: 0 },
                { clientX: 60, clientY: 60 },
            ]),
        );

        vi.advanceTimersByTime(1000);
        expect(callback).not.toHaveBeenCalled();
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

    /*
     * Two fingers tapping together, neither of them moving.
     *
     * The finger count was only checked when a finger LIFTED, and by the time
     * the second one left there was one finger's worth of contact and no
     * travel to show for it — so a two-finger tap looked exactly like a one
     * finger tap, and two of them in a row opened whatever a double tap opens.
     */
    it('does not count a two-finger tap, however still the fingers were', () => {
        const twoFingerTap = (): void => {
            element.dispatchEvent(
                touchEvent('touchstart', [{ clientX: 10, clientY: 10 }], [{ clientX: 10, clientY: 10 }]),
            );
            element.dispatchEvent(
                touchEvent(
                    'touchstart',
                    [{ clientX: 10, clientY: 10 }, { clientX: 90, clientY: 90 }],
                    [{ clientX: 90, clientY: 90 }],
                ),
            );
            element.dispatchEvent(
                touchEvent('touchend', [{ clientX: 10, clientY: 10 }], [{ clientX: 90, clientY: 90 }]),
            );
            element.dispatchEvent(
                touchEvent('touchend', [], [{ clientX: 10, clientY: 10 }]),
            );
        };

        twoFingerTap();
        vi.advanceTimersByTime(100);
        twoFingerTap();

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

function rightClick(target: Element, point = { clientX: 140, clientY: 90 }): MouseEvent {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, ...point });
    target.dispatchEvent(event);
    return event;
}

/** RED until spec 8 Tasks 4-5: the helpers below do not exist yet. */
const redUntil = it.fails;

describe('onContextGesture', () => {
    let outer: HTMLElement;
    let inner: HTMLElement;
    let leaf: HTMLElement;
    let disposers: Array<() => void>;

    /** Registers on `element` and returns the recorder; `claims` is what the handler answers. */
    function listen(element: HTMLElement, claims = true): ReturnType<typeof vi.fn<(gesture: ContextGesture) => boolean>> {
        const handler = vi.fn<(gesture: ContextGesture) => boolean>(() => claims);
        disposers.push(onContextGesture(element, handler, 500));
        return handler;
    }

    beforeEach(() => {
        vi.useFakeTimers();
        disposers = [];
        outer = document.createElement('div');
        inner = document.createElement('div');
        leaf = document.createElement('span');
        inner.appendChild(leaf);
        outer.appendChild(inner);
        document.body.appendChild(outer);
    });

    afterEach(() => {
        for (const dispose of disposers) dispose();
        outer.remove();
        vi.useRealTimers();
    });

    const finger = { clientX: 60, clientY: 40 };

    /** A finger lands on the leaf. */
    function touchDown(points = [finger]): TouchEvent {
        const event = touchEvent('touchstart', points, points);
        leaf.dispatchEvent(event);
        return event;
    }

    redUntil('answers a right-click once, with the point, the target and the event itself', () => {
        const handler = listen(outer, true);

        const event = rightClick(leaf, { clientX: 140, clientY: 90 });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ target: leaf, clientX: 140, clientY: 90, source: event });
        expect(event.defaultPrevented).toBe(true);
    });

    redUntil('leaves the native menu alone when the handler does not claim the gesture', () => {
        listen(outer, false);

        expect(rightClick(leaf).defaultPrevented).toBe(false);
    });

    redUntil('answers a one-finger long-press once, at the finger, with the touchstart as source', () => {
        const handler = listen(outer, true);

        const start = touchDown();
        vi.advanceTimersByTime(499);
        expect(handler).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ target: leaf, clientX: 60, clientY: 40, source: start });
    });

    // Android raises its own contextmenu for a held finger; iOS does not. One
    // gesture must reach the handler once on both.
    redUntil('swallows the contextmenu Android raises after a claimed long-press, but not a later right-click', () => {
        const handler = listen(outer, true);

        touchDown();
        vi.advanceTimersByTime(500);
        vi.advanceTimersByTime(100);
        const echo = rightClick(leaf, finger);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(echo.defaultPrevented).toBe(true);

        vi.advanceTimersByTime(1000);
        rightClick(leaf);
        expect(handler).toHaveBeenCalledTimes(2);
    });

    redUntil.each([
        { name: 'the finger travels 15px', gesture: () => leaf.dispatchEvent(touchEvent('touchmove', [{ clientX: 75, clientY: 40 }])) },
        { name: 'a second finger joins', gesture: () => touchDown([finger, { clientX: 200, clientY: 40 }]) },
        { name: 'the finger lifts', gesture: () => leaf.dispatchEvent(touchEvent('touchend', [], [finger])) },
    ])('never opens when $name before the hold completes', ({ gesture }) => {
        const handler = listen(outer, true);

        touchDown();
        vi.advanceTimersByTime(200);
        gesture();
        vi.advanceTimersByTime(1000);

        expect(handler).not.toHaveBeenCalled();
    });

    // The platform's own long-press arriving in the middle of a pan: the finger
    // travelled, so it is not a press, and the browser's guess must lose.
    redUntil('ignores and suppresses the contextmenu a browser raises mid-pan', () => {
        const handler = listen(outer, true);

        touchDown();
        leaf.dispatchEvent(touchEvent('touchmove', [{ clientX: 120, clientY: 40 }]));
        vi.advanceTimersByTime(300);
        const midPan = rightClick(leaf, { clientX: 120, clientY: 40 });

        expect(handler).not.toHaveBeenCalled();
        expect(midPan.defaultPrevented).toBe(true);
    });

    // Chromium reports the centre of the focused element for the context-menu key
    // and Shift+F10 (measured: a PointerEvent with button -1), so a real point needs
    // nothing. A browser that reports no point at all gets the target's inline-start
    // bottom corner, where a menu opened from the keyboard belongs.
    redUntil.each([
        { dir: 'ltr', expected: { clientX: 30, clientY: 60 } },
        { dir: 'rtl', expected: { clientX: 130, clientY: 60 } },
    ])('opens a keyboard-initiated contextmenu that carries no point at the target corner ($dir)', ({ dir, expected }) => {
        const handler = listen(outer, true);
        leaf.dir = dir;
        vi.spyOn(leaf, 'getBoundingClientRect').mockReturnValue(new DOMRect(30, 20, 100, 40));

        const key = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 });
        leaf.dispatchEvent(key);

        expect(handler).toHaveBeenCalledWith({ target: leaf, ...expected, source: key });
    });

    redUntil('stops a pending long-press when the browser starts a drag of the element', () => {
        const handler = listen(outer, true);

        touchDown();
        vi.advanceTimersByTime(200);
        leaf.dispatchEvent(new Event('dragstart', { bubbles: true }));
        vi.advanceTimersByTime(1000);

        expect(handler).not.toHaveBeenCalled();
    });

    // Nested targets: the innermost one that acts owns the gesture, for the
    // right-click and for the long-press alike.
    redUntil.each([
        { gesture: 'right-click', perform: () => { rightClick(leaf); } },
        { gesture: 'long-press', perform: () => { touchDown(); vi.advanceTimersByTime(500); } },
    ])('the innermost claiming target owns a $gesture', ({ perform }) => {
        const outerHandler = listen(outer, true);
        const innerHandler = listen(inner, true);

        perform();

        expect(innerHandler).toHaveBeenCalledTimes(1);
        expect(outerHandler).not.toHaveBeenCalled();
    });

    redUntil.each([
        { gesture: 'right-click', perform: () => { rightClick(leaf); } },
        { gesture: 'long-press', perform: () => { touchDown(); vi.advanceTimersByTime(500); } },
    ])('the outer target answers a $gesture the inner one declined', ({ perform }) => {
        const outerHandler = listen(outer, true);
        const innerHandler = listen(inner, false);

        perform();

        expect(innerHandler).toHaveBeenCalledTimes(1);
        expect(outerHandler).toHaveBeenCalledTimes(1);
    });

    redUntil('stops answering after cleanup', () => {
        const handler = listen(outer, true);
        for (const dispose of disposers.splice(0)) dispose();

        rightClick(leaf);
        touchDown();
        vi.advanceTimersByTime(1000);

        expect(handler).not.toHaveBeenCalled();
    });
});

describe('dismissOnOutsideTouch', () => {
    let host: HTMLElement;
    let inside: HTMLElement;
    let onDismiss: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
        host = document.createElement('div');
        inside = document.createElement('button');
        host.appendChild(inside);
        document.body.appendChild(host);
        onDismiss = vi.fn<() => void>();
    });

    afterEach(() => {
        host.remove();
    });

    // The tooltip opens on a touchstart and registers its dismissal inside that
    // very touch; a listener added mid-dispatch fires for the event in flight
    // unless it is in a phase that has already passed.
    redUntil('does not fire for the touch that registered it, then fires once for a touch outside', () => {
        let dispose = (): void => undefined;
        host.addEventListener('touchstart', () => {
            dispose = dismissOnOutsideTouch(host, onDismiss);
        }, { once: true });

        inside.dispatchEvent(touchEvent('touchstart', [{ clientX: 1, clientY: 1 }]));
        expect(onDismiss).not.toHaveBeenCalled();

        inside.dispatchEvent(touchEvent('touchstart', [{ clientX: 1, clientY: 1 }]));
        expect(onDismiss).not.toHaveBeenCalled();

        document.body.dispatchEvent(touchEvent('touchstart', [{ clientX: 300, clientY: 300 }]));
        expect(onDismiss).toHaveBeenCalledTimes(1);

        dispose();
    });

    redUntil('stops listening once cleaned up', () => {
        const dispose = dismissOnOutsideTouch(host, onDismiss);
        dispose();

        document.body.dispatchEvent(touchEvent('touchstart', [{ clientX: 300, clientY: 300 }]));

        expect(onDismiss).not.toHaveBeenCalled();
    });
});
