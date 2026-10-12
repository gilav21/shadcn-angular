/**
 * Touch device detection and gesture utilities.
 *
 * Provides helpers for long-press, double-tap, and touch detection
 * so components can support touch-only devices alongside mouse input.
 *
 * ### The rule every gesture here obeys
 *
 * **More than one finger means pan and zoom, and nothing else.** Not a press,
 * not a tap, not a drag — whatever a first finger had begun is given up the
 * moment a second arrives, and no gesture may start while more than one finger
 * is down.
 *
 * It reads as an obvious thing to remember and it is not, because a browser
 * will not tell you a gesture has changed meaning. It re-fires `touchstart`
 * for the new finger and leaves you to notice, and every one of these helpers
 * has been caught not noticing:
 *
 * - `onLongPress` assigned a fresh timer over a pending one, so the first was
 *   unreachable and fired regardless — two fingers did not merely fail to
 *   suppress a context menu, they guaranteed one.
 * - `onDoubleTap` counted any two `touchend` events in 300ms, including a
 *   finger lifting out of a pinch.
 *
 * So when adding a gesture here, or a surface that owns a drag: check the
 * finger count on every event, not only the first. `touches.length` on a
 * `touchend` counts the fingers still down; for pointer events the same
 * question is {@link isSecondaryTouch}.
 *
 * `onPointerDrag` is the one helper below that does NOT yet enforce this — it
 * keeps following `touches[0]` through a pinch. It is used by sliders and
 * pickers rather than by a pannable canvas, where the answer may legitimately
 * differ, so it is left as it is deliberately rather than by omission.
 */

/** Detect if the device has a coarse pointer (touch screen) */
/**
 * Whether this pointer is an additional finger in a multi-touch gesture.
 *
 * Two fingers mean pan and zoom in every canvas application, so anything a
 * first finger had started — dragging a node, drawing a connection, moving a
 * frame — has to be given up when a second arrives. Each surface that owns a
 * drag has to ask this; it was missed once per surface until it lived in one
 * place.
 *
 * Narrowed to touch on purpose. A synthetic `PointerEvent` reports
 * `isPrimary: false` by default, so an unqualified check treats every
 * dispatched event in every test as a second finger.
 */
export function isSecondaryTouch(event: PointerEvent): boolean {
  return event.pointerType === 'touch' && !event.isPrimary;
}

export function isTouchDevice(): boolean {
    return globalThis.window?.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/** Detect if the device supports hover (mouse/trackpad) */
export function hasHover(): boolean {
    return globalThis.window?.matchMedia?.('(hover: hover)').matches ?? true;
}

/**
 * Long-press detection — calls `callback` after the user holds a touch
 * for `duration` ms without moving more than 10px.
 *
 * @returns A cleanup function to remove all listeners.
 */
export function onLongPress(
    element: HTMLElement,
    callback: (event: TouchEvent) => void,
    duration = 500
): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    /** A copy, not the live `Touch`: only the point the finger started at matters. */
    let startTouch: { clientX: number; clientY: number } | null = null;

    const cancel = (): void => {
        if (timer) clearTimeout(timer);
        timer = null;
        startTouch = null;
    };

    const onTouchStart = (e: TouchEvent): void => {
        /*
         * Clear FIRST, because `touchstart` fires again for every finger that
         * joins.
         *
         * Assigning a fresh timer over a pending one leaked the original: the
         * variable pointed at the new timer, so the move handler, the lift and
         * every later finger all cancelled the wrong one. The first simply
         * fired on schedule, whatever the hand was doing by then — which is
         * how a two-finger pan opened a context menu.
         */
        cancel();

        // Two fingers mean pan and zoom, in this and every canvas application.
        // There is no press to wait for, so none is started.
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        startTouch = { clientX: touch.clientX, clientY: touch.clientY };
        timer = setTimeout(() => {
            timer = null;
            callback(e);
        }, duration);
    };

    const onTouchMove = (e: TouchEvent): void => {
        if (!startTouch || !timer) return;

        // A finger arriving mid-press is handled by `onTouchStart`; this is the
        // belt to that braces, for a platform that reports the extra contact
        // only on the move.
        if (e.touches.length !== 1) {
            cancel();
            return;
        }

        const dx = e.touches[0].clientX - startTouch.clientX;
        const dy = e.touches[0].clientY - startTouch.clientY;
        if (Math.hypot(dx, dy) > 10) cancel();
    };

    const onTouchEnd = (): void => {
        cancel();
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', onTouchEnd);

    return () => {
        if (timer) clearTimeout(timer);
        element.removeEventListener('touchstart', onTouchStart);
        element.removeEventListener('touchmove', onTouchMove);
        element.removeEventListener('touchend', onTouchEnd);
        element.removeEventListener('touchcancel', onTouchEnd);
    };
}

/**
 * How far a finger may travel and still have been a tap rather than a drag.
 *
 * The same 10px the long press allows, plus a little: a tap is a poke, and a
 * thumb on glass never lands and leaves at exactly one point.
 */
const TAP_SLOP_PX = 12;

/**
 * How far apart two taps may land and still be one double tap.
 *
 * Generous, because a double tap is aimed at a thing rather than a pixel, but
 * nothing like the whole screen — which is what "anywhere" amounted to before.
 */
const DOUBLE_TAP_RADIUS_PX = 40;

/** Where a gesture began, and whether it has moved far enough to be a drag. */
interface TapTracker {
    readonly onStart: (event: TouchEvent) => void;
    readonly onMove: (event: TouchEvent) => void;
    readonly startX: number;
    readonly startY: number;
    readonly travelled: boolean;
}

/**
 * Follow one gesture's origin and travel.
 *
 * Separate from the detector that uses it because "did this finger stay put"
 * is the question every touch gesture has to answer, and answering it inline
 * is how it came to be answered differently in each place.
 */
function trackTap(): TapTracker {
    let startX = 0;
    let startY = 0;
    let travelled = false;

    return {
        onStart: (event: TouchEvent): void => {
            const touch = event.touches[0];
            if (!touch) return;
            startX = touch.clientX;
            startY = touch.clientY;
            travelled = false;
        },
        onMove: (event: TouchEvent): void => {
            const touch = event.touches[0];
            if (!touch) return;
            if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > TAP_SLOP_PX) {
                travelled = true;
            }
        },
        get startX() {
            return startX;
        },
        get startY() {
            return startY;
        },
        get travelled() {
            return travelled;
        },
    };
}

/**
 * Whether this `touchend` is the last finger leaving.
 *
 * `touches` on a `touchend` counts the fingers STILL down — the one that just
 * left reports in `changedTouches`. So anything above zero means a finger
 * lifted out of a multi-touch gesture, which is a pinch ending, never a tap.
 */
function endsATap(event: TouchEvent): boolean {
    return event.touches.length === 0;
}

/**
 * Double-tap detection — calls `callback` when two taps occur within
 * `maxDelay` ms of each other, close together, with neither one a drag.
 *
 * ### Why position and movement matter, and not just time
 *
 * Time alone was the whole test once, and on a phone that reads far too much
 * as a double tap. Dragging a node on the canvas: press, move, lift — a tap.
 * Try again a moment later — a second tap, and the palette opens on top of the
 * context menu the same hold had already triggered. Two attempts to move
 * something became "add a node", in a different place from either attempt.
 *
 * So a tap now has to be a tap: one finger, barely moved, landing near where
 * the last one did.
 *
 * @returns A cleanup function to remove all listeners.
 */
export function onDoubleTap(
    element: HTMLElement,
    callback: (event: TouchEvent) => void,
    maxDelay = 300
): () => void {
    const gesture = trackTap();
    let lastTap = 0;
    let lastX = 0;
    let lastY = 0;

    const onTouchEnd = (e: TouchEvent): void => {
        // Not a tap: it cannot be half of a double tap, and must not leave one
        // behind either — hence resetting rather than merely returning.
        if (gesture.travelled || !endsATap(e)) {
            lastTap = 0;
            return;
        }

        const touch = e.changedTouches?.[0];
        const x = touch?.clientX ?? gesture.startX;
        const y = touch?.clientY ?? gesture.startY;
        const now = Date.now();
        const nearLast = Math.hypot(x - lastX, y - lastY) <= DOUBLE_TAP_RADIUS_PX;

        if (now - lastTap < maxDelay && nearLast) {
            e.preventDefault();
            callback(e);
            lastTap = 0;
            return;
        }

        lastTap = now;
        lastX = x;
        lastY = y;
    };

    element.addEventListener('touchstart', gesture.onStart, { passive: true });
    element.addEventListener('touchmove', gesture.onMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd);

    return (): void => {
        element.removeEventListener('touchstart', gesture.onStart);
        element.removeEventListener('touchmove', gesture.onMove);
        element.removeEventListener('touchend', onTouchEnd);
    };
}

/** One context gesture, however it was made. */
export interface ContextGesture {
    readonly target: Element;
    readonly clientX: number;
    readonly clientY: number;
    /** The `contextmenu` event, or the long-press's `touchstart`. */
    readonly source: MouseEvent | TouchEvent;
    /**
     * Whether a finger made it: a long-press, or the `contextmenu` a browser
     * raises for one. A right-click and the keyboard key are not.
     */
    readonly viaTouch: boolean;
}

/**
 * Whether a `contextmenu` event is a finger's. A browser that types it says so.
 * One that does not (a plain `MouseEvent`: Firefox, older Chromium) cannot, and
 * is taken for a finger's only when a finger was on this element a moment ago -
 * a right-click with no touch before it is a mouse's.
 */
function isTouchContextMenu(event: MouseEvent, touchedRecently: boolean): boolean {
    return event instanceof PointerEvent ? event.pointerType === 'touch' : touchedRecently;
}

/**
 * Where a mouse event or a touch event happened, in viewport coordinates. For
 * reading the `event` a context-menu directive hands back, which is the
 * `contextmenu` of a right-click or the `touchstart` of a long-press.
 */
export function pointOf(event: MouseEvent | TouchEvent): { readonly x: number; readonly y: number } {
    const source = 'touches' in event ? (event.touches[0] ?? event.changedTouches[0]) : event;
    return { x: source?.clientX ?? 0, y: source?.clientY ?? 0 };
}

/**
 * Calls `handler` once per context gesture on `element`: a right-click, the
 * keyboard context-menu key, or a one-finger long-press. Return `true` when you
 * acted on it — the gesture is then claimed: the native menu is suppressed,
 * ancestor `onContextGesture` handlers for the same gesture are skipped, and the
 * `contextmenu` a platform raises after a long-press (Android) is swallowed.
 * @returns cleanup
 */
export function onContextGesture(
    element: HTMLElement,
    handler: (gesture: ContextGesture) => boolean,
    duration = 500,
): () => void {
    const touch = trackContextTouch();

    const onPress = (event: TouchEvent): void => {
        if (touch.dragged || claimedGestures.has(event)) return;
        const finger = event.touches[0] ?? event.changedTouches[0];
        if (!finger) return;
        const target = (event.target as Element | null) ?? element;
        // The browser's own hold timer can beat ours: its contextmenu already answered this press.
        if (isRecentSameGesture(lastClaimedContext, target)) return;
        if (!handler({ target, clientX: finger.clientX, clientY: finger.clientY, source: event, viaTouch: true })) return;
        claimedGestures.add(event);
        lastClaimedPress = { at: Date.now(), target };
    };

    const onContextMenu = (event: MouseEvent): void => {
        if (claimedGestures.has(event)) return;
        const viaTouch = isTouchContextMenu(event, touch.touchedRecently);
        // A mouse right-click is never the echo of a finger, whatever the finger did a moment ago.
        if (viaTouch && (touch.panGuess || isRecentSameGesture(lastClaimedPress, event.target as Node | null))) {
            claim(event);
            return;
        }
        const target = event.target as Element;
        if (!handler({ target, clientX: event.clientX, clientY: event.clientY, source: event, viaTouch })) return;
        claim(event);
        if (viaTouch) lastClaimedContext = { at: Date.now(), target };
    };

    const stopLongPress = onLongPress(element, onPress, duration);
    element.addEventListener('touchstart', touch.onStart, { passive: true });
    element.addEventListener('touchmove', touch.onMove, { passive: true });
    element.addEventListener('dragstart', touch.onDragStart);
    element.addEventListener('contextmenu', onContextMenu);

    return () => {
        stopLongPress();
        element.removeEventListener('touchstart', touch.onStart);
        element.removeEventListener('touchmove', touch.onMove);
        element.removeEventListener('dragstart', touch.onDragStart);
        element.removeEventListener('contextmenu', onContextMenu);
    };
}

/**
 * What `onContextGesture` needs to know about the finger beyond the hold itself:
 * whether this touch has become a pan (so a browser `contextmenu` that follows is
 * its own long-press guess, not a menu request) and whether the browser took the
 * target for a drag.
 */
function trackContextTouch(): {
    readonly onStart: (event: TouchEvent) => void;
    readonly onMove: (event: TouchEvent) => void;
    readonly onDragStart: () => void;
    readonly panGuess: boolean;
    readonly touchedRecently: boolean;
    readonly dragged: boolean;
} {
    let origin: { readonly x: number; readonly y: number } | null = null;
    let travelled = false;
    let lastTouchAt = 0;
    let dragged = false;

    return {
        onStart: (event: TouchEvent): void => {
            lastTouchAt = Date.now();
            const finger = event.touches[0];
            if (event.touches.length !== 1 || !finger) {
                // A second finger is pan and zoom: the gesture is spent until every finger is up.
                travelled = true;
                origin = null;
                return;
            }
            origin = { x: finger.clientX, y: finger.clientY };
            travelled = false;
            dragged = false;
        },
        onMove: (event: TouchEvent): void => {
            lastTouchAt = Date.now();
            const finger = event.touches[0];
            const multiTouch = event.touches.length !== 1 || !finger;
            const strayed = !!finger && !!origin && Math.hypot(finger.clientX - origin.x, finger.clientY - origin.y) > CONTEXT_SLOP_PX;
            if (multiTouch || strayed) travelled = true;
        },
        // A draggable target may be picked up by the browser instead; that hold is a drag, not a press.
        onDragStart: (): void => {
            dragged = true;
        },
        get panGuess() {
            return travelled && Date.now() - lastTouchAt < SAME_GESTURE_MS;
        },
        get touchedRecently() {
            return lastTouchAt > 0 && Date.now() - lastTouchAt < SAME_GESTURE_MS;
        },
        get dragged() {
            return dragged;
        },
    };
}

/**
 * How long after a claimed long-press a `contextmenu` is taken to be the same
 * gesture, and how long after a pan a browser `contextmenu` is taken to be its
 * own long-press guess.
 *
 * Android raises `contextmenu` for a held finger as well; iOS does not. Without
 * a window the menu opens twice on one platform and not at all on the other.
 */
const SAME_GESTURE_MS = 700;

/** How far a finger may travel and still count as held: the 10px `onLongPress` allows. */
const CONTEXT_SLOP_PX = 10;

/** Gestures an inner target already answered; ancestors skip them. */
const claimedGestures = new WeakSet<Event>();

interface ClaimedAt {
    readonly at: number;
    readonly target: Node;
}

/** The last long-press a handler claimed, so the platform's echo of it can be recognised. */
let lastClaimedPress: ClaimedAt | null = null;

/** The last native contextmenu a handler claimed, so a long-press timer that fires after it is not a second gesture. */
let lastClaimedContext: ClaimedAt | null = null;

/** Whether something landing on `hit` just now is the gesture `claimed` already answered. */
function isRecentSameGesture(claimed: ClaimedAt | null, hit: Node | null): boolean {
    if (!claimed || Date.now() - claimed.at >= SAME_GESTURE_MS) return false;
    return !hit || claimed.target.contains(hit) || hit.contains(claimed.target);
}

/** Takes the event from the browser and from every other `onContextGesture` handler. */
function claim(event: Event): void {
    claimedGestures.add(event);
    event.preventDefault();
    event.stopPropagation();
}

/**
 * Calls `onDismiss` on the next touch that starts outside `host`. Safe to call
 * from inside the touch that opened the UI: it never fires for that touch.
 *
 * The rule it enforces: *the touch that opens a transient UI is never the touch
 * that dismisses it.* Registering during a `touchstart` in the bubble phase did
 * not honour it - a listener added to an ancestor while an event is in flight
 * still receives that event, so a tap-shown tooltip closed in the very tick it
 * opened. The listener here is in the capture phase of the document, which the
 * opening touch has already left by the time any handler of it can register.
 * One-shot: it removes itself once it has dismissed.
 *
 * @returns cleanup
 */
export function dismissOnOutsideTouch(host: Element, onDismiss: () => void): () => void {
    const doc = host.ownerDocument;
    const onTouch = (event: Event): void => {
        if (event.target instanceof Node && host.contains(event.target)) return;
        cleanup();
        onDismiss();
    };
    const cleanup = (): void => doc.removeEventListener('touchstart', onTouch, true);
    doc.addEventListener('touchstart', onTouch, true);
    return cleanup;
}

/**
 * Unified pointer tracking — handles both mouse and touch move/up events
 * for drag operations. Attaches to `window` so the pointer can leave
 * the element during a drag.
 *
 * @returns A cleanup function to remove all listeners.
 */
export function onPointerDrag(
    onMove: (clientX: number, clientY: number, event: MouseEvent | TouchEvent) => void,
    onEnd: (event: MouseEvent | TouchEvent) => void,
): () => void {
    const handleMouseMove = (e: MouseEvent): void => onMove(e.clientX, e.clientY, e);
    const handleTouchMove = (e: TouchEvent): void => {
        if (e.touches.length > 0) {
            onMove(e.touches[0].clientX, e.touches[0].clientY, e);
        }
    };
    const handleMouseUp = (e: MouseEvent): void => {
        cleanup();
        onEnd(e);
    };
    const handleTouchEnd = (e: TouchEvent): void => {
        cleanup();
        onEnd(e);
    };

    globalThis.window?.addEventListener('mousemove', handleMouseMove);
    globalThis.window?.addEventListener('mouseup', handleMouseUp);
    globalThis.window?.addEventListener('touchmove', handleTouchMove, { passive: false });
    globalThis.window?.addEventListener('touchend', handleTouchEnd);
    globalThis.window?.addEventListener('touchcancel', handleTouchEnd);

    const cleanup = (): void => {
        globalThis.window?.removeEventListener('mousemove', handleMouseMove);
        globalThis.window?.removeEventListener('mouseup', handleMouseUp);
        globalThis.window?.removeEventListener('touchmove', handleTouchMove);
        globalThis.window?.removeEventListener('touchend', handleTouchEnd);
        globalThis.window?.removeEventListener('touchcancel', handleTouchEnd);
    };

    return cleanup;
}
