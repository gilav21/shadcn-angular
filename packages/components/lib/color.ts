/**
 * Color utilities — pure functions, no Angular dependencies.
 *
 * Single source of truth for color conversion, parsing, formatting,
 * WCAG luminance/contrast, and harmony generation across the component
 * library. Consumed by `ui-color-picker`, `ui-eyedropper`, and exposed
 * for end-user developers.
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface RGBA extends RGB {
    /** 0..1 */
    a: number;
}

export interface HSL {
    h: number;
    s: number;
    l: number;
}

export interface HSLA extends HSL {
    a: number;
}

export interface HSV {
    h: number;
    s: number;
    v: number;
}

export interface OKLCH {
    /** 0..1 perceptual lightness */
    l: number;
    /** 0..~0.4 chroma */
    c: number;
    /** 0..360 hue degrees */
    h: number;
}

const NAMED_COLORS: Record<string, RGBA> = {
    transparent: { r: 0, g: 0, b: 0, a: 0 },
    black: { r: 0, g: 0, b: 0, a: 1 },
    white: { r: 255, g: 255, b: 255, a: 1 },
    red: { r: 255, g: 0, b: 0, a: 1 },
    green: { r: 0, g: 128, b: 0, a: 1 },
    blue: { r: 0, g: 0, b: 255, a: 1 },
    gray: { r: 128, g: 128, b: 128, a: 1 },
    grey: { r: 128, g: 128, b: 128, a: 1 },
};

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function clamp01(v: number): number {
    return clamp(v, 0, 1);
}

function clamp255(v: number): number {
    return Math.round(clamp(v, 0, 255));
}

function toHexByte(v: number): string {
    return clamp255(v).toString(16).padStart(2, '0');
}

function parseHex(input: string): RGBA | null {
    const m = /^#?([\da-f]{3,8})$/i.exec(input.trim());
    if (!m) return null;
    const hex = m[1];
    if (hex.length === 3 || hex.length === 4) {
        const r = Number.parseInt(hex[0] + hex[0], 16);
        const g = Number.parseInt(hex[1] + hex[1], 16);
        const b = Number.parseInt(hex[2] + hex[2], 16);
        const a = hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1;
        return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return { r, g, b, a };
    }
    return null;
}

function parseChannel(s: string, scale: number): number {
    const t = s.trim();
    if (t.endsWith('%')) {
        return (Number.parseFloat(t) / 100) * scale;
    }
    return Number.parseFloat(t);
}

function parseRgbFunc(input: string): RGBA | null {
    const m = /^rgba?\(\s*([^)]+)\)$/i.exec(input.trim());
    if (!m) return null;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseChannel(parts[0], 255);
    const g = parseChannel(parts[1], 255);
    const b = parseChannel(parts[2], 255);
    const a = parts.length >= 4 ? parseChannel(parts[3], 1) : 1;
    if ([r, g, b, a].some(Number.isNaN)) return null;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: clamp01(a) };
}

function parseHslFunc(input: string): RGBA | null {
    const m = /^hsla?\(\s*([^)]+)\)$/i.exec(input.trim());
    if (!m) return null;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = Number.parseFloat(parts[0]);
    const s = Number.parseFloat(parts[1]);
    const l = Number.parseFloat(parts[2]);
    const a = parts.length >= 4 ? parseChannel(parts[3], 1) : 1;
    if ([h, s, l, a].some(Number.isNaN)) return null;
    const rgb = hslToRgb({ h, s, l });
    return { ...rgb, a: clamp01(a) };
}

function parseOklchFunc(input: string): RGBA | null {
    const m = /^oklch\(\s*([^)]+)\)$/i.exec(input.trim());
    if (!m) return null;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const lStr = parts[0];
    const l = lStr.endsWith('%') ? Number.parseFloat(lStr) / 100 : Number.parseFloat(lStr);
    const c = Number.parseFloat(parts[1]);
    const h = Number.parseFloat(parts[2]);
    const a = parts.length >= 4 ? parseChannel(parts[3], 1) : 1;
    if ([l, c, h, a].some(Number.isNaN)) return null;
    const rgb = oklchToRgb({ l, c, h });
    return { ...rgb, a: clamp01(a) };
}

/**
 * Parse any CSS color string into RGBA. Supports:
 *  - #rgb / #rgba / #rrggbb / #rrggbbaa
 *  - rgb() / rgba()
 *  - hsl() / hsla()
 *  - oklch()
 *  - common named colors (transparent, black, white, red, green, blue, gray)
 *
 * Returns null on parse failure.
 */
export function parseColor(input: string): RGBA | null {
    if (!input) return null;
    const lowered = input.trim().toLowerCase();
    if (lowered in NAMED_COLORS) {
        return { ...NAMED_COLORS[lowered] };
    }
    if (lowered.startsWith('#')) return parseHex(lowered);
    if (lowered.startsWith('rgb')) return parseRgbFunc(lowered);
    if (lowered.startsWith('hsl')) return parseHslFunc(lowered);
    if (lowered.startsWith('oklch')) return parseOklchFunc(lowered);
    if (/^[\da-f]+$/i.test(lowered)) return parseHex(lowered);
    return null;
}

/**
 * Format as `#rrggbb`, or `#rrggbbaa` when `includeAlpha` is true and alpha < 1.
 */
export function formatHex(c: RGBA, includeAlpha = false): string {
    const base = `#${toHexByte(c.r)}${toHexByte(c.g)}${toHexByte(c.b)}`;
    if (!includeAlpha) return base;
    const a = clamp01(c.a);
    if (a >= 1) return base;
    return base + toHexByte(a * 255);
}

/** Format as `rgb(...)` or `rgba(...)` depending on alpha. */
export function formatRgb(c: RGBA): string {
    const r = clamp255(c.r);
    const g = clamp255(c.g);
    const b = clamp255(c.b);
    const a = clamp01(c.a);
    if (a >= 1) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${roundTo(a, 3)})`;
}

/** Format as `hsl(...)` or `hsla(...)` depending on alpha. */
export function formatHsl(c: RGBA): string {
    const hsl = rgbToHsl(c);
    const h = Math.round(hsl.h);
    const s = Math.round(hsl.s);
    const l = Math.round(hsl.l);
    const a = clamp01(c.a);
    if (a >= 1) return `hsl(${h}, ${s}%, ${l}%)`;
    return `hsla(${h}, ${s}%, ${l}%, ${roundTo(a, 3)})`;
}

/** Format as `oklch(L% C H)` with CSS Color 4 syntax. */
export function formatOklch(c: RGBA): string {
    const o = rgbToOklch(c);
    const l = roundTo(o.l * 100, 1);
    const ch = roundTo(o.c, 3);
    const h = roundTo(o.h, 1);
    const a = clamp01(c.a);
    if (a >= 1) return `oklch(${l}% ${ch} ${h})`;
    return `oklch(${l}% ${ch} ${h} / ${roundTo(a, 3)})`;
}

function roundTo(v: number, places: number): number {
    const f = 10 ** places;
    return Math.round(v * f) / f;
}

export function rgbToHsl(c: RGB): HSL {
    const r = c.r / 255;
    const g = c.g / 255;
    const b = c.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = hueFromMaxChannel(r, g, b, max, d);
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hueFromMaxChannel(r: number, g: number, b: number, max: number, d: number): number {
    if (max === r) return (((g - b) / d) + (g < b ? 6 : 0)) / 6;
    if (max === g) return (((b - r) / d) + 2) / 6;
    return (((r - g) / d) + 4) / 6;
}

function hue2rgb(p: number, q: number, t: number): number {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
}

export function hslToRgb(c: HSL): RGB {
    const h = ((c.h % 360) + 360) % 360 / 360;
    const s = clamp01(c.s / 100);
    const l = clamp01(c.l / 100);
    if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
        r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
}

export function rgbToHsv(c: RGB): HSV {
    const r = c.r / 255;
    const g = c.g / 255;
    const b = c.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        h = hueFromMaxChannel(r, g, b, max, d);
    }
    const s = max === 0 ? 0 : d / max;
    return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(max * 100) };
}

export function hsvToRgb(c: HSV): RGB {
    const h = ((c.h % 360) + 360) % 360 / 360;
    const s = clamp01(c.s / 100);
    const v = clamp01(c.v / 100);
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const channels = pickHsvChannels(i % 6, v, p, q, t);
    return {
        r: Math.round(channels[0] * 255),
        g: Math.round(channels[1] * 255),
        b: Math.round(channels[2] * 255),
    };
}

function pickHsvChannels(sector: number, v: number, p: number, q: number, t: number): [number, number, number] {
    switch (sector) {
        case 0: return [v, t, p];
        case 1: return [q, v, p];
        case 2: return [p, v, t];
        case 3: return [p, q, v];
        case 4: return [t, p, v];
        default: return [v, p, q];
    }
}

function srgbToLinear(c: number): number {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055;
    return clamp255(v * 255);
}

/**
 * Convert sRGB to OKLCH via Björn Ottosson's OKLab.
 * Reference: https://bottosson.github.io/posts/oklab/
 */
export function rgbToOklch(c: RGB): OKLCH {
    const r = srgbToLinear(c.r);
    const g = srgbToLinear(c.g);
    const b = srgbToLinear(c.b);

    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const lp = Math.cbrt(l);
    const mp = Math.cbrt(m);
    const sp = Math.cbrt(s);

    const L = 0.2104542553 * lp + 0.793617785 * mp - 0.0040720468 * sp;
    const A = 1.9779984951 * lp - 2.428592205 * mp + 0.4505937099 * sp;
    const B = 0.0259040371 * lp + 0.7827717662 * mp - 0.808675766 * sp;

    const C = Math.hypot(A, B);
    let H = (Math.atan2(B, A) * 180) / Math.PI;
    if (H < 0) H += 360;
    return { l: L, c: C, h: H };
}

export function oklchToRgb(c: OKLCH): RGB {
    const hRad = (c.h * Math.PI) / 180;
    const A = c.c * Math.cos(hRad);
    const B = c.c * Math.sin(hRad);

    const lp = c.l + 0.3963377774 * A + 0.2158037573 * B;
    const mp = c.l - 0.1055613458 * A - 0.0638541728 * B;
    const sp = c.l - 0.0894841775 * A - 1.291485548 * B;

    const l = lp ** 3;
    const m = mp ** 3;
    const s = sp ** 3;

    const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

/**
 * WCAG 2.1 relative luminance (0..1). Used for contrast-ratio calculation.
 */
export function relativeLuminance(c: RGB): number {
    const r = srgbToLinear(c.r);
    const g = srgbToLinear(c.g);
    const b = srgbToLinear(c.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.1 contrast ratio (1..21). Returns the larger:smaller luminance ratio.
 */
export function contrastRatio(a: RGB, b: RGB): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}

function rotateHue(c: RGBA, deltaDeg: number): RGBA {
    const hsl = rgbToHsl(c);
    const rotated: HSL = { h: (hsl.h + deltaDeg + 360) % 360, s: hsl.s, l: hsl.l };
    const rgb = hslToRgb(rotated);
    return { ...rgb, a: c.a };
}

/** Two-color palette: original + 180° rotation. */
export function harmonyComplementary(c: RGBA): RGBA[] {
    return [c, rotateHue(c, 180)];
}

/** Three-color palette: original ±30°. */
export function harmonyAnalogous(c: RGBA): RGBA[] {
    return [rotateHue(c, -30), c, rotateHue(c, 30)];
}

/** Three-color palette: original + 120° + 240°. */
export function harmonyTriadic(c: RGBA): RGBA[] {
    return [c, rotateHue(c, 120), rotateHue(c, 240)];
}

/** Four-color palette: original + 90° + 180° + 270°. */
export function harmonyTetradic(c: RGBA): RGBA[] {
    return [c, rotateHue(c, 90), rotateHue(c, 180), rotateHue(c, 270)];
}
