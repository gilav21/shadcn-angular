/**
 * Hand-rolled sRGB hex → OKLCH conversion (no dependency).
 * Reference: Björn Ottosson, "A perceptual color space for image processing".
 */

export interface Oklch {
    readonly l: number;
    readonly c: number;
    readonly h: number;
}

const HEX_PATTERN = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Returns true when the string is a valid 3- or 6-digit hex color. */
export function isValidHex(hex: string): boolean {
    return HEX_PATTERN.test(hex);
}

function expandHex(hex: string): string {
    const raw = hex.replace('#', '');
    if (raw.length === 3) {
        return raw.split('').map(ch => ch + ch).join('');
    }
    return raw;
}

function srgbToLinear(channel: number): number {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Converts a hex color to OKLCH.
 * @throws on an invalid hex string.
 */
export function hexToOklch(hex: string): Oklch {
    if (!isValidHex(hex)) {
        throw new Error(`Invalid hex color "${hex}" — expected #rgb or #rrggbb.`);
    }
    const full = expandHex(hex);
    const r = srgbToLinear(Number.parseInt(full.slice(0, 2), 16));
    const g = srgbToLinear(Number.parseInt(full.slice(2, 4), 16));
    const b = srgbToLinear(Number.parseInt(full.slice(4, 6), 16));

    const lRaw = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const mRaw = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const sRaw = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l = Math.cbrt(lRaw);
    const m = Math.cbrt(mRaw);
    const s = Math.cbrt(sRaw);

    const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

    const chroma = Math.hypot(okA, okB);
    if (chroma < 0.0001) {
        return { l: okL, c: 0, h: 0 };
    }
    let hue = Math.atan2(okB, okA) * (180 / Math.PI);
    if (hue < 0) hue += 360;
    return { l: okL, c: chroma, h: hue };
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/** Formats an OKLCH triplet the same way the theme presets do: `oklch(0.546 0.245 262.881)`. */
export function formatOklch({ l, c, h }: Oklch): string {
    return `oklch(${round(l, 3)} ${round(c, 3)} ${round(h, 3)})`;
}

/** Light foreground used by dark-primary presets. */
const LIGHT_FOREGROUND = 'oklch(0.985 0 0)';
/** Dark foreground used by light-primary presets (yellow). */
const DARK_FOREGROUND = 'oklch(0.205 0 0)';

/** Lightness above which a primary needs a dark foreground (yellow is 0.82, blue is 0.546). */
const LIGHT_PRIMARY_THRESHOLD = 0.65;
/** Below this lightness the dark-mode primary is lifted so it stays visible on dark surfaces. */
const DARK_MODE_LIFT_THRESHOLD = 0.55;
/** Target lightness for lifted dark-mode primaries. */
const DARK_MODE_LIFT_TARGET = 0.7;

export interface BrandTriplet {
    readonly light: Record<string, string>;
    readonly dark: Record<string, string>;
}

function foregroundFor(lightness: number): string {
    return lightness > LIGHT_PRIMARY_THRESHOLD ? DARK_FOREGROUND : LIGHT_FOREGROUND;
}

/**
 * Builds a `--primary` / `--primary-foreground` / `--ring` triplet from a brand
 * hex color, mirroring the shape of a `themeColors` accent entry.
 */
export function buildBrandTriplet(hex: string): BrandTriplet {
    const brand = hexToOklch(hex);

    const lightPrimary = formatOklch(brand);
    const darkOklch: Oklch = brand.l < DARK_MODE_LIFT_THRESHOLD
        ? { ...brand, l: DARK_MODE_LIFT_TARGET }
        : brand;
    const darkPrimary = formatOklch(darkOklch);

    return {
        light: {
            '--primary': lightPrimary,
            '--primary-foreground': foregroundFor(brand.l),
            '--ring': lightPrimary,
        },
        dark: {
            '--primary': darkPrimary,
            '--primary-foreground': foregroundFor(darkOklch.l),
            '--ring': darkPrimary,
        },
    };
}
