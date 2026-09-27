/**
 * Observer constructors that return `null` instead of throwing where the API
 * does not exist.
 *
 * `ResizeObserver` and `IntersectionObserver` are missing in jsdom — where a
 * consumer's own component tests run — and in server rendering and some older
 * WebViews. A bare `new ResizeObserver(…)` there throws out of the lifecycle
 * hook and the whole view fails to render. Every caller handles `null` by
 * falling back to what it does without an observer: keep the size it measured
 * once, or reveal content straight away instead of waiting to be scrolled
 * into view.
 */

/** A `ResizeObserver` for `callback`, or `null` where the API is unavailable. */
export function createResizeObserver(callback: ResizeObserverCallback): ResizeObserver | null {
    return typeof globalThis.ResizeObserver === 'function' ? new ResizeObserver(callback) : null;
}

/** An `IntersectionObserver` for `callback`, or `null` where the API is unavailable. */
export function createIntersectionObserver(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
): IntersectionObserver | null {
    return typeof globalThis.IntersectionObserver === 'function'
        ? new IntersectionObserver(callback, options)
        : null;
}
