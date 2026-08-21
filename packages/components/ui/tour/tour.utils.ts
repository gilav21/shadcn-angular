/**
 * Local helpers for `TourComponent`. Pure functions kept out of the component
 * file for readability, mirroring `color-picker.utils.ts`.
 *
 * Every storage access is wrapped: `localStorage` throws outright in some
 * privacy modes and sandboxed iframes, and a tour must degrade to
 * non-persistent rather than take the page down with it.
 */

const STORAGE_PREFIX = 'ui-tour:';

/**
 * Whether the tour under `storageKey` has already been completed. Always
 * `false` for a `null` key (persistence opted out) and whenever storage is
 * unreadable.
 */
export function readTourCompleted(storageKey: string | null): boolean {
    if (!storageKey) return false;
    try {
        return globalThis.localStorage?.getItem(STORAGE_PREFIX + storageKey) === 'done';
    } catch {
        return false;
    }
}

/** Record — or clear — the completion flag for `storageKey`. No-op for a `null` key. */
export function writeTourCompleted(storageKey: string | null, completed: boolean): void {
    if (!storageKey) return;
    try {
        const storage = globalThis.localStorage;
        if (!storage) return;
        if (completed) {
            storage.setItem(STORAGE_PREFIX + storageKey, 'done');
        } else {
            storage.removeItem(STORAGE_PREFIX + storageKey);
        }
    } catch {
        /* swallow quota / privacy-mode errors — persistence is best-effort */
    }
}
