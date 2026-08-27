/**
 * Singleton, refcounted aria-live region for drag/reorder announcements.
 *
 * Every sortable that wants to announce keyboard / drag events calls
 * `acquireAriaLive()` in its constructor and stores the returned handle.
 * The first call attaches an `aria-live="assertive"` element to
 * `document.body`. Additional callers share it. Each handle's
 * `release()` decrements the refcount; the last release removes the
 * element from the DOM.
 *
 * `announce(text)` clears the region first and re-sets the text on the
 * next macrotask so screen readers reliably re-read identical-content
 * messages.
 *
 * `resetAriaLive()` is testing-only: tears down the region and resets
 * the refcount.
 */

let region: HTMLElement | null = null;
let refCount = 0;
let announceTimer: ReturnType<typeof setTimeout> | null = null;

export interface AriaLiveHandle {
    /** Announce `text` via the shared region. */
    announce(text: string): void;
    /** Release this handle. Safe to call more than once. */
    release(): void;
}

function ensureRegion(): HTMLElement {
    if (region !== null) return region;
    const el = globalThis.document.createElement('div');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('role', 'status');
    el.dataset['slot'] = 'sortable-aria-live';
    /*
     * Hidden by clipping, NOT by being pushed off to the side.
     *
     * `left: -9999px` is the old way, and in a right-to-left document it is a
     * page-breaking one: overflow to the left is where RTL content is expected
     * to go, so the browser adds it to the scrollable area instead of
     * discarding it. One 1px region parked at -9999px made the whole document
     * ~10,000px wider than the viewport — enough that the page scrolled to a
     * blank region and appeared, for all the world, to have rendered nothing.
     *
     * `clip-path: inset(50%)` on a 1×1 box hides it just as thoroughly and
     * takes up no space in either direction, so it is the whole technique now.
     * Pinned to the start corner so it cannot overflow whichever way the
     * document runs.
     */
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.insetInlineStart = '0';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.overflow = 'hidden';
    el.style.clipPath = 'inset(50%)';
    globalThis.document.body.appendChild(el);
    region = el;
    return el;
}

/** Acquire a handle. Caller MUST release on teardown. */
export function acquireAriaLive(): AriaLiveHandle {
    refCount += 1;
    const el = ensureRegion();
    let released = false;
    return {
        announce(text: string): void {
            if (released) return;
            el.textContent = '';
            if (announceTimer !== null) clearTimeout(announceTimer);
            announceTimer = setTimeout(() => {
                announceTimer = null;
                if (region === el) el.textContent = text;
            }, 50);
        },
        release(): void {
            if (released) return;
            released = true;
            refCount -= 1;
            if (refCount <= 0) {
                refCount = 0;
                if (region !== null) {
                    region.remove();
                    region = null;
                }
                if (announceTimer !== null) {
                    clearTimeout(announceTimer);
                    announceTimer = null;
                }
            }
        },
    };
}

/** Testing-only: tear down the singleton without going through handle counts. */
export function resetAriaLive(): void {
    if (region !== null) {
        region.remove();
        region = null;
    }
    if (announceTimer !== null) {
        clearTimeout(announceTimer);
        announceTimer = null;
    }
    refCount = 0;
}
