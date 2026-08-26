/**
 * What a value becomes when it arrives on a port that wanted something else.
 *
 * Port `type` tags stop most mismatches at the wire, but not all of them: a
 * port with no tag accepts anything, an unconnected input arrives as
 * `undefined`, and a subgraph boundary carries whatever was pushed in. So every
 * node in this library states, in one place, what it does with a value it did
 * not expect — rather than each `compute` inventing its own rule and the graph
 * behaving differently depending on which node you reached.
 *
 * The rule throughout: **an absent value is the empty one, never an error.**
 * A half-built graph is the normal state of a graph being built, and a toolbox
 * that throws while you are still wiring it up is a toolbox people stop using.
 */

/** A plain object, which is the only thing the object nodes will touch. */
export type Recordish = Readonly<Record<string, unknown>>;

/**
 * Text, for a value that may not be text.
 *
 * Objects go through JSON rather than `String()`, which would render every one
 * of them as `[object Object]` — the least useful string in the language.
 */
export function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return safeJson(value);
}

/**
 * A number, for a value that may not be one.
 *
 * Absent is `0` rather than `NaN`: an unconnected addend should leave the sum
 * alone, and `NaN` poisons every node downstream of it with a value no one can
 * trace back. A string that genuinely is not a number still gives `NaN`, which
 * is a real answer to a real mistake.
 */
export function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  return Number.parseFloat(asText(value));
}

/**
 * A boolean, for a value that may not be one.
 *
 * `'false'` is `false`, which JavaScript disagrees with. It is here because
 * text arriving from a field, a query string or a database column says
 * `"false"` far more often than it means "a non-empty string".
 */
export function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value !== '' && value.toLowerCase() !== 'false';
  return Boolean(value);
}

/**
 * A list, for a value that may not be one.
 *
 * A lone value becomes a list of one rather than an empty list, so a node that
 * happens to receive a single item still does something sensible with it.
 */
export function asList(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

/** A plain object, for a value that may not be one. Arrays are NOT objects here. */
export function asRecord(value: unknown): Recordish {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  if (value instanceof Date) return {};
  return value as Recordish;
}

/**
 * JSON that cannot throw.
 *
 * `JSON.stringify` throws on a cycle, and a node that throws while someone is
 * mid-wiring takes the run down. A cycle is worth naming rather than hiding,
 * so it says so instead of returning empty.
 */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    // The only realistic cause is a circular structure.
    return '[circular]';
  }
}
