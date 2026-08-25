# Node Editor Runtime — Requirements & Architecture

**Status:** requirements agreed, not started · **Branch:** TBD · **Wave:** 1
**Builds on:** `specs/node-editor-spec.md` (structure, ports, a11y — complete)

The editor today is **structural**: nodes have ports, connections are recorded,
and nothing flows. This spec turns it into **generic infrastructure for
workflows — showing, managing, editing, and running them** — on which
genre-specific products (workflow automation, dataflow/computation, visual app
building) are built as addons rather than forks.

---

## 0. The brief, in the maintainer's words

> "I see it as a generic infra for workflows showing, managing, editing and
> even running. It can be defined as runnable steps, one step at a time; as
> dataflow where updating the URL immediately updates the website in the
> browser node; it can be the app itself if the developer wants. The idea is
> having the base infra and then addons for workflow automation, dataflow and
> computation, visual app building, or whatever else. The base can be the base
> for them all."

> "Performance is key, and most important alongside DX."

The motivating example, which the design must satisfy end to end:

```text
┌─ Text input ──┐      ┌─ Browser ─────────┐
│ [example.com] │ ───▶ │ url               │
└───────────────┘      │  ┌──────────────┐ │
                       │  │   <iframe>   │ │
                       │  └──────────────┘ │
                       └───────────────────┘
```

Typing in the text node streams each keystroke to the browser node's `url`
input, with no Run button and no perceptible delay.

---

## 1. Agreed requirements

Every row was decided explicitly. Where a default is stated, it is overridable.

| # | Decision | Chosen |
|---|---|---|
| R1 | Product identity | **Generic base**; workflow-automation / dataflow / visual-app-building are addons |
| R2 | Execution location | **Browser by default**, with a defined hand-off so real work can run on a backend |
| R3 | Evaluation trigger | **Both live and explicit-run, declared per node type** |
| R4 | Edge payload | **Values by default, streams when a port declares it** |
| R5 | Run control in base | **`run()` + `step()` one node** — a debugger is an addon |
| R6 | Backend contract | **Batched function input**, with an event as an escape hatch |
| R7 | Stream primitive | **`AsyncIterable`** — no RxJS in the public API |
| R8 | Multi-input semantics | **Declared per port**: what an input accepts, and sync vs async |
| R9 | Staleness | **Cancel by default**, overridable per node type |
| R10 | Performance gates | **Counts enforced, timings logged** |
| R11 | Undo/redo | **In the base, from day one** (command pattern) |
| R12 | Serialisation | **Base owns a versioned JSON format** |
| R13 | Scale | **Thousands of nodes** — incremental everything, no full-graph walks |
| R14 | Subgraphs | **Design the seam now, build later** |
| R15 | Adding nodes | **Base emits intent + owns insertion**; palette UI is an addon |
| R16 | Validation surface | **Inline at the pointer, plus a graph problems list** |
| R17 | Base/addon boundary | **Base owns what needs the internal model** (see §9) |

---

## 2. The developer-facing contract

This is the surface a consumer writes against. It is the whole DX story, so it
is specified before any internals.

### 2.1 Defining a node type

```ts
export interface NodeTypeDefinition<S = unknown, I = PortValues, O = PortValues> {
  /** Stable id, referenced by `EditorNode.type` and by serialised graphs. */
  id: string;
  label: string;
  category?: string;

  ports: readonly NodePortDefinition[];

  /** Per-node state the view can edit — the text in a text-input node. */
  initialState?: () => S;

  /** Component rendered inside the card. Injects NODE_CONTEXT. */
  view?: Type<unknown>;

  /**
   * Whether this type is safe to evaluate on every change (R3).
   * `true` for pure transforms; `false` for anything with side effects, which
   * then waits for an explicit run.
   */
  reactive?: boolean;              // default true

  /** Hand this node's work to `executeRemote` rather than running compute. */
  remote?: boolean;                // default false

  /** What happens to a run that has been superseded (R9). */
  staleness?: 'cancel' | 'drop' | 'apply';   // default 'cancel'

  /**
   * The work. Sync, async, or an async generator for streaming outputs.
   * Omit entirely for a pure-UI node that only calls `ctx.setState`.
   */
  compute?(inputs: I, ctx: ComputeContext<S>):
    | O
    | Promise<O>
    | AsyncIterable<Partial<O>>;
}
```

### 2.2 Declaring a port (R8)

Extends the existing `NodePort`, so structure and runtime share one type.

```ts
export interface NodePortDefinition extends NodePort {
  /** `'stream'` ports receive every emission; `'value'` ports hold the latest. */
  mode?: 'value' | 'stream';                  // default 'value'

  /**
   * What an input accepts when several connections land on it.
   *  - `'single'`  one connection only; the editor refuses a second ('occupied')
   *  - `'collect'` an array, in connection order — deterministic
   *  - `'latest'`  whichever upstream most recently produced
   */
  multi?: 'single' | 'collect' | 'latest';    // default 'single'

  /** An unconnected required input makes the node — and the graph — invalid. */
  required?: boolean;
  /** Used when nothing is connected and the port is not required. */
  default?: unknown;
}
```

`multi` and `mode` are orthogonal on purpose: a `collect` + `stream` port is a
fan-in of live sources, which is exactly what a "merge events" node is.

### 2.3 The compute context

```ts
export interface ComputeContext<S = unknown> {
  readonly state: S;
  /** Fired when this run is superseded or the graph is torn down (R9). */
  readonly signal: AbortSignal;
  /** Persisted per node; setting it marks the node dirty. */
  setState(next: S): void;
  /** Push a value on an output without returning — for imperative sources. */
  emit(portId: string, value: unknown): void;
}
```

### 2.4 The view context

A node's `view` component injects this. It is the *only* thing a view needs.

```ts
export const NODE_CONTEXT = new InjectionToken<NodeContext>('NODE_CONTEXT');

export interface NodeContext<S = unknown> {
  readonly node: Signal<EditorNode>;
  readonly state: Signal<S>;
  setState(next: S): void;

  /** The value currently arriving on an input. */
  input<T>(portId: string): Signal<T | undefined>;
  /** The value this node last produced on an output. */
  output<T>(portId: string): Signal<T | undefined>;

  readonly status: Signal<NodeStatus>;
  readonly error: Signal<unknown>;
}
```

> **On DI.** This repo bans *provider-based library configuration*
> (`provideNodeEditor({...})`). An injection token carrying per-instance
> context into a dynamically created component is not that: it is the only
> mechanism Angular offers for component-to-component data when the component
> is created by `NgComponentOutlet`, and it configures nothing. The
> distinction is deliberate and worth keeping straight.

### 2.5 The motivating example, complete

```ts
const TEXT_INPUT: NodeTypeDefinition<{ value: string }> = {
  id: 'text-input',
  label: 'Text input',
  ports: [{ id: 'text', direction: 'out', label: 'Text', type: 'text' }],
  initialState: () => ({ value: '' }),
  view: TextInputNodeComponent,
  compute: (_inputs, ctx) => ({ text: ctx.state.value }),
};

@Component({
  template: `<input [value]="ctx.state().value" (input)="onInput($event)">`,
})
class TextInputNodeComponent {
  readonly ctx = inject(NODE_CONTEXT) as NodeContext<{ value: string }>;
  onInput(e: Event) {
    this.ctx.setState({ value: (e.target as HTMLInputElement).value });
  }
}

const BROWSER: NodeTypeDefinition = {
  id: 'browser',
  label: 'Browser',
  ports: [{ id: 'url', direction: 'in', label: 'URL', type: 'text', required: true }],
  view: BrowserNodeComponent,
};

@Component({ template: `<iframe [src]="safe()" sandbox="allow-scripts"></iframe>` })
class BrowserNodeComponent {
  private readonly ctx = inject(NODE_CONTEXT);
  private readonly url = this.ctx.input<string>('url');
  readonly safe = computed(() => sanitize(this.url()));
}
```

`setState` → node dirty → `compute` → `text` output → connection → `url` input
signal → `computed` → iframe. No scheduler in the consumer's code, and no Run
button. **That path is the DX benchmark: if it needs more than the above, the
design is wrong.**

---

## 3. The backend hand-off (R2, R6)

One typed function input. Not DI, not a resolve/reject handshake.

```ts
readonly executeRemote = input<RemoteExecutor | null>(null);

type RemoteExecutor = (
  batch: readonly RemoteRequest[],
  signal: AbortSignal,
) => Promise<readonly RemoteResult[]> | AsyncIterable<RemoteResult>;

interface RemoteRequest {
  readonly runId: string;
  readonly nodeId: NodeId;
  readonly type: string;          // node type id
  readonly inputs: PortValues;
  readonly state: unknown;
}

type RemoteResult =
  | { runId: string; ok: true; outputs: PortValues; done?: boolean }
  | { runId: string; ok: false; error: string };
```

**Why an array is the whole performance argument.** The runtime already
computes the ready set for `step()`. Every ready *remote* node in a tick is one
call — twelve nodes, one request. A per-node contract cannot do this without
the consumer writing their own batching layer, and most never will.

**Why a function and not an event.** Returning the promise *is* resolution;
throwing *is* failure; the `AbortSignal` arrives already wired. There is no
handshake to forget, and no node that hangs in `running` forever because a
`resolve()` was missed on one branch.

Returning an `AsyncIterable` covers streaming and progress: yield partial
results as they arrive, keyed by `runId`.

**The escape hatch (R6).** A `(nodeExecute)` output fires alongside, for
observing, logging or intercepting. It is explicitly *not* authoritative —
`executeRemote` does the work. Documented that way, and a `remote` node with
no `executeRemote` bound is a **graph problem** surfaced in the problems list
(§7), never a silent hang.

---

## 4. The runtime

`node-editor.runtime.ts` — a plain class, no Angular DI, signals for read-out
so it is directly unit-testable and instantiable standalone (which R14 needs).

### 4.1 State

```ts
class NodeGraphRuntime {
  readonly status: (id: NodeId) => Signal<NodeStatus>;
  readonly outputs: (id: NodeId) => Signal<PortValues>;
  readonly problems: Signal<readonly GraphProblem[]>;
  readonly ready: Signal<readonly NodeId[]>;   // what step() would pick

  setGraph(nodes, connections, definitions): void;
  setState(id: NodeId, state: unknown): void;

  run(): Promise<void>;      // to completion
  step(): Promise<void>;     // exactly one ready node
  reset(): void;
}

type NodeStatus = 'idle' | 'stale' | 'ready' | 'running' | 'done' | 'error' | 'cycle';
```

### 4.2 Incremental evaluation (R13)

The scale requirement bans three things outright, permanently:

1. **Re-sorting the whole graph on an edit.** Topological order is maintained
   incrementally; connect/disconnect patches it.
2. **Scanning all nodes to find the ready set.** The ready set is maintained as
   a set, updated as dependencies complete.
3. **Recomputing anything not downstream of the change.** A change marks the
   node and its descendants dirty via the adjacency index — nothing else.

Memoisation: a node is skipped when its resolved inputs and its state are all
`Object.is`-equal to the previous run's. Shallow per key, no serialisation, so
the check is O(ports) not O(payload).

### 4.3 Cycles (R14 groundwork)

Cycles are legal at the structure level (`allowCycles` defaults true), so the
runtime must not hang. Tarjan's SCC over the dirty subgraph; every node in a
non-trivial SCC gets status `'cycle'`, is not evaluated, and produces a graph
problem. Descendants still evaluate, with those inputs undefined.

### 4.4 Async and staleness (R9)

Each run gets a monotonic `runId` and an `AbortController`.

| Policy | Superseded run | Late result |
|---|---|---|
| `cancel` *(default)* | aborted | discarded |
| `drop` | left to finish | discarded |
| `apply` | left to finish | applied |

`cancel` is the default because `apply` breaks the motivating example: type
fast, and a slow run resolving after a newer one shows the **older** URL. That
is the bug class this component exists to prevent, so it is not the default.

### 4.5 Subgraph seam (R14)

Nesting is not built. It is made *possible* by two constraints held from the
first commit:

- `NodeGraphRuntime` is instantiable standalone, with **no global or singleton
  state whatsoever**.
- A node's `compute` may own and drive a child runtime.

A future `subgraph` node type is then an ordinary node whose compute runs an
inner runtime and maps outer ports to inner boundary nodes. Nothing in the base
needs to change. **Any singleton introduced into the runtime breaks this**, and
that is the test to apply when reviewing runtime changes.

---

## 5. Undo/redo (R11)

Every mutation is a command with an inverse. This is decided now because
retrofitting it means rewriting every edit path.

```ts
type GraphCommand =
  | { kind: 'add-node'; node: EditorNode }
  | { kind: 'remove-nodes'; nodes: EditorNode[]; connections: NodeConnection[] }
  | { kind: 'move-nodes'; deltas: Map<NodeId, CanvasPoint> }
  | { kind: 'connect'; connection: NodeConnection }
  | { kind: 'disconnect'; connection: NodeConnection }
  | { kind: 'set-state'; nodeId: NodeId; before: unknown; after: unknown };
```

Notes that matter:

- A drag is **one** command covering the whole gesture, not one per frame.
- Typing coalesces: consecutive `set-state` on one node within a short window
  merge into a single history entry, or undo becomes per-keystroke and useless.
- History is bounded (default 100) so a long session cannot grow without limit.
- Undoing does **not** replay side effects. It restores graph state; whether
  effectful nodes re-run is governed by their `reactive` flag like any change.

The same funnel gives collaboration and audit a hook later, for free.

---

## 6. Serialisation (R12)

```jsonc
{
  "version": 1,
  "nodes": [
    { "id": "t1", "type": "text-input", "x": 0, "y": 0,
      "state": { "value": "example.com" } }
  ],
  "connections": [
    { "id": "c1", "from": ["t1", "text"], "to": ["b1", "url"] }
  ]
}
```

One format serves save/load, the `executeRemote` payload shape, undo snapshots
and e2e fixtures. `version` is present from v1 so a migration has somewhere to
hook. Node `state` must be JSON-serialisable — stated in the contract, and
validated in dev with a clear error naming the node.

---

## 7. Validation and legibility (R16)

The complaint this answers, verbatim: *"I can't understand the logic of why
some works, some are blocked."*

**At the pointer, during a drag:**

- Compatible ports highlight; incompatible ones dim to ~20%. Valid targets
  become obvious *before* an attempt, not after.
- The reason rides next to the cursor in plain language, resolved from the
  existing `ConnectRejection` union:
  `"Rows is a table, Key expects text"` — never `type-mismatch`.
- Port chips show their `type`, so incompatibility is predictable at rest.

**Graph problems list**, from `runtime.problems()`:

| Problem | Example |
|---|---|
| `required-input-unconnected` | Lookup — 'Key' is required but not connected |
| `cycle` | Filter → Write → Filter |
| `remote-without-executor` | 'Fetch' is a remote node but executeRemote is not bound |
| `unknown-type` | Node 'x7' has type 'foo', which is not registered |
| `compute-error` | Uppercase failed: Cannot read property 'toUpperCase' |

The base **exposes** the list and renders inline pointer feedback; a panel
component to display the list is an addon (§9).

---

## 8. Interaction changes the runtime forces

Not cosmetic — the current editor actively prevents the motivating example.

1. **Controls inside a node must work.** `pointerdown` on an `input`,
   `button`, `select`, `textarea` or `[contenteditable]` inside a node must not
   start a node drag. There is precedent in this repo: the collapsible
   trigger's `INTERACTIVE` selector.
2. **Card element follows body ownership.** The existing button/fieldset split
   already encodes "editor owns the body → `<button>`; someone else owns it →
   `<fieldset>`". A node type with a `view` takes the fieldset branch, for the
   same reason a projected template does — its content may hold controls.
3. **Drag handle.** With arbitrary controls in a card, dragging from anywhere
   becomes ambiguous. The header is the drag handle; the body is the view's.

---

## 9. Base / addon boundary (R17)

**The rule: the base owns whatever must know the graph's internal model. An
addon is anything that needs only the public API.** If an addon ever needs
something the base does not expose, the base's API is incomplete — that is not
a reason to move the feature in.

| In the base | Why |
|---|---|
| canvas, ports, edges, connect/disconnect | the model itself |
| runtime, scheduling, memoisation | reaches into the dirty set and topo order |
| undo/redo | must intercept every mutation |
| serialisation | must know every field |
| validation + problems | derived from the internal graph |
| keyboard + screen-reader model | must know structure to describe it |
| `executeRemote` hook | the runtime decides what is ready and batches it |

| Addon | Needs only |
|---|---|
| minimap | node positions |
| node palette / search | the type registry |
| auto-layout | nodes + edges in, positions out |
| problems panel | `runtime.problems()` |
| run history / replay | runtime events + serialised graphs |
| groups / comments | selection + an overlay slot |
| subgraphs | a standalone runtime instance (§4.5) |
| credentials / secrets | nothing from the base |

---

## 10. Performance (R10)

**Enforced — counts only, so no wall clock can flake them:**

| Assertion | Guards against |
|---|---|
| K ready remote nodes → exactly 1 `executeRemote` call | losing batching |
| changing one node recomputes only its descendants | a full-graph walk |
| unchanged inputs → 0 recomputes | memoisation regressing |
| after disconnect, 0 open streams for that edge | a subscription leak |
| no full topological re-sort on connect/disconnect | R13 violation |

**Logged, never enforced** — visible regressions without a red build:

```text
[perf] propagation p95 (10k graph): 1.4ms
[perf] recomputed: 12 of 10,000
[perf] first full run: 63ms
```

This split is deliberate. This repo has been bitten repeatedly by gates that
assert a *proxy* for the thing they care about, and by timing gates flaking
under load. A count is exact, cheap and machine-checkable; a millisecond on a
busy Windows box is neither.

---

## 11. Task list

| # | Task | Gate |
|---|---|---|
| RT-1 | Types: `NodeTypeDefinition`, `NodePortDefinition`, contexts | — |
| RT-2 | `runtime.ts` — incremental topo order + dirty set + ready set | Unit: no full re-sort, scoped dirty |
| RT-3 | Memoisation + sync compute | Unit: 0 recomputes when unchanged |
| RT-4 | Async compute, `runId`, AbortSignal, staleness policies | Unit: late result never wins |
| RT-5 | Streams via `AsyncIterable`; `multi` collect/latest | Unit: teardown on disconnect |
| RT-6 | Cycle detection (SCC) → `'cycle'` status + problem | Unit: does not hang |
| RT-7 | `run()` / `step()` / `reset()` | Unit: step advances exactly one |
| RT-8 | `executeRemote` batching + `(nodeExecute)` escape hatch | Unit: K nodes → 1 call |
| RT-9 | Undo/redo command funnel + coalescing | Unit: drag = 1 entry |
| RT-10 | Versioned JSON round-trip | Unit: fixture survives a round trip |
| RT-11 | Editor integration: `[definitions]`, per-node injector, view outlet | Component spec |
| RT-12 | Interaction: interactive-content drag skip, header handle | Component spec + touch |
| RT-13 | Validation: pointer feedback, port type chips, problems list | Component spec + a11y |
| RT-14 | Status + error + live-region announcements | a11y spec, axe clean |
| RT-15 | Demo: text-input → uppercase → browser, live | Manual + e2e |
| RT-16 | Perf spec: counts enforced, timings logged | Runs in CI |
| RT-17 | Stories, docs, registry, playground | Sweep spec passes |
| RT-18 | Full gates | lint · tests · coverage · **`npm run sonar`** |

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Runtime complexity swamps the component | Runtime is a standalone class with no Angular dependency; it is tested directly, not through the DOM |
| Live evaluation makes typing janky | `reactive` is per type; memoisation on inputs+state; only descendants recompute |
| A singleton creeps into the runtime | Breaks the subgraph seam (§4.5) — called out as a review test |
| Streams leak on disconnect | An enforced count assertion, not a code review habit |
| `apply` staleness looks harmless | It is the exact bug in the motivating example; default is `cancel` and the docs say why |
| Undo bloats memory on long sessions | Bounded history, coalesced state edits |
| Scope: this is larger than the structural editor was | Tasks are independently landable; RT-1..RT-10 are pure and need no UI |
