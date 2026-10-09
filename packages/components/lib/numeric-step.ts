/**
 * Grid arithmetic shared by the numeric controls (slider, number input,
 * rating): every value they render or produce is `min + k·step` for an
 * integer `k`, written at the precision of `min` and `step` — never
 * `0.30000000000000004`.
 *
 * The semantics are the native ones: `<input type=range>` value sanitising
 * for {@link snapToStep}, and `<input type=number>` `stepUp`/`stepDown` for
 * {@link stepFrom}.
 */

/** A numeric grid of `min + k·step` values. */
export interface StepGrid {
    /** Grid base and lower bound. Unset means base `0` with no lower bound. */
    readonly min?: number;
    /** Upper bound. The largest reachable value is the top grid point ≤ `max`; unset means unbounded. */
    readonly max?: number;
    /** Grid spacing. Anything not finite and positive falls back to `1`, as the native default does. */
    readonly step: number;
}

interface ResolvedGrid {
    readonly base: number;
    readonly step: number;
    /** Decimals every produced value is written at. */
    readonly precision: number;
    /** Lowest grid *index* `k` allowed (`-∞` when `min` is unset). */
    readonly lowest: number;
    /** Highest grid *index* `k` allowed — the index of *top* (`+∞` when `max` is unset). */
    readonly highest: number;
}

/** `toFixed` accepts at most 100 digits. */
const MAX_PRECISION = 100;

/**
 * Digits a grid index is rounded to before it is compared or rounded itself,
 * so a division that lands a hair off an integer or a tie
 * (`1.15 / 0.1 = 11.499999999999998`) reads as what it is.
 */
const INDEX_DECIMALS = 9;

/**
 * Digits after the decimal point, including exponent notation:
 * `0.05 → 2`, `1e-7 → 7`, `1.5e-7 → 8`, `1e21 → 0`. Non-finite → `0`.
 */
export function decimalsOf(n: number): number {
    if (!Number.isFinite(n)) return 0;
    const [mantissa, exponent = '0'] = Math.abs(n).toString().split('e');
    const fraction = mantissa.split('.')[1] ?? '';
    return Math.max(0, fraction.length - Number(exponent));
}

function cleanIndex(k: number): number {
    return Number(k.toFixed(INDEX_DECIMALS));
}

function resolve(grid: StepGrid): ResolvedGrid {
    const step = Number.isFinite(grid.step) && grid.step > 0 ? grid.step : 1;
    const base = grid.min ?? 0;
    return {
        base,
        step,
        precision: Math.min(MAX_PRECISION, Math.max(decimalsOf(base), decimalsOf(step))),
        lowest: grid.min === undefined ? Number.NEGATIVE_INFINITY : 0,
        highest: grid.max === undefined ? Number.POSITIVE_INFINITY : Math.floor(cleanIndex((grid.max - base) / step)),
    };
}

/** Clamps a grid index into the bounded sides; a lower bound wins when `max < min`. */
function valueAt(k: number, g: ResolvedGrid): number {
    const index = Math.max(g.lowest, Math.min(k, g.highest));
    return Number((g.base + index * g.step).toFixed(g.precision));
}

/**
 * The grid point nearest `value`, ties going up (the native range rule),
 * clamped to `[min, top]` where *top* is the largest grid point ≤ `max`.
 */
export function snapToStep(value: number, grid: StepGrid): number {
    const g = resolve(grid);
    return valueAt(Math.round(cleanIndex((value - g.base) / g.step)), g);
}

/**
 * Moves `count` grid steps from `value` in `direction`. An on-grid value moves
 * exactly `count` steps; an off-grid one first lands on the next grid point in
 * that direction (`2.4 ↑ 3`, `2.4 ↓ 2`), which counts as the first step — the
 * native `stepUp`/`stepDown` rule. The result is clamped to the bounded sides.
 */
export function stepFrom(value: number, direction: 1 | -1, count: number, grid: StepGrid): number {
    const g = resolve(grid);
    const k = cleanIndex((value - g.base) / g.step);
    if (Number.isInteger(k)) return valueAt(k + direction * count, g);
    const firstStep = direction > 0 ? Math.ceil(k) : Math.floor(k);
    return valueAt(firstStep + direction * (count - 1), g);
}
