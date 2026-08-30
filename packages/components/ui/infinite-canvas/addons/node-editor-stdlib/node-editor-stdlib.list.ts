/**
 * Lists.
 *
 * `Pluck` is the one to notice: it is a map over a list without being a
 * higher-order node. Reading one field off every row covers most of what
 * people actually reach for a map to do — turning a table's rows into a list
 * of names, or a schema's columns into a list of column names — and it needs
 * no way to pass a graph as a value.
 */
import type { NodeTypeDefinition } from '../node-editor';
import { asList, asNumber, asRecord, asText } from './node-editor-stdlib.coerce';

const ACCENT = '#ec4899';
const CATEGORY = 'List';

/** Many wires in, one list out — the counterpart of `Join text`. */
export const STD_LIST: NodeTypeDefinition = {
  id: 'std-list',
  label: 'Make list',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'items', direction: 'in', label: 'Items', multiple: true, multi: 'collect' },
    { id: 'out', direction: 'out', label: 'List', type: 'list' },
  ],
  compute: inputs => ({ out: [...asList(inputs['items'])] }),
};

export const STD_LIST_LENGTH: NodeTypeDefinition = {
  id: 'std-list-length',
  label: 'List length',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'List', type: 'list' },
    { id: 'out', direction: 'out', label: 'Length', type: 'number' },
  ],
  compute: inputs => ({ out: asList(inputs['in']).length }),
};

export const STD_LIST_JOIN: NodeTypeDefinition = {
  id: 'std-list-join',
  label: 'Join list',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'List', type: 'list' },
    { id: 'separator', direction: 'in', label: 'Separator', type: 'text', default: ', ' },
    { id: 'out', direction: 'out', label: 'Text', type: 'text' },
  ],
  compute: inputs => ({
    out: asList(inputs['in']).map(asText).join(asText(inputs['separator'])),
  }),
};

/** One item, counted from 0. Negative counts back from the end. */
export const STD_LIST_ITEM: NodeTypeDefinition = {
  id: 'std-list-item',
  label: 'List item',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'List', type: 'list' },
    { id: 'index', direction: 'in', label: 'Index', type: 'number', default: 0 },
    { id: 'out', direction: 'out', label: 'Item' },
  ],
  compute: inputs => ({ out: asList(inputs['in']).at(Math.trunc(asNumber(inputs['index']))) }),
};

/** One field off every item — a map, without needing a graph as a value. */
export const STD_PLUCK: NodeTypeDefinition = {
  id: 'std-pluck',
  label: 'Pluck field',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'List', type: 'list' },
    { id: 'key', direction: 'in', label: 'Field', type: 'text' },
    { id: 'out', direction: 'out', label: 'List', type: 'list' },
  ],
  compute: inputs => {
    const key = asText(inputs['key']);
    return { out: asList(inputs['in']).map(item => asRecord(item)[key]) };
  },
};

/**
 * Sorted, by text or by number.
 *
 * A copy, because `sort` sorts in place and the incoming array belongs to the
 * node upstream. Numbers compare numerically rather than as text, or 10 sorts
 * before 9 and nobody believes the graph again.
 */
export const STD_SORT: NodeTypeDefinition = {
  id: 'std-sort',
  label: 'Sort list',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'List', type: 'list' },
    { id: 'out', direction: 'out', label: 'List', type: 'list' },
  ],
  compute: inputs => {
    // Copied first: `sort` reorders in place, and the array belongs to the
    // node upstream — sorting it would change a value another branch of the
    // graph has already been handed. (`toSorted` would say this in one word,
    // but it is not in this project's TypeScript lib.)
    const items = [...asList(inputs['in'])];
    const allNumbers = items.every(item => typeof item === 'number');
    if (allNumbers) {
      items.sort((a, b) => asNumber(a) - asNumber(b));
      return { out: items };
    }
    items.sort((a, b) => asText(a).localeCompare(asText(b)));
    return { out: items };
  },
};

export const STD_LIST_NODES: readonly NodeTypeDefinition[] = [
  STD_LIST,
  STD_LIST_LENGTH,
  STD_LIST_JOIN,
  STD_LIST_ITEM,
  STD_PLUCK,
  STD_SORT,
];
