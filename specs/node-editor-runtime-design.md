# Node Editor Runtime — Detailed Design & Validation

**Companion to** `specs/node-editor-runtime-spec.md` (requirements R1–R17).
Written **before implementation**, so the design can be checked for
contradictions and proved with a spike rather than discovered mid-build.

---

## 1. Incremental topological order

R13 bans re-sorting the whole graph on an edit. The order is therefore
*maintained*, using **Pearce–Kelly**: adding an edge that violates the current
order touches only the region between its endpoints.

```ts
order: NodeId[];                 // topological order
position: Map<NodeId, number>;   // node -> index in `order`
```

**addNode(n)** — append; `position[n] = order.length - 1`. O(1).

**connect(u → v)**

1. If `position[u] < position[v]` the order is already valid. **O(1) — and this
   is the common case**, because nodes are usually created upstream-first.
2. Otherwise the edge inverts the order. Let `lo = position[v]`, `hi = position[u]`.
   - Forward DFS from `v`, visiting only nodes with `position < hi` → set `F`
     (nodes that must end up after `u`).
   - Backward DFS from `u`, visiting only nodes with `position > lo` → set `B`
     (nodes that must end up before `v`).
   - If the forward DFS reaches `u`, the edge closes a **cycle** (§5).
   - Re-place `B` then `F` into the index slots spanning `[lo, hi]`, preserving
     each group's internal order.
3. Cost is O(|B| + |F| + edges between them) — bounded by the *affected region*,
   never by N.

**disconnect(u → v)** — removing an edge cannot invalidate a topological order.
**O(1), no reorder.** Stated explicitly because the naive instinct is to re-sort.

**removeNode(n)** — splice from `order`. To avoid an O(N) index shift per
delete, positions are recomputed **lazily**: a `staleFrom` marker records the
first invalid slot, and any lookup past it triggers one compaction pass.
Deleting k nodes in a single command compacts once.

---

## 2. Dirty propagation

```text
markDirty(n):
  stack = [n]
  while stack:
    x = stack.pop()
    if dirty.has(x): continue        # its descendants are already marked
    dirty.add(x); status[x] = 'stale'
    for (x -> y) in outgoing[x]: stack.push(y)
```

The `continue` on an already-dirty node is what makes this O(descendants)
rather than O(paths); without it, a diamond re-walks its tail once per path.

Triggers: `setState`, an upstream output changing, connect, disconnect, node
added or removed, and a definition being replaced.

### 2.1 Propagation stops where outputs stop changing

**Found by the spike, and stronger than the property it was written to check.**

Marking a node dirty forces *that node* to re-run. It does not force its
descendants to run: they re-run only if the node's **output actually changed**,
because memoisation (§4) then finds their inputs identical and settles them
without computing.

So the real cost of a change is not "the size of the descendant subtree" but
"the length of the path along which values keep differing". A wide graph
hanging off a node that recomputes to the same value costs exactly one node.

This is why the enforced assertion is phrased as *"only descendants recompute"*
and a second one asserts the stronger behaviour directly — a claim that reads
as a subtlety is exactly the kind that regresses silently.

---

## 3. The ready set

Kahn's algorithm, maintained incrementally rather than recomputed — R13 bans
scanning all nodes to discover what is ready.

```ts
pendingDeps: Map<NodeId, number>;  // count of DIRTY upstream nodes
ready: Set<NodeId>;                // dirty nodes whose pendingDeps === 0
```

- Marking a node dirty increments `pendingDeps` for each downstream node and
  removes those from `ready`.
- A node settling (`done` / `error` / `cycle`) decrements each downstream's
  count; reaching 0 puts it in `ready`.
- `step()` takes one node from `ready`; `run()` drains until `ready` is empty
  and nothing is in flight.

`ready` is a `Set`, so membership and removal are O(1) and the loop never scans
the graph.

---

## 4. Memoisation

Before executing a node:

```text
resolved = resolveInputs(n)
if shallowEqualPorts(resolved, lastInputs[n]) and Object.is(state[n], lastState[n]):
    status[n] = 'done'
    settle(n)          # without recomputing, and without propagating
```

`shallowEqualPorts` compares **per port**, and must special-case `collect`
ports: they resolve to a *new array* on every pass, so `Object.is` would always
report a change and memoisation would never fire at all. Collect ports compare
element-wise.

> This is the single easiest way to silently lose every memoisation in the
> system, so it gets its own enforced assertion: *a graph containing a collect
> port recomputes zero nodes when nothing has changed.*

---

## 5. Cycles

Two detection points, and they are not redundant:

1. **At connect time** — the Pearce–Kelly forward DFS reaching `u` proves the
   new edge closes a cycle. This is what `canConnect`'s existing `'cycle'`
   rejection uses when `allowCycles` is `false`.
2. **At evaluation time** — `allowCycles` defaults to **true**, so a graph may
   legitimately contain cycles. Tarjan's SCC runs over the **dirty subgraph
   only**; every node in a non-trivial SCC, or with a self-edge, gets status
   `'cycle'`, is excluded from `ready`, and raises a graph problem.

Nodes downstream of a cycle still evaluate, with those inputs `undefined`.

**The assertion is that the runtime never hangs or overflows the stack on a
cyclic graph** — not that cycles are rejected.

---

## 6. Async runs and staleness

```ts
interface ActiveRun {
  readonly id: number;               // monotonic per node
  readonly controller: AbortController;
}
```

Starting a run for `n`:

```text
prev = active[n]
if prev and policy(n) === 'cancel': prev.controller.abort()
# 'drop' and 'apply' leave the previous run running
active[n] = { id: ++counter[n], controller: new AbortController() }
```

When a result arrives carrying `runId`:

| Current? | Policy | Action |
|---|---|---|
| `runId === active[n].id` | any | apply |
| stale | `cancel` | discard |
| stale | `drop` | discard |
| stale | `apply` | apply |

Only `apply` lets an older run win, and it is opt-in per node type precisely
because that is the motivating example's bug: type fast and the browser node
shows the **older** URL.

Teardown aborts every active run, and the runtime refuses further mutation
afterwards rather than resurrecting itself.

---

## 7. Streams

A `compute` returning an `AsyncIterable` streams:

```text
for await (const partial of iterable):
    if runId !== active[n].id: break      # superseded
    merge partial into outputs[n]
    propagate(n)                          # every yield reaches downstream
```

**Teardown is the part that leaks if it is not explicit.** On abort,
disconnect, node removal or graph teardown the runtime calls
`iterator.return?.()`, so a generator's `finally` runs and its sockets close.
Open iterators are tracked per node and the count is an enforced assertion:
*after disconnecting an edge, zero open iterators remain for that node.*

`mode: 'stream'` inputs receive every emission; `mode: 'value'` inputs hold the
latest only. A stream feeding a value port is legal and simply collapses.

---

## 8. Input resolution

For each input port of `n`:

```text
conns = connections targeting (n, port)

if conns is empty            -> port.default            (undefined if none)
else if multi === 'collect'  -> conns.map(source output), in connection order
else if multi === 'latest'   -> output of whichever upstream emitted most recently
else  /* 'single' */         -> output of conns[0]
```

`'latest'` needs an emission sequence number per output, which the run counter
already provides. Connection order for `'collect'` is creation order and is
preserved by serialisation, so a reloaded graph produces identical results.

---

## 9. Remote batching

Per tick, once the ready set is known:

```text
local  = ready where not definition.remote
remote = ready where     definition.remote

for n in local:  executeLocal(n)
if remote:       executeRemote(remote.map(toRequest), signal)     # ONE call
```

One call for the whole batch is the entire performance argument for the array
signature. `step()` executes exactly one ready node; if that node is remote it
is a batch of one, through the same code path — no special case.

A `remote` node with no `executeRemote` bound raises the
`remote-without-executor` problem and status `'error'`, never a silent hang.

---

## 10. Undo command funnel

Every mutation goes through `apply(command)`, which pushes the inverse.

| Command | Inverse |
|---|---|
| `add-node` | `remove-nodes` |
| `remove-nodes` | `add-node` ×n **plus** `connect` ×m — edges are restored too |
| `move-nodes` | `move-nodes` with negated deltas |
| `connect` | `disconnect` |
| `disconnect` | `connect` |
| `set-state` | `set-state` with `before` |

Two coalescing rules, both load-bearing:

- **A drag is one entry.** The command is pushed on pointer-up with the net
  delta, not per frame — otherwise a single drag fills the history.
- **Typing coalesces.** Consecutive `set-state` on the same node within
  `COALESCE_MS` (400) merge, keeping the *earliest* `before` and the *latest*
  `after`. Without this, undo is per-keystroke and useless.

History is bounded at 100 entries; the oldest is dropped.

Undo restores graph state only. It does **not** replay side effects; whether
effectful nodes re-run afterwards follows their `reactive` flag, exactly like
any other change.

---

## 11. Contradiction sweep

Every pair of decisions that could conflict, and how it resolves.

| Decisions in tension | The tension | Resolution |
|---|---|---|
| R3 live eval × R13 thousands of nodes | Re-evaluating a 10k graph on every keystroke | Only descendants recompute (§2); memoisation (§4) makes an unchanged subtree free. A keystroke in a leaf costs O(1). |
| R4 streams × R9 cancel-by-default | Aborting a superseded run kills a long-lived stream the user wanted kept | A stream node's steady state is *one* run; a new run starts only when its inputs or state change, which genuinely invalidates it. Nodes wanting otherwise set `staleness: 'drop'`. |
| R6 batched remote × R5 `step()` one node | Batching implies many, stepping implies one | `step()` sends a batch of one. Same path, no special case. |
| R8 `collect` × §4 memoisation | Collect resolves to a fresh array, so identity always differs | Element-wise comparison for collect ports, with its own enforced assertion. |
| R11 undo × R3 live eval | Undo restoring state re-triggers computes | Correct and intended — undo is a state change like any other. Effectful nodes are gated by `reactive: false` regardless. |
| R11 undo × R4 streams | Undoing mid-stream | Undo changes graph state; the affected node's run is superseded and torn down by §6/§7. No special case. |
| R14 subgraph seam × any global state | A singleton scheduler would make nested runtimes share state | No global state in the runtime — enforced by a test that instantiates two runtimes and proves isolation. |
| R12 JSON × arbitrary node state | State may not be serialisable | Contract requires JSON-safe state; a dev-mode check names the offending node. |
| R16 problems × R13 scale | Recomputing all problems on every change | Problems derive from the same dirty set incrementally, not by re-scanning. |

**No contradiction survives that the design cannot absorb.** The two needing a
real answer were `collect` × memoisation, and streams × cancel-by-default.

---

## 12. The motivating example, traced

| Step | What happens | Cost |
|---|---|---|
| user types `e` | `onInput` → `ctx.setState({ value: 'e' })` | — |
| | `markDirty(text-1)`; descendants = `{ browser-1 }` | O(1) |
| | `pendingDeps[browser-1] = 1`; `ready = { text-1 }` | O(1) |
| | `text-1` memo check: state changed → compute → `{ text: 'e' }` | O(1) |
| | output differs → `browser-1` stays dirty; `text-1` settles | O(1) |
| | `pendingDeps[browser-1] → 0`; `ready = { browser-1 }` | O(1) |
| | `browser-1` has no compute; its `url` input signal updates | O(1) |
| | `BrowserNodeComponent.safe` recomputes → iframe `src` | O(1) |

**Work per keystroke is independent of graph size.** That is the performance
and DX claim in one line, and §14 turns it into an enforced count.

---

## 13. DX check — is the consumer code actually pleasant?

Written out, a node type is one object literal, its view is an ordinary Angular
component, and the only library-specific thing in it is `inject(NODE_CONTEXT)`.
No scheduler, no subscription, no lifecycle hooks. **A node type with no view
and no state is four lines.** If that grows, the design has drifted.

One remaining DX risk: `compute` returning `O | Promise<O> | AsyncIterable<Partial<O>>`
is a wide union. Mitigated by inferring the type parameters from `ports`, so
authors get completion on real port names rather than `string`.

---

## 14. What the spike must prove

The design is **not accepted** until a throwaway spike demonstrates all of:

| # | Claim | From |
|---|---|---|
| 1 | `connect` does not re-sort the whole order in the common case | §1 |
| 2 | Changing one node recomputes only its descendants | §2 |
| 3 | Unchanged inputs recompute nothing — **including with a collect port** | §4 |
| 4 | A cyclic graph terminates | §5 |
| 5 | A superseded async result never wins under `cancel`/`drop`, and does under `apply` | §6 |
| 6 | Disconnecting a streaming edge runs the generator's `finally` | §7 |
| 7 | K ready remote nodes produce exactly 1 executor call | §9 |
| 8 | `step()` advances exactly one node | §3 |
| 9 | Two runtime instances share no state | R14 |
| 10 | Undo of a drag is one entry; of five fast keystrokes, one entry | §10 |
| 11 | Propagation halts where an output stops changing | §2.1 |

These are the same assertions the shipped suite enforces. **If the spike cannot
produce them, the design is wrong and changes before any production code
exists.**

## 15. Validation result — 2026-08-22

**The spike passes all of them: 25 assertions, 0 failures.** It implemented
Pearce–Kelly ordering, dirty propagation, the incremental ready set,
memoisation with element-wise collect comparison, Tarjan cycle exclusion,
async runs with all three staleness policies, `AsyncIterable` streaming with
teardown, remote batching and the undo coalescing rules — in ~500 throwaway
lines, with no Angular and no signals.

One assertion failed on the first run, and it was the *test* that was wrong:
it changed the state of a node whose `compute` ignores state, then expected the
descendant to recompute. The descendant correctly memoised, which is §2.1
above. That is precisely the value of validating before building — the
behaviour was right, the written claim was imprecise, and the imprecision was
caught while it cost nothing to fix.

**Design accepted. Implementation may proceed.** The spike is deleted when the
production runtime lands; its assertions move into the shipped suite (§10 of
the requirements spec).
