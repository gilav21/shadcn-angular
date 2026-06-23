import type {
    FilterGroup,
    FilterOperator,
    FilterRule,
    PivotAggregate,
    PivotConfig,
    PivotResult,
} from './data-table.types';

export interface RowRange {
    readonly start: number;
    readonly end: number;
}

function asString(value: unknown): string {
    return value == null ? '' : String(value);
}

function looseEquals(cell: unknown, value: unknown): boolean {
    const a = Number(cell);
    const b = Number(value);
    if (Number.isFinite(a) && Number.isFinite(b)) return a === b;
    return asString(cell).toLowerCase() === asString(value).toLowerCase();
}

const FILTER_OPS: Record<FilterOperator, (cell: unknown, value: unknown) => boolean> = {
    isEmpty: (cell) => asString(cell).trim() === '',
    isNotEmpty: (cell) => asString(cell).trim() !== '',
    equals: (cell, value) => looseEquals(cell, value),
    notEquals: (cell, value) => !looseEquals(cell, value),
    contains: (cell, value) => asString(cell).toLowerCase().includes(asString(value).toLowerCase()),
    notContains: (cell, value) => !asString(cell).toLowerCase().includes(asString(value).toLowerCase()),
    startsWith: (cell, value) => asString(cell).toLowerCase().startsWith(asString(value).toLowerCase()),
    endsWith: (cell, value) => asString(cell).toLowerCase().endsWith(asString(value).toLowerCase()),
    gt: (cell, value) => Number(cell) > Number(value),
    gte: (cell, value) => Number(cell) >= Number(value),
    lt: (cell, value) => Number(cell) < Number(value),
    lte: (cell, value) => Number(cell) <= Number(value),
};

/** Test a single cell value against an advanced-filter operator. */
export function matchesCondition(cell: unknown, operator: FilterOperator, value: unknown): boolean {
    return (FILTER_OPS[operator] ?? (() => true))(cell, value);
}

function evaluateRule(rule: FilterRule, getValue: (column: string) => unknown): boolean {
    if (rule.type === 'group') {
        return evaluateAdvancedFilter(rule, getValue);
    }
    return matchesCondition(getValue(rule.column), rule.operator, rule.value);
}

/**
 * Evaluate an advanced-filter group tree against a row. An empty group matches
 * everything; `and` requires every rule, `or` requires any. Nested groups recurse.
 */
export function evaluateAdvancedFilter(
    group: FilterGroup,
    getValue: (column: string) => unknown,
): boolean {
    if (group.rules.length === 0) return true;
    const results = group.rules.map((rule) => evaluateRule(rule, getValue));
    return group.combinator === 'and' ? results.every(Boolean) : results.some(Boolean);
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

const PIVOT_KEY_PREFIX = 'pivot:';
const PIVOT_TOTAL_KEY = '__total__';

function defaultGetValue(row: unknown, key: string): unknown {
    return (row as Record<string, unknown>)[key];
}

function aggregateNumbers(values: number[], fn: PivotAggregate): number {
    if (fn === 'count') return values.length;
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    switch (fn) {
        case 'sum':
            return sum;
        case 'avg':
            return Math.round((sum / values.length) * 100) / 100;
        case 'min':
            return Math.min(...values);
        case 'max':
            return Math.max(...values);
        default:
            return 0;
    }
}

function aggregateCell<T>(
    rows: T[],
    config: PivotConfig,
    getValue: (row: T, key: string) => unknown,
): number {
    if (config.aggregate === 'count') return rows.length;
    const nums = rows
        .map((row) => Number(getValue(row, config.value)))
        .filter((n) => Number.isFinite(n));
    return aggregateNumbers(nums, config.aggregate);
}

/**
 * Transform a flat dataset into a pivot table (rows × columns × values). The
 * row dimension(s) become the leading columns, each distinct value of
 * `config.column` becomes a column, and each cell is the aggregate of
 * `config.value`. Pure — bind the result's `columns`/`rows` to a data table.
 */
export function computePivot<T>(
    data: readonly T[],
    config: PivotConfig,
    getValue: (row: T, key: string) => unknown = defaultGetValue,
): PivotResult {
    const columnValues = Array.from(
        new Set(data.map((row) => String(getValue(row, config.column)))),
    ).sort((a, b) => a.localeCompare(b));

    const groups = new Map<string, { dim: Record<string, unknown>; rows: T[] }>();
    for (const row of data) {
        const dimValues = config.rows.map((key) => getValue(row, key));
        const groupKey = dimValues.map(String).join(' ');
        let group = groups.get(groupKey);
        if (!group) {
            const dim: Record<string, unknown> = {};
            config.rows.forEach((key, i) => (dim[key] = dimValues[i]));
            group = { dim, rows: [] };
            groups.set(groupKey, group);
        }
        group.rows.push(row);
    }

    const columns = [
        ...config.rows.map((key) => ({ key, header: key })),
        ...columnValues.map((value) => ({ key: PIVOT_KEY_PREFIX + value, header: value })),
        ...(config.showRowTotals ? [{ key: PIVOT_TOTAL_KEY, header: 'Total' }] : []),
    ];

    const rows = Array.from(groups.values()).map((group) => {
        const out: Record<string, unknown> = { ...group.dim };
        for (const value of columnValues) {
            const cellRows = group.rows.filter(
                (row) => String(getValue(row, config.column)) === value,
            );
            out[PIVOT_KEY_PREFIX + value] = aggregateCell(cellRows, config, getValue);
        }
        if (config.showRowTotals) {
            out[PIVOT_TOTAL_KEY] = aggregateCell(group.rows, config, getValue);
        }
        return out;
    });

    return { columns, rows, pivotColumnKeys: columnValues.map((v) => PIVOT_KEY_PREFIX + v) };
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
