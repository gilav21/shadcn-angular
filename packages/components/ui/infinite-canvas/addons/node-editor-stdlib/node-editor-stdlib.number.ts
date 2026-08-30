/**
 * Arithmetic.
 *
 * Absent inputs coerce to `0` (see `asNumber`), so a half-wired Add is a
 * pass-through rather than a `NaN` that spreads through the rest of the graph
 * and leaves no trace of where it started.
 */
import type { NodeTypeDefinition } from '../node-editor';
import { asNumber } from './node-editor-stdlib.coerce';

const ACCENT = '#f59e0b';
const CATEGORY = 'Number';

/** `a` and `b` in, one number out — the shape all four operators take. */
function binary(
  id: string,
  label: string,
  apply: (a: number, b: number) => number,
): NodeTypeDefinition {
  return {
    id,
    label,
    category: CATEGORY,
    accent: ACCENT,
    ports: [
      { id: 'a', direction: 'in', label: 'A', type: 'number' },
      { id: 'b', direction: 'in', label: 'B', type: 'number' },
      { id: 'out', direction: 'out', label: 'Result', type: 'number' },
    ],
    compute: inputs => ({ out: apply(asNumber(inputs['a']), asNumber(inputs['b'])) }),
  };
}

export const STD_ADD = binary('std-add', 'Add', (a, b) => a + b);
export const STD_SUBTRACT = binary('std-subtract', 'Subtract', (a, b) => a - b);
export const STD_MULTIPLY = binary('std-multiply', 'Multiply', (a, b) => a * b);

/**
 * Divide, answering `0` rather than `Infinity` when the divisor is missing.
 *
 * An unconnected divisor is `0` by the coercion rule above, and `x / 0` is
 * `Infinity` — a number that formats as "Infinity" three nodes later and tells
 * nobody that a wire was missing. Zero is not mathematically right either, but
 * it stays in the range of every node downstream.
 */
export const STD_DIVIDE = binary('std-divide', 'Divide', (a, b) => (b === 0 ? 0 : a / b));

/** Round to a number of decimal places. */
export const STD_ROUND: NodeTypeDefinition = {
  id: 'std-round',
  label: 'Round',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Number', type: 'number' },
    { id: 'places', direction: 'in', label: 'Decimals', type: 'number', default: 0 },
    { id: 'out', direction: 'out', label: 'Result', type: 'number' },
  ],
  compute: inputs => {
    const places = Math.trunc(asNumber(inputs['places']));
    // Clamped because 10 ** 400 is Infinity, and the multiply/divide below
    // would then answer NaN for a perfectly ordinary number.
    const safePlaces = Math.min(Math.max(places, 0), 15);
    const factor = 10 ** safePlaces;
    return { out: Math.round(asNumber(inputs['in']) * factor) / factor };
  },
};

/** Hold a number between a floor and a ceiling. */
export const STD_CLAMP: NodeTypeDefinition = {
  id: 'std-clamp',
  label: 'Clamp',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Number', type: 'number' },
    { id: 'min', direction: 'in', label: 'Min', type: 'number', default: 0 },
    { id: 'max', direction: 'in', label: 'Max', type: 'number', default: 1 },
    { id: 'out', direction: 'out', label: 'Result', type: 'number' },
  ],
  compute: inputs => {
    const low = asNumber(inputs['min']);
    const high = asNumber(inputs['max']);
    // Swapped bounds are a wiring slip, not a reason to answer nothing.
    const floor = Math.min(low, high);
    const ceiling = Math.max(low, high);
    return { out: Math.min(Math.max(asNumber(inputs['in']), floor), ceiling) };
  },
};

export const STD_NUMBER_NODES: readonly NodeTypeDefinition[] = [
  STD_ADD,
  STD_SUBTRACT,
  STD_MULTIPLY,
  STD_DIVIDE,
  STD_ROUND,
  STD_CLAMP,
];
