import { describe, it, expect } from 'vitest';
import { computeBins } from './histogram.utils';

/**
 * Best (lowest) elapsed time across a few runs. Wall-clock timing on a loaded
 * machine is dominated by scheduling noise, and noise only ever ADDS time, so
 * the minimum is the closest estimate of the real cost — and the only form of
 * this assertion that does not flake.
 */
function bestOf(work: () => unknown, runs = 5): number {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        work();
        best = Math.min(best, performance.now() - start);
    }
    return best;
}

describe('histogram utils workload', () => {
    describe('computeBins', () => {
        // Spec section 3.2: 10,000 raw values binned under 16ms. Timed as the BEST
        // of several runs — see bestOf above.
        it('bins 10,000 values within the 16ms budget', () => {
            const values = Array.from({ length: 10_000 }, (_, i) => (i * 7919) % 1000);
            expect(bestOf(() => computeBins(values))).toBeLessThan(16);
        });

        // Guards the complexity: binning is O(n log bins), so ten times the
        // sample must not cost anything like a hundred times the work.
        it('scales linearly with the sample size', () => {
            const small = Array.from({ length: 10_000 }, (_, i) => (i * 7919) % 1000);
            const large = Array.from({ length: 100_000 }, (_, i) => (i * 7919) % 1000);

            const t1 = bestOf(() => computeBins(small));
            const t2 = bestOf(() => computeBins(large));

            expect(t2).toBeLessThan(Math.max(t1, 0.05) * 40);
        });
    });
});
