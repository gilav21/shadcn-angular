/**
 * Local helpers for `ColorPickerComponent`. Pure functions kept out
 * of the component file for readability.
 */

import {
    formatHex,
    type RGBA,
} from '../../lib/color';

const STORAGE_PREFIX = 'ui-color-picker:';

/** Read persisted recent-colors list from localStorage. */
export function readRecents(storageKey: string | null, max: number): string[] {
    if (!storageKey) return [];
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + storageKey);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((c): c is string => typeof c === 'string').slice(0, max);
    } catch {
        return [];
    }
}

/** Persist recent-colors list to localStorage. */
export function writeRecents(storageKey: string | null, colors: string[]): void {
    if (!storageKey) return;
    try {
        globalThis.localStorage?.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(colors));
    } catch {
        /* swallow quota / privacy mode errors */
    }
}

/** Push a color onto the front of the list, dedup case-insensitively, cap to max. */
export function unshiftUniqueColor(colors: string[], color: string, max: number): string[] {
    const lower = color.toLowerCase();
    const filtered = colors.filter(c => c.toLowerCase() !== lower);
    return [color, ...filtered].slice(0, max);
}

/**
 * Convert an `RGBA` palette to hex strings, honoring whether the
 * component is in alpha mode (8-char hex) or not (6-char hex).
 */
export function paletteToHex(palette: RGBA[], includeAlpha: boolean): string[] {
    return palette.map(c => formatHex(c, includeAlpha));
}

export interface KeyboardStep {
    dSaturation: number;
    dValue: number;
}

/**
 * Map a keyboard event to an SV-area step. Returns null when the
 * key doesn't move the marker.
 */
export function keyboardStep(event: KeyboardEvent): KeyboardStep | null {
    const big = event.shiftKey ? 10 : 1;
    switch (event.key) {
        case 'ArrowLeft': return { dSaturation: -big, dValue: 0 };
        case 'ArrowRight': return { dSaturation: big, dValue: 0 };
        case 'ArrowUp': return { dSaturation: 0, dValue: big };
        case 'ArrowDown': return { dSaturation: 0, dValue: -big };
        case 'Home': return { dSaturation: -100, dValue: 0 };
        case 'End': return { dSaturation: 100, dValue: 0 };
        case 'PageUp': return { dSaturation: 0, dValue: 10 };
        case 'PageDown': return { dSaturation: 0, dValue: -10 };
        default: return null;
    }
}

export interface WcagBadge {
    label: 'AAA' | 'AA' | 'AA Large' | 'Fail';
    pass: boolean;
}

/**
 * Build the WCAG badge for a given contrast ratio.
 * AAA = 7+ normal / 4.5+ large
 * AA  = 4.5+ normal / 3+ large
 */
export function wcagBadge(ratio: number): WcagBadge {
    if (ratio >= 7) return { label: 'AAA', pass: true };
    if (ratio >= 4.5) return { label: 'AA', pass: true };
    if (ratio >= 3) return { label: 'AA Large', pass: true };
    return { label: 'Fail', pass: false };
}
