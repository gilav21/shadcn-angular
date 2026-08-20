# Infinite Canvas Engine — Architecture Spec

**Status:** design proposal, not yet approved for implementation.
**Date:** 2026-08-19
**Goal:** a very performant infinite canvas with nodes, edges, pan/zoom —
zero third-party dependencies, Angular 21, zoneless, and accessible.

---

## 0. The one decision that matters most

**Do not build "a node editor". Build an engine, then build products on it.**

```text
canvas            ← the infinite-plane engine: transform, culling,
                    DOM virtualization, selection, pointer state machine.
                    Knows nothing about "nodes" or "edges".
  ├── node-editor ← ports, edges, connect/disconnect interactions
  ├── whiteboard  ← freehand, shapes, sticky notes, text
  ├── network-graph (chart) ← force layout over the same engine
  └── mind-map    ← radial layout, keyboard-first outlining
```

Four products, one engine, one perf budget, one a11y story. It also fits the
registry's existing dependency model exactly (`dependencies: ['canvas']`), and
it means Tier-C's `network-graph` stops being an expensive one-off and becomes
a layout function over an engine that already exists.

If we build a monolithic `whiteboard` instead, we pay the hard costs (culling,
transform, hit-testing, a11y) once and can never reuse them.

---

## 1. Prior art in this repo (verified)

| Asset | Where | Relevance |
| --- | --- | --- |
| `ComponentPoolService` | `lib/component-pool.service.ts` | Already recycles `ComponentRef`s with a 200-instance cap. This is the node recycler — no new code needed. |
| 1-D virtualization + runway | `ui/virtual-scroll/` | The culling/recycling pattern, proven. Canvas generalizes it 1-D → 2-D. |
| Template projection convention | `virtual-scroll.component.ts:95` | `@ContentChild(VirtualItemDirective, { read: TemplateRef })` with `{$implicit, index}`. The canvas node template must mirror this exactly. |
| rAF + canvas2D + `ResizeObserver` | `ui/particles/particles.component.ts` | The render-loop shape to follow. |
| `sortable-aria-live.ts` | `lib/` | The pattern for announcing drag/drop to screen readers; canvas reuses it for move/connect. |
| `auto-scroll.ts`, `touch.ts`, `flip.ts` | `lib/` | Edge-of-viewport auto-pan while dragging, pointer helpers, animation. |
| `org-chart` | `ui/org-chart/` | **Counter-example.** SVG + `<foreignObject>` per node. Correct at 50 nodes, falls over well before 1,000. Do not extend this; consider re-targeting it onto the engine later. |

**Two findings from the survey that directly shape this design:**

1. **The demo app is zoneless** (`provideZonelessChangeDetection` in
   `demo/src/app/app.config.ts`). Every signal write schedules a change-detection
   pass. This dictates the whole hot-path design in §4.
2. **`devicePixelRatio` appears nowhere in the codebase** (verified: zero
   matches across `packages/components/`). `particles` therefore renders blurry
   on any HiDPI display. The canvas must handle DPR from day one — and
   `particles` has a small real bug worth fixing separately.

---

## 2. Rendering strategy: DOM nodes, canvas edges, LOD at distance

The tension: the library's philosophy is *"if you project content, you get full
control"* — consumers want real Angular components as nodes, with their own
inputs, buttons, and form controls. But real DOM is what kills canvas
performance at scale.

Three candidate strategies:

| | Pure DOM | Pure canvas2D | **Hybrid (chosen)** |
| --- | --- | --- | --- |
| Projected Angular nodes | ✅ | ❌ | ✅ |
| A11y / focus / form controls | ✅ | ❌ (rebuild from scratch) | ✅ |
| CSS theming, density, RTL | ✅ | ❌ | ✅ |
| 10k nodes | ❌ | ✅ | ✅ (culled) |
| Long edges crossing viewport | ✅ | ✅ | ✅ |
| Zoomed-out overview | ❌ (thousands visible) | ✅ | ✅ (LOD) |

**Chosen: hybrid, in three layers, bottom to top.**

```text
┌─ layer 3: overlay canvas ── selection box, connect-preview, snap guides
├─ layer 2: DOM node layer ── the transformed wrapper; visible nodes only
└─ layer 1: edge canvas ───── all visible edges, one <canvas>
```

- **Nodes are DOM**, absolutely positioned in world coordinates inside a single
  transformed wrapper. Only nodes intersecting the viewport (plus overscan)
  exist; they are created and recycled through `ComponentPoolService`. DOM
  count is bounded by *viewport area*, not by graph size — 10,000 nodes with
  200 visible costs the same as 200 nodes.
- **Edges are canvas.** Edges cannot be culled by endpoint: a long edge with
  both endpoints off-screen still crosses the viewport. They are also the thing
  there are most of. One canvas, one draw loop, zero DOM.
- **LOD:** below a zoom threshold (node's on-screen size < ~40px), stop
  instantiating DOM nodes and draw them as rectangles on the edge canvas
  instead. This is what makes "zoom out to see all 10,000" work at all, and it
  is the *only* way the DOM strategy survives a full-graph overview.

---

## 3. The transform model

Viewport state is an affine transform `{x, y, zoom}`. World → screen:

```text
screen = (world * zoom) + pan
```

Applied as **one** CSS transform on **one** wrapper element:

```css
transform: translate3d(Xpx, Ypx, 0) scale(Z);
transform-origin: 0 0;
```

Children are positioned at world coordinates and never re-laid-out during
pan/zoom — the browser composites the whole layer on the GPU.

**The wrapper must be zero-sized.** An infinite canvas does not need an
infinite (or even large) element: the wrapper is `position:absolute; width:0;
height:0` and serves only as a transform origin. Children are absolutely
positioned and may have negative coordinates. This avoids allocating a giant
composited layer, which is what blows up GPU memory in naive implementations.

**`will-change: transform`** is set on the wrapper only while an interaction is
active, and removed on idle. Leaving it on permanently promotes a layer forever
and costs memory for no benefit when nothing is moving.

**Known limits to document, not solve:**

- `scale()` scales text rendering. Zoomed in, text stays crisp (vector); zoomed
  far out it becomes illegible — which is exactly where LOD takes over, so this
  is self-correcting.
- At extreme zoom with far-flung coordinates, float precision in the compositor
  produces jitter. Mitigation is origin re-basing when `|pan|` exceeds a
  threshold. Document as a limit; implement only if it shows up in practice.

---

## 4. The render loop under zoneless — the critical constraint

This is the part that most Angular canvas implementations get wrong.

Under `provideZonelessChangeDetection`, **every signal write schedules a change
detection pass**. If `viewport` is a signal and it is written on every
`pointermove`, the result is a full CD tick per frame — at 120Hz, on a real app
with a large component tree, that is the entire frame budget gone before a
single pixel is drawn.

**Rule: the hot path must not touch signals.**

```text
pointermove ──▶ mutate plain object (no signal)  ──▶ mark dirty ──▶ rAF
                                                                    │
   ┌────────────────────────────────────────────────────────────────┘
   ▼
rAF frame:
   1. el.style.transform = `translate3d(...) scale(...)`   ← direct DOM write
   2. redraw edge canvas with ctx.setTransform(...)        ← no Angular
   3. IF the culled set changed beyond the overscan margin:
         write ONE signal  ──▶ exactly one CD pass adds/removes node components
```

Consequences:

- Pan and zoom stay at 60fps **even if the consumer's node components are
  expensive**, because Angular is not involved in a pan frame at all.
- The culled-set signal is written only when the viewport crosses the overscan
  margin — a few times per second while panning fast, never while zooming in
  place. Hysteresis on the margin prevents thrashing at the boundary.
- The same rule applies to **dragging a node**: mutate the dragged element's
  transform directly, and emit `nodesChange` **once, on pointerup**. A
  `liveUpdate` input can opt into streaming for consumers who need it.

Note: `NgZone.runOutsideAngular` (used in `particles` and `virtual-scroll`) is
vestigial under zoneless — `NgZone` is a `NoopNgZone`. The canvas should not
rely on it; the discipline above replaces it.

---

## 5. Spatial index: uniform hash grid

Culling naively is O(n) per query — at 10k nodes that is ~1–2ms, which is
survivable but leaves nothing for the rest of the frame, and it does not scale
to 100k.

**Choose a uniform spatial hash over a quadtree.** Bucket by
`(floor(x / cell), floor(y / cell))`, cell size ≈ 2× median node size.

- Query = iterate the cells overlapping the viewport rect → O(visible).
- Insert / move / remove = O(1), with **no rebalancing**. This matters more than
  it looks: nodes move constantly during drags and during force layout, and a
  quadtree pays a restructuring cost on every move that a hash grid does not.
- Trivial to implement and to unit-test — a few dozen lines.

The quadtree's advantage (adapting to non-uniform density) does not pay for
itself here, because node sizes in an editor are broadly uniform by
construction.

The index is queried **only when the viewport moves past the overscan margin**,
not every frame.

---

## 6. Edge rendering — the Path2D-in-world-space trick

The naive loop rebuilds every edge path each frame from transformed endpoints.
That is wasted work: the *shape* of an edge does not change when you pan.

**Build each edge's `Path2D` once, in world coordinates. Cache it. Then:**

```text
ctx.setTransform(zoom, 0, 0, zoom, panX, panY)
ctx.lineWidth = baseWidth / zoom        // constant on-screen width
for (path of visibleEdges) ctx.stroke(path)
```

Pan and zoom then require **zero path reconstruction** — only re-stroking. Paths
are rebuilt only when an endpoint actually moves.

Further optimizations, in order of payoff:

1. **Batch by stroke style.** `ctx.stroke()` per path is the bottleneck, not
   path construction. Group edges by `{color, width, dash}` and append them into
   one `Path2D` per style, then stroke once per style. Turns 5,000 stroke calls
   into ~5.
2. **Cull by control-box AABB** against the viewport, via the same spatial hash.
3. **DPR:** size the canvas `w*dpr × h*dpr`, CSS-size it `w × h`, and prescale
   the context. (Nothing in the codebase does this today — see §1.)

**Hit testing comes free.** `ctx.isPointInStroke(path2d, x, y)` gives exact
edge hit-testing against the cached world-space path — no bezier distance math
to write or get wrong. Narrow candidates by AABB first.

---

## 7. Interaction: one explicit pointer state machine

Node editors accumulate bugs at the seams between interactions — a drag that
starts a box-select, a connect that becomes a pan. The fix is to refuse to have
seams: **one** `pointerdown/move/up` handler on the root, and **one** explicit
state machine.

```text
idle ──┬─▶ panning        (space+drag, middle-drag, or drag on empty space)
       ├─▶ boxSelecting   (drag on empty space, when pan is on middle/space)
       ├─▶ draggingNodes  (drag on a selected node — moves the whole selection)
       ├─▶ connecting     (drag from a port)
       └─▶ resizing       (drag on a node handle)
```

- **Pointer Events + `setPointerCapture`**, not mouse events. This unifies
  mouse / touch / pen in one code path and satisfies the CLAUDE.md touch
  mandate structurally rather than by bolting on `touchstart` handlers.
- **Two active pointers → pinch-zoom** about the pointer midpoint. Falls out of
  the same handler.
- **Wheel conventions devs already have muscle memory for:** `ctrl+wheel` zooms
  (trackpad pinch emits exactly this), plain wheel pans, `shift+wheel` pans
  horizontally, `space+drag` pans. Matching Figma/tldraw here is a real DX
  feature — getting it wrong is immediately, viscerally annoying.
- `touch-action: none` on the root so the browser does not steal pinch/scroll.
- Auto-pan when dragging near the viewport edge — `lib/auto-scroll.ts` exists.

---

## 8. Accessibility — the actual differentiator

Every canvas library in every ecosystem fails here. This library has a green
axe gate and a paid-off a11y backlog; shipping an inaccessible canvas would be
the single biggest regression in the project's quality story. It is also a
genuine market gap: **an accessible node canvas essentially does not exist.**

The hard problem: nodes outside the viewport are not in the DOM, so Tab order
and screen-reader traversal are broken by construction.

Design:

- **Roving tabindex over the visible set.** One tab stop for the canvas; arrow
  keys move focus between nodes.
- **Spatial arrow navigation** — arrow key selects the nearest node in that
  direction (not DOM order, which is meaningless on a plane). Focusing a culled
  node pans the viewport to bring it in.
- **A parallel accessible model.** Render an off-screen `<ul>`/tree that mirrors
  the full graph — every node and its connections — as real, navigable text.
  Screen-reader users get the graph structure without needing the spatial view.
  This is the piece nobody ships.
- **Keyboard editing:** `Enter` activate, `Space`+arrows move a node, `Delete`
  remove, `Escape` deselect/cancel, `Ctrl+A` select all. Connecting via keyboard
  = focus a port, `Enter` to start, navigate to target port, `Enter` to commit.
- **`aria-live` announcements** on move, connect, disconnect, delete — reuse
  `lib/sortable-aria-live.ts`.
- RTL: the plane itself is direction-neutral, but default pan direction, the
  minimap, and any gutters must respect `dir`.

---

## 9. Public API — dual-mode, per CLAUDE.md

**Simple mode** (data-driven):

```html
<ui-canvas [nodes]="nodes()" [edges]="edges()" (nodesChange)="save($event)" />
```

**Custom mode** (template-driven, virtualization-compatible):

```html
<ui-canvas [nodes]="nodes()" [edges]="edges()">
  <ng-template uiCanvasNode let-node let-selected="selected">
    <my-node-card [data]="node" [class.ring-2]="selected" />
  </ng-template>
</ui-canvas>
```

Note the projection form: a **`TemplateRef`, not static content projection**.
You cannot project 10,000 static elements and then virtualize them — the
template is instantiated per *visible* node. This mirrors
`VirtualItemDirective` exactly (`{$implicit, index}` context), so the
convention is already established in the codebase.

Core inputs: `nodes`, `edges`, `zoom`, `minZoom`, `maxZoom`, `pan`,
`snapToGrid`, `selectable`, `multiSelect`, `readonly`, `class`.
Outputs: `nodesChange`, `edgesChange`, `selectionChange`, `viewportChange`,
`nodeClick`, `edgeClick`, `connect`, `disconnect`.
Imperative API via `exportAs`: `fitView()`, `zoomTo()`, `panTo()`,
`screenToWorld()`, `worldToScreen()`, `toJSON()`, `fromJSON()`.

Serialization must be designed in from day one, not retrofitted — persistence
is the first thing every consumer asks for.

**Addons** (following the proven `rich-text-editor/*` pattern):
`canvas/minimap`, `canvas/history` (undo/redo — a canvas without undo is a
toy), `canvas/auto-layout` (layered + force), `canvas/snapping` (alignment
guides), `canvas/groups`.

**Naming** is an open decision. `canvas` collides conceptually with
`HTMLCanvasElement`; `flow` matches ecosystem expectations (React Flow, Vue
Flow) but implies node-editing specifically, which the engine deliberately does
not. Current recommendation: engine = `canvas`, product = `node-editor`.

---

## 10. Performance budget — make it a gate, not an aspiration

This repo gates on a11y, e2e, coverage, and SonarQube. Performance should be no
different, or it will regress silently.

| Metric | Target |
| --- | --- |
| Graph size | 10,000 nodes / 20,000 edges loaded |
| Pan / zoom | ≥ 60fps sustained (frame < 8ms, leaving headroom) |
| DOM element count | ≤ ~400 regardless of graph size |
| First paint of a 10k graph | < 500ms |
| Drag one node in a 10k graph | zero dropped frames |
| Memory | flat under sustained pan (no leak from pooling) |

Enforced by a Playwright perf spec in the e2e harness that loads a generated
10k-node fixture, scripts a pan/zoom sequence, and asserts on long-task count
and DOM node count. Fixture generated in code, not committed.

---

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Text blurs / becomes illegible when zoomed out | LOD takes over below ~40px node size |
| Two hit-test paths (DOM for nodes, canvas for edges) disagree | Single `hitTest(point)` entry point that consults both in a defined z-order; unit-tested against the same fixtures |
| Safari composited-layer behaviour with large scaled layers | Zero-sized wrapper (§3) avoids the large-layer case; verify early on real Safari, not just Chromium |
| Float precision at extreme zoom | Origin re-basing; documented limit |
| Scope explosion — "and also whiteboard, and also mind-map" | The engine/product split (§0) is what keeps this bounded. Ship `canvas` + `node-editor` only; everything else is a later, cheap addition |
| Pool leaks `ComponentRef`s across large pans | Covered by the memory line in the perf budget |

---

## 12. Phasing

1. **Engine core** — transform, zero-sized wrapper, rAF loop, wheel/pinch/pan
   state machine, `screenToWorld`. No nodes yet. Demoable as a pannable grid.
2. **Spatial hash + DOM virtualization + pooling** — nodes appear, cull, and
   recycle. This is where the perf budget first gets asserted.
3. **Edge canvas** — Path2D world-space cache, style batching, DPR, hit-testing.
4. **Interaction** — selection (click, shift-click, box), node drag, snapping.
5. **A11y layer** — roving tabindex, spatial arrows, parallel accessible model,
   live announcements.
6. **LOD** — canvas-drawn nodes below the zoom threshold.
7. **`node-editor`** — ports, connect/disconnect, edge routing.
8. **Addons** — history, minimap, auto-layout.

Phases 1–3 are the engine's whole risk. If the perf budget holds at the end of
phase 3, everything after it is ordinary component work.

---

## 13. Downstream: what this unlocks

- **`network-graph`** (Tier C #18) becomes a force-layout function over the
  engine instead of a from-scratch chart — it drops from "hard" to "medium".
- **`whiteboard`**, **`mind-map`** become thin products.
- **`org-chart`** can be re-targeted off SVG/`foreignObject` onto the engine,
  fixing its scaling ceiling.
- **`page-builder`** could share the selection/drag/snapping layer.
