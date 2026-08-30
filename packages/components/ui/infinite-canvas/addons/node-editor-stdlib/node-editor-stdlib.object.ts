/**
 * Building and taking apart structured values.
 *
 * These are the nodes that make a subgraph able to answer with more than one
 * thing. A boundary output takes a single wire, and fanning two wires into it
 * would only ever give a list of two values sitting next to each other — which
 * is not the same as one value that carries both. `Set field` is how the two
 * travel together, and `Get field` is how they come apart again.
 *
 * Chained rather than variadic:
 *
 *     Empty object → Set field(text) → Set field(color) → Output
 *
 * A single "make object" node would need its field names to become ports,
 * which the runtime can do (`portsFor`), but only with somewhere to type the
 * names — and that is a view, which this library deliberately does not have.
 * Chaining costs a node per field and needs no UI at all.
 */
import type { NodeTypeDefinition } from '../node-editor';
import { asRecord, asText, type Recordish } from './node-editor-stdlib.coerce';

const ACCENT = '#10b981';
const CATEGORY = 'Object';

/** An object with nothing in it — where a chain of `Set field` starts. */
export const STD_EMPTY_OBJECT: NodeTypeDefinition = {
  id: 'std-empty-object',
  label: 'Empty object',
  category: CATEGORY,
  accent: ACCENT,
  ports: [{ id: 'out', direction: 'out', label: 'Object', type: 'object' }],
  compute: () => ({ out: {} }),
};

/**
 * One field added to an object, returning a new object.
 *
 * Copied rather than mutated: the incoming object is another node's output,
 * and the runtime memoises on it. Writing into it would change a value another
 * branch of the graph has already been handed.
 */
export const STD_SET_FIELD: NodeTypeDefinition = {
  id: 'std-set-field',
  label: 'Set field',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'object', direction: 'in', label: 'Object', type: 'object' },
    { id: 'key', direction: 'in', label: 'Field', type: 'text' },
    { id: 'value', direction: 'in', label: 'Value' },
    { id: 'out', direction: 'out', label: 'Object', type: 'object' },
  ],
  compute: inputs => {
    const key = asText(inputs['key']);
    const source = asRecord(inputs['object']);
    // A nameless field would write a key of "", which is legal and useless.
    if (key === '') return { out: source };
    return { out: { ...source, [key]: inputs['value'] } satisfies Recordish };
  },
};

/** One field read back out. Absent is `undefined`, which reads as "—" downstream. */
export const STD_GET_FIELD: NodeTypeDefinition = {
  id: 'std-get-field',
  label: 'Get field',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'object', direction: 'in', label: 'Object', type: 'object' },
    { id: 'key', direction: 'in', label: 'Field', type: 'text' },
    { id: 'out', direction: 'out', label: 'Value' },
  ],
  compute: inputs => ({ out: asRecord(inputs['object'])[asText(inputs['key'])] }),
};

/** Two objects into one. The second wins where they disagree. */
export const STD_MERGE: NodeTypeDefinition = {
  id: 'std-merge',
  label: 'Merge objects',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'a', direction: 'in', label: 'Base', type: 'object' },
    { id: 'b', direction: 'in', label: 'Over', type: 'object' },
    { id: 'out', direction: 'out', label: 'Object', type: 'object' },
  ],
  compute: inputs => ({ out: { ...asRecord(inputs['a']), ...asRecord(inputs['b']) } }),
};

/** The field names, as a list — for looking at an object of unknown shape. */
export const STD_KEYS: NodeTypeDefinition = {
  id: 'std-keys',
  label: 'Field names',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'object', direction: 'in', label: 'Object', type: 'object' },
    { id: 'out', direction: 'out', label: 'List', type: 'list' },
  ],
  compute: inputs => ({ out: Object.keys(asRecord(inputs['object'])) }),
};

export const STD_OBJECT_NODES: readonly NodeTypeDefinition[] = [
  STD_EMPTY_OBJECT,
  STD_SET_FIELD,
  STD_GET_FIELD,
  STD_MERGE,
  STD_KEYS,
];
