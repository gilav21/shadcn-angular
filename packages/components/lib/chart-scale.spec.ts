import { describe, it, expect } from 'vitest';
import {
    linearScale,
    timeScale,
    bandScale,
    sizeScale,
    niceDomain,
    niceTimeTicks,
    toEpochMs,
    zeroBasedDomain,
} from './chart-scale';
import { calculateAxisTicks } from './chart.utils';

/** Seeded PRNG (mulberry32) so a failing property prints a reproducible input. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SEED = 20261003;
const COUNTS = [1, 3, 5, 7, 10];
const SAMPLES_PER_CLASS = 300;

type Bounds = [number, number];
type BoundsClass = { name: string; fixed: Bounds[]; draw: (rng: () => number) => Bounds };

const twoDecimals = (rng: () => number, max: number): number => Math.round(rng() * max * 100) / 100;
const ordered = (a: number, b: number): Bounds => (a <= b ? [a, b] : [b, a]);

/** One generator per input class the tick/domain code treats differently. */
const FINITE_CLASSES: BoundsClass[] = [
    {
        name: 'integer',
        fixed: [[0, 15], [1, 2], [2, 3], [3, 97], [0, 100]],
        draw: rng => ordered(Math.round(rng() * 2000 - 1000), Math.round(rng() * 2000 - 1000)),
    },
    {
        name: 'fractional',
        fixed: [[1.97, 2.69], [0, 0.06]],
        draw: rng => ordered(twoDecimals(rng, 10), twoDecimals(rng, 10)),
    },
    {
        name: 'negative',
        fixed: [[-0.06, 0], [-2.69, -1.97]],
        draw: rng => ordered(-twoDecimals(rng, 10) - 0.01, -twoDecimals(rng, 10) - 0.01),
    },
    {
        name: 'mixed-sign',
        fixed: [[-0.06, 0.06], [-15, 1000]],
        draw: rng => [-twoDecimals(rng, 10) - 0.01, twoDecimals(rng, 10) + 0.01],
    },
    {
        // Arithmetic results sit an ulp off a step multiple (0.1 + 0.2).
        name: 'float-sum',
        fixed: [[-0.045000000000000005, 0.004999999999999998], [0.010000000000000002, 0.060000000000000005], [-82 * 0.1, 62 * 0.1]],
        draw: rng => {
            const s = [0.1, 0.2, 0.3, 0.7][Math.floor(rng() * 4)];
            return ordered(Math.round(rng() * 200 - 100) * s, Math.round(rng() * 200 - 100) * s);
        },
    },
    {
        name: 'all-equal',
        fixed: [[0, 0], [-3, -3], [2.69, 2.69]],
        draw: rng => {
            const v = twoDecimals(rng, 20) - 10;
            return [v, v];
        },
    },
    {
        name: 'tiny',
        fixed: [[0, 1e-9], [3e-10, 7e-10], [5.2e-316, 5.21e-316]],
        draw: rng => ordered(rng() * 1e-9, rng() * 1e-9),
    },
    {
        name: 'huge-narrow',
        fixed: [[1e20, 1e20 + 16384], [1e16, 1e16 + 4]],
        draw: rng => (rng() < 0.5
            ? ordered(1e20 + Math.round(rng() * 1e5), 1e20 + Math.round(rng() * 1e5))
            : ordered(1e16 + Math.round(rng() * 8), 1e16 + Math.round(rng() * 8))),
    },
    {
        name: 'giant',
        fixed: [[-1e307, 1e307], [-1e308, 1e308], [1e307, 1.7e308]],
        draw: rng => ordered((rng() * 2 - 1) * 1e307, (rng() * 2 - 1) * 1e307),
    },
];

/** How the ticks of `niceDomain(a, b, n)` break UC-3, if they do. */
function tickBoundProblems(a: number, b: number, n: number, label: string): string[] {
    const [d0, d1] = niceDomain(a, b, n);
    const scale = linearScale([d0, d1], [300, 0]);
    const own = scale.ticks(n);
    const problems: string[] = [];
    // The unclipped list must reproduce the domain (the fixed point); the
    // clipped `ticks()` below could otherwise hide an overshooting tick.
    const raw = calculateAxisTicks(d0, d1, n);
    if (raw[0] !== d0 || raw.at(-1) !== d1) problems.push(`${label}: not a fixed point, ticks ${raw.join(',')}`);
    if (own[0] !== d0 || own.at(-1) !== d1) {
        problems.push(`${label}: domain [${d0}, ${d1}] has ticks ${own.join(',')}`);
    }
    for (const m of COUNTS) {
        const outside = scale.ticks(m).filter(t => t < d0 || t > d1);
        if (outside.length > 0) problems.push(`${label}: ticks(${m}) outside [${d0}, ${d1}]: ${outside.join(',')}`);
    }
    return problems;
}

/** Every (class, bounds) pair the properties sample: fixed rows first, then seeded draws. */
function sampleBounds(): { cls: string; bounds: Bounds }[] {
    const rng = mulberry32(SEED);
    return FINITE_CLASSES.flatMap(cls => [
        ...cls.fixed.map(bounds => ({ cls: cls.name, bounds })),
        ...Array.from({ length: SAMPLES_PER_CLASS }, () => ({ cls: cls.name, bounds: cls.draw(rng) })),
    ]);
}

describe('linearScale', () => {
    it('maps the domain start/end to the range start/end', () => {
        const s = linearScale([0, 100], [0, 500]);
        expect(s.scale(0)).toBe(0);
        expect(s.scale(100)).toBe(500);
    });

    it('maps an interior value proportionally', () => {
        const s = linearScale([0, 100], [0, 500]);
        expect(s.scale(50)).toBe(250);
    });

    it('supports an inverted (descending) pixel range for y-axes', () => {
        const s = linearScale([0, 10], [200, 0]);
        expect(s.scale(0)).toBe(200);
        expect(s.scale(10)).toBe(0);
        expect(s.scale(5)).toBe(100);
    });

    it('inverts pixels back to domain values', () => {
        const s = linearScale([0, 100], [0, 500]);
        expect(s.invert(250)).toBe(50);
    });

    it('does not divide by zero on a degenerate domain', () => {
        const s = linearScale([5, 5], [0, 500]);
        expect(Number.isFinite(s.scale(5))).toBe(true);
    });

    it('produces nice ticks within the domain', () => {
        const s = linearScale([0, 100], [0, 500]);
        expect(s.ticks(5)).toEqual([0, 20, 40, 60, 80, 100]);
    });
});

describe('niceDomain', () => {
    it('rounds the domain outward to nice bounds', () => {
        expect(niceDomain(3, 97, 5)).toEqual([0, 100]);
    });

    it('keeps already-nice bounds unchanged', () => {
        expect(niceDomain(0, 100, 5)).toEqual([0, 100]);
    });

    it('handles a flat domain without collapsing to a single point', () => {
        const [min, max] = niceDomain(42, 42, 5);
        expect(max).toBeGreaterThan(min);
    });

    // T-1 (UC-1)
    it('niceDomain returns finite bounds containing every finite input', () => {
        const violations: string[] = [];
        for (const { cls, bounds: [a, b] } of sampleBounds()) {
            for (const n of COUNTS) {
                const [d0, d1] = niceDomain(a, b, n);
                const ok = Number.isFinite(d0) && Number.isFinite(d1) && d1 > d0 && d0 <= a && d1 >= b;
                if (!ok) violations.push(`${cls} niceDomain(${a}, ${b}, ${n}) = [${d0}, ${d1}]`);
            }
        }
        expect(violations.slice(0, 10), `seed ${SEED}: ${violations.length} violations`).toEqual([]);
    });

    // T-3 (UC-3)
    it('ticks of a nice domain start and end on its bounds', () => {
        const violations = sampleBounds().flatMap(({ cls, bounds: [a, b] }) =>
            COUNTS.flatMap(n => tickBoundProblems(a, b, n, `${cls} [${a}, ${b}] n=${n}`)));
        expect(violations.slice(0, 10), `seed ${SEED}: ${violations.length} violations`).toEqual([]);
    });

    // T-5 (UC-5)
    it.each<Bounds>([
        [5, 5],
        [0, 0],
        [-3, -3],
        [5, 1],
        [Number.NaN, 5],
        [0, Number.NaN],
        [Number.NaN, Number.NaN],
        [0, Number.POSITIVE_INFINITY],
        [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
        [-1e308, 1e308],
        [1.7e308, 1.7e308],
        [0, 1e-200],
        [5.2e-316, 5.21e-316],
    ])('degenerate bounds niceDomain(%s, %s) yield a finite non-collapsed domain', (a, b) => {
        const [d0, d1] = niceDomain(a, b, 5);
        expect(Number.isFinite(d0) && Number.isFinite(d1)).toBe(true);
        expect(d1).toBeGreaterThan(d0);
        for (const v of [a, b].filter(Number.isFinite)) {
            expect(v).toBeGreaterThanOrEqual(d0);
            expect(v).toBeLessThanOrEqual(d1);
        }
    });
});

// T-6 (UC-6) — each call must return. The 1,000 ms timeout fails a slow call
// that does return; it cannot interrupt a synchronous runaway loop, which
// stalls the file instead (that is how the pre-fix code fails these rows).
describe('zeroBasedDomain', () => {
    it.each([
        ['positive values start at zero', [1.97, 2.2, 2.69], [0, 3]],
        ['negative values end at zero', [-50, -10, -0.5], [-50, 0]],
        ['mixed values span both sides', [-30, 45.5, -0.01, 12], [-40, 60]],
        ['all zeros still have an axis', [0, 0, 0], [-1, 1]],
        ['no values still have an axis', [], [-1, 1]],
        ['non-finite entries are ignored', [Number.NaN, 4, Number.POSITIVE_INFINITY, null, undefined], [0, 4]],
    ])('%s', (...[, values, expected]) => {
        expect(zeroBasedDomain(values as number[])).toEqual(expected);
    });
});

describe('scale helpers return a bounded tick list in bounded time', () => {
    const cap = (count: number): number => 2 * Math.min(50, Math.max(1, Math.floor(count))) + 3;

    it.each<[number, number, number]>([
        [1e20, 1e20 + 16384, 5],
        [1e16, 1e16 + 4, 5],
        [0, 10, 1e9],
        [0, 10, 0],
        [0, 10, -1],
        [-1e308, 1e308, 5],
    ])('calculateAxisTicks(%s, %s, %s)', (min, max, count) => {
        const ticks = calculateAxisTicks(min, max, count);
        expect(ticks.length).toBeGreaterThanOrEqual(2);
        expect(ticks.length).toBeLessThanOrEqual(cap(count));
        expect(ticks.every(Number.isFinite)).toBe(true);
        expect(ticks[0]).toBeLessThanOrEqual(min);
        expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
    }, 1000);

    it.each<[number, number, number]>([
        [0, 10, 1e9],
        [0, 10, 0],
        [1e20, 1e20 + 16384, 5],
        [1e16, 1e16 + 4, -1],
    ])('niceDomain(%s, %s, %s)', (min, max, count) => {
        const [d0, d1] = niceDomain(min, max, count);
        expect(Number.isFinite(d0) && Number.isFinite(d1) && d0 <= min && d1 >= max && d1 > d0).toBe(true);
        expect(linearScale([d0, d1], [0, 1]).ticks(count).length).toBeLessThanOrEqual(cap(count));
    }, 1000);

    it.each<[number, number, number]>([
        [0, 8.64e15, 5],
        [0, 8.64e15, 1e9],
        [-Number.MAX_VALUE, Number.MAX_VALUE, 5],
        [Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1) + 3.1536e13, 10],
    ])('niceTimeTicks(%s, %s, %s) over a finite range', (min, max, count) => {
        const ticks = niceTimeTicks(min, max, count);
        expect(ticks.length).toBeGreaterThanOrEqual(2);
        expect(ticks.length).toBeLessThanOrEqual(cap(count));
        expect(ticks.every(t => Number.isFinite(t) && t >= min && t <= max)).toBe(true);
    }, 1000);

    it.each<[number, number, number[]]>([
        [0, Number.POSITIVE_INFINITY, [0]],
        [Number.NaN, 5, [5]],
        [Number.NEGATIVE_INFINITY, Number.NaN, []],
    ])('niceTimeTicks(%s, %s) with a non-finite bound', (min, max, expected) => {
        expect(niceTimeTicks(min, max, 5)).toEqual(expected);
    }, 1000);
});

describe('bandScale', () => {
    it('places evenly spaced bands with no padding', () => {
        const b = bandScale(['a', 'b', 'c'], [0, 300]);
        expect(b.bandwidth).toBeCloseTo(100, 5);
        expect(b.position('a')).toBeCloseTo(0, 5);
        expect(b.position('b')).toBeCloseTo(100, 5);
        expect(b.position('c')).toBeCloseTo(200, 5);
    });

    it('reduces bandwidth when inner padding is applied', () => {
        const b = bandScale(['a', 'b'], [0, 200], 0.5);
        expect(b.bandwidth).toBeLessThan(100);
    });

    it('returns undefined position for an unknown key', () => {
        const b = bandScale(['a'], [0, 100]);
        expect(b.position('z')).toBeUndefined();
    });
});

describe('sizeScale', () => {
    it('maps the domain extremes to the radius extremes', () => {
        const s = sizeScale([0, 100], [2, 20]);
        expect(s.radius(0)).toBeCloseTo(2, 5);
        expect(s.radius(100)).toBeCloseTo(20, 5);
    });

    it('uses a sqrt (area-proportional) mapping, not linear', () => {
        const s = sizeScale([0, 100], [0, 10]);
        // linear midpoint would be 5; sqrt makes 50 map above the linear midpoint
        expect(s.radius(50)).toBeGreaterThan(5);
    });
});

describe('toEpochMs', () => {
    it('passes through a number unchanged', () => {
        expect(toEpochMs(1719500000000)).toBe(1719500000000);
    });

    it('converts a Date to epoch milliseconds', () => {
        const d = new Date('2026-06-28T00:00:00.000Z');
        expect(toEpochMs(d)).toBe(d.getTime());
    });
});

describe('timeScale', () => {
    it('maps the time domain to the pixel range', () => {
        const start = new Date('2026-01-01T00:00:00Z').getTime();
        const end = new Date('2026-01-02T00:00:00Z').getTime();
        const s = timeScale([start, end], [0, 240]);
        expect(s.scale(start)).toBeCloseTo(0, 5);
        expect(s.scale(end)).toBeCloseTo(240, 5);
    });

    it('accepts Date inputs via toEpochMs at the boundary', () => {
        const start = new Date('2026-01-01T00:00:00Z');
        const end = new Date('2026-01-02T00:00:00Z');
        const s = timeScale([start, end], [0, 240]);
        expect(s.scale(new Date('2026-01-01T12:00:00Z'))).toBeCloseTo(120, 5);
    });
});

describe('niceTimeTicks', () => {
    it('returns ascending tick timestamps spanning the domain', () => {
        const start = new Date('2026-01-01T00:00:00Z').getTime();
        const end = new Date('2026-01-08T00:00:00Z').getTime();
        const ticks = niceTimeTicks(start, end, 7);
        expect(ticks.length).toBeGreaterThan(1);
        for (let i = 1; i < ticks.length; i++) {
            expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
        }
    });
});
