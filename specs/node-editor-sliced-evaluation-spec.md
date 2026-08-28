# Sliced evaluation — 100,000 nodes with logic actually running

> **Status:** revision 2, after three plan reviews. Not yet implemented.
> **Branch:** `feat/infinite-canvas-subgraphs`, on top of `0bcad096`.
>
> Revision 1 was reviewed by three independent agents before any code was
> written. They found **eleven** defects in it, none of which the test list in
> revision 1 would have caught — including one that made the feature a no-op on
> the very graph it was designed for, and one that produced silently wrong
> values. Their findings are folded in below; §9 records what was wrong with
> revision 1 so the reasoning is not lost.

---

## 1. Goal, stated honestly

Run a 100,000-node graph with real `compute` functions, keep the page
responsive throughout, and make the evaluation wavefront **visible**.

The user's model — "it propagates a layer at a time, like a neural network" —
is right, and the runtime already implements it. `drain()` is a topological
wavefront (`runtime.ts:1235`): `runnableNow()` returns exactly the nodes whose
upstreams are all clean, `execute` runs them, repeat. Ordering is already
correct and already tested.

**The defect is that the drain never yields.** `await Promise.all(...)` over
synchronous computes resolves in *microtasks*, which do not let the browser
paint. Every layer runs back-to-back in one block of main thread.

### Scoped goals

1. **The drain** never holds the main thread for more than a slice budget.
2. Panning, zooming and dragging stay smooth *while the graph evaluates*.
3. The wavefront is perceptible.
4. An edit, a deletion or a graph swap mid-run is handled without corruption.
5. A run can be stopped.
6. No behaviour change for graphs that finish inside one slice.

### Explicitly NOT met, and why it is stated here

**A cold 100k load still blocks.** Pressing Run on a fresh 100k board runs
~1s+ of unbroken main thread before the first slice: materialise 100k, index
100k, build 96k edge descriptors, index 100k spatially, then `setGraph` —
which alone mints a state signal per node in `addNode`, calls `markDirty` per
node and per connection (each walking a downstream cone), sweeps a 100k dirty
set in `refresh`, builds four 100k collections in `excludeCycles`, and then
`collectProblems` mints a **status signal for all 100,000**. Roughly 300k
signals before evaluation starts.

Revision 1 called this out of scope on the strength of one number (365ms for
`setGraph`) and was wrong twice over: the real figure is the sum of five steps,
and it is plausibly the larger half of what the user feels. It stays out of
scope for *this* change, but the goal above is now worded to say so, and §6
adds a follow-up. **§7's acceptance measurement must state whether it samples
across the build or only the drain, or the number is meaningless.**

### Non-goals

- Making evaluation faster in total. Slicing costs wall-clock; accepted.
- Off-main-thread compute. `compute` closes over consumer state.
- Priority by screen position. A downstream node cannot run before its
  upstream regardless of where either sits.

---

## 2. Design

### 2.1 Where the yield goes

Inside `execute()`, not in the `drain()` loop:

- `drain()`'s `while` is guarded by `MAX_DRAIN_ITERATIONS` (100,000) to catch a
  non-converging graph. Slicing in the outer loop would make a large graph trip
  a guard meant to catch a bug.
- `runnableNow()` copies `readySet` per call.

### 2.2 The deadline is a RUNTIME field, not a per-layer local

**This is the correction that makes the feature work at all.** A budget scoped
to one `execute(batch)` call resets on every layer. The demo's topology is a
chain (`connection → table → describe → query`), so layers are narrow; in the
deep limit one node per layer. Each `execute` would start one compute, never
reach the budget, reset, and return — **the drain would never yield**, on
exactly the graph this plan exists for, while passing every test in revision 1.

```ts
private sliceDeadline = 0;   // runtime field
```

- Set on entry to `drain()`.
- Reset **only** when a yield actually happens.
- Checked *before starting the first node of a layer* as well as between
  starts.

The `await` still lives in `execute`, so `MAX_DRAIN_ITERATIONS` still counts
layers exactly as today.

### 2.3 The slice, and why cutting mid-layer is safe

```
execute(batch):
  partition into local[] and remote[]
  start the remote batch                      // unchanged: one call per layer
  for each nodeId in local:
      if (this.disposed || this.cancelled) return
      if (!this.readySet.has(nodeId)) continue        // ← the load-bearing guard
      if (now >= this.sliceDeadline && this.yieldTo):
          await this.yieldSafely()
          if (this.disposed || this.cancelled) return
          this.sliceDeadline = now + this.sliceMs
          if (!this.readySet.has(nodeId)) continue    // re-check after the gap
      start executeLocal(nodeId)               // collect, do not await
  await everything started
```

**Safety argument — corrected.** Revision 1 claimed cutting is safe *because a
layer's nodes are independent*, and that settling can only add readiness. That
claim is **false**, verified in source:

- `markDirty` (`runtime.ts:833-837`) sets `cyclesStale = true`, bumps the
  version, and calls **`readySet.delete(node)`** for the whole descendant cone.
- `setState` calls `markDirty` (`:731`) — reachable from a consumer's
  `ctx.setState` inside a compute *and* from the editor on any user edit
  (`node-editor.component.ts:906,908,1151`).
- `markCycle` (`:1011`) also deletes from `readySet`, and is reached from
  `settle` → `refreshAfter` → `settleStaleFlags` → `excludeCycles` whenever
  `cyclesStale` was set.
- `setGraph` (from the editor's effect) rebuilds `readySet` wholesale.

So readiness **can** be withdrawn from an unstarted sibling, from inside the
slice and from outside it.

The failure that follows, if the node is started anyway: it computes from a
stale upstream, and because it captured `version` *after* the bump, `settle`
sees a matching version and marks it **clean**. The upstream later settles,
`reconsider` sees the node is not dirty and skips it. A permanently wrong
value, with no error and no stale badge — the same class the runtime's own
`drain` comment says serialised drains exist to prevent.

**Therefore: cutting is safe because every start is re-validated against
`readySet`.** Independence justifies the *ordering*; the guard justifies the
*cut*. Skipping is self-healing — the node stays dirty and the next
`runnableNow()` takes it in proper order.

The same guard covers node removal: `removeNode` deletes from `readySet`
(`:572`), so a node deleted during a yield is skipped rather than executed
through the `definition === undefined` path — which would mint a status signal
*and* an input signal for an id nothing prunes, push a settled event for a
ghost node, fire `onNodeSettled` into the editor, and flip the whole run to
`status: 'error'` because the user deleted something.

### 2.4 The yield itself

A composite, not bare `requestAnimationFrame`:

1. **`scheduler.yield()`** where available — the standardised primitive,
   resumes at continuation priority (so the drain is not starved behind tasks
   queued during the gap), and runs in a hidden tab.
2. **`requestAnimationFrame`** — the only thing that guarantees a frame was
   painted, which is goal 3.
3. **`setTimeout`** — the floor.

rAF alone is a **permanent wedge in a hidden tab**: no frames, so
`await yieldTo()` never returns, `draining` never clears, and every later
`run()`/`step()` awaits it forever. This repository has already fixed that bug
twice — `raceAbort` exists for it one layer down, and the stress demo already
uses `setTimeout` over rAF with a comment saying exactly this.

So: rAF **raced against** a timeout, and the whole thing raced against dispose
and cancel inside the runtime.

### 2.5 `yieldTo` and `sliceMs` as public fields

Consistent with `executeRemote` / `onRunStarted` / `onNodeSettled` (no DI, per
project rule). Default `yieldTo = null` — no yielding — which keeps the runtime
deterministic for its own suite and for headless consumers, and keeps a child
runtime nested inside a parent's `compute` synchronous (deliberate; see §8).

This is copy-in source consumers will edit, so the contract must be documented
and defended:

- **Never resolves** → race it against dispose/cancel, and a timeout.
- **Resolves synchronously** (`() => Promise.resolve()`) → a microtask; no
  paint. Not detectable at runtime. Defended in the tests (§5) and stated in
  the JSDoc: it must yield to the **event loop**, not the microtask queue.
- **Throws** → catch it, treat as `null` for the rest of the drain. Letting it
  propagate abandons the drain mid-layer with nodes stuck `running`, and
  rejects `run()` for a fault in a presentation callback.

### 2.6 Per-slice batching of signal writes

**Revision 1 budgeted compute and ignored the rest of the frame.** Today all
100k settles happen inside one block, so Angular (zoneless) runs change
detection *once*, at the end. The moment we yield, every gap flushes CD.

Per settle, today: `onNodeSettled` → `markRecentlyRan` writes
`recentlyRanVersion` (a signal Angular walks the live-consumer list for, and
`recentlyRan(node.id)` is bound on every mounted card — ~200-600 consumers), and
`refreshAfter` calls `bumpReady()`. At 100k that is ~2×10⁷ consumer visits of
pure bookkeeping plus 100,000 zoneless CD notifications.

So:

- `markRecentlyRan` accumulates into its map and bumps the version **once per
  slice**, not per settle.
- The demo's progress readout accumulates into a plain field and publishes per
  slice, never per event.
- `recentlyRanUntil` gets a bound: a highlight for a node that has never been
  mounted is bookkeeping for nobody. And `nextSweepDelay()` must not be O(n)
  per sweep — with entries arriving continuously and a 900ms window the next
  deadline is always ~a frame away, so it re-arms every ~16ms and walks a
  60-100k map twice each time, for the run's duration plus 900ms.

### 2.7 `durationMs` must not become a lie

`execute()` stamps `startedTicks` for the whole batch up front (`:1273-1276`)
and `report()` computes `durationMs = tick() - startedTick`. Correct today
because a layer is one block; under slicing a node started 1.4s into a layer
reports 1400ms for a 6µs compute, silently falsifying every consumer including
the run-history panel.

**Fix:** stamp `startedTicks` inside `executeLocal` immediately before
`beginRun`. Remote keeps the batch stamp (it genuinely is one batched call).

### 2.8 Cancellation

Runs now last seconds, so a Run button without a Stop is not acceptable —
and today **nothing** can stop a run: `abortRun` is private and per-node,
`dispose()` is terminal and never resets, and the editor exposes only
`run`/`step`/`readyNodes`.

`cancel()` on the runtime, surfaced on the editor beside `run()`:

- set a cancel flag (checked at the same points as `disposed`, §2.3);
- abort in-flight runs and the `remoteBatches` controllers;
- close the session via `leaveSession()` so `onRunFinished` still fires —
  otherwise `RunHistoryStore.openGraphs` retains a whole-graph snapshot for a
  run that never finishes, which is what its `openCount` getter exists to
  expose;
- **leave the graph dirty**, so a later Run resumes rather than restarts;
- clear the flag on the next `run()`.

### 2.9 Run-history memory

Two leaks, and revision 1 capped the smaller one.

- `session.nodes` (`:1613`) is unbounded, holding an `{...inputs}` and
  `{...outputs}` clone per settle.
- **`RunHistoryStore.begin()` stores a full `SerializedGraph`** — a deep copy
  of every node and every connection — per run, keeping up to 50 records.
  Fifty 100k-node snapshots dwarfs 100,000 settle events. Revision 1 never
  mentioned it.

Capping `session.nodes` **does** falsify readouts — answering revision 1's own
open question, which it asked and then contradicted in its body. Consumers of
`RunFinishedEvent.nodes`:

| consumer | breakage under a naive cap |
|---|---|
| `run.nodes.length` as the node count (`node-editor-history.component.ts:132`) | shows "5,000" for a 100,000-node run |
| `slowestNode` (`history.utils.ts:61`) | the genuinely slowest node is the one most likely to have settled early and been dropped — names the wrong node |
| `shareOfRun` (`history.utils.ts:70`) | denominator sums only the retained tail |

So the cap ships **with** a `settledCount` total carried through
`RunFinishedEvent` → `RunRecord` to those readouts. The graph-snapshot
retention is sized/bounded separately.

### 2.10 Accessibility

A multi-second board change is silent to a screen reader today. The live
region exists and announces every edit, but nothing announces evaluation. Add
one polite announcement at start and one at finish (not per node).

---

## 3. What the user actually sees — and why the demo must change

Revision 1 claimed the flow effect needed no work because `recentlyRan`
already exists. **It would show one flash, not a wave**, for two structural
reasons:

- The graph is **four layers deep**, so the wavefront has four positions.
- The computes are identity passthroughs at ~6.6µs, so an 8ms slice starts
  ~1,200 nodes — about 48 whole databases per frame. Every mounted card
  (~200) lights within a frame or two and goes dark together 900ms later.

Fixing it is **entirely a demo change**, and it is what makes the demo honest
about its own headline ("100k *with logic*"):

1. Give the computes real cost (a few hundred µs), so a slice covers tens of
   nodes rather than 1,200.
2. Deepen the chain past four layers, or stagger within a layer.
3. Frame the view so the wave crosses the *viewport*, not the 4,000-database
   pitch.

Without all three the runtime change will look correct and the deliverable
will not be met.

---

## 4. Demo controls

- **Run / Stop / live toggle**, 44×44 targets, in the existing wrapping
  toolbar.
- **Size switching mid-run** goes straight into the deletion path of §2.3;
  gate it on `running()` as well as `building()`, or Stop-then-switch.
- **"Measure 3s" perturbs its own measurement**: `countCards()` runs
  `querySelectorAll` and writes a signal *every frame*, in the exact scenario
  §7 designates as the acceptance test. Sample once at start and once at end.
- **Zones toggle** — fine as-is (`renderedNodes()` bounds membership to the
  mounted set, which changes only on pan).

---

## 5. Tests

Runtime, driven by `sliceMs = 0` (yield after every start) — **deterministic,
no wall-clock**, and still sabotage-fails when the budget check is removed. A
busy-loop-for-N-ms test is the flake shape this repo has already been burned
by.

1. A graph that fits in one slice never yields. *Break:* yield unconditionally.
2. Over budget, it yields. *Break:* remove the deadline check.
3. **The deadline survives across layers** — a chain-shaped graph (one node per
   layer) still yields. *Break:* scope the deadline to `execute` → fails. This
   is the H3 no-op.
4. Topological order holds across yields.
5. **A node re-dirtied during a yield is not started with stale inputs**, and
   is recomputed afterwards. *Break:* drop the `readySet.has` guard → the node
   settles clean and wrong.
6. **A node removed during a yield is not executed**: `metrics.retained`
   unchanged, no `nodeSettled` for the removed id, run status not `error`.
7. Dispose during a yield stops the drain.
8. `cancel()` stops the drain, fires `onRunFinished`, leaves the graph dirty,
   and a later `run()` resumes.
9. A second `run()` during a yield joins rather than starting a second drain.
10. Remote batching survives slicing: K ready remote nodes still cost one call.
11. `durationMs` reflects the node's own compute, not time since the layer
    began. *Break:* keep the batch stamp → a late node reports the whole span.
12. Session events are capped **and** `settledCount` reports the true total.
13. A `yieldTo` that throws is treated as absent; the drain completes.
14. A `yieldTo` that never resolves does not wedge the runtime (raced against
    dispose/cancel).

Editor:

15. The editor configures a yield.
16. **A real frame runs between two computes** — schedule a rAF before `run()`
    and assert it interleaved with the recorded compute order. *This is the
    only test that fails when the yield degrades to a microtask*, and it is the
    one the whole change exists to satisfy.
17. The pending frame is cancelled on destroy.
18. Signal writes are batched per slice, not per settle. *Break:* bump per
    settle → the count scales with nodes rather than slices.

Every test gets the standard sabotage pass.

---

## 6. Order of work

1. `durationMs` stamp (§2.7) — one line, independent, and wrong today the
   moment anything slices.
2. Session cap + `settledCount` + history readouts (§2.9).
3. `sliceDeadline`, `yieldTo`/`sliceMs`, sliced `execute` with the `readySet`
   guard (§2.2-2.5) + tests 1-14.
4. `cancel()` (§2.8).
5. Per-slice signal batching (§2.6) + test 18.
6. Editor opt-in, composite yield, destroy handling (§2.4) + tests 15-17.
7. **Split measurement** (§7) — before the demo work, so we know whether the
   budget or CD is the limit.
8. Demo: Run/Stop, real compute cost, deeper chain, framing, control gating
   (§3, §4).
9. Device measurement, then SonarQube.

Follow-up, not in this change: slicing the cold build (§1).

---

## 7. Verification

The demo's "Measure 3s" (slowest frame, frames over budget) is the acceptance
test, run **while evaluation is in flight**, and it must state whether it
samples the build, the drain, or both.

Before that, an assertion-grade split measurement: record rAF deltas during a
sliced 100k drain and report **two** numbers — time inside `execute` per frame,
and total frame time. If they diverge, change detection is the limit and no
`sliceMs` value fixes it. Without the split we cannot tell "the budget is too
big" from "the budget is irrelevant".

On `sliceMs`: it is a magic constant of the same family as `AFFORDABLE_SLACK`
and `MAX_BUILT_PATHS`, both of which this codebase got wrong. It is defensible
only if the split measurement above shows compute is actually the dominant
term. Start at 8ms, and let the measurement decide.

---

## 8. Deferred, deliberately

- **Child runtimes stay synchronous.** A subgraph's runtime is constructed
  bare inside a parent's `compute`; giving it the parent's `yieldTo` would make
  the parent's compute span frames, changing `staleness`/abort semantics this
  plan has not analysed.
- **The cold build** (§1).
- **A host-pumped generator** (`runStep()` the host calls per frame) is
  arguably the better architecture for a runtime that is deliberately
  Angular-free and DOM-free — it inverts ownership rather than having the
  runtime phone the host for time. Not now; keep it reachable.

---

## 9. What revision 1 got wrong

Recorded so the reasoning survives, per the project's living-spec rule.

| # | Defect | Consequence |
|---|---|---|
| 1 | "Cutting mid-layer is safe because layers are independent" | **False.** `markDirty`/`markCycle`/`setGraph` all withdraw readiness. Would have produced permanently wrong values, silently. |
| 2 | Budget scoped to one `execute` call | **No-op** on chain-shaped graphs — i.e. the demo's own topology. |
| 3 | rAF as the whole yield | Permanent wedge in a hidden tab. |
| 4 | Budget counted compute only | CD and paint unbudgeted; `markRecentlyRan` alone is ~2×10⁷ consumer visits. |
| 5 | `startedTicks` untouched | `durationMs` silently becomes "time since the layer began". |
| 6 | Cap on `session.nodes` alone | Falsifies four history readouts; misses the 50× whole-graph snapshots. |
| 7 | "P3: re-check `disposed`" | Too narrow — misses node removal and graph replacement. |
| 8 | Tests asserting `yieldTo` was called | A `Promise.resolve()` spy passes whether the yield works or not. |
| 9 | "The flow effect needs nothing new" | Would show one flash, not a wave. |
| 10 | Run with no Stop | Nothing today can stop a multi-second run. |
| 11 | Cold build dismissed on one number | It is five steps, ~1s+, and plausibly the larger half of the felt cost. |
