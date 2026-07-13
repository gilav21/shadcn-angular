/**
 * Touch device detection and gesture utilities.
 *
 * Provides helpers for long-press, double-tap, and touch detection
 * so components can support touch-only devices alongside mouse input.
 */

/** Detect if the device has a coarse pointer (touch screen) */
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
    let startTouch: Touch | null = null;

    const onTouchStart = (e: TouchEvent): void => {
        startTouch = e.touches[0];
        timer = setTimeout(() => {
            callback(e);
            timer = null;
        }, duration);
    };

    const onTouchMove = (e: TouchEvent): void => {
        if (!startTouch || !timer) return;
        const dx = e.touches[0].clientX - startTouch.clientX;
        const dy = e.touches[0].clientY - startTouch.clientY;
        if (Math.hypot(dx, dy) > 10) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const onTouchEnd = (): void => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
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
 * Double-tap detection — calls `callback` when two taps occur within
 * `maxDelay` ms of each other.
 *
 * @returns A cleanup function to remove all listeners.
 */
export function onDoubleTap(
    element: HTMLElement,
    callback: (event: TouchEvent) => void,
    maxDelay = 300
): () => void {
    let lastTap = 0;

    const handler = (e: TouchEvent): void => {
        const now = Date.now();
        if (now - lastTap < maxDelay) {
            e.preventDefault();
            callback(e);
            lastTap = 0;
        } else {
            lastTap = now;
        }
    };

    element.addEventListener('touchend', handler);
    return (): void => element.removeEventListener('touchend', handler);
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
