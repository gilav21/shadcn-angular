/**
 * Chart Utilities
 * Shared utility functions for chart rendering
 */

// =============================================================================
// Color Palette
// =============================================================================

/** Default chart color palette - vibrant, accessible colors */
export const CHART_COLORS = [
    'hsl(221, 83%, 53%)',  // Primary blue
    'hsl(142, 71%, 45%)',  // Emerald green
    'hsl(25, 95%, 53%)',   // Orange
    'hsl(271, 81%, 56%)',  // Purple
    'hsl(340, 82%, 52%)',  // Rose
    'hsl(199, 89%, 48%)',  // Cyan
    'hsl(48, 96%, 53%)',   // Amber
    'hsl(258, 90%, 66%)',  // Violet
    'hsl(0, 84%, 60%)',    // Red
    'hsl(173, 80%, 40%)',  // Teal
] as const;

export function getChartColor(index: number, customColor?: string): string {
    if (customColor) return customColor;
    return CHART_COLORS[index % CHART_COLORS.length];
}

// =============================================================================
// SVG Path Helpers
// =============================================================================

export function polarToCartesian(
    centerX: number,
    centerY: number,
    radius: number,
    angleInRadians: number
): { x: number; y: number } {
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians),
    };
}

export function describeArc(
    x: number,
    y: number,
    outerRadius: number,
    innerRadius: number,
    startAngle: number,
    endAngle: number
): string {
    const isFullCircle = Math.abs(endAngle - startAngle) >= Math.PI * 2 - 0.001;

    if (isFullCircle) {
        const halfAngle = startAngle + Math.PI;
        return (
            describeArc(x, y, outerRadius, innerRadius, startAngle, halfAngle) +
            ' ' +
            describeArc(x, y, outerRadius, innerRadius, halfAngle, endAngle)
        );
    }

    const start = polarToCartesian(x, y, outerRadius, startAngle);
    const end = polarToCartesian(x, y, outerRadius, endAngle);
    const innerStart = polarToCartesian(x, y, innerRadius, endAngle);
    const innerEnd = polarToCartesian(x, y, innerRadius, startAngle);

    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    if (innerRadius === 0) {
        return [
            'M', x, y,
            'L', start.x, start.y,
            'A', outerRadius, outerRadius, 0, largeArcFlag, 1, end.x, end.y,
            'Z'
        ].join(' ');
    }

    return [
        'M', start.x, start.y,
        'A', outerRadius, outerRadius, 0, largeArcFlag, 1, end.x, end.y,
        'L', innerStart.x, innerStart.y,
        'A', innerRadius, innerRadius, 0, largeArcFlag, 0, innerEnd.x, innerEnd.y,
        'Z'
    ].join(' ');
}

export function getSliceCentroid(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
): { x: number; y: number } {
    const midAngle = (startAngle + endAngle) / 2;
    const labelRadius = radius * 0.65;
    return polarToCartesian(centerX, centerY, labelRadius, midAngle);
}

// =============================================================================
// Animation Utilities
// =============================================================================

export const easingFunctions = {
    linear: (t: number): number => t,
    easeOut: (t: number): number => 1 - Math.pow(1 - t, 3),
    easeInOut: (t: number): number => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutQuart: (t: number): number => 1 - Math.pow(1 - t, 4),
} as const;

export function animateValue(
    start: number,
    end: number,
    duration: number,
    easing: keyof typeof easingFunctions,
    onUpdate: (value: number) => void,
    onComplete?: () => void
): () => void {
    let startTime: number | null = null;
    let animationId: number;

    const animate = (timestamp: number): void => {
        startTime ??= timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easingFunctions[easing](progress);
        const currentValue = start + (end - start) * easedProgress;

        onUpdate(currentValue);

        if (progress < 1) {
            animationId = requestAnimationFrame(animate);
        } else {
            onComplete?.();
        }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    };
}

// =============================================================================
// Number Formatting
// =============================================================================

export function formatChartValue(
    value: number,
    options?: {
        compact?: boolean;
        decimals?: number;
        locale?: string;
    }
): string {
    const { compact = false, decimals = 1, locale = 'en-US' } = options ?? {};

    if (compact && Math.abs(value) >= 1000) {
        return new Intl.NumberFormat(locale, {
            notation: 'compact',
            maximumFractionDigits: decimals,
        }).format(value);
    }

    return new Intl.NumberFormat(locale, {
        maximumFractionDigits: decimals,
    }).format(value);
}

export function formatPercentage(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
}

// =============================================================================
// Calculation Helpers
// =============================================================================

export function sumValues(data: { value: number }[]): number {
    return data.reduce((sum, item) => sum + item.value, 0);
}
export function getDataRange(data: { value: number }[]): { min: number; max: number } {
    if (data.length === 0) return { min: 0, max: 0 };
    const values = data.map(d => d.value);
    return {
        min: Math.min(...values),
        max: Math.max(...values),
    };
}

const DEFAULT_TICK_COUNT = 5;
const MAX_TICK_COUNT = 50;
const MIN_ROUNDABLE_STEP = 2 ** -1000;

/**
 * Floors a requested tick count and clamps it to `[1, 50]`, so neither a
 * fractional, zero, negative nor astronomically large count can unbound the
 * tick list. `NaN` falls back to the default of 5.
 */
export function clampTickCount(count: number): number {
    if (Number.isNaN(count)) return DEFAULT_TICK_COUNT;
    return Math.min(MAX_TICK_COUNT, Math.max(1, Math.floor(count)));
}

/**
 * The 1, 2 or 5 × 10ⁿ step nearest above `roughStep`. Built by parsing
 * `"<m>e<n>"` because `Math.pow(10, n)` carries float error for negative `n`
 * (e.g. 10⁻⁷), which would leak into every tick.
 */
function niceStep(roughStep: number): number {
    const exponent = Math.floor(Math.log10(roughStep));
    const residual = roughStep / Number(`1e${exponent}`);
    if (residual <= 1.5) return Number(`1e${exponent}`);
    if (residual <= 3) return Number(`2e${exponent}`);
    if (residual <= 7) return Number(`5e${exponent}`);
    return Number(`1e${exponent + 1}`);
}

/** `index · step` rounded to the step's decimal precision, so `2.3` never reads `2.3000000000000003`. */
function tickAt(index: number, step: number): number {
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    const raw = index * step;
    // `toFixed` throws above 100 digits; steps that small are left unrounded.
    return decimals >= 1 && decimals <= 100 ? Number(raw.toFixed(decimals)) : raw;
}

/** Index of the last step multiple at or below `min` (float division can be off by one either way). */
function firstTickIndex(min: number, step: number): number {
    const index = Math.floor(min / step);
    if (tickAt(index, step) > min) return index - 1;
    if (tickAt(index + 1, step) <= min) return index + 1;
    return index;
}

/** Index of the first step multiple at or above `max`. */
function lastTickIndex(max: number, step: number): number {
    const index = Math.ceil(max / step);
    if (tickAt(index, step) < max) return index + 1;
    if (tickAt(index - 1, step) >= max) return index - 1;
    return index;
}

/**
 * Ascending axis ticks at exact multiples of a 1/2/5×10ⁿ step, each rounded to
 * the step's precision: the first is ≤ `min`, the last ≥ `max`, and there are
 * at most `2·count + 3` of them. `targetCount` is floored and clamped to
 * `[1, 50]`; a domain straddling zero treats a count of 1 as 2, because its 0
 * tick forces two intervals (with one there is no stable nice domain).
 *
 * Returns `[]` when either bound is non-finite or `max <= min`, and
 * `[min, max]` when the step would fall below the float resolution of the
 * bounds (or below 2⁻¹⁰⁰⁰, so a domain like `[0, 1e-303]` is not ticked), or
 * the span, the step or an end tick overflows.
 */
export function calculateAxisTicks(
    min: number,
    max: number,
    targetCount = DEFAULT_TICK_COUNT
): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
    const count = clampTickCount(targetCount);
    const intervals = min < 0 && max > 0 ? Math.max(2, count) : count;
    // An overflowing span makes the step NaN, so the step guard covers it too.
    const step = niceStep((max - min) / intervals);
    // Floored well above the subnormal range (2⁻¹⁰²²): subnormals have fewer
    // significant bits than EPSILON assumes, so steps there cannot be rounded
    // reliably; 2⁻¹⁰⁰⁰ leaves headroom for the tick products near the floor.
    const resolution = Math.max(Math.max(Math.abs(min), Math.abs(max)) * Number.EPSILON * 8, MIN_ROUNDABLE_STEP);
    if (!Number.isFinite(step) || step <= resolution) return [min, max];

    // No count cap is needed here: the step is at least span / (1.5·intervals),
    // so the ticks span fewer than 1.5·intervals + 2 steps — within 2·count + 3.
    const first = firstTickIndex(min, step);
    const last = lastTickIndex(max, step);
    if (!Number.isFinite(tickAt(first, step)) || !Number.isFinite(tickAt(last, step))) return [min, max];
    return Array.from({ length: last - first + 1 }, (_, k) => tickAt(first + k, step));
}

// =============================================================================
// Accessibility Helpers
// =============================================================================

export function getPointAriaLabel(
    name: string,
    value: number,
    percentage?: number,
    total?: number
): string {
    let label = `${name}: ${formatChartValue(value)}`;
    if (percentage !== undefined) {
        label += ` (${formatPercentage(percentage)})`;
    }
    if (total !== undefined) {
        label += ` of ${formatChartValue(total)} total`;
    }
    return label;
}

export function getChartSummary(
    chartType: string,
    dataPointCount: number,
    title?: string
): string {
    const base = title ? `${title}. ` : '';
    return `${base}${chartType} with ${dataPointCount} data point${dataPointCount === 1 ? '' : 's'}.`;
}
