import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    easingFunctions,
    animateValue,
    calculateAxisTicks,
    extent,
    formatChartValue,
    formatChartValueOrGap,
    MISSING_VALUE_LABEL,
    getDataRange,
    describeArc,
    positiveOrZero,
} from './chart.utils';

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

/** Digits after the decimal point in a number's shortest string, exponent form included. */
function fractionDigits(value: number): number {
    const [mantissa, exponent = '0'] = String(Math.abs(value)).split('e');
    const fraction = mantissa.split('.')[1] ?? '';
    return Math.max(0, fraction.length - Number(exponent));
}

describe('calculateAxisTicks', () => {
    const twoDecimals = (rng: () => number, max: number): number => Math.round(rng() * max * 100) / 100;
    /** An ascending pair from `draw`, redrawn until the two values differ. */
    const distinctPair = (draw: () => number): [number, number] => {
        const a = draw();
        let b = draw();
        while (a === b) b = draw();
        return a < b ? [a, b] : [b, a];
    };

    /**
     * Classes whose step is far above float resolution, so every result must be
     * a real tick list (the ulp/overflow fallback is covered in chart-scale.spec).
     */
    const classes: { name: string; fixed: [number, number][]; draw: (rng: () => number) => [number, number] }[] = [
        { name: 'integer', fixed: [[0, 15], [1, 2], [2, 3]], draw: rng => distinctPair(() => Math.round(rng() * 2000 - 1000)) },
        { name: 'fractional', fixed: [[1.97, 2.69], [0, 0.06]], draw: rng => distinctPair(() => twoDecimals(rng, 10)) },
        { name: 'negative', fixed: [[-0.06, 0], [-2.69, -1.97]], draw: rng => distinctPair(() => -twoDecimals(rng, 10) - 0.01) },
        { name: 'mixed-sign', fixed: [[-0.07, 0.13]], draw: rng => [-twoDecimals(rng, 10) - 0.01, twoDecimals(rng, 10) + 0.01] },
        { name: 'tiny', fixed: [[0, 1e-9], [3e-10, 7e-10]], draw: rng => [rng() * 5e-10, 5e-10 + rng() * 5e-10] },
        // Bounds produced by float arithmetic sit an ulp off a step multiple,
        // where `floor(min / step)` can land on either side of the true index.
        {
            name: 'float-sum',
            fixed: [
                [-0.045000000000000005, 0.004999999999999998],
                [0.010000000000000002, 0.060000000000000005],
                [0.1 + 0.2, 0.7 + 0.1],
                [-82 * 0.1, 62 * 0.1],
                [812.8, 813.2],
                [-639.5, -639.3],
            ],
            draw: rng => {
                // A step multiple computed as k·s, the way chart data often is.
                const s = [0.1, 0.2, 0.3, 0.7][Math.floor(rng() * 4)];
                const min = Math.round(rng() * 200 - 100) * s;
                return [min, min + (Math.round(rng() * 50) + 1) * s];
            },
        },
        { name: 'giant', fixed: [[-1e307, 1e307]], draw: rng => [-rng() * 1e307, rng() * 1e307 + 1e306] },
    ];

    /** Every (class, min, max, count) call T-2 samples: fixed rows first, then seeded draws. */
    function sampledCalls(rng: () => number): { cls: string; min: number; max: number; count: number }[] {
        const pairs = classes.flatMap(cls =>
            [...cls.fixed, ...Array.from({ length: 300 }, () => cls.draw(rng))].map(bounds => ({ cls: cls.name, bounds })));
        return pairs.flatMap(({ cls, bounds: [min, max] }) => [1, 3, 5, 7, 10].map(count => ({ cls, min, max, count })));
    }

    // T-2 (UC-2)
    it('ticks are exact multiples of the step with no float noise', () => {
        const violations = sampledCalls(mulberry32(SEED)).flatMap(({ cls, min, max, count }) => {
            const problem = tickProblem(min, max, count);
            return problem ? [`${cls} calculateAxisTicks(${min}, ${max}, ${count}): ${problem}`] : [];
        });
        expect(violations.slice(0, 10), `seed ${SEED}: ${violations.length} violations`).toEqual([]);
    });

    /**
     * Whether one gap equals the step. Exact after rounding to the step's
     * digits; above 1e15 a gap between two doubles can only match to within
     * their spacing, so it is compared relative to the tick's magnitude.
     */
    function evenGap(gap: number, step: number, stepDigits: number, tick: number): boolean {
        if (Math.abs(tick) >= 1e15) return Math.abs(gap - step) <= Number.EPSILON * Math.abs(tick) * 4;
        return Number(gap.toFixed(stepDigits)) === step;
    }

    /**
     * The 1, 2 or 5 × 10ⁿ value nearest a measured gap. A gap between two
     * rounded ticks carries the ticks' float error (relative to the ticks, not
     * the gap), so the step is snapped rather than read off digit by digit.
     */
    function nearestNiceStep(gap: number): number {
        const exponent = Math.floor(Math.log10(gap));
        const candidates = ['1', '2', '5', '10'].map(m => Number(`${m}e${exponent}`));
        return candidates.reduce((best, c) => (Math.abs(c - gap) < Math.abs(best - gap) ? c : best), candidates[0]);
    }

    /** What, if anything, breaks the tick contract for one call. */
    function tickProblem(min: number, max: number, count: number): string | undefined {
        const ticks = calculateAxisTicks(min, max, count);
        if (ticks.length < 2 || ticks.length > 2 * count + 3) return `bad length ${ticks.length}`;
        if (ticks[0] > min || (ticks.at(-1) ?? Number.NaN) < max) return `does not cover: ${ticks.join(',')}`;
        // Tight: the step multiple floor(min/step) starts the list, not one below it.
        if (ticks[1] <= min || (ticks.at(-2) ?? Number.NaN) >= max) return `wider than needed: ${ticks.join(',')}`;
        const step = nearestNiceStep(ticks[1] - ticks[0]);
        if (Math.abs(ticks[1] - ticks[0] - step) > step * 1e-6) return `gap ${ticks[1] - ticks[0]} is not 1, 2 or 5 × 10ⁿ`;
        const stepDigits = fractionDigits(step);
        for (let i = 0; i < ticks.length; i++) {
            const problem = singleTickProblem(ticks[i], step, stepDigits);
            if (problem) return problem;
            if (i > 0 && !evenGap(ticks[i] - ticks[i - 1], step, stepDigits, ticks[i])) return `uneven gap at ${ticks[i]}`;
        }
        return undefined;
    }

    /** What, if anything, makes one tick other than a clean multiple of the step. */
    function singleTickProblem(tick: number, step: number, stepDigits: number): string | undefined {
        if (Number(tick.toFixed(stepDigits)) !== tick) return `tick ${tick} is not rounded to step ${step}`;
        if (!Number.isInteger(Number((tick / step).toFixed(6)))) return `tick ${tick} is not a multiple of step ${step}`;
        if (Math.abs(tick) < 1e15 && fractionDigits(tick) > stepDigits) return `noisy tick ${tick}`;
        return undefined;
    }

    it('treats a fractional tick count as its floor', () => {
        // Precondition: counts 5 and 6 pick different steps for this span (true
        // of the 1.5/3/7 residual thresholds), so 5.5 must act as 5.
        expect(calculateAxisTicks(0.5, 8.5, 6)).not.toEqual(calculateAxisTicks(0.5, 8.5, 5));
        expect(calculateAxisTicks(0.5, 8.5, 5.5)).toEqual(calculateAxisTicks(0.5, 8.5, 5));
    });

    it.each<[number, number, number]>([
        [5, 5, 5],
        [5, 1, 5],
        [Number.NaN, 5, 5],
        [0, Number.POSITIVE_INFINITY, 5],
    ])('returns no ticks for an empty or non-finite range (%s, %s)', (min, max, count) => {
        expect(calculateAxisTicks(min, max, count)).toEqual([]);
    });
});

// T-9 (UC-8)
describe('extent', () => {
    it('returns min and max in one pass and skips non-finite values', () => {
        const rng = mulberry32(SEED);
        const junk = [Number.NaN, null, undefined, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
        const values = Array.from({ length: 1_000_000 }, (...[, i]) =>
            i % 997 === 0 ? junk[i % junk.length] : (rng() - 0.5) * 1e6);
        const finite = values.filter((v): v is number => Number.isFinite(v));
        const reference = finite.reduce<[number, number]>(
            ([lo, hi], v) => [Math.min(lo, v), Math.max(hi, v)],
            [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
        );
        expect(extent(values)).toEqual(reference);
    });

    it('reads a one-shot iterable in a single pass', () => {
        function* readings(): Generator<number | null> {
            yield 3;
            yield null;
            yield -2;
            yield 7;
        }
        expect(extent(readings())).toEqual([-2, 7]);
    });

    it('returns undefined when no value is finite, and [v, v] for one value', () => {
        expect(extent([])).toBeUndefined();
        expect(extent([Number.NaN, null, Number.POSITIVE_INFINITY])).toBeUndefined();
        expect(extent([Number.NaN, -4.5])).toEqual([-4.5, -4.5]);
    });

    it('lets getDataRange measure 150,000 points without a stack overflow', () => {
        const data = Array.from({ length: 150_000 }, (...[, i]) => ({ value: (i % 1000) - 250 }));
        expect(getDataRange(data)).toEqual({ min: -250, max: 749 });
        expect(getDataRange([])).toEqual({ min: 0, max: 0 });
    });
});

// T-11 (UC-9)
describe('formatChartValue', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const optionSets = ['en-US', 'de-DE', 'he-IL'].flatMap(locale => [
        { locale, compact: false, decimals: 1 },
        { locale, compact: true, decimals: 2 },
    ]);
    const values = [0, -1234.56, 1e9, 0.05];

    function expected(value: number, { locale, compact, decimals }: (typeof optionSets)[number]): string {
        const useCompact = compact && Math.abs(value) >= 1000;
        return new Intl.NumberFormat(locale, {
            ...(useCompact ? { notation: 'compact' as const } : {}),
            maximumFractionDigits: decimals,
        }).format(value);
    }

    it('formats exactly like a fresh Intl.NumberFormat', () => {
        for (const options of optionSets) {
            for (const value of values) {
                expect(formatChartValue(value, options)).toBe(expected(value, options));
            }
        }
        expect(formatChartValue(1234.5)).toBe('1,234.5');
    });

    it('formatChartValueOrGap formats a finite value and dashes anything else', () => {
        expect(formatChartValueOrGap(1234.5)).toBe('1,234.5');
        expect(formatChartValueOrGap(0)).toBe('0');
        for (const missing of [Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
            expect(formatChartValueOrGap(missing)).toBe(MISSING_VALUE_LABEL);
        }
    });

    it('constructs one formatter per option set', () => {
        // Option sets no other test uses, so the module cache starts cold.
        const counted = [
            { locale: 'fr-FR', compact: true, decimals: 1 },
            { locale: 'fr-FR', compact: false, decimals: 2 },
            { locale: 'ja-JP', compact: false, decimals: 2 },
        ];
        const Original = Intl.NumberFormat;
        const want = Array.from({ length: 1000 }, (...[, i]) => expected(i * 7.25, counted[i % counted.length]));
        let constructions = 0;
        // A bare spy does not construct a real formatter under `new`, so count
        // and delegate to the original constructor.
        vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (
            ...args: ConstructorParameters<typeof Intl.NumberFormat>
        ) {
            constructions++;
            return new Original(...args);
        });
        const outputs = Array.from({ length: 1000 }, (...[, i]) =>
            formatChartValue(i * 7.25, counted[i % counted.length]));
        // The compact set formats values both below and above 1,000, so it needs
        // a compact and a standard formatter: 2 + 1 + 1. Sets that differ only
        // in decimals (fr-FR) or only in locale (decimals 2) make a cache that
        // drops either part of its key fail the output check below.
        expect(constructions).toBeGreaterThan(0);
        expect(constructions).toBeLessThanOrEqual(4);
        expect(outputs).toEqual(want);
    });
});

describe('easingFunctions', () => {
    const names = ['linear', 'easeOut', 'easeInOut', 'easeOutQuart'] as const;

    it.each(names)('%s is pinned at both ends of the curve', name => {
        expect(easingFunctions[name](0)).toBeCloseTo(0, 10);
        expect(easingFunctions[name](1)).toBeCloseTo(1, 10);
    });

    it.each(names)('%s rises monotonically across its domain', name => {
        const fn = easingFunctions[name];
        // Exact tenths: accumulating `t += 0.1` drifts past 1, and the curves
        // are only defined on [0, 1] — easeOutQuart turns back down beyond it.
        for (let i = 0; i < 10; i++) {
            expect(fn((i + 1) / 10)).toBeGreaterThanOrEqual(fn(i / 10));
        }
    });

    it('linear returns the input unchanged', () => {
        expect(easingFunctions.linear(0.25)).toBe(0.25);
    });

    it('easeOut front-loads its progress', () => {
        // Decelerating: half the time has already covered most of the distance.
        expect(easingFunctions.easeOut(0.5)).toBeGreaterThan(0.5);
    });

    it('easeInOut is symmetric about its midpoint', () => {
        // Exercises both sides of the t < 0.5 split.
        expect(easingFunctions.easeInOut(0.5)).toBeCloseTo(0.5, 10);
        expect(easingFunctions.easeInOut(0.25)).toBeCloseTo(1 - easingFunctions.easeInOut(0.75), 10);
    });
});

describe('animateValue', () => {
    let frames: FrameRequestCallback[];
    let cancelled: number[];
    let nextId: number;

    beforeEach(() => {
        frames = [];
        cancelled = [];
        nextId = 1;
        // Drive frames by hand. A real `requestAnimationFrame` would make these
        // assertions depend on how promptly the browser schedules — and this
        // suite backgrounds all but one iframe, where frames are throttled.
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(cb => {
            frames.push(cb);
            return nextId++;
        });
        vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => {
            cancelled.push(id);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Run the queued frame at `timestamp`, as the browser would. */
    function tick(timestamp: number): void {
        const frame = frames.shift();
        expect(frame).toBeDefined();
        frame!(timestamp);
    }

    it('interpolates from start to end and reports completion once', () => {
        const onUpdate = vi.fn();
        const onComplete = vi.fn();

        animateValue(0, 100, 1000, 'linear', onUpdate, onComplete);

        tick(0);
        expect(onUpdate).toHaveBeenLastCalledWith(0);
        tick(500);
        expect(onUpdate).toHaveBeenLastCalledWith(50);
        expect(onComplete).not.toHaveBeenCalled();

        tick(1000);
        expect(onUpdate).toHaveBeenLastCalledWith(100);
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('measures elapsed time from the first frame, not from the call', () => {
        const onUpdate = vi.fn();

        animateValue(0, 10, 100, 'linear', onUpdate);

        // The first timestamp becomes the baseline, so a late first frame does
        // not skip the animation forward.
        tick(5000);
        expect(onUpdate).toHaveBeenLastCalledWith(0);
        tick(5050);
        expect(onUpdate).toHaveBeenLastCalledWith(5);
    });

    it('clamps progress so a late frame cannot overshoot the end value', () => {
        const onUpdate = vi.fn();
        const onComplete = vi.fn();

        animateValue(0, 100, 100, 'linear', onUpdate, onComplete);

        tick(0);
        tick(999);

        expect(onUpdate).toHaveBeenLastCalledWith(100);
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('counts down when the end value is below the start', () => {
        const onUpdate = vi.fn();

        animateValue(100, 0, 1000, 'linear', onUpdate);

        tick(0);
        tick(250);

        expect(onUpdate).toHaveBeenLastCalledWith(75);
    });

    it('applies the named easing rather than interpolating linearly', () => {
        const onUpdate = vi.fn();

        animateValue(0, 100, 1000, 'easeOut', onUpdate);

        tick(0);
        tick(500);

        expect(onUpdate).toHaveBeenLastCalledWith(100 * easingFunctions.easeOut(0.5));
    });

    it('completes without an onComplete callback', () => {
        const onUpdate = vi.fn();

        animateValue(0, 1, 10, 'linear', onUpdate);

        tick(0);
        expect(() => tick(10)).not.toThrow();
        expect(onUpdate).toHaveBeenLastCalledWith(1);
    });

    // T-12 (UC-10)
    it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
        'animateValue with duration %s reports end once, then completes',
        duration => {
            const onUpdate = vi.fn();
            const onComplete = vi.fn();

            animateValue(10, 100, duration, 'easeOut', onUpdate, onComplete);
            expect(onUpdate).not.toHaveBeenCalled();
            tick(0);

            expect(onUpdate.mock.calls).toEqual([[100]]);
            expect(onComplete).toHaveBeenCalledTimes(1);
            expect(frames).toHaveLength(0);
        },
    );

    it('stops the animation when the returned canceller is called', () => {
        const onUpdate = vi.fn();
        const onComplete = vi.fn();

        const cancel = animateValue(0, 100, 1000, 'linear', onUpdate, onComplete);
        tick(0);
        const pending = frames.length;
        cancel();

        expect(cancelled).toHaveLength(1);
        // The frame the animation queued is abandoned, so nothing further runs.
        expect(pending).toBe(1);
        expect(onComplete).not.toHaveBeenCalled();
    });
});

describe('describeArc terminates and stays finite for every sweep', () => {
    // A single full turn, 143% of one, a negative sweep and a donut, in both directions.
    it.each([
        ['exactly one turn', 0, Math.PI * 2],
        ['143% of a turn', -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 1.43],
        ['several turns', 0, Math.PI * 6],
        ['a negative full sweep', 0, -Math.PI * 2],
        ['a negative sweep past a turn', 1, 1 - Math.PI * 3],
    ])('%s', (...[, start, end]) => {
        for (const innerRadius of [0, 40]) {
            const path = describeArc(0, 0, 100, innerRadius, start, end);
            expect(path).not.toMatch(/NaN|Infinity/);
        }
    });
});

describe('positiveOrZero', () => {
    it.each([
        [5, 5],
        [0, 0],
        [-3, 0],
        [Number.NaN, 0],
        [Number.POSITIVE_INFINITY, 0],
    ])('%s becomes %s', (value, expected) => {
        expect(positiveOrZero(value)).toBe(expected);
    });
});
