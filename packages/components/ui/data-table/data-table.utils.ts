import type { AggregateFn } from './data-table.types';

export interface RowRange {
    readonly start: number;
    readonly end: number;
}

export interface ColumnRange {
    readonly start: number;
    readonly end: number;
    readonly paddingLeft: number;
    readonly paddingRight: number;
}

export interface VariableRowRange {
    readonly start: number;
    readonly end: number;
    readonly paddingTop: number;
    readonly paddingBottom: number;
}

export function computeRowRange(
    scrollTop: number,
    viewportHeight: number,
    rowHeight: number,
    totalRows: number,
    buffer: number
): RowRange {
    if (totalRows === 0 || rowHeight <= 0) {
        return { start: 0, end: 0 };
    }
    const startRow = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(viewportHeight / rowHeight);
    const endRow = startRow + visibleCount;

    return {
        start: Math.max(0, startRow - buffer),
        end: Math.min(totalRows, endRow + buffer),
    };
}

export function computeColumnRange(
    scrollLeft: number,
    viewportWidth: number,
    columnWidths: readonly number[],
    buffer: number
): ColumnRange {
    if (columnWidths.length === 0) {
        return { start: 0, end: 0, paddingLeft: 0, paddingRight: 0 };
    }

    let offset = 0;
    let startCol = 0;
    for (let i = 0; i < columnWidths.length; i++) {
        if (offset + columnWidths[i] > scrollLeft) {
            startCol = i;
            break;
        }
        offset += columnWidths[i];
        if (i === columnWidths.length - 1) {
            startCol = columnWidths.length;
        }
    }

    let endCol = startCol;
    let widthAccum = 0;
    for (let i = startCol; i < columnWidths.length; i++) {
        widthAccum += columnWidths[i];
        endCol = i + 1;
        if (widthAccum >= viewportWidth) {
            break;
        }
    }

    const bufferedStart = Math.max(0, startCol - buffer);
    const bufferedEnd = Math.min(columnWidths.length, endCol + buffer);

    let paddingLeft = 0;
    for (let i = 0; i < bufferedStart; i++) {
        paddingLeft += columnWidths[i];
    }

    let paddingRight = 0;
    for (let i = bufferedEnd; i < columnWidths.length; i++) {
        paddingRight += columnWidths[i];
    }

    return {
        start: bufferedStart,
        end: bufferedEnd,
        paddingLeft,
        paddingRight,
    };
}

export function buildPrefixSums(
    getRowHeight: (index: number) => number,
    totalRows: number
): Float64Array {
    const sums = new Float64Array(totalRows + 1);
    for (let i = 0; i < totalRows; i++) {
        sums[i + 1] = sums[i] + getRowHeight(i);
    }
    return sums;
}

function binarySearchPrefix(prefixSums: Float64Array, target: number, totalRows: number): number {
    let lo = 0;
    let hi = totalRows;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (prefixSums[mid + 1] <= target) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    return Math.min(lo, totalRows);
}

export function computeVariableRowRange(
    scrollTop: number,
    viewportHeight: number,
    getRowHeight: (index: number) => number,
    totalRows: number,
    buffer: number,
    prefixSums?: Float64Array
): VariableRowRange {
    if (totalRows === 0) {
        return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 };
    }

    if (prefixSums?.length === totalRows + 1) {
        return computeVariableRowRangeFromPrefixSums(scrollTop, viewportHeight, prefixSums, totalRows, buffer);
    }

    return computeVariableRowRangeLinear(scrollTop, viewportHeight, getRowHeight, totalRows, buffer);
}

function computeVariableRowRangeFromPrefixSums(
    scrollTop: number,
    viewportHeight: number,
    prefixSums: Float64Array,
    totalRows: number,
    buffer: number
): VariableRowRange {
    const startRow = binarySearchPrefix(prefixSums, scrollTop, totalRows);

    let endRow = startRow;
    const scrollBottom = scrollTop + viewportHeight;
    if (startRow < totalRows) {
        endRow = binarySearchPrefix(prefixSums, scrollBottom, totalRows);
        if (prefixSums[endRow] < scrollBottom && endRow < totalRows) {
            endRow++;
        }
    }

    const bufferedStart = Math.max(0, startRow - buffer);
    const bufferedEnd = Math.min(totalRows, endRow + buffer);

    return {
        start: bufferedStart,
        end: bufferedEnd,
        paddingTop: prefixSums[bufferedStart],
        paddingBottom: prefixSums[totalRows] - prefixSums[bufferedEnd],
    };
}

function computeVariableRowRangeLinear(
    scrollTop: number,
    viewportHeight: number,
    getRowHeight: (index: number) => number,
    totalRows: number,
    buffer: number
): VariableRowRange {
    let offset = 0;
    let startRow = 0;
    for (let i = 0; i < totalRows; i++) {
        const h = getRowHeight(i);
        if (offset + h > scrollTop) {
            startRow = i;
            break;
        }
        offset += h;
        if (i === totalRows - 1) {
            startRow = totalRows;
        }
    }

    let endRow = startRow;
    let viewAccum = 0;
    for (let i = startRow; i < totalRows; i++) {
        viewAccum += getRowHeight(i);
        endRow = i + 1;
        if (viewAccum >= viewportHeight) {
            break;
        }
    }

    const bufferedStart = Math.max(0, startRow - buffer);
    const bufferedEnd = Math.min(totalRows, endRow + buffer);

    let paddingTop = 0;
    for (let i = 0; i < bufferedStart; i++) {
        paddingTop += getRowHeight(i);
    }

    let paddingBottom = 0;
    for (let i = bufferedEnd; i < totalRows; i++) {
        paddingBottom += getRowHeight(i);
    }

    return {
        start: bufferedStart,
        end: bufferedEnd,
        paddingTop,
        paddingBottom,
    };
}

export function buildTreeFromFlat<T>(
    rows: T[],
    getId: (row: T) => string,
    getParentId: (row: T) => string | null,
    setChildren: (row: T, children: T[]) => T
): T[] {
    const childrenMap = new Map<string | null, T[]>();

    for (const row of rows) {
        const parentId = getParentId(row);
        const siblings = childrenMap.get(parentId);
        if (siblings) {
            siblings.push(row);
        } else {
            childrenMap.set(parentId, [row]);
        }
    }

    function attachChildren(row: T): T {
        const id = getId(row);
        const children = childrenMap.get(id);
        if (!children || children.length === 0) {
            return row;
        }
        return setChildren(row, children.map(attachChildren));
    }

    const roots = childrenMap.get(null) ?? [];
    return roots.map(attachChildren);
}

interface TrailingNumbers {
    prefix: string;
    numbers: { value: number; width: number }[];
}

function toNumberSeries(source: unknown[]): number[] | null {
    const nums: number[] = [];
    for (const v of source) {
        if (typeof v !== 'number' || !Number.isFinite(v)) return null;
        nums.push(v);
    }
    return nums;
}

function fillNumericSeries(nums: number[], count: number): number[] {
    const step = nums.length >= 2 ? nums[nums.length - 1] - nums[nums.length - 2] : 0;
    const last = nums[nums.length - 1];
    return Array.from({ length: count }, (_, i) => last + step * (i + 1));
}

function splitTrailingDigits(v: string): { prefix: string; digits: string } | null {
    let end = v.length;
    while (end > 0) {
        const ch = v[end - 1];
        if (ch < '0' || ch > '9') break;
        end--;
    }
    return end === v.length ? null : { prefix: v.slice(0, end), digits: v.slice(end) };
}

function detectTrailingNumbers(source: unknown[]): TrailingNumbers | null {
    let prefix: string | null = null;
    const numbers: { value: number; width: number }[] = [];
    for (const v of source) {
        if (typeof v !== 'string') return null;
        const split = splitTrailingDigits(v);
        if (!split) return null;
        if (prefix === null) prefix = split.prefix;
        else if (prefix !== split.prefix) return null;
        numbers.push({ value: Number.parseInt(split.digits, 10), width: split.digits.length });
    }
    return prefix === null ? null : { prefix, numbers };
}

function padNumber(n: number, width: number): string {
    const body = Math.abs(n).toString().padStart(width, '0');
    return n < 0 ? `-${body}` : body;
}

function fillTrailingNumbers(info: TrailingNumbers, count: number): string[] {
    const { prefix, numbers } = info;
    const last = numbers[numbers.length - 1];
    const step = numbers.length >= 2 ? last.value - numbers[numbers.length - 2].value : 1;
    return Array.from({ length: count }, (_, i) =>
        prefix + padNumber(last.value + step * (i + 1), last.width),
    );
}

function cycleValues(source: unknown[], count: number): unknown[] {
    return Array.from({ length: count }, (_, i) => source[i % source.length]);
}

/**
 * Extrapolate `count` more values from a fill source (Excel-style drag-to-fill):
 * arithmetic step for numbers, incrementing trailing numbers in text (padding
 * preserved), else cycle the source pattern.
 */
export function buildFillValues(source: unknown[], count: number): unknown[] {
    if (count <= 0) return [];
    if (source.length === 0) return new Array(count).fill('');

    const numeric = toNumberSeries(source);
    if (numeric) return fillNumericSeries(numeric, count);

    const trailing = detectTrailingNumbers(source);
    if (trailing) return fillTrailingNumbers(trailing, count);

    return cycleValues(source, count);
}

/**
 * Reduce a list of cell values to a single aggregate string. Shared by column
 * footers and the range-selection readout so both compute identically.
 * `count` counts all values; the numeric aggregates ignore non-finite values.
 */
export function computeAggregateValue(values: unknown[], fn: AggregateFn): string {
    if (typeof fn === 'function') return fn(values);

    const nums = values.map(Number).filter(Number.isFinite);
    if (nums.length === 0 && fn !== 'count') return '';

    switch (fn) {
        case 'sum':
            return String(nums.reduce((a, b) => a + b, 0));
        case 'avg':
            return String(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100);
        case 'count':
            return String(values.length);
        case 'min':
            return String(Math.min(...nums));
        case 'max':
            return String(Math.max(...nums));
        default:
            return '';
    }
}

export interface RowGroup<T> {
    readonly groupKey: string;
    readonly groupValue: unknown;
    readonly rows: T[];
}

/**
 * Partitions a flat row list into insertion-ordered groups keyed by the
 * stringified value returned by `getGroupValue`. The first time a group key is
 * seen determines that group's position in the result.
 */
export function partitionIntoGroups<T>(
    rows: readonly T[],
    getGroupValue: (row: T) => unknown
): RowGroup<T>[] {
    const groups = new Map<string, { groupValue: unknown; rows: T[] }>();
    for (const row of rows) {
        const groupValue = getGroupValue(row);
        const groupKey = String(groupValue);
        const existing = groups.get(groupKey);
        if (existing) {
            existing.rows.push(row);
        } else {
            groups.set(groupKey, { groupValue, rows: [row] });
        }
    }
    return Array.from(groups, ([groupKey, value]) => ({
        groupKey,
        groupValue: value.groupValue,
        rows: value.rows,
    }));
}
