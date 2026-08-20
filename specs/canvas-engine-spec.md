# Canvas Engine — Spec (phases 1–3)

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately.
>
> **It is the highest-risk bundle in the set — start it early.** If the
> performance budget in §3.2 fails, the plan for `node-editor`, `whiteboard`,
> `network-graph` and `mind-map` all change. Everything else in Wave 0 is
> low-risk by comparison.
>
> Full design rationale lives in `specs/infinite-canvas-spec.md`. **Read it
> before starting.** This spec is the executable subset (phases 1–3 only).

**Status:** not started
**Scope:** the infinite-plane engine — transform, culling, DOM virtualization,
edge canvas. **No nodes-and-ports editor** (that is `node-editor-spec.md`).

---

## 1. Product Manager section

### 1.1 Business logic

An **engine**, not a product: an infinite pannable/zoomable plane that renders
a large set of positioned items efficiently, plus an edge layer. It knows
nothing about "nodes", "ports", or "connections".

Products built on it later: `node-editor`, `whiteboard`, `mind-map`, and
`network-graph`. Building the engine once means those four stop being four
from-scratch efforts.

### 1.2 Why the customer wants this

A developer who needs a flow editor, diagram tool, mind map, or force-directed
graph in Angular today has three options: add a heavy third-party dependency
(breaking the library's zero-dependency property), use `org-chart` (which is
SVG + `<foreignObject>` and does not scale past a few hundred nodes), or build
pan/zoom/culling/hit-testing from scratch — which is weeks of work and where
most attempts fail on performance.

The library already owns the two hardest pieces (`ComponentPoolService` for
recycling, `virtual-scroll` for the culling pattern), so this is closer than it
looks.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| UC-1 | A developer drops `<ui-canvas>` in a page and can pan by dragging empty space, and zoom with ctrl+wheel / trackpad pinch. |
| UC-2 | Plain wheel pans vertically, shift+wheel pans horizontally, space+drag pans — matching Figma/tldraw conventions. |
| UC-3 | Two-finger pinch on touch zooms about the midpoint of the two pointers. |
| UC-4 | A developer supplies 10,000 positioned items and only those intersecting the viewport (plus overscan) exist in the DOM. |
| UC-5 | Item components are **recycled**, not recreated, as they scroll in and out of view. |
| UC-6 | A developer supplies edges between items and they render, including edges whose endpoints are both off-screen but whose line crosses the viewport. |
| UC-7 | Pan and zoom stay at 60fps with 10,000 items loaded, **even when the item components are expensive to render**. |
| UC-8 | A developer calls `fitView()`, `zoomTo()`, `panTo()`, `screenToWorld()`, `worldToScreen()` and they behave correctly. |
| UC-9 | Hit-testing returns the correct item or edge under a point, with a defined z-order when both are present. |
| UC-10 | The canvas renders crisply on a HiDPI display (`devicePixelRatio` handled). |
| UC-11 | `toJSON()` / `fromJSON()` round-trip viewport and item positions. |
| UC-12 | The canvas is keyboard-operable: arrow keys pan, +/- zoom, and it is reachable by Tab. |

### 1.4 Out of scope — phases 4–8

Deliberately deferred so this bundle stays finishable:

- Selection (click, shift-click, box-select) — phase 4.
- Node dragging and snapping — phase 4.
- The full a11y layer (roving tabindex, spatial arrow navigation, the parallel
  accessible model) — phase 5. **UC-12 is the minimum bar for this bundle**;
  the complete story is phase 5.
- LOD (canvas-drawn items below a zoom threshold) — phase 6.
- Ports, connect/disconnect, edge routing — `node-editor-spec.md`.
- Minimap, history, auto-layout addons.

### 1.5 Naming — decide in Task 1

`canvas` collides conceptually with `HTMLCanvasElement`; `flow` matches
ecosystem expectations (React Flow, Vue Flow) but implies node-editing, which
this engine deliberately is not. Recommendation is engine = `canvas`,
product = `node-editor`. **Task 1 confirms with the user before any file is
created** — renaming a registry entry later is expensive.

---

## 2. QA section — write these tests FIRST

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `drag on empty space pans; transform updates` | UC-1 | unit |
| T-2 | `ctrl+wheel zooms about the cursor` | UC-1 | unit |
| T-3 | `plain/shift wheel pans; space+drag pans` | UC-2 | unit |
| T-4 | `two pointers pinch-zoom about their midpoint` | UC-3 | unit |
| T-5 | `only viewport+overscan items are in the DOM at 10k` | UC-4 | unit |
| T-6 | `pool recycle count rises and create count plateaus while panning` | UC-5 | unit |
| T-7 | `an edge with both endpoints off-screen still draws` | UC-6 | unit |
| T-8 | **`pan/zoom of a 10k graph holds the frame budget`** | UC-7 | perf |
| T-9 | **`DOM element count stays bounded regardless of graph size`** | UC-4, UC-7 | perf |
| T-10 | `fitView/zoomTo/panTo/screenToWorld/worldToScreen are correct` | UC-8 | unit |
| T-11 | `hitTest returns item or edge with defined z-order` | UC-9 | unit |
| T-12 | `canvas backing store is scaled by devicePixelRatio` | UC-10 | unit |
| T-13 | `toJSON/fromJSON round-trips` | UC-11 | unit |
| T-14 | `arrow keys pan, +/- zoom, canvas is tab-reachable` | UC-12 | a11y |
| T-15 | `axe clean` | UC-12 | story a11y |
| T-16 | `e2e smoke: pan, zoom, item count` | all | e2e |
| T-17 | `no ComponentRef leak across sustained panning` | UC-5 | unit |

### 2.2 The performance tests are the point (T-8, T-9)

These are **gates, not aspirations** — this repo gates on a11y, coverage and
Sonar, and performance should be no different or it regresses silently.

Implement as a Playwright spec that generates a 10,000-item fixture **in code**
(never committed), scripts a deterministic pan/zoom sequence, and asserts on:

- long-task count / dropped frames,
- `document.querySelectorAll('[data-slot=canvas-item]').length` staying bounded,
- heap not growing monotonically across the run (T-17).

If a budget cannot be met, **do not silently lower it.** Record the measured
number in the retrospective and raise it with the user — that result changes
downstream plans.

### 2.3 Edge cases

Zero items; one item; all items at the same coordinate; items at extreme
coordinates (float precision, see R-4); zoom at min and max clamps; a resize
mid-drag; pointer leaving the window mid-drag; RTL.

### 2.4 Coverage expectation

≥90% lines. The transform math and the spatial hash are pure functions and must
be **unit-tested directly**, not only through the component.

---

## 3. Architecture

### 3.1 Usability

```html
<ui-canvas [items]="items()" [edges]="edges()" #c="uiCanvas">
  <ng-template uiCanvasItem let-item>
    <my-card [data]="item" />
  </ng-template>
</ui-canvas>
<ui-button (click)="c.fitView()">Fit</ui-button>
```

Item projection **must be a `TemplateRef`, not static content projection** —
you cannot project 10,000 static elements and then virtualize them. This
mirrors the existing convention exactly:
`virtual-scroll.component.ts:95` uses
`@ContentChild(VirtualItemDirective, { read: TemplateRef })` with an
`{$implicit, index}` context. Follow it.

### 3.2 Efficiency — the budget

| Metric | Target |
|---|---|
| Graph size | 10,000 items / 20,000 edges |
| Pan / zoom | ≥60fps sustained (frame < 8ms) |
| DOM element count | ≤ ~400 regardless of graph size |
| First paint of a 10k graph | < 500ms |
| Memory | flat under sustained pan |

### 3.3 The three decisions that make this work

**1. The hot path must not touch signals.** The demo app is zoneless
(`provideZonelessChangeDetection` in `demo/src/app/app.config.ts`), so every
signal write schedules change detection. Writing viewport state to a signal on
`pointermove` means a full CD pass per frame.

Instead: mutate a plain object, `requestAnimationFrame`, write
`el.style.transform` **directly**, redraw the edge canvas — Angular is not
involved in a pan frame at all. Touch a signal only when the *culled set*
changes, which is throttled naturally by the overscan margin. This is what
keeps pan smooth even when item components are expensive (UC-7).

Note `NgZone.runOutsideAngular` (used in `particles`, `virtual-scroll`) is
vestigial under zoneless — do not rely on it; the discipline above replaces it.

**2. The transform wrapper must be zero-sized.** One element,
`position:absolute; width:0; height:0; transform-origin:0 0`, carrying a single
`translate3d(...) scale(...)`. Children are absolutely positioned at world
coordinates and may be negative. An infinite canvas does **not** need a large
element — allocating one is what blows up GPU memory. Set `will-change:
transform` only during interaction, never permanently.

**3. Edge paths are cached in world space.** Build each edge's `Path2D` once in
world coordinates; per frame do `ctx.setTransform(zoom,0,0,zoom,panX,panY)` and
stroke. Pan/zoom then rebuilds **zero** paths. Divide `lineWidth` by `zoom` to
keep on-screen width constant. Batch by stroke style into one `Path2D` per
style — `ctx.stroke()` per path is the bottleneck, not path construction.
The same cached path gives exact hit-testing via `ctx.isPointInStroke()`, so
there is no bezier distance math to write.

### 3.4 Implementation options — rendering strategy

**Option 1 — Pure DOM, no canvas.** Every item and edge is an element.
Pros: simplest; full projection; a11y free. Cons: edges cannot be culled by
endpoint and thousands of SVG paths destroy performance. Fails UC-6/UC-7.

**Option 2 — Pure canvas2D.** Draw everything.
Pros: fastest. Cons: no projected Angular components, no a11y, no form
controls, no CSS theming — it abandons the library's entire philosophy.

**Option 3 — Hybrid: DOM items (culled + pooled) over a canvas edge layer.**
Pros: keeps projected Angular items, a11y, theming; DOM count bounded by
*viewport area* not graph size; edges get canvas throughput and are cullable by
AABB rather than endpoint.
Cons: two hit-test paths that must agree (R-2); LOD needed at far zoom (phase 6).

**✅ Chosen: Option 3.** It is the only option that preserves "if you project
content, you get full control" while meeting the perf budget. Option 1 fails
the budget; Option 2 fails the philosophy.

### 3.5 Implementation options — spatial index

**Option 1 — Linear scan, O(n) per query.** At 10k that is ~1–2ms — survivable
but consumes most of the frame budget and does not scale.

**Option 2 — Quadtree.** Adapts to non-uniform density, but pays a
restructuring cost on **every item move**, and items move constantly during
drags and layout.

**✅ Chosen: Option 3 — uniform spatial hash.** Bucket by
`(floor(x/cell), floor(y/cell))`, cell ≈ 2× median item size. Query = iterate
cells overlapping the viewport → O(visible). Insert/move/remove O(1) with **no
rebalancing**. A few dozen lines, trivially unit-testable. The quadtree's
density adaptation does not pay for itself when item sizes are broadly uniform
by construction. Query only when the viewport crosses the overscan margin — not
every frame.

### 3.6 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Perf budget missed → downstream plans change | T-8/T-9 run from phase 2, not at the end. Report the measured number; never lower the bar silently |
| R-2 | DOM and canvas hit-testing disagree | One `hitTest(point)` entry point consulting both in a defined z-order; T-11 uses shared fixtures |
| R-3 | `devicePixelRatio` is used **nowhere** in the codebase today (verified: zero matches) — easy to forget | T-12 asserts the backing store scale. (`particles` has this bug already — out of scope here, worth a separate fix) |
| R-4 | Float precision jitter at extreme zoom/coordinates | Document as a known limit; implement origin re-basing only if it shows up |
| R-5 | Safari composited-layer behaviour with large scaled layers | Zero-sized wrapper avoids the large-layer case; verify on real Safari, not just Chromium |
| R-6 | Scope creep into selection/nodes/whiteboard | §1.4 is explicit. If tempted, STOP and report |
| R-7 | Pool leaks `ComponentRef`s over long pans | T-17 asserts flat memory |

---

## 4. Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — full server scan (`npm run coverage` then
   `unset SONAR_TOKEN; npm run sonar`) clean on changed code. If
   token/server/Docker unavailable, the task is **blocked, not done**.
5. **Review gate ≥ 91** — invoke the `review-gate` skill.

Then update the task row with **Completed**, **Score**, **Retrospective**.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Read `infinite-canvas-spec.md`; **confirm the component name with the user**; audit `virtual-scroll` + `ComponentPoolService` for the conventions to reuse | — | ⬜ Not started | — | — | — |
| 2 | Write failing tests T-1…T-4 (pointer state machine) and T-10 (transform math, as pure unit tests) | UC-1…UC-3, UC-8 | ⬜ Not started | — | — | — |
| 3 | **Phase 1** — zero-sized transform wrapper, rAF loop, pointer state machine, wheel/pinch/space-drag, `screenToWorld`/`worldToScreen`. Demoable as a pannable grid, no items yet | UC-1…UC-3, UC-8 | ⬜ Not started | — | — | — |
| 4 | Write failing tests for the spatial hash as a **pure unit**, plus T-5 | UC-4 | ⬜ Not started | — | — | — |
| 5 | **Phase 2a** — uniform spatial hash + viewport culling with overscan hysteresis | UC-4 | ⬜ Not started | — | — | — |
| 6 | Write failing tests T-6, T-17 (pooling and leak) | UC-5 | ⬜ Not started | — | — | — |
| 7 | **Phase 2b** — DOM item virtualization via `TemplateRef` + `ComponentPoolService` recycling | UC-4, UC-5 | ⬜ Not started | — | — | — |
| 8 | Write **perf gate** tests T-8, T-9 with the in-code 10k fixture. Report measured numbers even if they pass | UC-7 | ⬜ Not started | — | — | — |
| 9 | Optimise until the budget in §3.2 is met, or report the shortfall to the user | UC-7 | ⬜ Not started | — | — | — |
| 10 | Write failing tests T-7, T-11, T-12 (edges, hit-test, DPR) | UC-6, UC-9, UC-10 | ⬜ Not started | — | — | — |
| 11 | **Phase 3** — edge canvas: world-space `Path2D` cache, style batching, DPR scaling, `isPointInStroke` hit-testing, AABB culling | UC-6, UC-9, UC-10 | ⬜ Not started | — | — | — |
| 12 | T-13 serialization, T-14/T-15 keyboard + axe, register, scaffold + pass e2e (T-16), stories + demo page | UC-11, UC-12 | ⬜ Not started | — | — | — |

---

## 6. Completion log

_(empty — no tasks complete yet)_
