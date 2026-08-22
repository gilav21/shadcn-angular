/**
 * THROWAWAY design spike — deleted once the production runtime lands.
 *
 * `specs/node-editor-runtime-design.md` §14 lists ten claims the design must
 * survive. This file implements the algorithms as leanly as possible and
 * asserts every one of them. The point is to find a wrong design BEFORE any
 * production code is built on it, not to be production code itself: no signals,
 * no Angular, no error handling, no API polish.
 *
 * If an assertion here cannot be made to pass, the design is wrong.
 */
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal model
// ---------------------------------------------------------------------------

type NodeId = string;
type PortValues = Record<string, unknown>;

interface SpikePort {
    id: string;
    direction: 'in' | 'out';
    multi?: 'single' | 'collect' | 'latest';
}

interface SpikeDef {
    id: string;
    ports: readonly SpikePort[];
    remote?: boolean;
    staleness?: 'cancel' | 'drop' | 'apply';
    compute?: (inputs: PortValues, ctx: SpikeCtx) => unknown;
}

interface SpikeCtx {
    state: unknown;
    signal: AbortSignal;
}

interface SpikeNode { id: NodeId; type: string }
interface SpikeConn {
    id: string;
    source: NodeId; sourcePort: string;
    target: NodeId; targetPort: string;
}

interface RemoteRequest { runId: number; nodeId: NodeId; inputs: PortValues }
interface RemoteResult { runId: number; nodeId: NodeId; outputs: PortValues }
type RemoteExecutor = (
    batch: readonly RemoteRequest[],
    signal: AbortSignal,
) => Promise<readonly RemoteResult[]>;

type Status = 'idle' | 'stale' | 'done' | 'error' | 'cycle';

// ---------------------------------------------------------------------------
// The spike runtime
// ---------------------------------------------------------------------------

class SpikeRuntime {
    // --- graph
    private readonly defs = new Map<string, SpikeDef>();
    private readonly nodes = new Map<NodeId, SpikeNode>();
    private conns: SpikeConn[] = [];
    private readonly outgoing = new Map<NodeId, Set<NodeId>>();
    private readonly incoming = new Map<NodeId, Set<NodeId>>();

    // --- topological order (design §1)
    private order: NodeId[] = [];
    private readonly position = new Map<NodeId, number>();

    // --- evaluation state (design §2, §3)
    private readonly dirty = new Set<NodeId>();
    private readonly pendingDeps = new Map<NodeId, number>();
    private readonly ready = new Set<NodeId>();
    readonly status = new Map<NodeId, Status>();

    // --- values + memo (design §4)
    readonly outputs = new Map<NodeId, PortValues>();
    private readonly state = new Map<NodeId, unknown>();
    private readonly lastInputs = new Map<NodeId, PortValues>();
    private readonly lastState = new Map<NodeId, unknown>();
    private readonly emitSeq = new Map<string, number>();   // "node:port" -> seq
    private seq = 0;

    // --- async (design §6, §7)
    private readonly active = new Map<NodeId, { id: number; controller: AbortController }>();
    private runCounter = 0;
    private readonly iterators = new Map<NodeId, AsyncIterator<unknown>>();

    executeRemote: RemoteExecutor | null = null;

    // --- instrumentation, for the assertions
    readonly computed: NodeId[] = [];
    remoteCalls = 0;
    reorders = 0;

    constructor(defs: readonly SpikeDef[]) {
        for (const d of defs) this.defs.set(d.id, d);
    }

    // ---------------------------------------------------------------- graph

    addNode(node: SpikeNode, initialState: unknown = undefined): void {
        this.nodes.set(node.id, node);
        this.order.push(node.id);
        this.position.set(node.id, this.order.length - 1);
        this.outgoing.set(node.id, new Set());
        this.incoming.set(node.id, new Set());
        this.state.set(node.id, initialState);
        this.outputs.set(node.id, {});
        this.status.set(node.id, 'idle');
        this.markDirty(node.id);
    }

    /** Returns 'cycle' when the edge would close one; the edge is still added. */
    connect(c: SpikeConn): 'ok' | 'reordered' | 'cycle' {
        this.conns.push(c);
        this.outgoing.get(c.source)!.add(c.target);
        this.incoming.get(c.target)!.add(c.source);
        const result = this.repairOrder(c.source, c.target);
        this.markDirty(c.target);
        return result;
    }

    disconnect(id: string): void {
        const c = this.conns.find(x => x.id === id);
        if (!c) return;
        this.conns = this.conns.filter(x => x.id !== id);
        // Only drop the adjacency when no other edge joins the same pair.
        if (!this.conns.some(x => x.source === c.source && x.target === c.target)) {
            this.outgoing.get(c.source)!.delete(c.target);
            this.incoming.get(c.target)!.delete(c.source);
        }
        // design §1: removing an edge cannot invalidate a topological order.
        this.teardownIterator(c.source);
        this.markDirty(c.target);
    }

    setState(id: NodeId, next: unknown): void {
        this.state.set(id, next);
        this.markDirty(id);
    }

    // ------------------------------------------------ topological order (§1)

    /** Pearce–Kelly. Returns 'ok' when the existing order already holds. */
    private repairOrder(u: NodeId, v: NodeId): 'ok' | 'reordered' | 'cycle' {
        const pu = this.position.get(u)!;
        const pv = this.position.get(v)!;
        if (pu < pv) return 'ok';                       // the common case, O(1)

        // Forward from v, bounded by pu.
        const F: NodeId[] = [];
        const seenF = new Set<NodeId>();
        const fStack = [v];
        while (fStack.length) {
            const x = fStack.pop()!;
            if (seenF.has(x)) continue;
            seenF.add(x);
            F.push(x);
            if (x === u) return 'cycle';                // v ...→ u, plus u→v
            for (const y of this.outgoing.get(x) ?? []) {
                if ((this.position.get(y) ?? Infinity) <= pu) fStack.push(y);
            }
        }

        // Backward from u, bounded by pv.
        const B: NodeId[] = [];
        const seenB = new Set<NodeId>();
        const bStack = [u];
        while (bStack.length) {
            const x = bStack.pop()!;
            if (seenB.has(x)) continue;
            seenB.add(x);
            B.push(x);
            for (const y of this.incoming.get(x) ?? []) {
                if ((this.position.get(y) ?? -Infinity) >= pv) bStack.push(y);
            }
        }

        // Re-place B then F into the slots they collectively occupied.
        const affected = [...B, ...F];
        const slots = affected.map(n => this.position.get(n)!).sort((a, b) => a - b);
        const ordered = [
            ...B.sort((a, b) => this.position.get(a)! - this.position.get(b)!),
            ...F.sort((a, b) => this.position.get(a)! - this.position.get(b)!),
        ];
        slots.forEach((slot, i) => {
            this.order[slot] = ordered[i];
            this.position.set(ordered[i], slot);
        });
        this.reorders++;
        return 'reordered';
    }

    // -------------------------------------------------- dirty + ready (§2,§3)

    private markDirty(n: NodeId): void {
        const stack = [n];
        while (stack.length) {
            const x = stack.pop()!;
            if (this.dirty.has(x)) continue;      // descendants already marked
            this.dirty.add(x);
            this.status.set(x, 'stale');
            this.ready.delete(x);
            for (const y of this.outgoing.get(x) ?? []) stack.push(y);
        }
        this.recomputeReady();
    }

    /**
     * Recomputes pendingDeps for the DIRTY set only.
     *
     * The production version maintains these counters incrementally; the spike
     * recomputes over `dirty` because that is still bounded by the dirty set,
     * never by N, which is the property under test.
     */
    private recomputeReady(): void {
        this.ready.clear();
        for (const n of this.dirty) {
            let pending = 0;
            for (const up of this.incoming.get(n) ?? []) if (this.dirty.has(up)) pending++;
            this.pendingDeps.set(n, pending);
            if (pending === 0) this.ready.add(n);
        }
        this.excludeCycles();
    }

    /** Tarjan over the dirty subgraph; SCC members cannot become ready (§5). */
    private excludeCycles(): void {
        const index = new Map<NodeId, number>();
        const low = new Map<NodeId, number>();
        const onStack = new Set<NodeId>();
        const stack: NodeId[] = [];
        let counter = 0;

        const strongConnect = (v: NodeId): void => {
            index.set(v, counter); low.set(v, counter); counter++;
            stack.push(v); onStack.add(v);
            for (const w of this.outgoing.get(v) ?? []) {
                if (!this.dirty.has(w)) continue;
                if (!index.has(w)) {
                    strongConnect(w);
                    low.set(v, Math.min(low.get(v)!, low.get(w)!));
                } else if (onStack.has(w)) {
                    low.set(v, Math.min(low.get(v)!, index.get(w)!));
                }
            }
            if (low.get(v) === index.get(v)) {
                const comp: NodeId[] = [];
                let w: NodeId;
                do { w = stack.pop()!; onStack.delete(w); comp.push(w); } while (w !== v);
                const selfLoop = comp.length === 1 && (this.outgoing.get(comp[0])?.has(comp[0]) ?? false);
                if (comp.length > 1 || selfLoop) {
                    for (const n of comp) {
                        this.status.set(n, 'cycle');
                        this.ready.delete(n);
                    }
                }
            }
        };

        for (const n of this.dirty) if (!index.has(n)) strongConnect(n);
    }

    // ------------------------------------------------------- input resolution

    private resolveInputs(n: NodeId): PortValues {
        const def = this.defs.get(this.nodes.get(n)!.type)!;
        const values: PortValues = {};
        for (const port of def.ports) {
            if (port.direction !== 'in') continue;
            const conns = this.conns.filter(c => c.target === n && c.targetPort === port.id);
            if (conns.length === 0) { values[port.id] = undefined; continue; }

            if (port.multi === 'collect') {
                values[port.id] = conns.map(c => this.outputs.get(c.source)?.[c.sourcePort]);
            } else if (port.multi === 'latest') {
                const newest = conns
                    .map(c => ({ c, seq: this.emitSeq.get(`${c.source}:${c.sourcePort}`) ?? -1 }))
                    .sort((a, b) => b.seq - a.seq)[0];
                values[port.id] = this.outputs.get(newest.c.source)?.[newest.c.sourcePort];
            } else {
                values[port.id] = this.outputs.get(conns[0].source)?.[conns[0].sourcePort];
            }
        }
        return values;
    }

    /** design §4 — collect ports compare element-wise, or memoisation never fires. */
    private inputsUnchanged(n: NodeId, resolved: PortValues): boolean {
        const prev = this.lastInputs.get(n);
        if (!prev) return false;
        const def = this.defs.get(this.nodes.get(n)!.type)!;
        for (const port of def.ports) {
            if (port.direction !== 'in') continue;
            const a = resolved[port.id];
            const b = prev[port.id];
            if (port.multi === 'collect') {
                const av = a as unknown[] | undefined;
                const bv = b as unknown[] | undefined;
                if (!av || !bv || av.length !== bv.length) return false;
                if (av.some((x, i) => !Object.is(x, bv[i]))) return false;
            } else if (!Object.is(a, b)) {
                return false;
            }
        }
        return true;
    }

    // --------------------------------------------------------- execution

    /** Executes exactly one ready node (design §3). */
    async step(): Promise<void> {
        const n = [...this.ready][0];
        if (n === undefined) return;
        await this.execute([n]);
    }

    /** Drains until nothing is ready. */
    async run(): Promise<void> {
        let guard = 0;
        while (this.ready.size > 0) {
            if (++guard > 10_000) throw new Error('run() did not converge');
            await this.execute([...this.ready]);
        }
    }

    private async execute(batch: readonly NodeId[]): Promise<void> {
        const local: NodeId[] = [];
        const remote: NodeId[] = [];
        for (const n of batch) {
            (this.defs.get(this.nodes.get(n)!.type)!.remote ? remote : local).push(n);
        }
        await Promise.all([this.executeLocal(local), this.executeRemoteBatch(remote)]);
    }

    private async executeLocal(batch: readonly NodeId[]): Promise<void> {
        await Promise.all(batch.map(n => this.executeOne(n)));
    }

    private async executeOne(n: NodeId): Promise<void> {
        const def = this.defs.get(this.nodes.get(n)!.type)!;
        const inputs = this.resolveInputs(n);

        if (this.inputsUnchanged(n, inputs) && Object.is(this.state.get(n), this.lastState.get(n))) {
            this.settle(n, 'done');                         // memo hit (§4)
            return;
        }
        this.lastInputs.set(n, inputs);
        this.lastState.set(n, this.state.get(n));

        if (!def.compute) { this.settle(n, 'done'); return; }

        const run = this.beginRun(n, def);
        this.computed.push(n);
        const result = def.compute(inputs, { state: this.state.get(n), signal: run.controller.signal });

        if (isAsyncIterable(result)) { await this.consume(n, run.id, result); return; }
        const value = await result;
        this.applyOutputs(n, run.id, def, value as PortValues);
        this.settle(n, 'done');
    }

    private beginRun(n: NodeId, def: SpikeDef): { id: number; controller: AbortController } {
        const prev = this.active.get(n);
        if (prev && (def.staleness ?? 'cancel') === 'cancel') prev.controller.abort();
        const run = { id: ++this.runCounter, controller: new AbortController() };
        this.active.set(n, run);
        return run;
    }

    /** design §6 — only 'apply' lets a superseded run win. */
    private applyOutputs(n: NodeId, runId: number, def: SpikeDef, value: PortValues): void {
        const current = this.active.get(n);
        const stale = current !== undefined && current.id !== runId;
        if (stale && (def.staleness ?? 'cancel') !== 'apply') return;

        const next = { ...this.outputs.get(n), ...value };
        this.outputs.set(n, next);
        for (const key of Object.keys(value)) this.emitSeq.set(`${n}:${key}`, ++this.seq);
    }

    /** design §7 — every yield propagates; the iterator is tracked for teardown. */
    private async consume(n: NodeId, runId: number, it: AsyncIterable<unknown>): Promise<void> {
        const def = this.defs.get(this.nodes.get(n)!.type)!;
        const iterator = it[Symbol.asyncIterator]();
        this.iterators.set(n, iterator);
        try {
            while (true) {
                const { value, done } = await iterator.next();
                if (done) break;
                if (this.active.get(n)?.id !== runId) break;   // superseded
                this.applyOutputs(n, runId, def, value as PortValues);
            }
        } finally {
            if (this.iterators.get(n) === iterator) this.iterators.delete(n);
        }
        this.settle(n, 'done');
    }

    private teardownIterator(n: NodeId): void {
        const it = this.iterators.get(n);
        if (!it) return;
        this.iterators.delete(n);
        void it.return?.(undefined);
    }

    get openIterators(): number { return this.iterators.size; }

    private async executeRemoteBatch(batch: readonly NodeId[]): Promise<void> {
        if (batch.length === 0) return;
        if (!this.executeRemote) {
            for (const n of batch) this.settle(n, 'error');
            return;
        }
        const requests: RemoteRequest[] = batch.map(n => {
            const def = this.defs.get(this.nodes.get(n)!.type)!;
            const run = this.beginRun(n, def);
            this.computed.push(n);
            const inputs = this.resolveInputs(n);
            this.lastInputs.set(n, inputs);
            this.lastState.set(n, this.state.get(n));
            return { runId: run.id, nodeId: n, inputs };
        });

        this.remoteCalls++;                          // design §9 — ONE per tick
        const results = await this.executeRemote(requests, new AbortController().signal);
        for (const r of results) {
            const def = this.defs.get(this.nodes.get(r.nodeId)!.type)!;
            this.applyOutputs(r.nodeId, r.runId, def, r.outputs);
            this.settle(r.nodeId, 'done');
        }
    }

    private settle(n: NodeId, status: Status): void {
        this.dirty.delete(n);
        if (this.status.get(n) !== 'cycle') this.status.set(n, status);
        this.recomputeReady();
    }
}

function isAsyncIterable(v: unknown): v is AsyncIterable<unknown> {
    return typeof v === 'object' && v !== null && Symbol.asyncIterator in v;
}

// ---------------------------------------------------------------------------
// Undo history (design §10)
// ---------------------------------------------------------------------------

type Command =
    | { kind: 'move-nodes'; deltas: Map<NodeId, { x: number; y: number }> }
    | { kind: 'set-state'; nodeId: NodeId; before: unknown; after: unknown; at: number };

const COALESCE_MS = 400;

class SpikeHistory {
    readonly entries: Command[] = [];

    push(cmd: Command): void {
        const last = this.entries.at(-1);
        if (
            cmd.kind === 'set-state' && last?.kind === 'set-state' &&
            last.nodeId === cmd.nodeId && cmd.at - last.at < COALESCE_MS
        ) {
            // Keep the EARLIEST before and the LATEST after.
            this.entries[this.entries.length - 1] = { ...last, after: cmd.after, at: cmd.at };
            return;
        }
        this.entries.push(cmd);
    }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PASSTHROUGH: SpikeDef = {
    id: 'passthrough',
    ports: [
        { id: 'in', direction: 'in' },
        { id: 'out', direction: 'out' },
    ],
    compute: inputs => ({ out: inputs['in'] }),
};

const SOURCE: SpikeDef = {
    id: 'source',
    ports: [{ id: 'out', direction: 'out' }],
    compute: (_i, ctx) => ({ out: ctx.state }),
};

const COLLECTOR: SpikeDef = {
    id: 'collector',
    ports: [
        { id: 'items', direction: 'in', multi: 'collect' },
        { id: 'out', direction: 'out' },
    ],
    compute: inputs => ({ out: (inputs['items'] as unknown[]).join(',') }),
};

function chain(rt: SpikeRuntime, ids: readonly NodeId[]): void {
    ids.forEach((id, i) => rt.addNode({ id, type: i === 0 ? 'source' : 'passthrough' }, 'seed'));
    for (let i = 0; i < ids.length - 1; i++) {
        rt.connect({ id: `c${i}`, source: ids[i], sourcePort: 'out', target: ids[i + 1], targetPort: 'in' });
    }
}

const DEFS = [PASSTHROUGH, SOURCE, COLLECTOR];

// ---------------------------------------------------------------------------
// The ten claims
// ---------------------------------------------------------------------------

describe('design claim 1 — connect does not re-sort the whole order', () => {
    it('is O(1) when nodes are created upstream-first', () => {
        const rt = new SpikeRuntime(DEFS);
        chain(rt, ['a', 'b', 'c', 'd']);
        expect(rt.reorders).toBe(0);
    });

    it('reorders only when an edge actually inverts the order', () => {
        const rt = new SpikeRuntime(DEFS);
        rt.addNode({ id: 'later', type: 'passthrough' });
        rt.addNode({ id: 'earlier', type: 'source' }, 's');
        // earlier was added second, so this edge inverts the order.
        expect(rt.connect({
            id: 'c', source: 'earlier', sourcePort: 'out', target: 'later', targetPort: 'in',
        })).toBe('reordered');
        expect(rt.reorders).toBe(1);
    });

    it('detects the cycle an inverting edge would close', () => {
        const rt = new SpikeRuntime(DEFS);
        chain(rt, ['a', 'b', 'c']);
        expect(rt.connect({
            id: 'back', source: 'c', sourcePort: 'out', target: 'a', targetPort: 'in',
        })).toBe('cycle');
    });

    it('never reorders on disconnect', () => {
        const rt = new SpikeRuntime(DEFS);
        chain(rt, ['a', 'b', 'c']);
        const before = rt.reorders;
        rt.disconnect('c0');
        expect(rt.reorders).toBe(before);
    });
});

describe('design claim 2 — a change recomputes only descendants', () => {
    it('recomputes the changed node and everything below it, and nothing else', async () => {
        const rt = new SpikeRuntime(DEFS);
        // a -> b -> c, and an unrelated island x -> y
        chain(rt, ['a', 'b', 'c']);
        rt.addNode({ id: 'x', type: 'source' }, 'x0');
        rt.addNode({ id: 'y', type: 'passthrough' });
        rt.connect({ id: 'cx', source: 'x', sourcePort: 'out', target: 'y', targetPort: 'in' });
        await rt.run();

        rt.computed.length = 0;
        // 'a' is the source, whose compute actually reads state, so this does
        // change its output.
        rt.setState('a', 'changed');
        await rt.run();

        expect(new Set(rt.computed)).toEqual(new Set(['a', 'b', 'c']));
        expect(rt.computed).not.toContain('x');
        expect(rt.computed).not.toContain('y');
    });

    /**
     * Found BY this spike, and stronger than the claim it was written for.
     *
     * Propagation does not stop at "descendants of the change" — it stops
     * where OUTPUTS stop changing. Marking a node dirty forces that node to
     * re-run, but if it produces an identical output its own descendants
     * memoise and never execute. A wide graph hanging off a node that
     * recomputes to the same value costs one node, not its whole subtree.
     */
    it('stops propagating where an output stops changing', async () => {
        const rt = new SpikeRuntime(DEFS);
        chain(rt, ['a', 'b', 'c']);
        await rt.run();

        rt.computed.length = 0;
        // 'b' is a passthrough: its compute ignores state, so re-running it
        // yields the identical output and 'c' has nothing to react to.
        rt.setState('b', 'irrelevant');
        await rt.run();

        expect(rt.computed).toEqual(['b']);
        expect(rt.computed).not.toContain('c');
    });

    it('walks a diamond tail once, not once per path', async () => {
        const rt = new SpikeRuntime(DEFS);
        for (const id of ['top', 'l', 'r', 'bottom']) {
            rt.addNode({ id, type: id === 'top' ? 'source' : 'passthrough' }, 't');
        }
        rt.connect({ id: '1', source: 'top', sourcePort: 'out', target: 'l', targetPort: 'in' });
        rt.connect({ id: '2', source: 'top', sourcePort: 'out', target: 'r', targetPort: 'in' });
        rt.connect({ id: '3', source: 'l', sourcePort: 'out', target: 'bottom', targetPort: 'in' });
        rt.connect({ id: '4', source: 'r', sourcePort: 'out', target: 'bottom', targetPort: 'in' });
        await rt.run();

        rt.computed.length = 0;
        rt.setState('top', 'next');
        await rt.run();

        expect(rt.computed.filter(n => n === 'bottom')).toHaveLength(1);
    });
});

describe('design claim 3 — unchanged inputs recompute nothing', () => {
    it('recomputes zero nodes on a second run', async () => {
        const rt = new SpikeRuntime(DEFS);
        chain(rt, ['a', 'b', 'c']);
        await rt.run();

        rt.computed.length = 0;
        rt.setState('a', 'seed');          // same value as before
        await rt.run();

        // 'a' re-runs (its state was SET), but produces the same output, so
        // nothing downstream recomputes.
        expect(rt.computed).not.toContain('b');
        expect(rt.computed).not.toContain('c');
    });

    /**
     * The trap from design §4: a collect port resolves to a NEW array each
     * pass, so an identity comparison would report a change every time and
     * memoisation would never fire anywhere in the graph.
     */
    it('still memoises through a COLLECT port', async () => {
        const rt = new SpikeRuntime(DEFS);
        rt.addNode({ id: 's1', type: 'source' }, 'one');
        rt.addNode({ id: 's2', type: 'source' }, 'two');
        rt.addNode({ id: 'm', type: 'collector' });
        rt.addNode({ id: 'tail', type: 'passthrough' });
        rt.connect({ id: 'a', source: 's1', sourcePort: 'out', target: 'm', targetPort: 'items' });
        rt.connect({ id: 'b', source: 's2', sourcePort: 'out', target: 'm', targetPort: 'items' });
        rt.connect({ id: 'c', source: 'm', sourcePort: 'out', target: 'tail', targetPort: 'in' });
        await rt.run();
        expect(rt.outputs.get('m')?.['out']).toBe('one,two');

        rt.computed.length = 0;
        rt.setState('s1', 'one');          // identical value
        await rt.run();

        expect(rt.computed).not.toContain('m');
        expect(rt.computed).not.toContain('tail');
    });

    it('collect preserves connection order', async () => {
        const rt = new SpikeRuntime(DEFS);
        rt.addNode({ id: 's1', type: 'source' }, 'first');
        rt.addNode({ id: 's2', type: 'source' }, 'second');
        rt.addNode({ id: 'm', type: 'collector' });
        rt.connect({ id: 'a', source: 's1', sourcePort: 'out', target: 'm', targetPort: 'items' });
        rt.connect({ id: 'b', source: 's2', sourcePort: 'out', target: 'm', targetPort: 'items' });
        await rt.run();
        expect(rt.outputs.get('m')?.['out']).toBe('first,second');
    });
});

describe('design claim 4 — a cyclic graph terminates', () => {
    it('does not hang, and marks the cycle', async () => {
        const rt = new SpikeRuntime(DEFS);
        chain(rt, ['a', 'b', 'c']);
        rt.connect({ id: 'back', source: 'c', sourcePort: 'out', target: 'b', targetPort: 'in' });

        await rt.run();      // the assertion is that this RESOLVES at all

        expect(rt.status.get('b')).toBe('cycle');
        expect(rt.status.get('c')).toBe('cycle');
    });

    it('handles a self-edge', async () => {
        const rt = new SpikeRuntime(DEFS);
        rt.addNode({ id: 'solo', type: 'passthrough' });
        rt.connect({ id: 's', source: 'solo', sourcePort: 'out', target: 'solo', targetPort: 'in' });
        await rt.run();
        expect(rt.status.get('solo')).toBe('cycle');
    });
});

describe('design claim 5 — a superseded async result never wins', () => {
    function slowDef(delays: Record<string, number>, staleness?: SpikeDef['staleness']): SpikeDef {
        return {
            id: 'slow',
            staleness,
            ports: [{ id: 'out', direction: 'out' }],
            compute: async (_i, ctx) => {
                const value = ctx.state as string;
                await new Promise(r => setTimeout(r, delays[value] ?? 0));
                return { out: value };
            },
        };
    }

    it('discards the older result under the default cancel policy', async () => {
        const rt = new SpikeRuntime([slowDef({ old: 40, new: 0 })]);
        rt.addNode({ id: 'n', type: 'slow' }, 'old');

        const first = rt.run();            // slow
        rt.setState('n', 'new');
        const second = rt.run();           // fast, supersedes
        await Promise.all([first, second]);
        await new Promise(r => setTimeout(r, 80));

        expect(rt.outputs.get('n')?.['out']).toBe('new');
    });

    it('lets the older result win under apply — which is why it is not the default', async () => {
        const rt = new SpikeRuntime([slowDef({ old: 40, new: 0 }, 'apply')]);
        rt.addNode({ id: 'n', type: 'slow' }, 'old');

        const first = rt.run();
        rt.setState('n', 'new');
        const second = rt.run();
        await Promise.all([first, second]);
        await new Promise(r => setTimeout(r, 80));

        expect(rt.outputs.get('n')?.['out']).toBe('old');
    });

    it('fires the AbortSignal of the superseded run', async () => {
        const aborted: string[] = [];
        const def: SpikeDef = {
            id: 'slow',
            ports: [{ id: 'out', direction: 'out' }],
            compute: async (_i, ctx) => {
                const value = ctx.state as string;
                ctx.signal.addEventListener('abort', () => aborted.push(value));
                await new Promise(r => setTimeout(r, 30));
                return { out: value };
            },
        };
        const rt = new SpikeRuntime([def]);
        rt.addNode({ id: 'n', type: 'slow' }, 'first');
        const a = rt.run();
        rt.setState('n', 'second');
        const b = rt.run();
        await Promise.all([a, b]);

        expect(aborted).toContain('first');
    });
});

describe('design claim 6 — disconnecting a stream runs the generator finally', () => {
    it('tears the iterator down and closes its resource', async () => {
        let closed = false;
        let started = false;
        const streamer: SpikeDef = {
            id: 'streamer',
            ports: [{ id: 'out', direction: 'out' }],
            compute: () => (async function* () {
                started = true;
                try {
                    for (let i = 0; i < 1_000_000; i++) {
                        yield { out: i };
                        await new Promise(r => setTimeout(r, 1));
                    }
                } finally {
                    closed = true;          // a real node closes its socket here
                }
            })(),
        };
        const rt = new SpikeRuntime([streamer, PASSTHROUGH]);
        rt.addNode({ id: 's', type: 'streamer' });
        rt.addNode({ id: 't', type: 'passthrough' });
        rt.connect({ id: 'e', source: 's', sourcePort: 'out', target: 't', targetPort: 'in' });

        void rt.run();
        await new Promise(r => setTimeout(r, 20));
        expect(started).toBe(true);
        expect(rt.openIterators).toBe(1);

        rt.disconnect('e');
        await new Promise(r => setTimeout(r, 20));

        expect(closed).toBe(true);
        expect(rt.openIterators).toBe(0);
    });
});

describe('design claim 7 — K ready remote nodes cost ONE executor call', () => {
    it('batches every ready remote node into a single request', async () => {
        const remoteDef: SpikeDef = {
            id: 'remote',
            remote: true,
            ports: [{ id: 'out', direction: 'out' }],
        };
        const rt = new SpikeRuntime([remoteDef]);
        for (let i = 0; i < 12; i++) rt.addNode({ id: `r${i}`, type: 'remote' });

        const executor = vi.fn(async (batch: readonly RemoteRequest[]) =>
            batch.map(b => ({ runId: b.runId, nodeId: b.nodeId, outputs: { out: b.nodeId } })),
        );
        rt.executeRemote = executor;

        await rt.run();

        expect(executor).toHaveBeenCalledTimes(1);
        expect(executor.mock.calls[0][0]).toHaveLength(12);
        expect(rt.remoteCalls).toBe(1);
    });

    it('errors rather than hanging when no executor is bound', async () => {
        const remoteDef: SpikeDef = { id: 'remote', remote: true, ports: [{ id: 'out', direction: 'out' }] };
        const rt = new SpikeRuntime([remoteDef]);
        rt.addNode({ id: 'r', type: 'remote' });
        await rt.run();
        expect(rt.status.get('r')).toBe('error');
    });
});

describe('design claim 8 — step() advances exactly one node', () => {
    it('executes one node per call, in dependency order', async () => {
        const rt = new SpikeRuntime(DEFS);
        chain(rt, ['a', 'b', 'c']);

        await rt.step();
        expect(rt.computed).toEqual(['a']);
        await rt.step();
        expect(rt.computed).toEqual(['a', 'b']);
        await rt.step();
        expect(rt.computed).toEqual(['a', 'b', 'c']);
    });

    it('is a no-op once nothing is ready', async () => {
        const rt = new SpikeRuntime(DEFS);
        chain(rt, ['a', 'b']);
        await rt.run();
        rt.computed.length = 0;
        await rt.step();
        expect(rt.computed).toEqual([]);
    });
});

describe('design claim 9 — two runtimes share no state', () => {
    it('keeps outputs, status and counters fully separate', async () => {
        const one = new SpikeRuntime(DEFS);
        const two = new SpikeRuntime(DEFS);
        chain(one, ['a', 'b']);
        chain(two, ['a', 'b']);

        one.setState('a', 'ONE');
        two.setState('a', 'TWO');
        await Promise.all([one.run(), two.run()]);

        expect(one.outputs.get('b')?.['out']).toBe('ONE');
        expect(two.outputs.get('b')?.['out']).toBe('TWO');
    });
});

describe('design claim 10 — undo coalescing', () => {
    it('records a drag as ONE entry', () => {
        const history = new SpikeHistory();
        // The command is pushed once, on pointer-up, with the net delta.
        history.push({ kind: 'move-nodes', deltas: new Map([['a', { x: 90, y: 0 }]]) });
        expect(history.entries).toHaveLength(1);
    });

    it('coalesces fast keystrokes into one entry, keeping first-before/last-after', () => {
        const history = new SpikeHistory();
        const base = 1_000;
        ['h', 'he', 'hel', 'hell', 'hello'].forEach((after, i) => {
            history.push({
                kind: 'set-state', nodeId: 'text',
                before: i === 0 ? '' : ['h', 'he', 'hel', 'hell'][i - 1],
                after, at: base + i * 50,
            });
        });

        expect(history.entries).toHaveLength(1);
        const entry = history.entries[0] as Extract<Command, { kind: 'set-state' }>;
        expect(entry.before).toBe('');
        expect(entry.after).toBe('hello');
    });

    it('does NOT coalesce across the window, so a pause is a checkpoint', () => {
        const history = new SpikeHistory();
        history.push({ kind: 'set-state', nodeId: 't', before: '', after: 'a', at: 0 });
        history.push({ kind: 'set-state', nodeId: 't', before: 'a', after: 'ab', at: COALESCE_MS + 1 });
        expect(history.entries).toHaveLength(2);
    });

    it('does not coalesce across different nodes', () => {
        const history = new SpikeHistory();
        history.push({ kind: 'set-state', nodeId: 'a', before: '', after: 'x', at: 0 });
        history.push({ kind: 'set-state', nodeId: 'b', before: '', after: 'y', at: 10 });
        expect(history.entries).toHaveLength(2);
    });
});
