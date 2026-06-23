export interface RowRange {
    readonly start: number;
    readonly end: number;
}

/** A filter spec compiled from a natural-language query by an AI provider. */
export interface NlFilterSpec {
    globalFilter?: string;
    columnFilters?: Record<string, unknown>;
}

/**
 * Parse an AI provider's natural-language-filter JSON into a safe {@link NlFilterSpec}:
 * keeps a string `globalFilter` and only `columnFilters` whose keys are known
 * columns. Returns an empty spec for malformed input — the provider's output is
 * never trusted to address unknown columns.
 */
export function parseNlFilterSpec(raw: string, validColumnKeys: string[]): NlFilterSpec {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;
    const spec: NlFilterSpec = {};
    if (typeof obj['globalFilter'] === 'string') {
        spec.globalFilter = obj['globalFilter'];
    }
    const columnFilters = obj['columnFilters'];
    if (columnFilters && typeof columnFilters === 'object') {
        const valid = new Set(validColumnKeys);
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(columnFilters as Record<string, unknown>)) {
            if (valid.has(key)) out[key] = value;
        }
        if (Object.keys(out).length > 0) spec.columnFilters = out;
    }
    return spec;
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
