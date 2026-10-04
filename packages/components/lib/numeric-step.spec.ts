import { describe, expect, it } from 'vitest';
import { decimalsOf, snapToStep, stepFrom, type StepGrid } from './numeric-step';

/**
 * Expected values are what Chromium's own `<input type=range>` sanitising and
 * `<input type=number>` `stepUp`/`stepDown` produce for the same grid, and are
 * compared with `toBe`: exactness is the behaviour, so a near miss like
 * `0.30000000000000004` must fail.
 */
describe('numeric-step', () => {
    it.each<[StepGrid, number, number]>([
        [{ min: 0, max: 100, step: 1 }, 2.4, 2],
        [{ min: 0, max: 100, step: 1 }, 2.5, 3],
        [{ min: 1, max: 10, step: 2 }, 5.6, 5],
        [{ min: 1, max: 10, step: 2 }, 6, 7],
        [{ min: 1, max: 10, step: 2 }, 10, 9],
        [{ min: 1, max: 10, step: 2 }, -3, 1],
        [{ min: -0.5, max: 10, step: 1 }, 0.2, 0.5],
        [{ min: -0.5, max: 10, step: 1 }, -1, -0.5],
        [{ min: 0.5, max: 4, step: 0.1 }, 2.3000000000000003, 2.3],
        [{ min: 0.5, max: 4, step: 0.1 }, 4, 4],
        // (0.3 - 0) / 0.1 is 2.9999999999999996: a raw floor would put top at 0.2.
        [{ min: 0, max: 0.3, step: 0.1 }, 0.3, 0.3],
        [{ min: 0, max: 2, step: 0.1 }, 1.15, 1.2],
        [{ min: 0, max: 1, step: 0.05 }, 0.625, 0.65],
        [{ min: 0, max: 1, step: 0.05 }, 0.35, 0.35],
        [{ min: 0, max: 1, step: 1e-7 }, 0.50000004, 0.5],
        [{ min: 0, step: 5 }, 1_000_003, 1_000_005],
        [{ step: 2 }, -7.2, -8],
        [{ min: 0, max: 10, step: 0 }, 2.5, 3],
        [{ min: 0, max: 10, step: -2 }, 2.4, 2],
        [{ min: 0, max: 10, step: Number.NaN }, 2.5, 3],
    ])('snaps a value to the nearest grid point of min + k·step, ties up, inside [min, top] — %o: %d → %d', (grid, value, expected) => {
        expect(snapToStep(value, grid)).toBe(expected);
    });

    it.each<[StepGrid, number, 1 | -1, number, number]>([
        [{ min: 0, max: 1, step: 0.1 }, 0.2, 1, 1, 0.3],
        [{ min: 0, max: 1, step: 0.1 }, 0.7, 1, 1, 0.8],
        [{ step: 1 }, 2.4, 1, 1, 3],
        [{ step: 1 }, 2.4, -1, 1, 2],
        [{ step: 1 }, 2.5, 1, 1, 3],
        [{ min: 1, step: 2 }, 2, 1, 1, 3],
        [{ min: -0.5, step: 1 }, 0, 1, 1, 0.5],
        [{ min: 0.5, step: 1 }, 0.5, 1, 1, 1.5],
        [{ step: 1e-7 }, 0.5, 1, 1, 0.5000001],
        [{ min: 1, max: 30, step: 2 }, 1, 1, 10, 21],
        [{ min: 1, max: 30, step: 2 }, 2, 1, 10, 21],
        [{ min: 1, max: 10, step: 2 }, 9, 1, 1, 9],
        [{ min: 1, max: 10, step: 2 }, 1, -1, 1, 1],
        [{ min: 1, max: 10, step: 2 }, 3, -1, 10, 1],
        [{ min: 0, step: 0.5 }, 1e6, 1, 1, 1_000_000.5],
        [{ step: 1 }, -40, -1, 1, -41],
        [{ min: 0, max: 5, step: 0.5 }, 2.3, 1, 1, 2.5],
        [{ min: 0, max: 5, step: 0.5 }, 2.3, -1, 1, 2],
    ])('steps from on-grid and off-grid values in both directions without drift — %o: %d by %d×%d → %d', (grid, value, direction, count, expected) => {
        expect(stepFrom(value, direction, count, grid)).toBe(expected);
    });

    it.each<[number, number]>([
        [1, 0],
        [0.05, 2],
        [-0.5, 1],
        [1e-7, 7],
        [1.5e-7, 8],
        [1e21, 0],
        [2.5e-3, 4],
        [Number.NaN, 0],
    ])('counts decimals of plain and exponent-notation numbers — %d has %d', (n, expected) => {
        expect(decimalsOf(n)).toBe(expected);
    });
});
