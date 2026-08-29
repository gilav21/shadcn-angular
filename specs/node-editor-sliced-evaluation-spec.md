# Sliced evaluation — 100,000 nodes with logic actually running

> **Status:** revision 3, after four plan reviews. Not yet implemented.
> **Branch:** `feat/infinite-canvas-subgraphs`, on top of `0bcad096`.
>
> Revision 1 was reviewed by three independent agents before any code was
> written; they found **eleven** defects, none of which revision 1's own tests
> would have caught. Revision 2 folded those in and was reviewed again — and
> **two of its fixes were themselves wrong** (`cancel()` hung the drain; the
> yield chain was ordered so it never painted), one was unimplementable as
> written, and one recorded an unverified claim as fact. Revision 3 corrects
> those. §9 records what each draft got wrong, so the reasoning survives.
>
> Sequence so far: 11 defects found in rev 1, 8 in rev 2. None of them cost a
> line of implementation.

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

Inside `execute()`, not in the `drain()` loop.

**The primary reason is correctness, not tidiness.** `readySet` is NOT a set of
unstarted nodes: `execute` does not remove a node when it starts it, only
`settle` and `markDirty` do, and a started-but-unsettled node is still dirty —
so `refresh()` (which rebuilds `readySet` from `dirty`) can put a *currently
running* node back into it. The design is safe only because `execute` captures
`local[]` ONCE, before the loop, and every `runnableNow()` call happens after
`await this.execute(batch)` has awaited every promise the loop started. No
re-derived batch is ever consumed while a node it names is in flight.

Move the yield into `drain()`'s loop — the obvious future "simplification" —
and the re-derived batch names the running node, `executeLocal` runs it a
second time and `beginRun` aborts the first. For a `reactive: false` node (an
HTTP POST, the case that flag exists for) that is a duplicate request. **The
`local[]` capture site needs a comment saying it must not be re-derived.**

Secondary reasons: `drain()`'s `while` is guarded by `MAX_DRAIN_ITERATIONS`
(100,000) to catch a non-converging graph, and slicing in the outer loop would
make a large graph trip a guard meant to catch a bug; and `runnableNow()`
copies `readySet` per call.

### 2.2 The deadline is a RUNTIME field, not a per-layer local

A budget scoped to one `execute(batch)` call resets on every layer, so on a
deep, narrow graph the budget is never reached and the drain never yields.

**Revision 2 claimed that was true of THIS demo. It is not — verified.**
`buildWorkload` uses `TABLES_PER_DB = 8`, so `perDb = 25` and 100k gives ~4,000
databases: the layers are 4,000 / 32,000 / 32,000 / 32,000. Wide, not narrow. A
per-layer budget would yield ~27 times inside layer 2 alone. Revision 2 took a
reviewer's claim and recorded it as fact without checking the arithmetic, in a
document written to stop exactly that.

The runtime-level deadline is still the right design — it is correct for
genuinely deep chains, and §3 deliberately proposes deepening this graph past
four layers, which moves it toward that shape. But it is a defence, not the
reason the current demo fails.

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

**`requestAnimationFrame` raced against `setTimeout(…, ~16)`.** That pair is
the whole mechanism: rAF for the guaranteed paint (goal 3), the timeout as the
hidden-tab floor.

**`scheduler.yield()` must NOT lead the chain.** Revision 2 put it first on a
reviewer's recommendation and that defeats the deliverable: it resumes at
*continuation* priority — ahead of rendering — precisely so the caller is not
descheduled. In Chrome (the only engine that ships it) leg 1 would always win,
so no frame is ever guaranteed and the wavefront is never visible in the
browser the change takes effect in. Two further problems: `scheduler` is not in
`lib.dom.d.ts`, so it needs a hand-written interface (a `globalThis as any`
cast fails the Sonar gate); and resuming ahead of rendering also resumes ahead
of Angular's change detection, so the editor's `setGraph` effect has not yet
applied a mid-run edit when the `readySet` guard is consulted — the guard's
protection depends on the gap being long enough for CD to flush.

It is at best an *additional* micro-gap for input responsiveness inside a
slice. Not the paint leg, and not first.

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

### 2.6 What a yield actually costs, and where to batch

**Revision 2 budgeted the wrong thing.** `markRecentlyRan`'s ~2×10⁷ consumer
visits happen *today*, unchanged by slicing — a signal write notifies its live
consumers synchronously whether or not change detection runs. What slicing
ADDS is one CD pass per gap.

And the dominant per-gap cost is not the highlight at all. `[items]` is bound
to `sizedNodes()`, which reads **every node's state signal**. So one
`ctx.setState` from any compute invalidates, per gap:

- `sizedNodes` — materialise + heights over 100k;
- `toCanvasEdges` — 96k;
- `edgeRenderer.setEdges` — a full 96k sweep its own JSDoc measures at **14ms
  at this scale**;
- `itemLayer.setItems` → `tryMoveOnly`'s 100k identity walk → `invalidate()` →
  a **full re-cull next frame**;
- `runtime.setGraph`'s diff (`sameShape` short-circuits on position, not on a
  changed `ports` array).

That is ≥50ms per gap and **no `sliceMs` value fixes it.** Today's demo
computes only *read* `ctx.state`, so it never fires — but §3 says give them
real cost, and any state write detonates this. §7's measurement must be
designed to see this mechanism specifically, or it will report "the budget is
fine" while the page stutters.

**Where batching can even happen.** There is no "end of slice" seam in the
editor: `markRecentlyRan` is called from `onNodeSettled`, and only the runtime
knows a slice ended. The one seam that exists is **the editor's own `yieldTo`
callback** — flush, then yield. That leaves two cases it never reaches, both of
which must be handled explicitly or the highlight never appears:

- the **final slice**, with no yield after it → flush on `onRunFinished`;
- settles with **no session at all** — `report()` uses `this.session?.id ?? 0`,
  and stream emissions via `consume` settle outside any run.

### 2.7 `durationMs` must not become a lie

`execute()` stamps `startedTicks` for the whole batch up front (`:1273-1276`)
and `report()` computes `durationMs = tick() - startedTick`. Correct today
because a layer is one block; under slicing a node started 1.4s into a layer
reports 1400ms for a 6µs compute, silently falsifying every consumer including
the run-history panel.

**Fix:** stamp `startedTicks` inside `executeLocal` immediately before
`beginRun`. Remote keeps the batch stamp (it genuinely is one batched call).

### 2.8 Cancellation

Runs now last seconds, so Run without Stop is not acceptable — and today
**nothing** can stop a run: `abortRun` is private and per-node, `dispose()` is
terminal and never resets, and the editor exposes only `run`/`step`/
`readyNodes`.

**Revision 2's sketch was wrong in three ways**, all verified:

1. **It hangs.** `execute` returning early on `cancelled` while the graph stays
   dirty means nothing leaves `readySet`, so `runnableNow()` returns the
   identical batch and `drain()` spins. `run()`'s outer loop has the same
   shape and allocates a 100,000-element array per iteration, and `await` on an
   already-resolved async function is a microtask — so Stop on a 100k board
   freezes the tab, then eventually throws `evaluation did not converge`, a lie
   about a graph that converges fine. `dispose()` escapes this only because it
   clears `readySet`.
2. **`leaveSession()` is the wrong exit.** It decrements `runDepth` and returns
   early while depth > 0, and mid-drain the depth is routinely ≥2 because the
   editor's effect fires `run({automatic:true})` on every graph/state change
   and those nest. So it would NOT fire `onRunFinished` — the exact
   `openGraphs` leak it was invoked to avoid — and it corrupts the depth for
   the real `finally` in `run()` and `step()`.
3. **It strands nodes.** Aborting in-flight runs makes `raceAbort` resolve
   `ABANDONED` and `executeLocal` return **without settling**, so every started
   node keeps `status: 'running'` for ever: spinners on screen, and never
   re-picked as stale. And aborting the remote controllers falls through a
   `disposed`-only guard, settling the whole batch as `'error'` — so pressing
   Stop files the run in history as a failure.

So `cancel()` must:

- be checked in **`drain()`'s loop condition and `run()`'s**, both returning
  cleanly — not only inside `execute`;
- **force-close the session itself**: emit `onRunFinished` directly, set
  `runDepth = 0`, null the session — never via `leaveSession()`;
- **reset aborted nodes to `'stale'`**, leaving them dirty so a later Run
  resumes;
- extend every remote-path `this.disposed` guard to `disposed || cancelled`;
- report **`status: 'cancelled'`** on `RunFinishedEvent` (required field, no
  optional hedging), not `'done'` for a partial run;
- clear the flag on the next `run()`.

Test 8 must assert termination **with a real timeout**, or a regression hangs
the suite instead of failing it.

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

A count repairs only the first row. `slowestNode` reduces over the retained
tail, and no count can tell it which node was slowest; `shareOfRun`'s
denominator is a sum over the tail, and no count restores it. A fourth
consumer is worse: **`replayFrame`** builds its frame from `run.nodes`, and the
editor falls back *per node* to live values when the frame lacks an entry — so
a capped replay silently mixes recorded and live values with nothing marking
which is which.

So the cap ships with **three** required fields on `RunFinishedEvent` →
`RunRecord`: `settledCount`, a running **max-duration event**, and a running
**duration total**. Pick one eviction policy and say it — revision 2 stated
both "keeping the most recent" and "stops growing past the cap". For replay,
drop-oldest is the worse choice, because upstream sources settle first and
their values are exactly what a replay needs.

**Do not copy `MAX_RECORDED_COMPUTES`' `shift()`.** A 5,000-element `shift`
× 100,000 settles is ≈500M element moves added to the hot settle path —
recreating the cost profile this work exists to remove. Ring buffer with a
write cursor, or drop-newest plus a counter.

And state what the cap does **not** buy: `report` still builds
`{...inputs}`/`{...outputs}` clones and still fires `onNodeSettled` 100,000
times. It bounds retention, not allocation or emission.

The graph-snapshot retention is sized separately.

### 2.10 Accessibility

A multi-second board change is silent to a screen reader today. The live
region exists and announces every edit, but nothing announces evaluation. Add
one polite announcement at start and one at finish (not per node).

### 2.11 A live run collides with the drag path — verified

The drag path committed in `0bcad096` keeps `nodes` unwritten during a gesture
and commits once on release. That was safe because nothing else changed `nodes`
mid-drag. A live run breaks the assumption: a settle can `setState`, and
`sizedNodes` reads every node's state signal, so a settle produces a new node
array which flows into `[items]` → `setItems` → `tryMoveOnly`.

Whether the dragged card is yanked back depends on a cache policy:

- `withMaterializedTypes` caches a materialised node **keyed on the node
  object**, unless `isStateDependent` — i.e. the type declares `portsFor`.
- **Static-port types** hit that cache, so a recompute hands back the *same*
  object, `tryMoveOnly` sees `before === after` and skips it. The card stays
  under the finger.
- **Dynamic-port types** (subgraphs, any type with `portsFor`) are
  re-materialised every recompute — a **new object each time**, still carrying
  the pre-drag GRAPH position — so `tryMoveOnly` calls `hash.move` and the card
  **snaps back to where the gesture started**, potentially once per frame.

The stress demo's four types all have static ports, so it will not reproduce
there. That makes it more dangerous, not less: the demo looks fine and a
consumer dragging a subgraph node during a live run sees the card fight them.

**FIXED, ahead of everything else here.** It turned out to be reachable with
nothing exotic at all, and not only for `portsFor` types: **Ctrl+Z during a
drag**. The undo path has no gesture guard and replaces the whole array, and
when the undone command CHANGES THE LENGTH (restoring a deleted node), the
engine cannot take its identity-diff shortcut and rebuilds every item at its
graph position — so the dragged card jumps back. Undoing a *move* does not
reach it, because unchanged nodes keep their identity; the first version of
the test asserted exactly that and passed with the fix removed.

The fix is an `afterRenderEffect` that, while a gesture is live, rebuilds only
the dragged ids from the new sized objects and re-issues `moveItems` — O(dragged),
through the seam the gesture already uses, after the engine has taken the new
items. Verified by reverting it: the card snaps from x=160 to x=10 mid-drag.

One correction this forces to §2.6: `materializeNode` reads state ONLY for
types declaring `portsFor`, so `sizedNodes` depends on the state signals of
dynamic-port nodes only. The ≥50ms per-gap chain is therefore conditional on
those types rather than universal — which lands it squarely on subgraph nodes,
this branch's headline feature, but spares a static-port graph like the
demo's.

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
15. **`cancel()` terminates**, asserted under a real timeout so a regression
    fails rather than hanging the suite. *Break:* leave the graph dirty without
    breaking `drain()`'s and `run()`'s loop conditions → spins.
16. **`cancel()` leaves no node `running`** and files the run as `cancelled`,
    not `done` or `error`.
17. **A dragged node is not yanked back by a settle mid-gesture** — with a
    `portsFor` type, which is the only shape that reproduces it (§2.11).
    *Break:* drop the drag-overlay re-apply → the card returns to its graph
    position.
18. **`step()` does not yield** for its single node (the deadline must not be
    left in the past by a previous drain).

Editor:

19. The editor configures a yield.
20. **A real frame runs between two computes** — schedule a rAF before `run()`
    and assert it interleaved with the recorded compute order. *This is the
    only test that fails when the yield degrades to a microtask*, and it is the
    one the whole change exists to satisfy.
21. The pending frame is cancelled on destroy.
22. Signal writes are batched per slice, not per settle — including the final
    slice, and settles with no session. *Break:* bump per settle → the count
    scales with nodes rather than slices.

Every test gets the standard sabotage pass.

---

## 6. Order of work

Re-ordered after the rev-2 review: the split measurement moves early, because
it decides whether `sliceMs` is even the right lever, and the drag fix moves
first, because it is a defect in shipped code.

1. **The drag-vs-settle fix** (§2.11) + test 17 — shipped code is defective
   today for `portsFor` types; independent of everything else here.
2. `durationMs` stamp (§2.7) — one line, wrong the moment anything slices.
3. Session cap + `settledCount` + max-duration + duration total + the four
   history readouts (§2.9).
4. `sliceDeadline`, `yieldTo`/`sliceMs`, sliced `execute` with the `readySet`
   guard (§2.1–2.5) + tests 1–14, 18.
5. **The split measurement** (§7) — before any tuning or demo work, so we know
   whether compute or change detection is the limit.
6. `cancel()` (§2.8) + tests 15–16.
7. Editor opt-in, composite yield, destroy handling (§2.4) + tests 19–21.
8. Per-slice batching at the `yieldTo` seam (§2.6) + test 22.
9. Demo: Run/Stop, real compute cost, deeper chain, framing, control gating,
   a11y announcements (§3, §4, §2.10).
10. Device measurement, then SonarQube.

Follow-up, not in this change: slicing the cold build (§1).

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

## 9. What each draft got wrong

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

### Revision 2

| # | Defect | Consequence |
|---|---|---|
| 12 | `cancel()` returned early while leaving the graph dirty | `drain()` and `run()` both spin on an unchanged `readySet`; Stop freezes the tab, then throws a false "did not converge" |
| 13 | `cancel()` exiting via `leaveSession()` | `runDepth` is routinely ≥2 mid-drain, so `onRunFinished` never fires — the exact leak it was invoked to prevent — and the depth is corrupted for later runs |
| 14 | `cancel()` aborting in-flight runs | `raceAbort` resolves `ABANDONED` and `executeLocal` returns without settling: nodes stuck `running` for ever, remote batches filed as `error` |
| 15 | `scheduler.yield()` first in the yield chain | Resumes at continuation priority — ahead of rendering AND ahead of Angular CD. In Chrome leg 1 always wins, so no frame is painted and the wavefront, the whole deliverable, is never seen |
| 16 | §2.6 batching "in the editor" | No seam exists; only the runtime knows a slice ended. The `yieldTo` callback is the seam, and it misses the final slice and session-less settles |
| 17 | §2.6 budgeting `markRecentlyRan` | Those consumer visits happen today regardless. The cost slicing ADDS is a CD pass per gap, dominated by the `sizedNodes` → edges → re-cull chain at ≥50ms, which no `sliceMs` fixes |
| 18 | "The demo is chain-shaped, so a per-layer budget never yields" | **False, and mine** — repeated from a reviewer without checking. Layers are 4,000 / 32,000 × 3. The runtime deadline is still right, for different reasons |
| 19 | `settledCount` alone repairing the history | A count cannot restore `slowestNode`, `shareOfRun`'s denominator, or `replayFrame`'s per-node fallback |
