# Node Editor — Addon Suite

**Companion to** `specs/node-editor-runtime-spec.md` and
`specs/node-editor-runtime-design.md`.

Per R17, the boundary rule is:

> **The base owns whatever must know the graph's internal model. An addon is
> anything that needs only the public API.**

This document exists partly to *apply* that rule and partly to *test* it: each
addon below lists exactly what it consumes from the base. **Anything an addon
needs that the base does not already expose is a gap in the base's API, not a
reason to move the addon inward.** The "Requires from base" column is therefore
the real deliverable of this spec — it is the base's public surface, derived
from actual consumers rather than guessed.

---

## 0. Gaps this exercise found in the base API

Writing the addons surfaced seven things the base must expose that the runtime
spec did not mention. They are folded into the base's task list.

| Gap | Needed by | Base addition |
|---|---|---|
| Node positions as a readable signal | minimap, auto-layout, groups | `nodes` is already a `model()` — sufficient |
| Viewport rect + `panTo`/`zoomTo` | minimap | Already on `ui-infinite-canvas`; base must **re-expose** it, since addons talk to `ui-node-editor`, not the canvas underneath |
| The registered type list | palette | `definitions` input is an array; expose as a readonly signal |
| A "user asked to add a node here" intent | palette | `(addNodeRequested)` output carrying a world point |
| Programmatic insertion honouring undo | palette, auto-layout | `addNode()`, `moveNodes()` as public methods routed through the command funnel |
| Runtime lifecycle events | run history | `(runStarted)`, `(nodeSettled)`, `(runFinished)` outputs ✅ |
| Showing a past run's values | run history | `[replay]` input taking a `ReplayFrame` ✅ |

**Why replay landed in the base rather than the addon.** The addon can record
everything it needs from three outputs, but it cannot *show* a past run: node
views read their values through `NODE_CONTEXT`, which only the editor supplies.
An addon would have had to fork the editor's template and re-render the graph
itself — a second renderer to keep in step with the first, which is how every
"preview mode" eventually drifts. So the base substitutes the values at the one
place every view already reads them, and a node type written months ago
replays without knowing it can.

Two decisions fell out of that:

- **Evaluation is suspended while a frame is bound.** A graph cannot show the
  past and compute the present at once; left running, the live value overwrites
  the replayed one the moment anything upstream changes. This is not a silent
  override of `live` — it is what replay *means*.
- **A node absent from the frame reads `idle`, not its live status.** It did
  not run in that pass, and reporting the value it happens to hold now would
  put a present-tense answer inside a picture of the past.

---

## 0.1 Registering an addon — three things, all easy to miss

Learned by getting each of them wrong on the first addon. Every remaining
addon in this document has to do all three.

**1. Import through the parent's barrel, never a deep path.** An addon that
does `from '../../node-editor.runtime.types'` defeats `sync-registry`'s
component-boundary detection: it copied two parent files INTO the addon's
`files[]` and set `dependencies: ['infinite-canvas']` — an addon that would
not install its own parent. `from '../..'` fixes both. Already stated in
CLAUDE.md; restated here because the failure is silent and the registry looks
plausible afterwards.

**2. An addon MUST declare `attach`.** `isValidAddonEntry` requires
`parent`, plus `attach.import` and `attach.selector`. And `isValidRegistryShape`
is all-or-nothing — `Object.values(data).every(isValidRegistryEntry)` — so a
single addon without `attach` makes the WHOLE manifest invalid. Not just that
addon: every component becomes invisible to an installed CLI, `list_components`
returns nothing, and `apply` reports "Available addons: (none)". The blast
radius is the entire registry, which is why this is worth its own paragraph.

```ts
attach: {
  import: "NodeEditorProblemsComponent from './ui/node-editor/addons/problems'",
  selector: 'ui-node-editor-problems',
},
```

**3. The PARENT must list the addon.** `addons: ['node-editor/problems']` on
the `node-editor` entry is what surfaces it in `add`'s multiselect and in the
discovery tools. Resolving the base deliberately does not install them.

Then regenerate the docs payload (`npm run docs:regen`) — a component in the
registry that is missing from `component-docs.json` fails the CLI coverage leg
by exactly one.

---

## 1. `node-editor-problems` — problems panel

**Priority: 1.** Directly answers the maintainer's complaint that refusal
reasons were unreadable. The *inline* half (pointer feedback, port type chips)
is base per R16; this is the list.

| | |
|---|---|
| Requires from base | `problems()` signal |
| Writes to base | `selection` (clicking a problem selects the offending node) |

```html
<ui-node-editor-problems [editor]="editor" (problemSelected)="editor.focusNode($event.nodeId)" />
```

Renders one row per `GraphProblem`, grouped by severity, each in plain language
— never a raw enum. Empty state says the graph is valid rather than showing an
empty box.

Tasks: A1 component + template · A2 severity grouping and i18n across the 10
locales · A3 click-to-select · A4 a11y (a list, not a div soup; `aria-live` for
newly appearing problems) · A5 story + demo.

---

## 2. `node-editor-palette` — add-node picker

**Priority: 2.** R15 puts insertion in the base and the picker UI here.

| | |
|---|---|
| Requires from base | `definitions()` signal, `(addNodeRequested)`, `addNode(typeId, point)` |
| Writes to base | one `add-node` command, so it participates in undo for free |

Built by composing `ui-command` — this repo already ships a command palette, so
this is mostly composition plus the category grouping.

```html
<ui-node-editor (addNodeRequested)="palette.openAt($event)" />
<ui-node-editor-palette #palette [editor]="editor" />
```

Opens on double-click of empty plane, or a keyboard shortcut. Filters by label,
category and port type — *"what can accept a `table`"* is the query that makes
a palette useful in a typed graph, and the base already has the type info.

Tasks: B1 component over `ui-command` · B2 category + port-type filtering ·
B3 keyboard-only operation (it is a picker; it must be) · B4 i18n · B5 story +
demo.

---

## 3. `node-editor-minimap` — overview + navigation

**Priority: 3.**

| | |
|---|---|
| Requires from base | `nodes()`, the viewport rect, `panTo()` |
| Writes to base | viewport position only |

Renders node boxes to scale on a single `<canvas>` — **not** DOM. At thousands
of nodes, one canvas with a batched fill is the only version that holds a frame
budget, and the base's edge renderer already proves the pattern.

A dragged viewport rectangle pans the graph. Touch: the rectangle needs the
same 44px consideration as ports, so it gets a minimum grab size independent of
zoom.

Tasks: C1 canvas render of node boxes · C2 viewport rect + drag to pan ·
C3 click to centre · C4 touch sizing · C5 story + demo.

---

## 4. `node-editor-layout` — automatic layout

**Priority: 4.** Pure function in, positions out — the cleanest addon in the
suite, and the strongest evidence the boundary rule is right.

| | |
|---|---|
| Requires from base | `nodes()`, `connections()`, `moveNodes()` |
| Writes to base | one `move-nodes` command — so auto-layout is undoable |

**Layered (Sugiyama) for DAGs**, which is what a workflow graph is: assign
layers by longest path, order within a layer to reduce crossings (median
heuristic, a couple of sweeps), then assign coordinates. Cyclic graphs get
their back-edges temporarily reversed for layering, exactly as dot does.

Deliberately **not** force-directed: it produces a different layout every run,
which makes a workflow diagram feel unstable and makes screenshots useless.

```ts
layout(nodes, connections, { direction: 'LR' | 'TB', spacing }): Map<NodeId, CanvasPoint>
```

Pure and synchronous, so it is unit-testable without a DOM and reusable
server-side.

Tasks: D1 layering · D2 crossing reduction · D3 coordinate assignment ·
D4 cycle handling · D5 animate into place · D6 story + demo.

---

## 5. `node-editor-history` — run history and replay

**Priority: 5.** The addon that makes the workflow-automation genre real.

| | |
|---|---|
| Requires from base | `(runStarted)`, `(nodeSettled)`, `(runFinished)`, serialised graph |
| Writes to base | node status overlay when replaying a past run |

Records per run: the serialised graph, each node's inputs, outputs, status,
error and duration. Replay puts the editor into a read-only mode showing that
run's values — which is *"what happened on run #47"*, the question the genre
exists to answer.

Storage is the consumer's: the addon exposes a `RunRecord[]` and a sink
interface; it does not choose IndexedDB on anyone's behalf.

Tasks: E1 record shape + collection ✅ · E2 run list UI ✅ · E3 replay mode ✅ ·
E4 per-node timing display ✅ · E5 export a run as JSON ✅ · E6 demo ✅.

**Built.** `RunHistoryStore` is a plain class, not a service: `providedIn:
'root'` would give the whole application one history, and two editors on a page
— or a subgraph node owning a nested one — would interleave their runs into a
single unreadable list. It is bounded (default 50) because a graph with a
streaming node produces a run per emission, and an editor left open overnight
is otherwise a memory leak that reports itself as a very long list. "Keep
everything" is what `RunSink` is for.

Three decisions worth recording:

- **The graph snapshot is taken when a run STARTS.** By the time anyone asks
  what a run did, the graph has usually been edited; a snapshot taken at the
  end would be a picture of a different graph than the one that produced the
  values beside it.
- **The error is stored as its MESSAGE.** `JSON.stringify(new Error('boom'))`
  is `'{}'` — the message lives on the prototype and does not survive. Keeping
  the object gives a history that looks right in a console and exports as an
  empty pair of braces.
- **The panel hands over a JSON string and stops.** Downloading it, or putting
  it on the clipboard, means a permission prompt in one host and a file dialog
  in another. Those are application decisions, the same reasoning that keeps
  `RunSink` an interface. The demo does the download.

**Found by looking, not by a test.** The per-node timing bar was drawn bare and
left-aligned under a right-aligned number, so a node accounting for 1% of a run
was a two-pixel speck that read as stray punctuation. It is a bar in a fixed
track now, right-aligned to match the number, with a minimum fill so work that
happened stays visible as work that happened. Every assertion in the suite
passed both before and after.

---

## 6. `node-editor-groups` — visual grouping and comments

**Priority: 6.**

| | |
|---|---|
| Requires from base | `nodes()`, `selection`, an overlay slot behind the item layer |
| Writes to base | nothing — groups are its own data |

A group is a titled, coloured rectangle behind a set of nodes; moving it moves
its members. Comments are the same primitive without membership. Both are
**purely visual** and never enter the runtime, which is what keeps them an
addon rather than a change to the graph model.

The one base addition needed is an overlay slot rendered *beneath* nodes and
*above* the grid. Worth stating: without it, this addon is impossible without
forking the base template — which is exactly the signal the boundary rule
predicts.

Tasks: F1 group model + rendering · F2 membership by containment · F3 move
with members · F4 comments · F5 a11y (a group is a labelled region; its members
must remain individually reachable) · F6 story + demo.

---

## 7. `node-editor-subgraph` — nested graphs

**Priority: 7.** Deferred by R14; the seam is held open by the base's
no-global-state rule.

| | |
|---|---|
| Requires from base | `NodeGraphRuntime` instantiable standalone |
| Writes to base | nothing — it *is* a node type |

A `subgraph` node type whose `compute` owns a child `NodeGraphRuntime`, mapping
outer ports to inner boundary nodes. Expand/collapse swaps which graph the
editor is showing.

**This addon is the test of §14.9 of the design doc.** If it cannot be built
without touching the base, a singleton crept in.

Tasks: G1 subgraph node type · G2 boundary port mapping · G3 expand/collapse
navigation · G4 breadcrumb · G5 serialisation of nested graphs · G6 story +
demo.

---

## 8. Genre bundles

Not components — curated **collections of node types** built on the base, which
is what R1 means by "addons for workflow automation, dataflow and visual app
building". Each is a directory of `NodeTypeDefinition`s plus their views.

| Bundle | Representative node types | Notes |
|---|---|---|
| **Automation** | HTTP request, branch, delay, merge, schedule trigger, template | Mostly `remote: true` and `reactive: false` — they have side effects |
| **Dataflow** | map, filter, reduce, join, sort, chart | Pure, `reactive: true`, cheap to re-run continuously |
| **Visual app** | text input, select, button, browser, image, markdown | Have a `view`, little or no `compute`; the graph *is* the UI |

The demo ships the **visual app** trio first — text input → uppercase → browser
— because it is the maintainer's motivating example and it exercises live
propagation, node views and interactive content inside a card in one screen.

Credentials/secrets belong to the automation bundle, not the base: the base
never sees a credential, which is a security property worth keeping.

---

## 9. Build order and honesty about scope

The suite is large. It lands in this order, each piece independently useful:

1. **Base runtime** (RT-1 … RT-10) — pure, no UI, all the risk
2. **Base integration** (RT-11 … RT-14) — views, interaction, validation inline
3. **Demo: the motivating example** (RT-15)
4. **Perf gates** (RT-16)
5. `node-editor-problems`
6. `node-editor-palette`
7. `node-editor-minimap`
8. `node-editor-layout`
9. `node-editor-history`
10. `node-editor-groups`
11. `node-editor-subgraph`

Steps 1–4 are the point; everything after is additive and none of it is blocked
by the others. Each addon is a separate registry entry, so a consumer installs
only what they use — which is the property the boundary rule exists to protect.
