import type {
    AggregateFn,
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

const MS_PER_DAY = 86_400_000;

interface Ymd {
    y: number;
    m: number;
    d: number;
}

interface DateSeries {
    last: Ymd;
    kind: 'date' | 'iso';
    mode: 'day' | 'month';
    step: number;
}

function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

function parseDateCell(v: unknown): { ymd: Ymd; kind: 'date' | 'iso' } | null {
    if (v instanceof Date) {
        return Number.isNaN(v.getTime())
            ? null
            : { ymd: { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() }, kind: 'date' };
    }
    if (typeof v === 'string') {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
        if (match) {
            return { ymd: { y: +match[1], m: +match[2], d: +match[3] }, kind: 'iso' };
        }
    }
    return null;
}

function dayIndex(ymd: Ymd): number {
    return Math.round(Date.UTC(ymd.y, ymd.m - 1, ymd.d) / MS_PER_DAY);
}

function fromDayIndex(index: number): Ymd {
    const dt = new Date(index * MS_PER_DAY);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function daysInMonth(y: number, m: number): number {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addMonths(ymd: Ymd, k: number): Ymd {
    const total = ymd.y * 12 + (ymd.m - 1) + k;
    const y = Math.floor(total / 12);
    const m = mod(total, 12) + 1;
    return { y, m, d: Math.min(ymd.d, daysInMonth(y, m)) };
}

function ymdToIso(ymd: Ymd): string {
    return `${ymd.y}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`;
}

function ymdToDate(ymd: Ymd): Date {
    return new Date(ymd.y, ymd.m - 1, ymd.d);
}

function constantStep(values: number[]): number | null {
    const step = values[1] - values[0];
    for (let i = 1; i < values.length; i++) {
        if (values[i] - values[i - 1] !== step) return null;
    }
    return step;
}

function detectDateSeries(source: unknown[]): DateSeries | null {
    const items: Ymd[] = [];
    let kind: 'date' | 'iso' | null = null;
    for (const v of source) {
        const parsed = parseDateCell(v);
        if (!parsed) return null;
        kind ??= parsed.kind;
        items.push(parsed.ymd);
    }
    if (kind === null) return null;
    const last = items[items.length - 1];
    if (items.length === 1) return { last, kind, mode: 'day', step: 1 };

    const sameDom = items.every((it) => it.d === items[0].d);
    const monthStep = sameDom ? constantStep(items.map((it) => it.y * 12 + (it.m - 1))) : null;
    if (monthStep) return { last, kind, mode: 'month', step: monthStep };

    const dayStep = constantStep(items.map(dayIndex));
    return dayStep === null ? null : { last, kind, mode: 'day', step: dayStep };
}

function nextYmd(series: DateSeries, i: number): Ymd {
    const k = series.step * (i + 1);
    return series.mode === 'month'
        ? addMonths(series.last, k)
        : fromDayIndex(dayIndex(series.last) + k);
}

function fillDateSeries(series: DateSeries, count: number): (Date | string)[] {
    if (series.kind === 'date') {
        return Array.from({ length: count }, (_, i) => ymdToDate(nextYmd(series, i)));
    }
    return Array.from({ length: count }, (_, i) => ymdToIso(nextYmd(series, i)));
}

const WEEKDAY_NAMES = {
    full: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    abbr: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};

const MONTH_NAMES = {
    full: [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
    ],
    abbr: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
};

type NameCasing = 'upper' | 'lower' | 'title';
interface NameTable { full: string[]; abbr: string[] }
interface NameMatch { index: number; form: 'full' | 'abbr'; casing: NameCasing }
interface NameSeries { lastIndex: number; form: 'full' | 'abbr'; casing: NameCasing; step: number; table: NameTable }

function detectCasing(s: string): NameCasing {
    if (s === s.toUpperCase()) return 'upper';
    if (s === s.toLowerCase()) return 'lower';
    return 'title';
}

function matchName(s: string, table: NameTable): NameMatch | null {
    const lower = s.toLowerCase();
    const fullIndex = table.full.indexOf(lower);
    if (fullIndex !== -1) return { index: fullIndex, form: 'full', casing: detectCasing(s) };
    const abbrIndex = table.abbr.indexOf(lower);
    if (abbrIndex !== -1) return { index: abbrIndex, form: 'abbr', casing: detectCasing(s) };
    return null;
}

function detectNameSeries(source: unknown[], table: NameTable): NameSeries | null {
    const matches: NameMatch[] = [];
    for (const v of source) {
        if (typeof v !== 'string') return null;
        const match = matchName(v, table);
        if (!match) return null;
        matches.push(match);
    }
    const len = table.full.length;
    const last = matches[matches.length - 1];
    const base = { lastIndex: last.index, form: last.form, casing: last.casing, table };
    if (matches.length === 1) return { ...base, step: 1 };

    const step = mod(matches[1].index - matches[0].index, len);
    if (step === 0) return null;
    for (let i = 1; i < matches.length; i++) {
        if (mod(matches[i].index - matches[i - 1].index, len) !== step) return null;
    }
    return { ...base, step };
}

function applyCasing(base: string, casing: NameCasing): string {
    if (casing === 'upper') return base.toUpperCase();
    if (casing === 'lower') return base;
    return base.charAt(0).toUpperCase() + base.slice(1);
}

function fillNameSeries(series: NameSeries, count: number): string[] {
    const len = series.table.full.length;
    return Array.from({ length: count }, (_, i) => {
        const index = mod(series.lastIndex + series.step * (i + 1), len);
        const base = series.form === 'abbr' ? series.table.abbr[index] : series.table.full[index];
        return applyCasing(base, series.casing);
    });
}

/**
 * Extrapolate `count` more values from a fill source (Excel-style drag-to-fill).
 * Detection order (per column): arithmetic numbers → dates (day or month step,
 * ISO strings or `Date` objects) → weekday names → month names →
 * trailing-number text (padding preserved) → cycle the source pattern.
 * Names and date formats preserve the source's style/casing.
 */
export function buildFillValues(source: unknown[], count: number): unknown[] {
    if (count <= 0) return [];
    if (source.length === 0) return new Array(count).fill('');

    const numeric = toNumberSeries(source);
    if (numeric) return fillNumericSeries(numeric, count);

    const dates = detectDateSeries(source);
    if (dates) return fillDateSeries(dates, count);

    const weekdays = detectNameSeries(source, WEEKDAY_NAMES);
    if (weekdays) return fillNameSeries(weekdays, count);

    const months = detectNameSeries(source, MONTH_NAMES);
    if (months) return fillNameSeries(months, count);

    const trailing = detectTrailingNumbers(source);
    if (trailing) return fillTrailingNumbers(trailing, count);

    return cycleValues(source, count);
}

function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    while (i < line.length) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += ch;
        }
        i++;
    }
    cells.push(current);
    return cells;
}

/**
 * Parse clipboard text into a grid of cell strings. Tab-separated when any tab
 * is present (Excel / the table's own copy-out), otherwise comma-separated with
 * quoted-cell support. A single trailing newline is dropped.
 */
export function parseClipboardGrid(text: string): string[][] {
    if (text === '') return [];
    const normalized = text.replaceAll(/\r\n?/g, '\n');
    const body = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;
    const lines = body.split('\n');
    if (lines.some((line) => line.includes('\t'))) {
        return lines.map((line) => line.split('\t'));
    }
    return lines.map(parseCsvLine);
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

// ── Advanced filter evaluation (A5) ──
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

// ── Pivot transform (A6) ──
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
