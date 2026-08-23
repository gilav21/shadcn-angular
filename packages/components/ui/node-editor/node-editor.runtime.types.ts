/**
 * The runtime contract: node types, the values that flow between them, and the
 * two contexts a developer touches.
 *
 * This is the whole DX surface. See `specs/node-editor-runtime-spec.md` §2 —
 * a node type with no view and no state is four lines, and if that grows the
 * design has drifted.
 */
import { InjectionToken, type Signal, type Type } from '@angular/core';
import type { NodeId, NodePort } from './node-editor.types';

/** Values on a node's ports, keyed by port id. */
export type PortValues = Record<string, unknown>;

/**
 * How an input port behaves when more than one connection lands on it.
 *
 * - `single` — one connection only; the editor refuses a second (`occupied`).
 * - `collect` — an array, in connection order. Deterministic across reloads,
 *   because connection order is preserved by serialisation.
 * - `latest` — whichever upstream most recently produced a value.
 */
export type PortMulti = 'single' | 'collect' | 'latest';

/** `stream` ports see every emission; `value` ports hold only the latest. */
export type PortMode = 'value' | 'stream';

/** A port, with the runtime semantics the structural editor does not need. */
export interface NodePortDefinition extends NodePort {
  mode?: PortMode;
  multi?: PortMulti;
  /** An unconnected required input makes the node, and the graph, invalid. */
  required?: boolean;
  /** Used when nothing is connected and the port is not required. */
  default?: unknown;
}

/**
 * What happens to a run that has been superseded by a newer one.
 *
 * `cancel` is the default because `apply` reproduces the exact bug this
 * component exists to prevent: type quickly into a text node and a slow run
 * resolving after a newer one shows the **older** value downstream.
 */
export type StalenessPolicy = 'cancel' | 'drop' | 'apply';

/** Passed to `compute`. */
export interface ComputeContext<S = unknown> {
  readonly state: S;
  /** Fired when this run is superseded, or the runtime is torn down. */
  readonly signal: AbortSignal;
  /** Persist new state for this node. Marks it dirty. */
  setState(next: S): void;
  /** Push a value on an output without returning one — for imperative sources. */
  emit(portId: string, value: unknown): void;
}

/**
 * What `compute` may return.
 *
 * An `AsyncIterable` streams: every yield is merged into the node's outputs and
 * propagated downstream, and the iterator is torn down (so a generator's
 * `finally` runs) when the run is superseded or an edge is disconnected.
 */
export type ComputeResult<O extends PortValues = PortValues> =
  | O
  | Promise<O>
  | AsyncIterable<Partial<O>>;

/** A developer-defined node type. */
export interface NodeTypeDefinition<
  S = unknown,
  I extends PortValues = PortValues,
  O extends PortValues = PortValues,
> {
  /** Stable id, referenced by `EditorNode.type` and by serialised graphs. */
  readonly id: string;
  readonly label: string;
  readonly category?: string;
  readonly ports: readonly NodePortDefinition[];

  /** Per-node state the view edits — the text in a text-input node. */
  readonly initialState?: () => S;

  /** Component rendered inside the card. Injects {@link NODE_CONTEXT}. */
  readonly view?: Type<unknown>;

  /**
   * Vertical space, in world units, the {@link view} needs below the ports.
   *
   * Required in spirit whenever `view` is set: the node's height is derived
   * from its ports, so a view that declares nothing gets the port rows drawn
   * straight over its content.
   */
  readonly bodyHeight?: number;

  /**
   * Whether this type is safe to evaluate on every change.
   *
   * `true` for pure transforms, which then stream live. `false` for anything
   * with side effects, which waits for an explicit run.
   */
  readonly reactive?: boolean;

  /** Hand this node's work to the editor's `executeRemote` instead of `compute`. */
  readonly remote?: boolean;

  readonly staleness?: StalenessPolicy;

  /** The work. Omit entirely for a pure-UI node that only calls `setState`. */
  compute?(inputs: I, ctx: ComputeContext<S>): ComputeResult<O>;

  /** Accent colour for the card header. */
  readonly accent?: string;
}

/** Where a node is in its lifecycle. */
export type NodeStatus =
  | 'idle'
  | 'stale'
  | 'ready'
  | 'running'
  | 'done'
  | 'error'
  | 'cycle';

/**
 * One node's finished work.
 *
 * Carries the inputs it saw and the outputs it produced, not just the fact
 * that it finished — because the question a run history exists to answer is
 * *"what did node X actually get on run #47"*, and a status alone cannot
 * answer it.
 */
export interface NodeSettledEvent {
  /** The evaluation pass this belongs to. */
  readonly runId: number;
  readonly nodeId: NodeId;
  readonly status: NodeStatus;
  readonly inputs: PortValues;
  readonly outputs: PortValues;
  /** Present only when `status` is `error`. */
  readonly error?: unknown;
  /** Monotonic, in milliseconds. Zero for a memo hit — it did no work. */
  readonly durationMs: number;
}

/**
 * An evaluation pass beginning: the first ready node through to nothing left.
 *
 * Re-entrant calls join the pass already in flight rather than starting a new
 * one, so this fires once per settled-to-settled cycle — which is what a
 * person means by "a run". A call with nothing to do starts no pass at all,
 * so an idle editor does not fill the history with empty entries.
 */
export interface RunStartedEvent {
  readonly runId: number;
  /** Wall clock, for display alongside the record. */
  readonly startedAt: number;
  /** What was ready when it began; more may be dirtied as it goes. */
  readonly nodes: readonly NodeId[];
}

/** An evaluation pass ending, with everything that settled inside it. */
export interface RunFinishedEvent {
  readonly runId: number;
  readonly startedAt: number;
  readonly durationMs: number;
  /** In settle order, which is the order the work actually completed. */
  readonly nodes: readonly NodeSettledEvent[];
  /** `error` when any node in the pass errored. */
  readonly status: 'done' | 'error';
}

/** One node's values as they were, for replay. */
export interface ReplayNodeValues {
  readonly status: NodeStatus;
  readonly inputs: PortValues;
  readonly outputs: PortValues;
}

/**
 * A past run's values, shown in place of the live ones.
 *
 * Bound to the editor, this is what makes *"what happened on run #47"* a thing
 * you can look at rather than read in a table: the same node views render the
 * recorded values. Evaluation stops while a frame is bound — a graph cannot be
 * showing the past and computing the present at once.
 */
export type ReplayFrame = Readonly<Record<NodeId, ReplayNodeValues>>;

/** Why a graph is not valid. Rendered in plain language, never as the code. */
export type GraphProblemKind =
  | 'required-input-unconnected'
  | 'cycle'
  | 'remote-without-executor'
  | 'unknown-type'
  | 'compute-error';

export interface GraphProblem {
  readonly kind: GraphProblemKind;
  readonly nodeId: NodeId;
  readonly portId?: string;
  /** Already human-readable — the consumer should not have to translate a code. */
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

/** One node's work, handed to the backend. */
export interface RemoteRequest {
  readonly runId: number;
  readonly nodeId: NodeId;
  /** The node type's id, so a server can dispatch on it. */
  readonly type: string;
  readonly inputs: PortValues;
  readonly state: unknown;
}

export type RemoteResult =
  | {
      readonly runId: number;
      readonly nodeId: NodeId;
      readonly ok: true;
      readonly outputs: PortValues;
      /** For streaming executors: `false` means more results will follow. */
      readonly done?: boolean;
    }
  | {
      readonly runId: number;
      readonly nodeId: NodeId;
      readonly ok: false;
      readonly error: string;
    };

/**
 * The backend hand-off.
 *
 * Takes an **array** deliberately: the runtime already computes the ready set,
 * so every ready remote node in a tick is one call. A per-node contract cannot
 * batch without every consumer writing that layer themselves.
 *
 * Returning the promise is resolution; throwing is failure; the `AbortSignal`
 * arrives already wired. Returning an `AsyncIterable` streams partial results.
 */
export type RemoteExecutor = (
  batch: readonly RemoteRequest[],
  signal: AbortSignal,
) => Promise<readonly RemoteResult[]> | AsyncIterable<RemoteResult>;

/**
 * Injected into a node type's `view` component. The only library-specific
 * thing a view needs.
 *
 * > **On DI.** This repo bans provider-based library *configuration*
 * > (`provideNodeEditor({...})`). A token carrying per-instance context into a
 * > component created by `NgComponentOutlet` is not that: it configures
 * > nothing, and it is the only mechanism Angular offers for the job.
 */
export interface NodeContext<S = unknown> {
  readonly nodeId: NodeId;
  readonly state: Signal<S>;
  setState(next: S): void;

  /** The value currently arriving on an input port. */
  input<T>(portId: string): Signal<T | undefined>;
  /** The value this node last produced on an output port. */
  output<T>(portId: string): Signal<T | undefined>;

  readonly status: Signal<NodeStatus>;
  readonly error: Signal<unknown>;
}

export const NODE_CONTEXT = new InjectionToken<NodeContext>('NODE_CONTEXT');
