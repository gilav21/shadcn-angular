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
    readableForeground,
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

/**
 * The browser is the oracle for CSS Color 4 syntax: a 1x1 canvas parses the
 * string with the engine's own colour parser and we read the pixel back.
 */
const oracleCtx = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.getContext('2d', { willReadFrequently: true })!;
})();

function browserRgb(css: string): RGB {
    const sentinel = '#123456';
    oracleCtx.fillStyle = sentinel;
    oracleCtx.fillStyle = css;
    if (oracleCtx.fillStyle === sentinel) throw new Error(`browser rejected "${css}"`);
    oracleCtx.clearRect(0, 0, 1, 1);
    oracleCtx.fillRect(0, 0, 1, 1);
    const [r, g, b] = oracleCtx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
}

/** Strings where `parseColor` and the browser disagree by more than `tolerance`. */
function disagreements(inputs: readonly string[], tolerance: number): string[] {
    return inputs.flatMap(css => {
        const parsed = parseColor(css);
        if (!parsed) return [`${css} -> null`];
        const want = browserRgb(css);
        const off = Math.max(Math.abs(parsed.r - want.r), Math.abs(parsed.g - want.g), Math.abs(parsed.b - want.b));
        return off > tolerance
            ? [`${css} -> rgb(${parsed.r}, ${parsed.g}, ${parsed.b}), browser rgb(${want.r}, ${want.g}, ${want.b})`]
            : [];
    });
}

/** One hue, written in every unit CSS Color 4 allows (plus unitless degrees). */
function hueSpellings(degrees: number): string[] {
    const n = (v: number): string => v.toFixed(6);
    return [n(degrees), `${n(degrees)}deg`, `${n((degrees * Math.PI) / 180)}rad`,
        `${n((degrees * 400) / 360)}grad`, `${n(degrees / 360)}turn`];
}

const HUE_SAMPLES = [0, 45, 90, 137, 200, 255, 300, 359, 400, 720, -30, -200];

describe('parseColor against the browser (CSS Color 4)', () => {
    it('reads hsl() hues in every unit, with the space and the comma syntax', () => {
        const inputs = HUE_SAMPLES.flatMap(deg => hueSpellings(deg).flatMap(h => [
            `hsl(${h} 80% 45%)`,
            `hsl(${h}, 35%, 70%)`,
        ]));
        expect(disagreements(inputs, 1)).toEqual([]);
    });

    it('reads oklch() hues in every unit', () => {
        const inputs = HUE_SAMPLES.flatMap(deg => hueSpellings(deg).map(h => `oklch(75% 0.08 ${h})`));
        expect(disagreements(inputs, 2)).toEqual([]);
    });

    // CSS Color 4: 100% oklch chroma is 0.4; a negative chroma is clamped to 0
    // at parse time; `none` is a missing component, which converts as 0. The
    // spec's wording for hsl()/oklch() "none" covers every component, not only hue.
    it('reads oklch() chroma percentages (100% = 0.4), negative chroma and the none keyword', () => {
        const inputs = [
            'oklch(75% 20% 200)',
            'oklch(75% 20% 0.25turn)',
            'oklch(60% 25% 30)',
            'oklch(70% -0.1 200)',
            'oklch(70% none 200)',
            'oklch(70% 0.1 none)',
            'oklch(none 0.1 200)',
            'hsl(none 80% 45%)',
            'hsl(120 none 45%)',
            'hsl(120 80% none)',
        ];
        expect(disagreements(inputs, 2)).toEqual([]);
        // Canvas read-back is premultiplied, so alpha is asserted directly rather than via the oracle.
        expect(parseColor('hsl(0.5turn 100% 50% / none)')?.a).toBe(0);
        expect(parseColor('hsl(0.5turn 100% 50% / 50%)')?.a).toBe(0.5);
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

/** Seeded PRNG (mulberry32) so a failing property prints a reproducible input. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('readableForeground', () => {
    const BACKDROPS = ['#ffffff', '#000000', '#1e293b'] as const;
    const ALPHAS = [0, 0.05, 0.15, 0.5, 0.95, 1] as const;

    function composite(fg: RGBA, backdrop: RGB): RGB {
        const over = (f: number, b: number): number => f * fg.a + b * (1 - fg.a);
        return { r: over(fg.r, backdrop.r), g: over(fg.g, backdrop.g), b: over(fg.b, backdrop.b) };
    }

    /** The opaque-only rule the helper used before it knew about alpha. */
    function opaqueRule(c: RGB): '#000000' | '#ffffff' {
        return contrastRatio(c, BLACK) >= contrastRatio(c, WHITE) ? '#000000' : '#ffffff';
    }

    /** Why `readableForeground` is wrong for this input, or null when it is right. */
    function violation(fg: RGBA, backdrop: string): string | null {
        const css = `rgba(${fg.r}, ${fg.g}, ${fg.b}, ${fg.a})`;
        const picked = readableForeground(css, backdrop);
        if (fg.a === 1) {
            return picked === opaqueRule(fg) ? null : `${css} (opaque) -> ${picked}`;
        }
        const seen = composite(fg, parseColor(backdrop)!);
        const chosen = contrastRatio(seen, picked === '#000000' ? BLACK : WHITE);
        const rejected = contrastRatio(seen, picked === '#000000' ? WHITE : BLACK);
        return chosen >= rejected ? null : `${css} over ${backdrop} -> ${picked}`;
    }

    it('picks the higher-contrast foreground on the colour composited over the backdrop', () => {
        const random = mulberry32(7);
        const channel = (): number => Math.floor(random() * 256);
        const colours = Array.from({ length: 60 }, () => ({ r: channel(), g: channel(), b: channel() }));
        const failures = colours.flatMap(c => ALPHAS.flatMap(a => BACKDROPS.map(backdrop =>
            violation({ ...c, a }, backdrop)))).filter(Boolean);
        expect(failures.slice(0, 8)).toEqual([]);
    });

    it('judges a soft translucent badge against a white backdrop unless told otherwise', () => {
        expect(readableForeground('rgba(15, 23, 42, 0.15)')).toBe('#000000');
        expect(readableForeground('#00000010')).toBe('#000000');
        expect(readableForeground('rgba(255, 255, 255, 0.1)', '#0f172a')).toBe('#ffffff');
    });

    it('lets a fully transparent colour defer to the backdrop', () => {
        expect(readableForeground('transparent')).toBe('#000000');
        expect(readableForeground('transparent', '#0f172a')).toBe('#ffffff');
    });

    it('falls back to white text for an unparseable colour', () => {
        expect(readableForeground('not-a-color')).toBe('#ffffff');
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
