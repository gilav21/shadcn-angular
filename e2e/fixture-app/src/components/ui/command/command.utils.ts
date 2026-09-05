/**
 * Local helpers for `CommandService`. Pure functions kept out of the component
 * file for readability, mirroring `color-picker.utils.ts`.
 *
 * Every storage access is wrapped: `localStorage` throws outright in some
 * privacy modes and sandboxed iframes, and a command palette must degrade to
 * non-persistent recents rather than take the page down with it.
 */

const STORAGE_PREFIX = 'ui-command:';

/** Read the persisted recent-values list for `storageKey`. `[]` for a null key or unreadable storage. */
export function readRecentValues(storageKey: string | null, max: number): string[] {
    if (!storageKey) return [];
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + storageKey);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v): v is string => typeof v === 'string').slice(0, max);
    } catch {
        return [];
    }
}

/** Persist the recent-values list for `storageKey`. No-op for a null key. */
export function writeRecentValues(storageKey: string | null, values: readonly string[]): void {
    if (!storageKey) return;
    try {
        globalThis.localStorage?.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(values));
    } catch {
        /* swallow quota / privacy-mode errors — persistence is best-effort */
    }
}

/** Push `value` onto the front of the list, dropping any earlier occurrence, capped at `max`. */
export function unshiftUniqueValue(values: readonly string[], value: string, max: number): string[] {
    return [value, ...values.filter(v => v !== value)].slice(0, Math.max(0, max));
}
