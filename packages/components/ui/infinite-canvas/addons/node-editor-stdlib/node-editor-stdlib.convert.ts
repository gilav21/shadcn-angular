/**
 * Crossing between types, and dates.
 *
 * Port `type` tags refuse a wire between a number output and a text input,
 * which is the right default and would be infuriating without these: the
 * converters are the sanctioned way through, and being explicit nodes means
 * the conversion is visible in the graph rather than implied by it.
 */
import type { NodeTypeDefinition } from '../node-editor';
import { asBoolean, asNumber, asText } from './node-editor-stdlib.coerce';

const ACCENT = '#64748b';
const CATEGORY = 'Convert';

export const STD_TO_TEXT: NodeTypeDefinition = {
  id: 'std-to-text',
  label: 'To text',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Value' },
    { id: 'out', direction: 'out', label: 'Text', type: 'text' },
  ],
  compute: inputs => ({ out: asText(inputs['in']) }),
};

export const STD_TO_NUMBER: NodeTypeDefinition = {
  id: 'std-to-number',
  label: 'To number',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Value' },
    { id: 'out', direction: 'out', label: 'Number', type: 'number' },
  ],
  compute: inputs => ({ out: asNumber(inputs['in']) }),
};

export const STD_TO_BOOLEAN: NodeTypeDefinition = {
  id: 'std-to-boolean',
  label: 'To true/false',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Value' },
    { id: 'out', direction: 'out', label: 'Result', type: 'boolean' },
  ],
  compute: inputs => ({ out: asBoolean(inputs['in']) }),
};

/**
 * Text into whatever it describes.
 *
 * Bad JSON answers `undefined` rather than throwing: pasting a half-finished
 * string into a field is a normal step on the way to a finished one, and it
 * should not take the run down.
 */
export const STD_PARSE_JSON: NodeTypeDefinition = {
  id: 'std-parse-json',
  label: 'Parse JSON',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Text', type: 'text' },
    { id: 'out', direction: 'out', label: 'Value' },
  ],
  compute: inputs => {
    try {
      return { out: JSON.parse(asText(inputs['in'])) as unknown };
    } catch {
      // Half-typed JSON is a normal intermediate state, not a failure.
      return { out: undefined };
    }
  },
};

/**
 * The current time.
 *
 * Reads the clock when it runs, which makes it the one node here that is not a
 * pure function of its inputs. It is in this library rather than left to the
 * application because almost every graph wants it, and because a node with an
 * `at` input is testable in a way that reading the clock inside another node
 * is not.
 */
export const STD_NOW: NodeTypeDefinition = {
  id: 'std-now',
  label: 'Now',
  category: CATEGORY,
  accent: ACCENT,
  ports: [{ id: 'out', direction: 'out', label: 'Time', type: 'number' }],
  compute: () => ({ out: Date.now() }),
};

/**
 * A time, as text someone can read, in the viewer's locale.
 *
 * `Intl` rather than a format string: a hand-rolled `YYYY-MM-DD` is wrong for
 * most of the people who will read it, and the library already takes locale
 * seriously everywhere else.
 */
export const STD_FORMAT_TIME: NodeTypeDefinition = {
  id: 'std-format-time',
  label: 'Format time',
  category: CATEGORY,
  accent: ACCENT,
  ports: [
    { id: 'in', direction: 'in', label: 'Time', type: 'number' },
    { id: 'locale', direction: 'in', label: 'Locale', type: 'text' },
    { id: 'out', direction: 'out', label: 'Text', type: 'text' },
  ],
  compute: inputs => {
    const when = new Date(asNumber(inputs['in']));
    if (Number.isNaN(when.getTime())) return { out: '' };
    const locale = asText(inputs['locale']);
    try {
      return { out: when.toLocaleString(locale === '' ? undefined : locale) };
    } catch {
      // An invalid locale tag throws RangeError; the default is a better
      // answer than no answer.
      return { out: when.toLocaleString() };
    }
  },
};

export const STD_CONVERT_NODES: readonly NodeTypeDefinition[] = [
  STD_TO_TEXT,
  STD_TO_NUMBER,
  STD_TO_BOOLEAN,
  STD_PARSE_JSON,
  STD_NOW,
  STD_FORMAT_TIME,
];
