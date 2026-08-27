/**
 * Touch device detection and gesture utilities.
 *
 * Provides helpers for long-press, double-tap, and touch detection
 * so components can support touch-only devices alongside mouse input.
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
    return globalThis.window?.matchMedia('(pointer: coarse)').matches ?? false;
}

/** Detect if the device supports hover (mouse/trackpad) */
export function hasHover(): boolean {
    return globalThis.window?.matchMedia('(hover: hover)').matches ?? true;
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
    let lastTap = 0;
    let lastX = 0;
    let lastY = 0;
    let startX = 0;
    let startY = 0;
    let travelled = false;

    const onTouchStart = (e: TouchEvent): void => {
        const touch = e.touches[0];
        if (!touch) return;
        startX = touch.clientX;
        startY = touch.clientY;
        travelled = false;
    };

    const onTouchMove = (e: TouchEvent): void => {
        const touch = e.touches[0];
        if (!touch) return;
        if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > TAP_SLOP_PX) {
            travelled = true;
        }
    };

    const onTouchEnd = (e: TouchEvent): void => {
        /*
         * A gesture that was not a tap cannot be half of a double tap, and it
         * must not leave one behind either — hence resetting rather than
         * merely returning.
         *
         * `touches.length` still counts the fingers STILL down, so anything
         * above zero means this finger left a multi-touch gesture: two fingers
         * mean pan and zoom, never a tap.
         */
        if (travelled || e.touches.length > 0) {
            lastTap = 0;
            return;
        }

        const touch = e.changedTouches?.[0];
        const x = touch?.clientX ?? startX;
        const y = touch?.clientY ?? startY;
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

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd);

    return (): void => {
        element.removeEventListener('touchstart', onTouchStart);
        element.removeEventListener('touchmove', onTouchMove);
        element.removeEventListener('touchend', onTouchEnd);
    };
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
