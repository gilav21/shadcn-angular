/**
 * Aggregate function applied at each pivot cell. `count` counts the source rows
 * that fall in the cell, whatever their values. The others read only numeric
 * values — numbers and non-blank numeric strings; `null`, `undefined`, blank
 * strings, booleans and other text are skipped. Over no numeric values `sum` is
 * `0` and `avg` / `min` / `max` are `null` (a blank cell), so a missing value is
 * never mistaken for a zero.
 */
export type PivotAggregate = 'sum' | 'avg' | 'count' | 'min' | 'max';

/** Config for {@link computePivot}: row dimension(s) x one column dimension x one value. */
export interface PivotConfig {
  /** Column keys whose distinct combinations form the pivot rows. */
  rows: string[];
  /** Column key whose distinct values spread across the pivot columns. */
  column: string;
  /** Column key whose values are aggregated at each (row x column) cell. */
  value: string;
  aggregate: PivotAggregate;
  /** Add a trailing "Total" column aggregating across the row. */
  showRowTotals?: boolean;
}

export interface PivotColumn {
  key: string;
  header: string;
}

export interface PivotResult {
  columns: PivotColumn[];
  rows: Record<string, unknown>[];
  /** The dynamic pivot-column keys (excludes the row-dimension and total columns). */
  pivotColumnKeys: string[];
}

const PIVOT_KEY_PREFIX = 'pivot:';
const PIVOT_TOTAL_KEY = '__total__';

function defaultGetValue(row: unknown, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

/**
 * The cell value as a number, or `null` when it holds no number. `Number()` alone
 * is not enough: it turns `null`, `''`, whitespace and `false` into `0`.
 */
function toAggregatableNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function aggregateNumbers(values: number[], fn: PivotAggregate): number | null {
  if (fn === 'count') return values.length;
  const sum = values.reduce((a, b) => a + b, 0);
  if (fn === 'sum') return sum;
  if (values.length === 0) return null;
  switch (fn) {
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
): number | null {
  if (config.aggregate === 'count') return rows.length;
  const nums: number[] = [];
  for (const row of rows) {
    const n = toAggregatableNumber(getValue(row, config.value));
    if (n !== null) nums.push(n);
  }
  return aggregateNumbers(nums, config.aggregate);
}

/**
 * Transform a flat dataset into a pivot table (rows x columns x values). The
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
    // A joined string is ambiguous ('a b' + 'c' vs 'a' + 'b c'); a JSON array is
    // not. Values compare as strings, the same equality the column dimension uses.
    const groupKey = JSON.stringify(dimValues.map(String));
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
