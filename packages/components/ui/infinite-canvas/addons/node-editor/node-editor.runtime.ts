/**
 * The dataflow runtime: what turns a drawing of a graph into a running one.
 *
 * Deliberately a plain class with no Angular dependency beyond `signal` for
 * read-out, and — the constraint that matters most — **no global or singleton
 * state of any kind**. That is what keeps nested graphs (subgraphs) buildable
 * later as an addon: a `subgraph` node type is simply a node whose `compute`
 * owns another instance of this class. One convenience singleton closes that
 * door quietly, so it is the first thing to check when reviewing a change here.
 *
 * Algorithms and their justification: `specs/node-editor-runtime-design.md`.
 * Every one of them was proved by a throwaway spike before this file existed.
 */
import { signal, type Signal, type WritableSignal } from '@angular/core';
import type { EditorNode, NodeConnection, NodeId } from './node-editor.types';
import type {
  GraphProblem,
  NodeSettledEvent,
  NodeStatus,
  NodePortDefinition,
  NodeTypeDefinition,
  PortValues,
  RemoteExecutor,
  RemoteRequest,
  RemoteResult,
  RunFinishedEvent,
  RunStartedEvent,
  StalenessPolicy,
} from './node-editor.runtime.types';

interface ActiveRun {
  readonly id: number;
  readonly controller: AbortController;
}

/** The evaluation pass in flight, accumulating what settles inside it. */
interface RunSession {
  readonly id: number;
  readonly startedAt: number;
  readonly startedTick: number;
  readonly nodes: NodeSettledEvent[];
}

/** Monotonic where available; `performance` is absent in some SSR shims. */
function tick(): number {
  return globalThis.performance?.now() ?? Date.now();
}

/** Counters the performance suite asserts on. Counts, never wall-clock. */
export interface RuntimeMetrics {
  /** Nodes whose `compute` actually ran. */
  readonly computed: readonly NodeId[];
  /** Calls made to `executeRemote`. K ready remote nodes must cost 1. */
  readonly remoteCalls: number;
  /** Times the topological order was repaired. */
  readonly reorders: number;
  /** Async iterators still open. Must return to 0 after a disconnect. */
  readonly openIterators: number;
  /**
   * Nodes this runtime still holds anything for.
   *
   * A count, like the rest of these, and for the same reason: a leak is a
   * number that fails to come back down, and nothing else in a test can see
   * one. Removing a node must return this to what it was, and `dispose` must
   * take it to zero — an editor that mounts and unmounts a hundred graphs
   * should not be carrying the first one around.
   */
  readonly retained: number;
}

/**
 * The two sentences the runtime writes into `problems`.
 *
 * A settable object rather than an injected locale, because this class is
 * deliberately free of Angular and of any global: it is instantiated inside
 * another runtime's evaluation when a subgraph runs, and reaching for DI here
 * would put a container in that path. The editor assigns these from its own
 * locale; a runtime used on its own still says something sensible.
 */
export interface RuntimeMessages {
  /** A node that cannot run because it sits in a cycle. */
  cycle(title: string): string;
  /** A required input with nothing wired to it. */
  requiredInput(title: string, port: string): string;
}

const DEFAULT_MESSAGES: RuntimeMessages = {
  cycle: title => `“${title}” is part of a loop, so it cannot run.`,
  requiredInput: (title, port) => `“${title}” needs “${port}” connected.`,
};

/** Shared, so a node with nothing wired to it allocates nothing to find that out. */
const NO_CONNECTIONS: readonly NodeConnection[] = [];

const DEFAULT_STALENESS: StalenessPolicy = 'cancel';
/** Guards a pathological graph from spinning forever rather than hanging silently. */
const MAX_DRAIN_ITERATIONS = 100_000;

export class NodeGraphRuntime {
  // ---- graph -------------------------------------------------------------
  private readonly definitions = new Map<string, NodeTypeDefinition>();
  private readonly nodes = new Map<NodeId, EditorNode>();
  private connections: readonly NodeConnection[] = [];
  private readonly outgoing = new Map<NodeId, Set<NodeId>>();
  private readonly incoming = new Map<NodeId, Set<NodeId>>();
  /**
   * Connections grouped by the node they arrive at.
   *
   * Resolving a node's inputs and reporting its unconnected required ports both
   * ask "what lands here", and both used to answer by scanning every connection
   * in the graph — once per port, per node, per pass. On a graph of any size
   * that is the dominant cost of an edit: `refresh` walks every node, so a
   * single keystroke in one text field was O(nodes x ports x connections).
   *
   * Measured before this index, one `setState`: 0.4ms at 250 nodes, 3.0ms at
   * 1000 — 7.5x for 4x the graph, when linear would be 4x.
   *
   * Rebuilt wholesale in `setConnections`, which is the only writer.
   */
  private readonly connectionsByTarget = new Map<NodeId, NodeConnection[]>();

  // ---- topological order (design §1) -------------------------------------
  private order: NodeId[] = [];
  private readonly position = new Map<NodeId, number>();

  // ---- evaluation (design §2, §3) ----------------------------------------
  private readonly dirty = new Set<NodeId>();
  private readonly readySet = new Set<NodeId>();
  /**
   * Bumped every time a node is marked dirty.
   *
   * A run captures the version it set out to satisfy. If the node is dirtied
   * again while that run is in flight, the version moves on and `settle` must
   * NOT clear the dirtiness — the newer change has not been addressed yet.
   */
  private readonly dirtyVersion = new Map<NodeId, number>();

  // ---- values and memoisation (design §4) --------------------------------
  private readonly outputValues = new Map<NodeId, PortValues>();
  private readonly stateValues = new Map<NodeId, unknown>();
  private readonly lastInputs = new Map<NodeId, PortValues>();
  private readonly lastState = new Map<NodeId, unknown>();
  private readonly emitSeq = new Map<string, number>();
  private seq = 0;

  // ---- async (design §6, §7) ---------------------------------------------
  private readonly active = new Map<NodeId, ActiveRun>();
  private readonly iterators = new Map<NodeId, AsyncIterator<unknown>>();
  private runCounter = 0;
  private disposed = false;
  /** The drain in flight, if any. See {@link run}. */
  private draining: Promise<void> | null = null;

  // ---- reactive read-out --------------------------------------------------
  private readonly statusSignals = new Map<NodeId, WritableSignal<NodeStatus>>();
  private readonly outputSignals = new Map<NodeId, WritableSignal<PortValues>>();
  private readonly inputSignals = new Map<NodeId, WritableSignal<PortValues>>();
  private readonly stateSignals = new Map<NodeId, WritableSignal<unknown>>();
  private readonly errorSignals = new Map<NodeId, WritableSignal<unknown>>();
  private readonly problemsSignal = signal<readonly GraphProblem[]>([]);
  /**
   * Whether the reported problems could have changed since they were last built.
   *
   * Building them walks every node in the graph, and `refresh` runs once per
   * node that settles — so a full evaluation rebuilt them N times, making a run
   * O(N x N) for a list that had not changed between any two of those rebuilds.
   * At ten thousand nodes that was the difference between a moment and half a
   * minute.
   *
   * A problem depends on the SHAPE of the graph — its nodes, their definitions,
   * what is wired to their required inputs — plus, for a node in a loop, that
   * it is in one. None of that changes because a node finished computing, so a
   * settle no longer rebuilds them; the things that genuinely move them set
   * this instead.
   */
  private problemsStale = true;
  /**
   * Whether the loop analysis has to run again.
   *
   * Tarjan over the dirty subgraph, once per node that settles, was the other
   * half of a quadratic run: the dirty set starts at every node and shrinks by
   * one per settle, so the passes summed to N squared.
   *
   * Shrinking a graph cannot create a loop in it. So the analysis is only owed
   * when something is ADDED to the dirty set, or the shape changes — never
   * when a node finishes. Readiness itself is unaffected either way: a node in
   * a loop always has a dirty upstream, so the readiness rule already refuses
   * it. What this pass really produces is the `cycle` STATUS, and that cannot
   * change while the set only shrinks.
   */
  private cyclesStale = true;
  /** Who was in a cycle when the problems were last built. */
  private cycleMembers = new Set<NodeId>();
  private readonly readySignal = signal<readonly NodeId[]>([]);

  /** Backend hand-off. `null` means every node runs locally. */
  executeRemote: RemoteExecutor | null = null;

  /** Wording for the problems this reports. Replaced by the editor per locale. */
  messages: RuntimeMessages = DEFAULT_MESSAGES;

  /**
   * Run lifecycle, for the run-history addon.
   *
   * Plain callbacks rather than signals: history is a stream of things that
   * happened, and a signal only ever holds the latest — an observer that
   * missed a tick would silently lose a run.
   */
  onRunStarted: ((event: RunStartedEvent) => void) | null = null;
  onNodeSettled: ((event: NodeSettledEvent) => void) | null = null;
  onRunFinished: ((event: RunFinishedEvent) => void) | null = null;

  // ---- run sessions -------------------------------------------------------
  private session: RunSession | null = null;
  private sessionCounter = 0;
  /** Re-entrant `run()` callers. The pass closes when the last one leaves. */
  private runDepth = 0;
  /** When each node's current attempt started, for its duration. */
  private readonly startedTicks = new Map<NodeId, number>();

  // ---- instrumentation ----------------------------------------------------
  private readonly computedNodes: NodeId[] = [];
  private remoteCalls = 0;
  private reorders = 0;

  get metrics(): RuntimeMetrics {
    return {
      computed: [...this.computedNodes],
      remoteCalls: this.remoteCalls,
      reorders: this.reorders,
      openIterators: this.iterators.size,
      retained: this.retainedNodes().size,
    };
  }

  /** Every per-node container, so none can be forgotten in one place and not another. */
  private perNodeMaps(): readonly ReadonlyMap<NodeId, unknown>[] {
    return [
      this.nodes,
      this.outgoing,
      this.incoming,
      this.dirtyVersion,
      this.outputValues,
      this.stateValues,
      this.lastInputs,
      this.lastState,
      this.active,
      this.iterators,
      this.statusSignals,
      this.outputSignals,
      this.inputSignals,
      this.stateSignals,
      this.errorSignals,
      this.startedTicks,
    ];
  }

  private retainedNodes(): ReadonlySet<NodeId> {
    const ids = new Set<NodeId>();
    for (const map of this.perNodeMaps()) {
      for (const id of map.keys()) ids.add(id);
    }
    return ids;
  }

  resetMetrics(): void {
    this.computedNodes.length = 0;
    this.remoteCalls = 0;
    this.reorders = 0;
  }

  readonly problems: Signal<readonly GraphProblem[]> = this.problemsSignal.asReadonly();
  /** What `step()` would execute next. */
  readonly ready: Signal<readonly NodeId[]> = this.readySignal.asReadonly();

  // =========================================================== graph mutation

  setDefinitions(definitions: readonly NodeTypeDefinition[]): void {
    this.definitions.clear();
    for (const definition of definitions) this.definitions.set(definition.id, definition);
    for (const id of this.nodes.keys()) this.markDirty(id);
    this.invalidateProblems();
    this.refresh();
  }

  definition(nodeId: NodeId): NodeTypeDefinition | undefined {
    const type = this.nodes.get(nodeId)?.type;
    return type === undefined ? undefined : this.definitions.get(type);
  }

  /**
   * The ports THIS node has, which is not always what its type declares.
   *
   * A type with `portsFor` derives its ports from each node's own state — a
   * subgraph, whose inner boundary nodes are its outer ports. Reading
   * `definition.ports` directly would give every instance the type's ports, so
   * a user-built subgraph would draw the ports it grew and then carry no
   * values through any of them: input resolution would not find them, and
   * nothing would reach `compute`.
   *
   * Read through this everywhere a node's ports are resolved.
   */
  private portsOf(nodeId: NodeId, definition: NodeTypeDefinition): readonly NodePortDefinition[] {
    if (!definition.portsFor) return definition.ports;
    return definition.portsFor(this.stateSignal(nodeId)());
  }

  /**
   * Replace the graph.
   *
   * Diffed rather than rebuilt: a rebuild would drop every cached output and
   * re-run the whole graph on any edit, which is precisely what R13 bans.
   */
  setGraph(nodes: readonly EditorNode[], connections: readonly NodeConnection[]): void {
    if (this.disposed) return;

    const incomingIds = new Set(nodes.map(n => n.id));
    // Collected first: `removeNode` deletes from `this.nodes`, and mutating a
    // collection while iterating it is a trap even where the spec allows it.
    const removed = [...this.nodes.keys()].filter(id => !incomingIds.has(id));
    for (const id of removed) this.removeNode(id);
    for (const node of nodes) {
      if (this.nodes.has(node.id)) this.nodes.set(node.id, node);
      else this.addNode(node);
    }
    this.setConnections(connections);
    this.invalidateProblems();
    this.refresh();
  }

  private addNode(node: EditorNode): void {
    this.nodes.set(node.id, node);
    this.order.push(node.id);
    this.position.set(node.id, this.order.length - 1);
    this.outgoing.set(node.id, new Set());
    this.incoming.set(node.id, new Set());
    this.outputValues.set(node.id, {});

    /*
     * A state written for this id BEFORE the node arrived wins over the type's
     * initial state.
     *
     * `setState` then `setGraph` is the order a consumer restoring a document
     * naturally writes — `deserializeGraph` hands back `states` separately from
     * `nodes`, and subgraph navigation re-mounts a node that was removed while
     * another graph was on screen. Seeding `initialState()` unconditionally
     * threw those writes away, silently: the graph came back with the right
     * shape and the wrong values, and for a subgraph, whose state IS its inner
     * graph, it came back empty.
     *
     * `has` rather than `?? `: `undefined` is a legitimate state, and a node
     * whose state was deliberately set to it must not fall back to the type.
     */
    const initial = this.stateValues.has(node.id)
      ? this.stateValues.get(node.id)
      : this.definitions.get(node.type ?? '')?.initialState?.();
    this.stateValues.set(node.id, initial);
    this.stateSignal(node.id).set(initial);
    this.markDirty(node.id);
  }

  private removeNode(id: NodeId): void {
    this.abortRun(id);
    this.teardownIterator(id);
    this.nodes.delete(id);
    this.outputValues.delete(id);
    this.stateValues.delete(id);
    this.lastInputs.delete(id);
    this.lastState.delete(id);
    this.dirty.delete(id);
    this.readySet.delete(id);
    this.dirtyVersion.delete(id);
    this.startedTicks.delete(id);

    /*
     * The read-out signals go too.
     *
     * They were the one thing a removed node left behind, and nothing ever
     * collected them: five maps growing by one entry per node for the lifetime
     * of the editor. A graph that adds and removes as you work — which is what
     * a graph editor is for — carried every node it had ever shown.
     *
     * Safe to drop because a node's view captures the signals it needs when
     * its context is built, so an existing card keeps reading the object it
     * already holds; only a LATER lookup makes a fresh one, and by then the
     * node is gone.
     */
    this.statusSignals.delete(id);
    this.outputSignals.delete(id);
    this.inputSignals.delete(id);
    this.stateSignals.delete(id);
    this.errorSignals.delete(id);

    // Keyed by `node:port`, so they cannot be reached by id alone.
    const prefix = `${String(id)}:`;
    for (const key of [...this.emitSeq.keys()]) {
      if (key.startsWith(prefix)) this.emitSeq.delete(key);
    }

    for (const peer of this.outgoing.get(id) ?? []) this.incoming.get(peer)?.delete(id);
    for (const peer of this.incoming.get(id) ?? []) this.outgoing.get(peer)?.delete(id);
    this.outgoing.delete(id);
    this.incoming.delete(id);

    this.order = this.order.filter(n => n !== id);
    this.reindex();
  }

  /** One compaction pass, rather than an O(N) shift per delete (design §1). */
  private reindex(): void {
    this.position.clear();
    this.order.forEach((n, i) => this.position.set(n, i));
  }

  private setConnections(next: readonly NodeConnection[]): void {
    const before = new Map(this.connections.map(c => [c.id, c]));
    const after = new Map(next.map(c => [c.id, c]));

    /*
     * Same id, different endpoints, counts as gone and come back.
     *
     * The diff was by id alone, so re-pointing a connection while keeping its
     * id changed nothing: the old target kept the value it had and the new one
     * never heard. The editor happens to give a rewired edge a fresh id, which
     * is why this went unseen — but a document restored from serialised state,
     * or any consumer editing `connections` directly, has no such habit.
     */
    const rewired = (a: NodeConnection, b: NodeConnection): boolean =>
      a.source !== b.source ||
      a.sourcePort !== b.sourcePort ||
      a.target !== b.target ||
      a.targetPort !== b.targetPort;

    for (const [id, connection] of before) {
      const replacement = after.get(id);
      if (!replacement || rewired(connection, replacement)) {
        // design §7 — an edge going away must tear its stream down.
        this.teardownIterator(connection.source);
        this.markDirty(connection.target);
      }
    }
    this.connections = next;
    this.rebuildAdjacency();
    this.rebuildTargetIndex();

    for (const [id, connection] of after) {
      const previous = before.get(id);
      if (previous && !rewired(previous, connection)) continue;
      this.repairOrder(connection.source, connection.target);
      this.markDirty(connection.target);
    }
  }

  private rebuildTargetIndex(): void {
    this.connectionsByTarget.clear();
    for (const connection of this.connections) {
      const existing = this.connectionsByTarget.get(connection.target);
      if (existing) existing.push(connection);
      else this.connectionsByTarget.set(connection.target, [connection]);
    }
  }

  /** What lands on this node. Empty array shared, so asking costs no allocation. */
  private incomingFor(nodeId: NodeId): readonly NodeConnection[] {
    return this.connectionsByTarget.get(nodeId) ?? NO_CONNECTIONS;
  }

  private rebuildAdjacency(): void {
    for (const set of this.outgoing.values()) set.clear();
    for (const set of this.incoming.values()) set.clear();
    for (const c of this.connections) {
      this.outgoing.get(c.source)?.add(c.target);
      this.incoming.get(c.target)?.add(c.source);
    }
  }

  /**
   * Write a node's state — including before that node exists.
   *
   * Dropping a write for an unknown id was the quiet half of a bug the
   * subgraph addon made visible. `deserializeGraph` returns `states` beside
   * `nodes`, and swapping which graph is on screen re-mounts a node that was
   * removed while another one was showing, so "set the state, then set the
   * graph" is an order consumers reach for and one this refused to honour: the
   * value went nowhere and the node came back holding `initialState()`.
   *
   * Recorded rather than applied when the node is absent — there is nothing to
   * schedule yet, and {@link addNode} picks the value up when it arrives.
   */
  setState(nodeId: NodeId, next: unknown): void {
    if (this.disposed) return;
    this.stateValues.set(nodeId, next);
    this.stateSignal(nodeId).set(next);
    if (!this.nodes.has(nodeId)) return;
    this.markDirty(nodeId);
    // Dynamic ports come from state, so an edit can add or remove a problem.
    this.invalidateProblems();
    this.refresh();
  }

  // ================================================= topological order (§1)

  /**
   * Pearce–Kelly. When the existing order already satisfies the new edge this
   * is O(1), which is the common case because nodes are created upstream-first.
   * Otherwise only the region between the endpoints is touched — never N.
   */
  private repairOrder(source: NodeId, target: NodeId): void {
    const from = this.position.get(source);
    const to = this.position.get(target);
    if (from === undefined || to === undefined || from < to) return;

    const forward = this.collectForward(target, from);
    if (forward === null) return;            // closes a cycle; §5 handles it
    const backward = this.collectBackward(source, to);

    const byPosition = (a: NodeId, b: NodeId): number =>
      (this.position.get(a) ?? 0) - (this.position.get(b) ?? 0);

    const slots = [...backward, ...forward].map(n => this.position.get(n) ?? 0);
    slots.sort((a, b) => a - b);

    const orderedBackward = [...backward];
    orderedBackward.sort(byPosition);
    const orderedForward = [...forward];
    orderedForward.sort(byPosition);
    const reordered = [...orderedBackward, ...orderedForward];

    slots.forEach((slot, i) => {
      this.order[slot] = reordered[i];
      this.position.set(reordered[i], slot);
    });
    this.reorders++;
  }

  /** Nodes reachable from `start` within the affected region, or null on a cycle. */
  private collectForward(start: NodeId, limit: number): NodeId[] | null {
    const seen = new Set<NodeId>();
    const found: NodeId[] = [];
    const stack = [start];
    while (stack.length > 0) {
      const node = stack.pop() as NodeId;
      if (seen.has(node)) continue;
      seen.add(node);
      found.push(node);
      for (const next of this.outgoing.get(node) ?? []) {
        const at = this.position.get(next) ?? Number.POSITIVE_INFINITY;
        if (at > limit) continue;
        if (at === limit) return null;        // reached the source: a cycle
        stack.push(next);
      }
    }
    return found;
  }

  private collectBackward(start: NodeId, limit: number): NodeId[] {
    const seen = new Set<NodeId>();
    const found: NodeId[] = [];
    const stack = [start];
    while (stack.length > 0) {
      const node = stack.pop() as NodeId;
      if (seen.has(node)) continue;
      seen.add(node);
      found.push(node);
      for (const prev of this.incoming.get(node) ?? []) {
        if ((this.position.get(prev) ?? Number.NEGATIVE_INFINITY) >= limit) stack.push(prev);
      }
    }
    return found;
  }

  // ================================================== dirty and ready (§2,§3)

  private markDirty(start: NodeId): void {
    // A local `seen` set rather than skipping already-dirty nodes: the version
    // has to be bumped even for a node that is currently running, or its
    // settle would clear a dirtiness it never addressed. `seen` still keeps a
    // diamond's tail visited once, and a cycle from looping forever.
    const seen = new Set<NodeId>();
    const stack = [start];
    while (stack.length > 0) {
      const node = stack.pop() as NodeId;
      if (seen.has(node)) continue;
      seen.add(node);

      /*
       * A node that is gone cannot be dirty.
       *
       * Removing a graph re-set its connections, and dirtying their endpoints
       * wrote a version back for every node just deleted — one entry per
       * connection, resurrected a moment after being released. It computed
       * nothing and was never read; it simply stayed. `retained` counts it,
       * which is how it was found at all.
       */
      if (!this.nodes.has(node)) continue;

      this.cyclesStale = true;
      this.dirtyVersion.set(node, (this.dirtyVersion.get(node) ?? 0) + 1);
      this.dirty.add(node);
      this.setStatus(node, 'stale');
      this.readySet.delete(node);
      for (const next of this.outgoing.get(node) ?? []) stack.push(next);
    }
  }

  /** Re-dirty everything downstream of a node, without re-running the node. */
  private propagateFrom(nodeId: NodeId): void {
    for (const next of this.outgoing.get(nodeId) ?? []) this.markDirty(next);
    this.refresh();
  }

  /** The dirtiness a run is setting out to satisfy. */
  private versionOf(nodeId: NodeId): number {
    return this.dirtyVersion.get(nodeId) ?? 0;
  }

  /**
   * Recompute the ready set over the DIRTY subgraph only.
   *
   * Bounded by the dirty set, never by N — which is the property R13 requires
   * and the perf suite asserts.
   */
  private refresh(): void {
    this.readySet.clear();
    for (const node of this.dirty) {
      let pending = 0;
      for (const up of this.incoming.get(node) ?? []) if (this.dirty.has(up)) pending++;
      if (pending === 0) this.readySet.add(node);
    }
    if (this.cyclesStale) {
      this.cyclesStale = false;
      this.excludeCycles();
    }
    this.readySignal.set([...this.readySet]);

    if (this.problemsStale) {
      this.problemsStale = false;
      this.problemsSignal.set(this.collectProblems());
    }
  }

  /**
   * Note that the problems have to be built again.
   *
   * Called by everything that changes the shape of the graph, or a node's
   * state — dynamic ports mean a subgraph's required inputs come from its
   * state, so an edit there can add or remove a problem.
   */
  private invalidateProblems(): void {
    this.problemsStale = true;
  }

  /** Tarjan over the dirty subgraph; SCC members can never become ready (§5). */
  /** A change in who sits in a loop is the one evaluation-time input to a problem. */
  private noteCycleMembers(members: ReadonlySet<NodeId>): void {
    if (members.size === this.cycleMembers.size) {
      let same = true;
      for (const id of members) {
        if (!this.cycleMembers.has(id)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    this.cycleMembers = new Set(members);
    this.invalidateProblems();
  }

  private excludeCycles(): void {
    /** Who this pass put in a loop, so a change in that can rebuild the problems. */
    const found = new Set<NodeId>();
    const index = new Map<NodeId, number>();
    const low = new Map<NodeId, number>();
    const onStack = new Set<NodeId>();
    const stack: NodeId[] = [];
    let counter = 0;

    const connect = (v: NodeId): void => {
      index.set(v, counter);
      low.set(v, counter);
      counter++;
      stack.push(v);
      onStack.add(v);

      for (const w of this.outgoing.get(v) ?? []) {
        if (!this.dirty.has(w)) continue;
        if (!index.has(w)) {
          connect(w);
          low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0));
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0));
        }
      }

      if (low.get(v) === index.get(v)) closeComponent(v);
    };

    const closeComponent = (root: NodeId): void => {
      const component: NodeId[] = [];
      let node: NodeId;
      do {
        node = stack.pop() as NodeId;
        onStack.delete(node);
        component.push(node);
      } while (node !== root);
      for (const member of this.markCycle(component)) found.add(member);
    };

    for (const node of this.dirty) if (!index.has(node)) connect(node);

    this.noteCycleMembers(found);
  }

  /**
   * A component is a cycle when it has more than one node, or a self-edge.
   *
   * Returns the members it marked, so the caller can tell whether the set of
   * nodes in a loop has changed — the one thing an evaluation does that a
   * reported problem depends on.
   */
  private markCycle(component: readonly NodeId[]): readonly NodeId[] {
    const selfEdge =
      component.length === 1 && (this.outgoing.get(component[0])?.has(component[0]) ?? false);
    if (component.length === 1 && !selfEdge) return [];
    for (const node of component) {
      this.setStatus(node, 'cycle');
      this.readySet.delete(node);
    }
    return component;
  }

  // ====================================================== input resolution (§8)

  private resolveInputs(nodeId: NodeId): PortValues {
    const definition = this.definition(nodeId);
    const values: PortValues = {};
    if (!definition) return values;

    for (const port of this.portsOf(nodeId, definition)) {
      if (port.direction !== 'in') continue;
      const conns = this.incomingFor(nodeId).filter(c => c.targetPort === port.id);

      if (conns.length === 0) {
        values[port.id] = port.default;
      } else if (port.multi === 'collect') {
        values[port.id] = conns.map(c => this.outputValues.get(c.source)?.[c.sourcePort]);
      } else if (port.multi === 'latest') {
        const newest = conns.reduce(
          (best, c) => (this.emittedAt(c) > this.emittedAt(best) ? c : best),
          conns[0],
        );
        values[port.id] = this.outputValues.get(newest.source)?.[newest.sourcePort];
      } else {
        values[port.id] = this.outputValues.get(conns[0].source)?.[conns[0].sourcePort];
      }
    }
    return values;
  }

  /** When a connection's source port last produced a value. */
  private emittedAt(connection: NodeConnection): number {
    return this.emitSeq.get(`${connection.source}:${connection.sourcePort}`) ?? -1;
  }

  /**
   * design §4 — collect ports MUST compare element-wise.
   *
   * They resolve to a new array on every pass, so an identity check would
   * report a change every time and memoisation would never fire anywhere.
   */
  private inputsUnchanged(nodeId: NodeId, resolved: PortValues): boolean {
    const previous = this.lastInputs.get(nodeId);
    if (!previous) return false;
    const definition = this.definition(nodeId);
    if (!definition) return false;

    for (const port of this.portsOf(nodeId, definition)) {
      if (port.direction !== 'in') continue;
      const next = resolved[port.id];
      const last = previous[port.id];

      const same = port.multi === 'collect'
        ? sameCollected(next, last)
        : Object.is(next, last);
      if (!same) return false;
    }
    return true;
  }

  // ================================================================ execution

  /**
   * Execute exactly one ready node — the one furthest upstream.
   *
   * Any ready node would be *correct*: they are ready precisely because
   * nothing they depend on is outstanding. But stepping is something a person
   * watches, and taking whichever node happened to be inserted first made the
   * graph light up in an order with no visible logic — a node on the right
   * running before one on the left, for reasons only the insertion order knew.
   * Reported as "it seems like the nodes AFTER the derived area update before
   * it, am I missing something?" Nothing was missing; the order was arbitrary.
   *
   * Taking the lowest topological position makes a step walk the graph the way
   * it reads. It costs a scan of the ready set, which only `step` pays —
   * `run()` still drains the whole set at once and does not care.
   */
  async step(): Promise<void> {
    // Never step into a drain that is already in flight, for the same reason
    // two drains cannot overlap.
    if (this.draining) await this.draining;
    if (this.readySet.size === 0) return;

    let next: NodeId | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const nodeId of this.readySet) {
      const at = this.position.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (at < best) {
        best = at;
        next = nodeId;
      }
    }
    if (next === null) return;

    this.enterSession();
    try {
      await this.execute([next]);
    } finally {
      this.leaveSession();
    }
  }

  /**
   * Drain until nothing is ready.
   *
   * ### Why this is serialised
   *
   * Two overlapping drains corrupt results, and quietly. Both pick up the same
   * ready node, so `beginRun` bumps its run id; the first drain's result is
   * then discarded as stale — correctly, by design — but a downstream node in
   * the *other* drain may already have read the output slot before either
   * write landed, computed from an empty value, and settled.
   *
   * That is exactly what happened once the editor called `run()` on every
   * state change while its own effect was also calling it: the source node
   * held the right value and everything downstream of it held an empty one.
   * Found by the integration test, not by the runtime's own suite, because it
   * takes two callers to produce it.
   */
  async run(): Promise<void> {
    // Nothing to do starts no pass at all, so an idle editor calling `run()`
    // on every keystroke does not fill the history with empty runs.
    if (this.readySet.size === 0) return;

    this.enterSession();
    try {
      while (this.readySet.size > 0) await this.drainOnce();
    } finally {
      this.leaveSession();
    }
  }

  /**
   * One drain — or a join of the one already in flight.
   *
   * Joining then returning to the loop is deliberate: work dirtied while a
   * drain ran may have arrived after it made its final decision to stop, so
   * the caller re-checks rather than assuming the graph is settled.
   */
  private async drainOnce(): Promise<void> {
    if (this.draining) {
      await this.draining;
      return;
    }
    const drain = this.drain();
    this.draining = drain;
    try {
      await drain;
    } finally {
      if (this.draining === drain) this.draining = null;
    }
  }

  /**
   * Join the pass in flight, or open one.
   *
   * The editor calls `run()` from several places at once — an effect, a state
   * change, every stream emission. Treating each as its own run would report
   * three runs for what a person did once, so callers nest.
   */
  private enterSession(): void {
    this.runDepth++;
    if (this.session) return;

    this.session = {
      id: ++this.sessionCounter,
      startedAt: Date.now(),
      startedTick: tick(),
      nodes: [],
    };
    this.onRunStarted?.({
      runId: this.session.id,
      startedAt: this.session.startedAt,
      nodes: [...this.readySet],
    });
  }

  private leaveSession(): void {
    this.runDepth = Math.max(0, this.runDepth - 1);
    const session = this.session;
    if (this.runDepth > 0 || !session) return;

    this.session = null;
    this.onRunFinished?.({
      runId: session.id,
      startedAt: session.startedAt,
      durationMs: tick() - session.startedTick,
      nodes: session.nodes,
      status: session.nodes.some(node => node.status === 'error') ? 'error' : 'done',
    });
  }

  private async drain(): Promise<void> {
    let guard = 0;
    while (this.readySet.size > 0) {
      if (++guard > MAX_DRAIN_ITERATIONS) {
        throw new Error('node-editor: evaluation did not converge');
      }
      await this.execute([...this.readySet]);
    }
  }

  private async execute(batch: readonly NodeId[]): Promise<void> {
    const local: NodeId[] = [];
    const remote: NodeId[] = [];
    const startedTick = tick();
    for (const node of batch) {
      this.startedTicks.set(node, startedTick);
      (this.definition(node)?.remote === true ? remote : local).push(node);
    }
    await Promise.all([
      Promise.all(local.map(n => this.executeLocal(n))),
      this.executeRemoteBatch(remote),
    ]);
  }

  private async executeLocal(nodeId: NodeId): Promise<void> {
    const definition = this.definition(nodeId);
    if (!definition) {
      this.settle(nodeId, 'error');
      return;
    }

    // Captured before any await: the dirtiness this run is answering.
    const version = this.versionOf(nodeId);
    const inputs = this.resolveInputs(nodeId);
    if (
      this.inputsUnchanged(nodeId, inputs) &&
      Object.is(this.stateValues.get(nodeId), this.lastState.get(nodeId))
    ) {
      this.settle(nodeId, 'done', version);  // memo hit — no compute, no propagation
      return;
    }
    this.recordInputs(nodeId, inputs);
    this.lastState.set(nodeId, this.stateValues.get(nodeId));

    if (!definition.compute) {
      this.settle(nodeId, 'done', version);
      return;
    }

    const run = this.beginRun(nodeId, definition);
    this.computedNodes.push(nodeId);
    this.setStatus(nodeId, 'running');

    try {
      const result = definition.compute(this.resolveInputs(nodeId), {
        state: this.stateValues.get(nodeId),
        signal: run.controller.signal,
        setState: next => this.setState(nodeId, next),
        emit: (portId, value) => this.applyOutputs(nodeId, run.id, definition, { [portId]: value }),
      });

      if (isAsyncIterable(result)) {
        /*
         * A stream does NOT block the drain.
         *
         * Awaiting it would hold the drain open for as long as the generator
         * keeps yielding — forever, for a websocket or a poller — and every
         * later evaluation in the graph would queue behind it. The node
         * settles now, on the value it already has, and each later emission
         * propagates on its own.
         */
        void this.consume(nodeId, run.id, definition, result);
        this.settle(nodeId, 'done', version);
        return;
      }
      this.applyOutputs(nodeId, run.id, definition, await result);
      this.settle(nodeId, 'done', version);
    } catch (cause: unknown) {
      this.errorSignal(nodeId).set(cause);
      this.settle(nodeId, 'error', version);
    }
  }

  private beginRun(nodeId: NodeId, definition: NodeTypeDefinition): ActiveRun {
    const previous = this.active.get(nodeId);
    if (previous && (definition.staleness ?? DEFAULT_STALENESS) === 'cancel') {
      previous.controller.abort();
    }
    const run: ActiveRun = { id: ++this.runCounter, controller: new AbortController() };
    this.active.set(nodeId, run);
    return run;
  }

  /** design §6 — only `apply` lets a superseded run win. */
  private applyOutputs(
    nodeId: NodeId,
    runId: number,
    definition: NodeTypeDefinition,
    value: PortValues,
  ): void {
    const current = this.active.get(nodeId);
    const stale = current !== undefined && current.id !== runId;
    if (stale && (definition.staleness ?? DEFAULT_STALENESS) !== 'apply') return;

    const merged = { ...this.outputValues.get(nodeId), ...value };
    this.outputValues.set(nodeId, merged);
    this.outputSignal(nodeId).set(merged);
    for (const key of Object.keys(value)) this.emitSeq.set(`${nodeId}:${key}`, ++this.seq);
  }

  /** design §7 — every yield propagates; the iterator is tracked for teardown. */
  private async consume(
    nodeId: NodeId,
    runId: number,
    definition: NodeTypeDefinition,
    iterable: AsyncIterable<unknown>,
  ): Promise<void> {
    const iterator = iterable[Symbol.asyncIterator]();
    this.iterators.set(nodeId, iterator);
    try {
      while (true) {
        const { value, done } = await iterator.next();
        if (done === true) break;
        if (this.active.get(nodeId)?.id !== runId) break;      // superseded
        this.applyOutputs(nodeId, runId, definition, value as PortValues);
        // The node itself settled when the stream started, so downstream has
        // to be re-dirtied for each emission to reach it.
        this.propagateFrom(nodeId);
        void this.run();
      }
    } catch (cause: unknown) {
      this.errorSignal(nodeId).set(cause);
      this.setStatus(nodeId, 'error');
    } finally {
      if (this.iterators.get(nodeId) === iterator) this.iterators.delete(nodeId);
    }
  }

  private teardownIterator(nodeId: NodeId): void {
    const iterator = this.iterators.get(nodeId);
    if (!iterator) return;
    this.iterators.delete(nodeId);
    // Runs the generator's `finally`, which is where a real node closes its
    // socket. Without this, disconnecting an edge leaks the stream.
    void iterator.return?.(undefined);
  }

  private abortRun(nodeId: NodeId): void {
    this.active.get(nodeId)?.controller.abort();
    this.active.delete(nodeId);
  }

  /** design §9 — every ready remote node in a tick is ONE call. */
  private async executeRemoteBatch(batch: readonly NodeId[]): Promise<void> {
    if (batch.length === 0) return;

    if (!this.executeRemote) {
      for (const nodeId of batch) this.settle(nodeId, 'error');
      this.problemsSignal.set(this.collectProblems());
      return;
    }

    const controller = new AbortController();
    const requests = batch
      .map(nodeId => this.buildRemoteRequest(nodeId))
      .filter((request): request is RemoteRequest => request !== null);

    this.remoteCalls++;
    try {
      const results = this.executeRemote(requests, controller.signal);
      if (isAsyncIterable(results)) {
        for await (const result of results) this.applyRemoteResult(result);
      } else {
        for (const result of await results) this.applyRemoteResult(result);
      }
    } catch (cause: unknown) {
      for (const nodeId of batch) {
        this.errorSignal(nodeId).set(cause);
        this.settle(nodeId, 'error');
      }
    }
  }

  /** Starts a run for one remote node and describes it for the executor. */
  private buildRemoteRequest(nodeId: NodeId): RemoteRequest | null {
    const definition = this.definition(nodeId);
    if (!definition) return null;

    const run = this.beginRun(nodeId, definition);
    this.computedNodes.push(nodeId);
    this.setStatus(nodeId, 'running');

    const inputs = this.resolveInputs(nodeId);
    this.recordInputs(nodeId, inputs);
    this.lastState.set(nodeId, this.stateValues.get(nodeId));

    return {
      runId: run.id,
      nodeId,
      type: this.nodes.get(nodeId)?.type ?? '',
      inputs,
      state: this.stateValues.get(nodeId),
    };
  }

  private applyRemoteResult(result: RemoteResult): void {
    const definition = this.definition(result.nodeId);
    if (!definition) return;
    if (!result.ok) {
      this.errorSignal(result.nodeId).set(result.error);
      this.settle(result.nodeId, 'error');
      return;
    }
    this.applyOutputs(result.nodeId, result.runId, definition, result.outputs);
    if (result.done !== false) this.settle(result.nodeId, 'done');
  }

  private settle(nodeId: NodeId, status: NodeStatus, version?: number): void {
    // Re-dirtied while this run was in flight: the newer change is still
    // outstanding, so leave the node dirty for the drain to pick up again.
    if (version !== undefined && this.versionOf(nodeId) !== version) {
      this.setStatus(nodeId, 'stale');
      this.readySet.delete(nodeId);
      this.refresh();
      return;
    }

    this.dirty.delete(nodeId);
    this.readySet.delete(nodeId);
    if (this.statusSignal(nodeId)() !== 'cycle') this.setStatus(nodeId, status);
    this.report(nodeId, status);
    this.refresh();
  }

  /** Publish what this node did, and file it under the pass in flight. */
  private report(nodeId: NodeId, status: NodeStatus): void {
    const startedTick = this.startedTicks.get(nodeId);
    this.startedTicks.delete(nodeId);

    const event: NodeSettledEvent = {
      runId: this.session?.id ?? 0,
      nodeId,
      status,
      inputs: { ...this.inputSignal(nodeId)() },
      outputs: { ...this.outputValues.get(nodeId) },
      error: status === 'error' ? this.errorSignal(nodeId)() : undefined,
      durationMs: startedTick === undefined ? 0 : tick() - startedTick,
    };
    this.session?.nodes.push(event);
    this.onNodeSettled?.(event);
  }

  // ================================================================ problems

  private collectProblems(): readonly GraphProblem[] {
    const problems: GraphProblem[] = [];
    for (const [nodeId, node] of this.nodes) problems.push(...this.problemsFor(nodeId, node));
    return problems;
  }

  private problemsFor(nodeId: NodeId, node: EditorNode): readonly GraphProblem[] {
    const definition = this.definition(nodeId);
    if (!definition) {
      if (node.type === undefined) return [];
      return [{
        kind: 'unknown-type',
        nodeId,
        message: `“${node.title}” has type “${node.type}”, which is not registered.`,
        severity: 'error',
      }];
    }

    const problems: GraphProblem[] = [];
    if (definition.remote === true && !this.executeRemote) {
      problems.push({
        kind: 'remote-without-executor',
        nodeId,
        message: `“${node.title}” runs on a backend, but no executor is bound.`,
        severity: 'error',
      });
    }
    if (this.statusSignal(nodeId)() === 'cycle') {
      problems.push({
        kind: 'cycle',
        nodeId,
        message: this.messages.cycle(node.title ?? String(nodeId)),
        severity: 'error',
      });
    }
    problems.push(...this.missingRequiredInputs(nodeId, node, definition));
    return problems;
  }

  private missingRequiredInputs(
    nodeId: NodeId,
    node: EditorNode,
    definition: NodeTypeDefinition,
  ): readonly GraphProblem[] {
    return this.portsOf(nodeId, definition)
      .filter(port => port.direction === 'in' && port.required === true)
      .filter(port => !this.incomingFor(nodeId).some(c => c.targetPort === port.id))
      .map(port => ({
        kind: 'required-input-unconnected' as const,
        nodeId,
        portId: port.id,
        message: this.messages.requiredInput(node.title ?? String(nodeId), port.label),
        severity: 'error' as const,
      }));
  }

  // ============================================================== read-out

  status(nodeId: NodeId): Signal<NodeStatus> {
    return this.statusSignal(nodeId).asReadonly();
  }

  outputs(nodeId: NodeId): Signal<PortValues> {
    return this.outputSignal(nodeId).asReadonly();
  }

  /**
   * The values currently arriving on a node's inputs.
   *
   * Read by a node's view, which is how a node with no `compute` at all — the
   * browser node in the motivating example — still reacts to its upstream.
   */
  inputs(nodeId: NodeId): Signal<PortValues> {
    return this.inputSignal(nodeId).asReadonly();
  }

  /** Stores the resolved inputs for both memoisation and the view. */
  private recordInputs(nodeId: NodeId, inputs: PortValues): void {
    this.lastInputs.set(nodeId, inputs);
    this.inputSignal(nodeId).set(inputs);
  }

  private inputSignal(nodeId: NodeId): WritableSignal<PortValues> {
    let existing = this.inputSignals.get(nodeId);
    if (!existing) {
      existing = signal<PortValues>({});
      this.inputSignals.set(nodeId, existing);
    }
    return existing;
  }

  state(nodeId: NodeId): Signal<unknown> {
    return this.stateSignal(nodeId).asReadonly();
  }

  error(nodeId: NodeId): Signal<unknown> {
    return this.errorSignal(nodeId).asReadonly();
  }

  private statusSignal(nodeId: NodeId): WritableSignal<NodeStatus> {
    let existing = this.statusSignals.get(nodeId);
    if (!existing) {
      existing = signal<NodeStatus>('idle');
      this.statusSignals.set(nodeId, existing);
    }
    return existing;
  }

  private outputSignal(nodeId: NodeId): WritableSignal<PortValues> {
    let existing = this.outputSignals.get(nodeId);
    if (!existing) {
      existing = signal<PortValues>({});
      this.outputSignals.set(nodeId, existing);
    }
    return existing;
  }

  private stateSignal(nodeId: NodeId): WritableSignal<unknown> {
    let existing = this.stateSignals.get(nodeId);
    if (!existing) {
      existing = signal<unknown>(undefined);
      this.stateSignals.set(nodeId, existing);
    }
    return existing;
  }

  private errorSignal(nodeId: NodeId): WritableSignal<unknown> {
    let existing = this.errorSignals.get(nodeId);
    if (!existing) {
      existing = signal<unknown>(null);
      this.errorSignals.set(nodeId, existing);
    }
    return existing;
  }

  private setStatus(nodeId: NodeId, status: NodeStatus): void {
    this.statusSignal(nodeId).set(status);
  }

  /** Abort everything in flight and refuse further work. */
  dispose(): void {
    this.disposed = true;
    // Snapshotted: both loops delete from the collection they read.
    const running = [...this.active.keys()];
    const streaming = [...this.iterators.keys()];
    for (const nodeId of running) this.abortRun(nodeId);
    for (const nodeId of streaming) this.teardownIterator(nodeId);

    this.dirty.clear();
    this.readySet.clear();
    this.startedTicks.clear();

    /*
     * Everything else, because a disposed runtime is finished with.
     *
     * A subgraph builds one of these per evaluation and throws it away, so
     * anything left holding on here is held once per run of every nested
     * graph. Aborting the work was not the same as letting go of it.
     */
    this.nodes.clear();
    this.definitions.clear();
    this.connections = [];
    this.outgoing.clear();
    this.incoming.clear();
    this.connectionsByTarget.clear();
    this.order = [];
    this.position.clear();
    this.dirtyVersion.clear();
    this.outputValues.clear();
    this.stateValues.clear();
    this.lastInputs.clear();
    this.lastState.clear();
    this.emitSeq.clear();
    this.statusSignals.clear();
    this.outputSignals.clear();
    this.inputSignals.clear();
    this.stateSignals.clear();
    this.errorSignals.clear();
    this.computedNodes.length = 0;
    this.session = null;

    /*
     * And the callbacks, which are the ones that hold a whole component.
     *
     * `onRunStarted = event => this.runStarted.emit(event)` closes over the
     * editor. Leaving it attached to a runtime someone else still references
     * keeps the component, its template and its nodes alive behind it.
     */
    this.onRunStarted = null;
    this.onNodeSettled = null;
    this.onRunFinished = null;
    this.executeRemote = null;
  }
}

/**
 * Whether two resolved `collect` values are equal.
 *
 * Element-wise, because a collect port resolves to a NEW array on every pass —
 * an identity check would report a change every time and memoisation would
 * never fire anywhere in the graph (design §4). Falls back to identity when
 * either side is not an array, which also makes two absent values equal.
 */
function sameCollected(next: unknown, last: unknown): boolean {
  if (!Array.isArray(next) || !Array.isArray(last)) return Object.is(next, last);
  return next.length === last.length && next.every((value, i) => Object.is(value, last[i]));
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}
