/**
 * Chart Component Types
 * Shared TypeScript interfaces for all chart components
 */

// =============================================================================
// Base Data Types
// =============================================================================

export interface ChartDataPoint {
    name: string;
    value: number;
    color?: string;
}

export interface DrilldownDataPoint extends ChartDataPoint {
    drilldown?: string;
}

export interface RangeDataPoint {
    name: string;
    low: number;
    high: number;
    color?: string;
}

export interface StackedDataPoint {
    name: string;
    values: { name: string; value: number }[];
}

// =============================================================================
// Series Types
// =============================================================================

export interface ChartSeries {
    id?: string;
    name: string;
    data: ChartDataPoint[];
    color?: string;
}

export interface DrilldownSeries {
    id: string;
    name: string;
    data: ChartDataPoint[];
}

// =============================================================================
// Event Types
// =============================================================================

export interface ChartClickEvent<T = ChartDataPoint> {
    point: T;
    index: number;
    event?: MouseEvent;
}

export interface DrilldownEvent {
    seriesId: string;
    parentPoint: DrilldownDataPoint;
}

// =============================================================================
// Configuration Types
// =============================================================================

export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';
export type ChartOrientation = 'horizontal' | 'vertical';
export type StackingMode = 'absolute' | 'percent';
export type EasingFunction = 'linear' | 'easeOut' | 'easeInOut' | 'easeOutQuart';

export interface TooltipConfig {
    enabled: boolean;
    formatter?: (point: ChartDataPoint, percentage?: number) => string;
}

export interface AxisConfig {
    label?: string;
    showGrid?: boolean;
    showLine?: boolean;
    min?: number;
    max?: number;
    ticks?: number[];
}

// =============================================================================
// Internal Types (for component implementation)
// =============================================================================

export interface PieSlice {
    index: number;
    data: ChartDataPoint;
    startAngle: number;
    endAngle: number;
    percentage: number;
    color: string;
    path: string;
    labelPosition: { x: number; y: number };
    centroid: { x: number; y: number };
}

export interface BarRect {
    index: number;
    data: ChartDataPoint;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    value: number;
    labelPosition: { x: number; y: number };
}

export interface RaceFrame {
    label: string;
    data: ChartDataPoint[];
    rankings: Map<string, number>;
}

// =============================================================================
// Organization Chart Types
// =============================================================================

export interface OrgNode {
    id: string;
    name: string;
    title?: string;
    description?: string;
    image?: string;
    color?: string;
    parentId?: string | null;
}

export interface OrgNodePosition {
    node: OrgNode;
    x: number;
    y: number;
    width: number;
    height: number;
    level: number;
    children: OrgNodePosition[];
}

export type OrgLayoutDirection = 'vertical' | 'horizontal';
export type OrgLineType = 'curved' | 'straight';

