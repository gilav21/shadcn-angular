import { describe, it, expect } from 'vitest';
import { hexToOklch, formatOklch, buildBrandTriplet, isValidHex } from './color.js';

describe('isValidHex', () => {
    it('accepts 6-digit hex with and without #', () => {
        expect(isValidHex('#3b82f6')).toBe(true);
        expect(isValidHex('3b82f6')).toBe(true);
    });

    it('accepts 3-digit hex', () => {
        expect(isValidHex('#f00')).toBe(true);
    });

    it('rejects malformed values', () => {
        expect(isValidHex('#3b82f')).toBe(false);
        expect(isValidHex('#gggggg')).toBe(false);
        expect(isValidHex('blue')).toBe(false);
        expect(isValidHex('')).toBe(false);
    });
});

describe('hexToOklch', () => {
    it('converts white to L≈1, C≈0', () => {
        const { l, c } = hexToOklch('#ffffff');
        expect(l).toBeCloseTo(1, 3);
        expect(c).toBe(0);
    });

    it('converts black to L≈0, C≈0', () => {
        const { l, c } = hexToOklch('#000000');
        expect(l).toBeCloseTo(0, 3);
        expect(c).toBe(0);
    });

    it('converts pure red to known OKLCH values', () => {
        const { l, c, h } = hexToOklch('#ff0000');
        expect(l).toBeCloseTo(0.628, 2);
        expect(c).toBeCloseTo(0.258, 2);
        expect(h).toBeCloseTo(29.23, 0);
    });

    it('converts #3b82f6 to a blue hue around 259°', () => {
        const { l, c, h } = hexToOklch('#3b82f6');
        expect(l).toBeGreaterThan(0.55);
        expect(l).toBeLessThan(0.68);
        expect(c).toBeGreaterThan(0.1);
        expect(h).toBeGreaterThan(250);
        expect(h).toBeLessThan(268);
    });

    it('expands 3-digit hex', () => {
        expect(hexToOklch('#f00')).toEqual(hexToOklch('#ff0000'));
    });

    it('throws on invalid hex', () => {
        expect(() => hexToOklch('nope')).toThrow(/Invalid hex color/);
    });
});

describe('formatOklch', () => {
    it('matches preset formatting', () => {
        expect(formatOklch({ l: 0.5455, c: 0.2452, h: 262.8814 })).toBe('oklch(0.546 0.245 262.881)');
    });

    it('formats achromatic colors with zeroed chroma and hue', () => {
        expect(formatOklch(hexToOklch('#ffffff'))).toBe('oklch(1 0 0)');
    });
});

describe('buildBrandTriplet', () => {
    it('uses the brand color as-is for the light primary and ring', () => {
        const triplet = buildBrandTriplet('#3b82f6');
        expect(triplet.light['--primary']).toMatch(/^oklch\(/);
        expect(triplet.light['--ring']).toBe(triplet.light['--primary']);
        expect(triplet.dark['--ring']).toBe(triplet.dark['--primary']);
    });

    it('pairs a light foreground with a mid/dark primary', () => {
        const triplet = buildBrandTriplet('#3b82f6');
        expect(triplet.light['--primary-foreground']).toBe('oklch(0.985 0 0)');
    });

    it('pairs a dark foreground with a very light primary', () => {
        const triplet = buildBrandTriplet('#fde047');
        expect(triplet.light['--primary-foreground']).toBe('oklch(0.205 0 0)');
    });

    it('lifts a dark brand color for dark mode', () => {
        const triplet = buildBrandTriplet('#1e3a8a');
        const lightL = Number.parseFloat(/oklch\(([\d.]+)/.exec(triplet.light['--primary'])![1]);
        const darkL = Number.parseFloat(/oklch\(([\d.]+)/.exec(triplet.dark['--primary'])![1]);
        expect(lightL).toBeLessThan(0.55);
        expect(darkL).toBeCloseTo(0.7, 3);
    });

    it('keeps a sufficiently light brand color unchanged in dark mode', () => {
        const triplet = buildBrandTriplet('#3b82f6');
        expect(triplet.dark['--primary']).toBe(triplet.light['--primary']);
    });
});
