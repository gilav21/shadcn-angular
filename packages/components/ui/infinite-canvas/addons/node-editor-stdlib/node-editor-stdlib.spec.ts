// The standard library.
//
// Two kinds of test here. Most are the boring, necessary kind: each node does
// what it says, including for the value it did not expect. The interesting one
// is at the bottom — the whole point of this library is that a user can now
// compose a transformer that nobody wrote, so that gets built and run in a
// real runtime rather than asserted a piece at a time.
import { describe, it, expect } from 'vitest';
import {
    NodeGraphRuntime,
    type EditorNode,
    type NodeConnection,
    type NodeTypeDefinition,
    type PortValues,
} from '../node-editor';
import {
    STDLIB_NODE_TYPES,
    STD_ADD,
    STD_ALL,
    STD_ANY,
    STD_CLAMP,
    STD_DIVIDE,
    STD_EMPTY_OBJECT,
    STD_EQUALS,
    STD_FORMAT_TIME,
    STD_GET_FIELD,
    STD_GREATER,
    STD_LESS,
    STD_LIST_LENGTH,
    STD_NOT,
    STD_NOW,
    STD_TO_BOOLEAN,
    STD_JOIN,
    STD_KEYS,
    STD_LIST,
    STD_LIST_ITEM,
    STD_LIST_JOIN,
    STD_MERGE,
    STD_PARSE_JSON,
    STD_PLUCK,
    STD_REPLACE,
    STD_ROUND,
    STD_SELECT,
    STD_SET_FIELD,
    STD_SLICE,
    STD_SORT,
    STD_SPLIT,
    STD_TEMPLATE,
    STD_TEXT_LENGTH,
    STD_TO_NUMBER,
    STD_TO_TEXT,
    STD_UPPER,
    asBoolean,
    asList,
    asNumber,
    asRecord,
    asText,
} from './index';

/** Run a node's `compute` with nothing but its inputs. */
function run(definition: NodeTypeDefinition, inputs: PortValues): PortValues {
    const compute = definition.compute;
    if (!compute) throw new Error(`${definition.id} has no compute`);
    const result = compute(inputs, {
        state: undefined,
        signal: new AbortController().signal,
        setState: () => undefined,
        emit: () => undefined,
    });
    if (result instanceof Promise || Symbol.asyncIterator in Object(result)) {
        throw new Error(`${definition.id} is not synchronous`);
    }
    return result as PortValues;
}

/** The single output of a one-output node. */
function out(definition: NodeTypeDefinition, inputs: PortValues): unknown {
    return run(definition, inputs)['out'];
}

describe('coercions', () => {
    it('turns absent into the empty value, never an error', () => {
        expect(asText(undefined)).toBe('');
        expect(asNumber(undefined)).toBe(0);
        expect(asBoolean(undefined)).toBe(false);
        expect(asList(undefined)).toEqual([]);
        expect(asRecord(undefined)).toEqual({});
    });

    it('renders an object as JSON rather than [object Object]', () => {
        expect(asText({ a: 1 })).toBe('{"a":1}');
    });

    it('survives a circular object instead of throwing', () => {
        const cyclic: Record<string, unknown> = {};
        cyclic['self'] = cyclic;

        expect(asText(cyclic)).toBe('[circular]');
    });

    /** Text from a field or a database column says "false" and means it. */
    it('reads the text "false" as false', () => {
        expect(asBoolean('false')).toBe(false);
        expect(asBoolean('False')).toBe(false);
        expect(asBoolean('no')).toBe(true);
    });

    it('wraps a lone value as a list of one', () => {
        expect(asList('a')).toEqual(['a']);
    });

    /** Anything not named above falls through to plain truthiness. */
    it('reads an object as true and nothing as false', () => {
        expect(asBoolean({})).toBe(true);
        expect(asBoolean([])).toBe(true);
    });

    it('does not treat an array or a date as a record', () => {
        expect(asRecord([1, 2])).toEqual({});
        expect(asRecord(new Date())).toEqual({});
    });
});

describe('text nodes', () => {
    it('upper-cases', () => {
        expect(out(STD_UPPER, { in: 'hello' })).toBe('HELLO');
    });

    /** Code points, not UTF-16 units — an emoji is one character to a person. */
    it('counts an emoji as one character', () => {
        expect(out(STD_TEXT_LENGTH, { in: 'a🙂b' })).toBe(3);
    });

    it('slices without cutting an emoji in half', () => {
        expect(out(STD_SLICE, { in: 'a🙂b', start: 1, end: 2 })).toBe('🙂');
    });

    it('replaces every occurrence, not just the first', () => {
        expect(out(STD_REPLACE, { in: 'a-b-c', find: '-', replacement: '+' })).toBe('a+b+c');
    });

    /** Replacing "" would insert between every character. */
    it('leaves the text alone when there is nothing to find', () => {
        expect(out(STD_REPLACE, { in: 'abc', find: '', replacement: 'X' })).toBe('abc');
    });

    it('splits into a list', () => {
        expect(out(STD_SPLIT, { in: 'a,b', separator: ',' })).toEqual(['a', 'b']);
    });

    it('fills named placeholders and leaves unknown ones visible', () => {
        expect(out(STD_TEMPLATE, { template: 'Hi {name}, {x}', values: { name: 'Ada' } })).toBe(
            'Hi Ada, {x}',
        );
    });

    it('joins many wired parts in connection order', () => {
        expect(out(STD_JOIN, { parts: ['a', 'b', 'c'], separator: '-' })).toBe('a-b-c');
    });
});

describe('number nodes', () => {
    it('adds', () => {
        expect(out(STD_ADD, { a: 2, b: 3 })).toBe(5);
    });

    /** An unwired addend is 0, so a half-built Add passes its value through. */
    it('treats a missing input as zero rather than NaN', () => {
        expect(out(STD_ADD, { a: 2 })).toBe(2);
    });

    /** Infinity formats as "Infinity" three nodes later and explains nothing. */
    it('answers zero rather than Infinity when dividing by nothing', () => {
        expect(out(STD_DIVIDE, { a: 5, b: 0 })).toBe(0);
    });

    it('rounds to decimals', () => {
        expect(out(STD_ROUND, { in: 3.14159, places: 2 })).toBeCloseTo(3.14, 10);
    });

    /** 10 ** 400 is Infinity, which would make an ordinary number answer NaN. */
    it('survives an absurd number of decimals', () => {
        expect(out(STD_ROUND, { in: 3.5, places: 400 })).toBe(3.5);
    });

    it('clamps, and copes with the bounds wired backwards', () => {
        expect(out(STD_CLAMP, { in: 12, min: 0, max: 10 })).toBe(10);
        expect(out(STD_CLAMP, { in: 12, min: 10, max: 0 })).toBe(10);
    });
});

describe('logic nodes', () => {
    it('compares a number and its text by value', () => {
        expect(out(STD_EQUALS, { a: 1, b: '1' })).toBe(true);
        expect(out(STD_EQUALS, { a: 'a', b: 'b' })).toBe(false);
    });

    it('picks a branch without evaluating either one differently', () => {
        expect(out(STD_SELECT, { condition: true, whenTrue: 'y', whenFalse: 'n' })).toBe('y');
        expect(out(STD_SELECT, { condition: false, whenTrue: 'y', whenFalse: 'n' })).toBe('n');
    });

    it('compares magnitudes', () => {
        expect(out(STD_GREATER, { a: 3, b: 2 })).toBe(true);
        expect(out(STD_GREATER, { a: 2, b: 3 })).toBe(false);
        expect(out(STD_LESS, { a: 2, b: 3 })).toBe(true);
        expect(out(STD_LESS, { a: 3, b: 2 })).toBe(false);
    });

    it('negates', () => {
        expect(out(STD_NOT, { in: true })).toBe(false);
        expect(out(STD_NOT, { in: 'false' })).toBe(true);
    });

    it('is vacuously true for nothing, and vacuously false for nothing', () => {
        expect(out(STD_ALL, { values: [] })).toBe(true);
        expect(out(STD_ANY, { values: [] })).toBe(false);
    });
});

describe('object nodes', () => {
    /** The chain that answers "one output that carries both". */
    it('builds an object one field at a time', () => {
        const empty = out(STD_EMPTY_OBJECT, {});
        const withText = out(STD_SET_FIELD, { object: empty, key: 'text', value: 'HELLO' });
        const both = out(STD_SET_FIELD, { object: withText, key: 'color', value: '#f00' });

        expect(both).toEqual({ text: 'HELLO', color: '#f00' });
    });

    /**
     * The incoming object is another node's output and the runtime memoises on
     * it — writing into it would change a value another branch already holds.
     */
    it('does not mutate the object it was given', () => {
        const source = { a: 1 };
        out(STD_SET_FIELD, { object: source, key: 'b', value: 2 });

        expect(source).toEqual({ a: 1 });
    });

    it('ignores a nameless field rather than writing a key of ""', () => {
        expect(out(STD_SET_FIELD, { object: { a: 1 }, key: '', value: 2 })).toEqual({ a: 1 });
    });

    it('reads a field back, and answers undefined for one that is not there', () => {
        expect(out(STD_GET_FIELD, { object: { a: 1 }, key: 'a' })).toBe(1);
        expect(out(STD_GET_FIELD, { object: { a: 1 }, key: 'z' })).toBeUndefined();
    });

    it('merges, with the second winning', () => {
        expect(out(STD_MERGE, { a: { x: 1, y: 2 }, b: { y: 3 } })).toEqual({ x: 1, y: 3 });
    });

    it('lists field names', () => {
        expect(out(STD_KEYS, { object: { a: 1, b: 2 } })).toEqual(['a', 'b']);
    });
});

describe('list nodes', () => {
    it('collects many wires into a list', () => {
        expect(out(STD_LIST, { items: [1, 2] })).toEqual([1, 2]);
    });

    it('counts a list', () => {
        expect(out(STD_LIST_LENGTH, { in: ['a', 'b', 'c'] })).toBe(3);
        expect(out(STD_LIST_LENGTH, {})).toBe(0);
    });

    /** The other branch of the sort: anything not all numbers compares as text. */
    it('sorts text alphabetically', () => {
        expect(out(STD_SORT, { in: ['pear', 'apple', 'fig'] })).toEqual(['apple', 'fig', 'pear']);
    });

    it('indexes from the end with a negative index', () => {
        expect(out(STD_LIST_ITEM, { in: ['a', 'b', 'c'], index: -1 })).toBe('c');
    });

    it('joins a list into text', () => {
        expect(out(STD_LIST_JOIN, { in: ['a', 'b'], separator: '/' })).toBe('a/b');
    });

    /** A map over a list, without a graph having to be a value. */
    it('plucks one field off every item', () => {
        const rows = [{ name: 'id' }, { name: 'email' }];

        expect(out(STD_PLUCK, { in: rows, key: 'name' })).toEqual(['id', 'email']);
    });

    it('sorts numbers numerically, not as text', () => {
        expect(out(STD_SORT, { in: [10, 9, 1] })).toEqual([1, 9, 10]);
    });

    it('does not sort the caller’s array in place', () => {
        const source = [3, 1, 2];
        out(STD_SORT, { in: source });

        expect(source).toEqual([3, 1, 2]);
    });
});

describe('convert nodes', () => {
    it('converts both ways', () => {
        expect(out(STD_TO_TEXT, { in: 42 })).toBe('42');
        expect(out(STD_TO_NUMBER, { in: '42' })).toBe(42);
    });

    /** Half-typed JSON is a normal step, not a reason to take the run down. */
    it('answers undefined for JSON that is not finished yet', () => {
        expect(out(STD_PARSE_JSON, { in: '{"a":' })).toBeUndefined();
        expect(out(STD_PARSE_JSON, { in: '{"a":1}' })).toEqual({ a: 1 });
    });

    it('reads a value as true or false', () => {
        expect(out(STD_TO_BOOLEAN, { in: 'yes' })).toBe(true);
        expect(out(STD_TO_BOOLEAN, { in: 0 })).toBe(false);
    });

    /** The one node here that is not a pure function of its inputs. */
    it('reports a time that is roughly now', () => {
        const before = Date.now();
        const now = out(STD_NOW, {}) as number;

        expect(now).toBeGreaterThanOrEqual(before);
        expect(now).toBeLessThanOrEqual(Date.now());
    });

    it('falls back to the default locale rather than throwing on a bad tag', () => {
        expect(out(STD_FORMAT_TIME, { in: 0, locale: 'not-a-locale!!' })).not.toBe('');
    });

    it('answers empty for a time that is not one', () => {
        expect(out(STD_FORMAT_TIME, { in: Number.NaN })).toBe('');
    });
});

/*
 * The trap named in the library docs, asserted so it cannot come back.
 *
 * `multiple` is what the EDITOR checks before accepting a second wire, and
 * `multi` is what the RUNTIME reads to decide how the values combine. They are
 * separate fields and nothing reconciles them, so a port carrying one without
 * the other looks right on the card and silently refuses the second
 * connection.
 */
describe('every collect port declares both fields', () => {
    it.each(STDLIB_NODE_TYPES.filter(d => d.ports.some(p => p.multi === 'collect')))(
        '$id',
        (definition: NodeTypeDefinition) => {
            for (const port of definition.ports) {
                if (port.multi !== 'collect') continue;
                expect(port.multiple, `${definition.id}.${port.id} needs multiple: true`).toBe(true);
            }
        },
    );

    it('has no port declaring multiple without a multi rule', () => {
        const offenders = STDLIB_NODE_TYPES.flatMap(d =>
            d.ports.filter(p => p.multiple === true && p.multi === undefined).map(p => `${d.id}.${p.id}`),
        );

        expect(offenders).toEqual([]);
    });
});

describe('the library as a whole', () => {
    it('has no duplicate ids', () => {
        const ids = STDLIB_NODE_TYPES.map(d => d.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('is entirely viewless — the middle of a graph is data, not rendering', () => {
        expect(STDLIB_NODE_TYPES.filter(d => d.view !== undefined)).toEqual([]);
    });

    it('gives every node a category, so the palette can group them', () => {
        expect(STDLIB_NODE_TYPES.filter(d => d.category === undefined)).toEqual([]);
    });
});

/*
 * The thing this library exists for.
 *
 * "Take text and a colour, and give me one output that is the text upper-cased
 * and carrying that colour." Nobody wrote a node for that. It is built here out
 * of four library nodes and run, because a toolbox that only works one node at
 * a time is not a toolbox.
 */
describe('a transformer nobody wrote', () => {
    function node(id: string, type: string): EditorNode {
        return { id, type, x: 0, y: 0, width: 180, height: 0 };
    }

    /**
     * A literal, supplied by the test rather than the library.
     *
     * There is no source node in the standard library on purpose — sources are
     * edges, and an application brings its own. This is the application.
     */
    const SOURCE: NodeTypeDefinition = {
        id: 'test-source',
        label: 'Value',
        ports: [{ id: 'out', direction: 'out', label: 'Value' }],
        compute: (_inputs, ctx) => ({ out: ctx.state }),
    };

    const GRAPH: readonly NodeConnection[] = [
        { id: 'c1', source: 'text', sourcePort: 'out', target: 'shout', targetPort: 'in' },
        { id: 'c2', source: 'empty', sourcePort: 'out', target: 'withText', targetPort: 'object' },
        { id: 'c3', source: 'keyText', sourcePort: 'out', target: 'withText', targetPort: 'key' },
        { id: 'c4', source: 'shout', sourcePort: 'out', target: 'withText', targetPort: 'value' },
        { id: 'c5', source: 'withText', sourcePort: 'out', target: 'withColour', targetPort: 'object' },
        { id: 'c6', source: 'keyColour', sourcePort: 'out', target: 'withColour', targetPort: 'key' },
        { id: 'c7', source: 'colour', sourcePort: 'out', target: 'withColour', targetPort: 'value' },
    ];

    const NODES: readonly EditorNode[] = [
        node('text', 'test-source'),
        node('colour', 'test-source'),
        node('keyText', 'test-source'),
        node('keyColour', 'test-source'),
        node('shout', 'std-upper'),
        node('empty', 'std-empty-object'),
        node('withText', 'std-set-field'),
        node('withColour', 'std-set-field'),
    ];

    async function build(text: unknown, colour: unknown): Promise<unknown> {
        const runtime = new NodeGraphRuntime();
        try {
            runtime.setDefinitions([...STDLIB_NODE_TYPES, SOURCE]);
            runtime.setState('text', text);
            runtime.setState('colour', colour);
            runtime.setState('keyText', 'text');
            runtime.setState('keyColour', 'color');
            runtime.setGraph([...NODES], [...GRAPH]);
            await runtime.run();
            return runtime.outputs('withColour')()['out'];
        } finally {
            runtime.dispose();
        }
    }

    it('composes upper-cased text and a colour into one styled value', async () => {
        expect(await build('hello there', '#ff0000')).toEqual({
            text: 'HELLO THERE',
            color: '#ff0000',
        });
    });

    /** Half-wired is the normal state of a graph being built. */
    it('still answers when the colour has not been wired yet', async () => {
        expect(await build('hello', undefined)).toEqual({ text: 'HELLO', color: undefined });
    });

    /** The composed value comes apart again — otherwise it is a dead end. */
    it('reads the fields back out', async () => {
        const styled = await build('hi', '#0f0');

        expect(out(STD_GET_FIELD, { object: styled, key: 'text' })).toBe('HI');
        expect(out(STD_GET_FIELD, { object: styled, key: 'color' })).toBe('#0f0');
    });
});

/*
 * `asText` states five conversions; four of them had a test. The Date branch
 * did not, so replacing `toISOString()` with `String(date)` — a locale-
 * dependent, unparseable form — left all 57 tests green.
 *
 * It matters because a date is the one value whose default string form differs
 * by machine: `String(date)` gives "Wed Aug 27 2026 ..." in one timezone and
 * something else in another, so a graph that formats or re-parses a date would
 * quietly produce different output on a colleague's laptop.
 */
describe('asText converts a Date to a form that survives the trip', () => {
    it('renders a Date as its ISO string', () => {
        expect(asText(new Date(Date.UTC(2026, 7, 27, 12, 0, 0)))).toBe('2026-08-27T12:00:00.000Z');
    });

    it('does not fall back to the locale-dependent default form', () => {
        const rendered = asText(new Date(Date.UTC(2026, 7, 27, 12, 0, 0)));
        expect(rendered).not.toContain('GMT');
        expect(new Date(rendered).getTime()).toBe(Date.UTC(2026, 7, 27, 12, 0, 0));
    });
});
