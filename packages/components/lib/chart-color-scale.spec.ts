import { describe, it, expect } from 'vitest';
import { sequentialColorScale } from './chart-color-scale';
import { formatHex, formatOklch, parseColor, rgbToHsl } from './color';

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

interface Hsl {
    h: number;
    s: number;
    l: number;
}

/** Reads back the `hsl(h, s%, l%)` the ramp emits. */
function readHsl(css: string): Hsl {
    const m = /^hsl\((\d+), (\d+)%, (\d+)%\)$/.exec(css);
    if (!m) throw new Error(`not an hsl() ramp colour: ${css}`);
    return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

/** Smallest angle between two hues, in degrees (0..180). */
function hueGap(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
}

/** Hue reached `t` of the way along the shorter arc; exactly opposite hues increase. */
function shorterArcHue(from: number, to: number, t: number): number {
    let delta = (((to - from) % 360) + 360) % 360;
    if (delta > 180) delta -= 360;
    return (((from + delta * t) % 360) + 360) % 360;
}

describe('sequentialColorScale', () => {
    it('returns the endpoints at the domain bounds', () => {
        const c = sequentialColorScale([0, 100], ['hsl(200, 80%, 90%)', 'hsl(200, 80%, 30%)']);
        expect(c(0)).toBe('hsl(200, 80%, 90%)');
        expect(c(100)).toBe('hsl(200, 80%, 30%)');
    });

    it('interpolates to an intermediate color at the midpoint', () => {
        const c = sequentialColorScale([0, 100], ['hsl(200, 80%, 90%)', 'hsl(200, 80%, 30%)']);
        expect(c(50)).toBe('hsl(200, 80%, 60%)');
    });

    it('clamps values outside the domain to the endpoints', () => {
        const c = sequentialColorScale([0, 100], ['hsl(200, 80%, 90%)', 'hsl(200, 80%, 30%)']);
        expect(c(-50)).toBe('hsl(200, 80%, 90%)');
        expect(c(150)).toBe('hsl(200, 80%, 30%)');
    });

    it('follows the shorter hue arc between random endpoints, including pairs across 0/360 and opposite pairs', () => {
        const random = mulberry32(11);
        // Saturation and lightness stay where 8-bit RGB resolves a hue to
        // within half a degree (chroma >= 0.25, i.e. >= 64 channel levels), so
        // endpoint rounding plus the integer output stay inside the 1.5 degree
        // tolerance; below that the endpoint itself is lost in parseColor.
        const pick = (lo: number, hi: number): number => lo + Math.floor(random() * (hi - lo + 1));
        const pairs: Array<[number, number]> = [
            [350, 10], [10, 350], [0, 180], [90, 270], [200, 200],
            ...Array.from({ length: 40 }, (): [number, number] => [pick(0, 359), pick(0, 359)]),
        ];
        const failures: string[] = [];
        for (const [h0, h1] of pairs) {
            const s0 = pick(50, 100);
            const l0 = pick(25, 75);
            const s1 = pick(50, 100);
            const l1 = pick(25, 75);
            const ramp = sequentialColorScale([0, 1], [`hsl(${h0}, ${s0}%, ${l0}%)`, `hsl(${h1}, ${s1}%, ${l1}%)`]);
            for (const t of [0.25, 0.5, 0.75]) {
                const got = readHsl(ramp(t));
                const inRange = (v: number, a: number, b: number): boolean =>
                    v >= Math.min(a, b) - 1 && v <= Math.max(a, b) + 1;
                if (hueGap(got.h, shorterArcHue(h0, h1, t)) > 1.5
                    || !inRange(got.s, s0, s1) || !inRange(got.l, l0, l1)) {
                    failures.push(`hsl(${h0},${s0}%,${l0}%) -> hsl(${h1},${s1}%,${l1}%) @${t} = ${ramp(t)}`);
                }
            }
        }
        expect(failures).toEqual([]);
    });

    it('lets an achromatic endpoint adopt the other endpoint hue instead of swinging through unrelated hues', () => {
        const fromGrey = sequentialColorScale([0, 1], ['hsl(0, 0%, 95%)', 'hsl(220, 80%, 40%)']);
        const toWhite = sequentialColorScale([0, 1], ['#1d4ed8', '#ffffff']);
        const blueHue = rgbToHsl(parseColor('#1d4ed8')!).h;
        for (const t of [0.25, 0.5, 0.75]) {
            expect(hueGap(readHsl(fromGrey(t)).h, 220)).toBeLessThanOrEqual(1);
            expect(hueGap(readHsl(toWhite(t)).h, blueHue)).toBeLessThanOrEqual(1);
        }
        expect(Math.abs(readHsl(fromGrey(0.5)).s - 40)).toBeLessThanOrEqual(1);
    });

    it('ramps between endpoints written in any parseColor format, never through black', () => {
        const blue = parseColor('#1d4ed8')!;
        const forms: Array<[string, string]> = [
            ['#fff', '#1d4ed8'],
            ['#ffffff', '#1d4ed8'],
            ['#ffffffff', '#1d4ed8ff'],
            ['white', formatHex(blue)],
            ['rgb(255, 255, 255)', 'rgb(29, 78, 216)'],
            ['hsl(0, 0%, 100%)', 'hsl(224, 76%, 48%)'],
            ['hsl(0 0% 100%)', 'hsl(224 76% 48%)'],
            ['oklch(100% 0 0)', formatOklch(blue)],
        ];
        const [baseline] = forms.map(([from, to]) => readHsl(sequentialColorScale([0, 1], [from, to])(0.5)));
        const failures = forms.flatMap(([from, to]) => {
            const mid = readHsl(sequentialColorScale([0, 1], [from, to])(0.5));
            const near = hueGap(mid.h, baseline.h) <= 2
                && Math.abs(mid.s - baseline.s) <= 2 && Math.abs(mid.l - baseline.l) <= 2;
            return near ? [] : [`${from} -> ${to}: ${JSON.stringify(mid)} vs ${JSON.stringify(baseline)}`];
        });
        expect(failures).toEqual([]);
        // #1d4ed8 is hsl(224.3, 76.3%, 48.0%); white contributes s 0 and l 100 and adopts its hue.
        expect(hueGap(baseline.h, 224)).toBeLessThanOrEqual(1);
        expect(Math.abs(baseline.s - 38)).toBeLessThanOrEqual(1);
        expect(Math.abs(baseline.l - 74)).toBeLessThanOrEqual(1);
    });

    it('takes the shorter arc from red to blue, through magenta rather than green', () => {
        expect(sequentialColorScale([0, 1], ['#ff0000', '#0000ff'])(0.5)).toBe('hsl(300, 100%, 50%)');
    });

    it('keeps a black endpoint black and ramps from it', () => {
        const ramp = sequentialColorScale([0, 1], ['black', '#ffffff']);
        expect(readHsl(ramp(0.5)).l).toBe(50);
    });

    it('returns the nearer endpoint, not black, when an endpoint cannot be parsed', () => {
        const ramp = sequentialColorScale([0, 100], ['not-a-colour', '#1d4ed8']);
        expect(ramp(25)).toBe('not-a-colour');
        expect(ramp(75)).toBe('#1d4ed8');
    });
});
