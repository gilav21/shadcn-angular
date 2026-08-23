// Turning a kept run back into something usable — §5, tasks E3–E5.
import { describe, it, expect } from 'vitest';
import {
    describeValue,
    exportRun,
    formatDuration,
    formatStartedAt,
    replayFrame,
    shareOfRun,
    slowestNode,
} from './node-editor-history.utils';
import type { RunNodeRecord, RunRecord } from './node-editor-history.types';

function nodeRecord(overrides: Partial<RunNodeRecord> = {}): RunNodeRecord {
    return {
        nodeId: 'a',
        title: 'Source',
        status: 'done',
        inputs: { in: 1 },
        outputs: { out: 2 },
        durationMs: 4,
        ...overrides,
    };
}

function runRecord(nodes: readonly RunNodeRecord[] = [nodeRecord()]): RunRecord {
    return {
        id: 1,
        startedAt: 1_700_000_000_000,
        durationMs: 12,
        status: 'done',
        nodes,
        graph: null,
    };
}

describe('replayFrame — what makes replay possible at all', () => {
    /**
     * The base already renders node views from whatever `NODE_CONTEXT`
     * reports, so replay is just handing it recorded values. No second
     * renderer to keep in step with the first, which is the failure mode of
     * every "preview mode" that drifts.
     */
    it('maps a run to the shape the editor’s replay input takes', () => {
        const frame = replayFrame(runRecord());
        expect(frame?.['a']).toEqual({
            status: 'done',
            inputs: { in: 1 },
            outputs: { out: 2 },
        });
    });

    it('covers every node in the run', () => {
        const frame = replayFrame(
            runRecord([nodeRecord(), nodeRecord({ nodeId: 'b', title: 'Sink' })]),
        );
        expect(Object.keys(frame ?? {})).toEqual(['a', 'b']);
    });

    it('is null for no run, which is how the editor returns to the present', () => {
        expect(replayFrame(null)).toBeNull();
    });

    it('is an empty frame for a run in which nothing settled', () => {
        expect(replayFrame(runRecord([]))).toEqual({});
    });
});

describe('formatDuration', () => {
    /**
     * Sub-millisecond work reports `<1 ms` rather than `0.03 ms`: the digits
     * are real but meaningless, and a column of them buries the one node that
     * took two seconds.
     */
    it('does not print meaningless precision', () => {
        expect(formatDuration(0.03)).toBe('<1 ms');
        expect(formatDuration(0)).toBe('<1 ms');
    });

    it('rounds milliseconds', () => {
        expect(formatDuration(4.6)).toBe('5 ms');
        expect(formatDuration(999)).toBe('999 ms');
    });

    it('switches to seconds past a second', () => {
        expect(formatDuration(1500)).toBe('1.50 s');
        expect(formatDuration(42_000)).toBe('42.0 s');
    });

    it('switches to minutes past a minute', () => {
        expect(formatDuration(95_000)).toBe('1 min 35 s');
    });

    it('refuses to invent a number for a bad one', () => {
        expect(formatDuration(Number.NaN)).toBe('—');
        expect(formatDuration(-1)).toBe('—');
    });
});

describe('formatStartedAt', () => {
    it('renders a clock time', () => {
        expect(formatStartedAt(Date.UTC(2026, 0, 1, 12, 34, 56), 'en')).toMatch(/\d{1,2}:\d{2}/);
    });
});

describe('reading a run’s timings', () => {
    it('names the slowest node', () => {
        const run = runRecord([
            nodeRecord({ nodeId: 'a', durationMs: 4 }),
            nodeRecord({ nodeId: 'slow', durationMs: 90 }),
            nodeRecord({ nodeId: 'c', durationMs: 12 }),
        ]);
        expect(slowestNode(run)?.nodeId).toBe('slow');
    });

    it('has no slowest node in an empty run, rather than a fabricated zero', () => {
        expect(slowestNode(runRecord([]))).toBeNull();
    });

    it('reports each node’s share of the work', () => {
        const run = runRecord([
            nodeRecord({ nodeId: 'a', durationMs: 25 }),
            nodeRecord({ nodeId: 'b', durationMs: 75 }),
        ]);
        expect(shareOfRun(run, 75)).toBeCloseTo(0.75, 5);
    });

    it('does not divide by zero when nothing took any time', () => {
        const run = runRecord([nodeRecord({ durationMs: 0 })]);
        expect(shareOfRun(run, 0)).toBe(0);
    });
});

describe('exportRun', () => {
    it('produces JSON that parses back', () => {
        expect(JSON.parse(exportRun(runRecord())).id).toBe(1);
    });

    it('is pretty-printed, because the destination is a bug report', () => {
        expect(exportRun(runRecord())).toContain('\n  ');
    });

    /**
     * An export that silently loses a node's output is worse than one that
     * says the output was a function. Every one of these is `undefined` — and
     * so, absent — under a plain `JSON.stringify`.
     */
    it('names values JSON cannot express instead of dropping them', () => {
        const run = runRecord([
            nodeRecord({ outputs: { fn: () => 1, big: 10n, sym: Symbol('s') } }),
        ]);
        const parsed = JSON.parse(exportRun(run)).nodes[0].outputs;

        expect(parsed.fn).toBe('[function]');
        expect(parsed.big).toBe('10n');
        expect(parsed.sym).toContain('Symbol');
    });

    it('unpacks a Map, which stringifies to an empty object', () => {
        const run = runRecord([nodeRecord({ outputs: { m: new Map([['k', 1]]) } })]);
        expect(JSON.parse(exportRun(run)).nodes[0].outputs.m).toEqual({ k: 1 });
    });

    it('unpacks a Set, which stringifies to an empty object too', () => {
        const run = runRecord([nodeRecord({ outputs: { s: new Set([1, 2]) } })]);
        expect(JSON.parse(exportRun(run)).nodes[0].outputs.s).toEqual([1, 2]);
    });

    it('keeps Infinity as a word rather than turning it into null', () => {
        const run = runRecord([nodeRecord({ outputs: { n: Number.POSITIVE_INFINITY } })]);
        expect(JSON.parse(exportRun(run)).nodes[0].outputs.n).toBe('Infinity');
    });
});

describe('describeValue — one line, for a table cell', () => {
    it('shows a short string as itself', () => {
        expect(describeValue('hello')).toBe('hello');
    });

    it('truncates a long one rather than blowing out the column', () => {
        const described = describeValue('x'.repeat(200));
        expect(described).toHaveLength(58);
        expect(described.endsWith('…')).toBe(true);
    });

    it('distinguishes an absent value from a null one', () => {
        expect(describeValue(undefined)).toBe('—');
        expect(describeValue(null)).toBe('null');
    });

    it('summarises arrays and objects by size', () => {
        expect(describeValue([1, 2, 3])).toBe('[3]');
        expect(describeValue({ a: 1, b: 2 })).toBe('{2}');
    });

    it('shows numbers and booleans as themselves', () => {
        expect(describeValue(0)).toBe('0');
        expect(describeValue(false)).toBe('false');
    });
});
