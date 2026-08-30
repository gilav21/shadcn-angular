/**
 * Text operations.
 *
 * Every one of these is a pure function of its inputs with no view and no
 * state, which is the shape the runtime spec says a node type should be able
 * to reach in four lines. They are here so that a person building a transformer
 * out of a subgraph has something to build it FROM — the editor could always
 * run a graph, but until now the only things to put in one were the demo's own
 * examples.
 */
import type { NodeTypeDefinition } from '../node-editor';
import { asList, asNumber, asText } from './node-editor-stdlib.coerce';

const ACCENT = '#0ea5e9';
const CATEGORY = 'Text';

/** `in` → `out`, the shape most of these take. */
function textToText(
  id: string,
  label: string,
  transform: (text: string) => string,
): NodeTypeDefinition {
  return {
    id,
    label,
    category: CATEGORY,
    accent: ACCENT,
    ports: [
      { id: 'in', direction: 'in', label: 'Text', type: 'text' },
      { id: 'out', direction: 'out', label: 'Text', type: 'text' },
    ],
    compute: inputs => ({ out: transform(asText(inputs['in'])) }),
  };
}

export const STD_UPPER = textToText('std-upper', 'Upper case', text => text.toUpperCase());
export const STD_LOWER = textToText('std-lower', 'Lower case', text => text.toLowerCase());
export const STD_TRIM = textToText('std-trim', 'Trim', text => text.trim());

/**
 * Text length.
 *
 * `[...text].length`, not `text.length`: the second counts UTF-16 code units,
 * so an emoji counts as two and any text outside the basic plane is reported
 * wrong. Code points are what a person means by "how many characters".
 */
export const STD_TEXT_LENGTH: NodeTypeDefinition = {
  id: 'std-text-length',
  label: 'Text length',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Text', type: 'text' },
    { id: 'out', direction: 'out', label: 'Length', type: 'number' },
  ],
  compute: inputs => ({ out: [...asText(inputs['in'])].length }),
};

/**
 * Join many texts into one.
 *
 * The `parts` port takes MANY wires — `multiple` so the editor accepts the
 * second one, `multi: 'collect'` so the runtime hands them over as an array in
 * connection order. Both are needed and they are separate fields; either one
 * alone gives a port that looks right and does the wrong thing.
 */
export const STD_JOIN: NodeTypeDefinition = {
  id: 'std-join',
  label: 'Join text',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    {
      id: 'parts',
      direction: 'in',
      label: 'Parts',
      type: 'text',
      multiple: true,
      multi: 'collect',
    },
    { id: 'separator', direction: 'in', label: 'Separator', type: 'text', default: '' },
    { id: 'out', direction: 'out', label: 'Text', type: 'text' },
  ],
  compute: inputs => ({
    out: asList(inputs['parts']).map(asText).join(asText(inputs['separator'])),
  }),
};

/** Replace every occurrence, not just the first — the usual intent. */
export const STD_REPLACE: NodeTypeDefinition = {
  id: 'std-replace',
  label: 'Replace',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Text', type: 'text' },
    { id: 'find', direction: 'in', label: 'Find', type: 'text' },
    { id: 'replacement', direction: 'in', label: 'With', type: 'text', default: '' },
    { id: 'out', direction: 'out', label: 'Text', type: 'text' },
  ],
  compute: inputs => {
    const find = asText(inputs['find']);
    const text = asText(inputs['in']);
    // Replacing the empty string inserts between every character, which is
    // never what someone wiring this up wanted.
    if (find === '') return { out: text };
    return { out: text.replaceAll(find, asText(inputs['replacement'])) };
  },
};

export const STD_SPLIT: NodeTypeDefinition = {
  id: 'std-split',
  label: 'Split',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Text', type: 'text' },
    { id: 'separator', direction: 'in', label: 'Separator', type: 'text', default: ',' },
    { id: 'out', direction: 'out', label: 'List', type: 'list' },
  ],
  compute: inputs => ({ out: asText(inputs['in']).split(asText(inputs['separator'])) }),
};

/** A slice of text, by code point, so it cannot cut an emoji in half. */
export const STD_SLICE: NodeTypeDefinition = {
  id: 'std-slice',
  label: 'Slice text',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Text', type: 'text' },
    { id: 'start', direction: 'in', label: 'Start', type: 'number', default: 0 },
    { id: 'end', direction: 'in', label: 'End', type: 'number' },
    { id: 'out', direction: 'out', label: 'Text', type: 'text' },
  ],
  compute: inputs => {
    const points = [...asText(inputs['in'])];
    const start = Math.trunc(asNumber(inputs['start']));
    const end = inputs['end'] === undefined ? points.length : Math.trunc(asNumber(inputs['end']));
    return { out: points.slice(start, end).join('') };
  },
};

/**
 * Fill `{name}` placeholders from an object.
 *
 * The one node here that reaches for a regex, and the reason it is worth it:
 * without it, building a sentence out of three values means three Join nodes
 * and a lot of wire.
 */
export const STD_TEMPLATE: NodeTypeDefinition = {
  id: 'std-template',
  label: 'Fill template',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'template', direction: 'in', label: 'Template', type: 'text' },
    { id: 'values', direction: 'in', label: 'Values', type: 'object' },
    { id: 'out', direction: 'out', label: 'Text', type: 'text' },
  ],
  compute: inputs => {
    const values = inputs['values'];
    const source =
      typeof values === 'object' && values !== null
        ? (values as Record<string, unknown>)
        : {};
    const filled = asText(inputs['template']).replaceAll(
      /\{(\w+)\}/g,
      (whole, key: string) => (key in source ? asText(source[key]) : whole),
    );
    return { out: filled };
  },
};

export const STD_TEXT_NODES: readonly NodeTypeDefinition[] = [
  STD_UPPER,
  STD_LOWER,
  STD_TRIM,
  STD_TEXT_LENGTH,
  STD_JOIN,
  STD_REPLACE,
  STD_SPLIT,
  STD_SLICE,
  STD_TEMPLATE,
];
