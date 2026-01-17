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

    const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
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

export function calculateAxisTicks(
    min: number,
    max: number,
    targetCount = 5
): number[] {
    const range = max - min;
    const roughStep = range / targetCount;

    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const residual = roughStep / magnitude;

    let niceStep: number;
    if (residual <= 1.5) niceStep = 1 * magnitude;
    else if (residual <= 3) niceStep = 2 * magnitude;
    else if (residual <= 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;

    const niceMin = Math.floor(min / niceStep) * niceStep;
    const niceMax = Math.ceil(max / niceStep) * niceStep;

    const ticks: number[] = [];
    for (let tick = niceMin; tick <= niceMax; tick += niceStep) {
        ticks.push(tick);
    }

    return ticks;
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
    return `${base}${chartType} with ${dataPointCount} data point${dataPointCount !== 1 ? 's' : ''}.`;
}
