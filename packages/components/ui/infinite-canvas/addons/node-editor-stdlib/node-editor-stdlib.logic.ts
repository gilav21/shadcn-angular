/**
 * Comparison and choice.
 *
 * `Select` is the only branching this library offers, and deliberately: it
 * picks between two values that both already exist, which is still dataflow.
 * Loops, recursion and conditional execution are not here, because a graph
 * that grows them stops being a graph you can read and becomes a worse text
 * editor.
 */
import type { NodeTypeDefinition } from '../node-editor';
import { asBoolean, asList, asNumber, asText } from './node-editor-stdlib.coerce';

const ACCENT = '#8b5cf6';
const CATEGORY = 'Logic';

/**
 * Equality across types, comparing by value.
 *
 * Deliberately not `Object.is` on the raw inputs: the number `1` arriving from
 * arithmetic and the text `"1"` arriving from a field are the same answer to a
 * person looking at the graph, and a node editor that says otherwise sends
 * them hunting for a converter that changes nothing they can see.
 */
export const STD_EQUALS: NodeTypeDefinition = {
  id: 'std-equals',
  label: 'Equals',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'a', direction: 'in', label: 'A' },
    { id: 'b', direction: 'in', label: 'B' },
    { id: 'out', direction: 'out', label: 'Equal', type: 'boolean' },
  ],
  compute: inputs => {
    const a = inputs['a'];
    const b = inputs['b'];
    if (typeof a === 'number' || typeof b === 'number') {
      return { out: asNumber(a) === asNumber(b) };
    }
    return { out: asText(a) === asText(b) };
  },
};

/** `a` and `b` in, a boolean out — the shape the comparisons take. */
function compare(
  id: string,
  label: string,
  apply: (a: number, b: number) => boolean,
): NodeTypeDefinition {
  return {
    id,
    label,
    category: CATEGORY,
    accent: ACCENT,
    ports: [
      { id: 'a', direction: 'in', label: 'A', type: 'number' },
      { id: 'b', direction: 'in', label: 'B', type: 'number' },
      { id: 'out', direction: 'out', label: 'Result', type: 'boolean' },
    ],
    compute: inputs => ({ out: apply(asNumber(inputs['a']), asNumber(inputs['b'])) }),
  };
}

export const STD_GREATER = compare('std-greater', 'Greater than', (a, b) => a > b);
export const STD_LESS = compare('std-less', 'Less than', (a, b) => a < b);

export const STD_NOT: NodeTypeDefinition = {
  id: 'std-not',
  label: 'Not',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Value', type: 'boolean' },
    { id: 'out', direction: 'out', label: 'Result', type: 'boolean' },
  ],
  compute: inputs => ({ out: !asBoolean(inputs['in']) }),
};

/** Many wires in, one boolean out. Empty is `true` — nothing is unsatisfied. */
export const STD_ALL: NodeTypeDefinition = {
  id: 'std-all',
  label: 'All true',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    {
      id: 'values',
      direction: 'in',
      label: 'Values',
      type: 'boolean',
      multiple: true,
      multi: 'collect',
    },
    { id: 'out', direction: 'out', label: 'Result', type: 'boolean' },
  ],
  compute: inputs => ({ out: asList(inputs['values']).every(asBoolean) }),
};

/** Many wires in, one boolean out. Empty is `false` — nothing is satisfied. */
export const STD_ANY: NodeTypeDefinition = {
  id: 'std-any',
  label: 'Any true',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    {
      id: 'values',
      direction: 'in',
      label: 'Values',
      type: 'boolean',
      multiple: true,
      multi: 'collect',
    },
    { id: 'out', direction: 'out', label: 'Result', type: 'boolean' },
  ],
  compute: inputs => ({ out: asList(inputs['values']).some(asBoolean) }),
};

/**
 * One of two values, by a condition.
 *
 * Both branches are evaluated — this chooses a value, it does not choose which
 * part of the graph runs. That distinction is the whole reason it is safe to
 * have here.
 */
export const STD_SELECT: NodeTypeDefinition = {
  id: 'std-select',
  label: 'Select',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'condition', direction: 'in', label: 'If', type: 'boolean' },
    { id: 'whenTrue', direction: 'in', label: 'Then' },
    { id: 'whenFalse', direction: 'in', label: 'Else' },
    { id: 'out', direction: 'out', label: 'Value' },
  ],
  compute: inputs => ({
    out: asBoolean(inputs['condition']) ? inputs['whenTrue'] : inputs['whenFalse'],
  }),
};

export const STD_LOGIC_NODES: readonly NodeTypeDefinition[] = [
  STD_EQUALS,
  STD_GREATER,
  STD_LESS,
  STD_NOT,
  STD_ALL,
  STD_ANY,
  STD_SELECT,
];
