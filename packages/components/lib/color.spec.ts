import { describe, it, expect } from 'vitest';
import {
    parseColor,
    formatHex,
    formatRgb,
    formatHsl,
    formatOklch,
    rgbToHsl,
    hslToRgb,
    rgbToHsv,
    hsvToRgb,
    rgbToOklch,
    oklchToRgb,
    relativeLuminance,
    contrastRatio,
    harmonyComplementary,
    harmonyAnalogous,
    harmonyTriadic,
    harmonyTetradic,
    type RGB,
    type RGBA,
} from './color';

const RED: RGBA = { r: 255, g: 0, b: 0, a: 1 };
const GREEN: RGBA = { r: 0, g: 255, b: 0, a: 1 };
const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 1 };
const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };

function rgbClose(actual: RGB, expected: RGB, tolerance = 2): void {
    expect(Math.abs(actual.r - expected.r)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(actual.g - expected.g)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(actual.b - expected.b)).toBeLessThanOrEqual(tolerance);
}

describe('parseColor', () => {
    it('parses 6-char hex', () => {
        expect(parseColor('#ff0000')).toEqual(RED);
    });

    it('parses 3-char hex', () => {
        expect(parseColor('#f00')).toEqual(RED);
    });

    it('parses 8-char hex with alpha', () => {
        const result = parseColor('#ff000080');
        expect(result?.r).toBe(255);
        expect(result?.a).toBeCloseTo(128 / 255, 2);
    });

    it('parses rgb()', () => {
        expect(parseColor('rgb(255, 0, 0)')).toEqual(RED);
    });

    it('parses rgba()', () => {
        const result = parseColor('rgba(255, 0, 0, 0.5)');
        expect(result?.r).toBe(255);
        expect(result?.a).toBe(0.5);
    });

    it('parses hsl()', () => {
        const result = parseColor('hsl(0, 100%, 50%)');
        if (!result) throw new Error('parse failed');
        rgbClose(result, RED);
    });

    it('parses oklch()', () => {
        const result = parseColor('oklch(62.8% 0.258 29.2)');
        if (!result) throw new Error('parse failed');
        rgbClose(result, RED, 5);
    });

    it('parses named colors', () => {
        expect(parseColor('red')).toEqual(RED);
        expect(parseColor('TRANSPARENT')?.a).toBe(0);
    });

    it('returns null for invalid input', () => {
        expect(parseColor('not-a-color')).toBeNull();
        expect(parseColor('')).toBeNull();
    });
});

describe('formatters', () => {
    it('formatHex without alpha returns 6-char', () => {
        expect(formatHex(RED)).toBe('#ff0000');
    });

    it('formatHex with alpha appends alpha when < 1', () => {
        expect(formatHex({ ...RED, a: 0.5 }, true)).toBe('#ff000080');
    });

    it('formatHex with includeAlpha=true and a=1 omits alpha byte', () => {
        expect(formatHex(RED, true)).toBe('#ff0000');
    });

    it('formatRgb switches between rgb/rgba', () => {
        expect(formatRgb(RED)).toBe('rgb(255, 0, 0)');
        expect(formatRgb({ ...RED, a: 0.5 })).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('formatHsl produces hsl()', () => {
        expect(formatHsl(RED)).toBe('hsl(0, 100%, 50%)');
    });

    it('formatOklch produces oklch()', () => {
        expect(formatOklch(RED)).toMatch(/^oklch\([\d.]+% [\d.]+ [\d.]+\)$/);
    });
});

describe('round-trips', () => {
    const samples: RGB[] = [
        { r: 128, g: 64, b: 200 },
        { r: 255, g: 200, b: 100 },
        { r: 10, g: 200, b: 50 },
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
    ];

    it('rgb -> hsl -> rgb', () => {
        for (const c of samples) {
            const back = hslToRgb(rgbToHsl(c));
            rgbClose(back, c, 3);
        }
    });

    it('rgb -> hsv -> rgb', () => {
        for (const c of samples) {
            const back = hsvToRgb(rgbToHsv(c));
            rgbClose(back, c, 3);
        }
    });

    it('rgb -> oklch -> rgb', () => {
        for (const c of samples) {
            const back = oklchToRgb(rgbToOklch(c));
            rgbClose(back, c, 2);
        }
    });

    it('hex -> parse -> formatHex', () => {
        const hex = '#3b82f6';
        const parsed = parseColor(hex);
        if (!parsed) throw new Error('parse failed');
        expect(formatHex(parsed)).toBe(hex);
    });
});

describe('WCAG contrast', () => {
    it('white on black is 21:1', () => {
        expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 0);
    });

    it('identical colors give 1:1', () => {
        expect(contrastRatio(RED, RED)).toBeCloseTo(1, 5);
    });

    it('relativeLuminance white = 1, black = 0', () => {
        expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
        expect(relativeLuminance(BLACK)).toBeCloseTo(0, 5);
    });
});

describe('harmonies', () => {
    it('complementary is 180° rotation', () => {
        const [base, comp] = harmonyComplementary(RED);
        expect(base).toEqual(RED);
        rgbClose(comp, { r: 0, g: 255, b: 255 }, 3);
    });

    it('analogous returns 3 colors', () => {
        expect(harmonyAnalogous(RED)).toHaveLength(3);
    });

    it('triadic returns 3 colors at 120°', () => {
        const [a, b, c] = harmonyTriadic(RED);
        expect(a).toEqual(RED);
        rgbClose(b, GREEN, 3);
        rgbClose(c, BLUE, 3);
    });

    it('tetradic returns 4 colors', () => {
        expect(harmonyTetradic(RED)).toHaveLength(4);
    });

    it('harmonies preserve alpha', () => {
        const withAlpha = { ...RED, a: 0.5 };
        expect(harmonyComplementary(withAlpha)[1].a).toBe(0.5);
    });
});
