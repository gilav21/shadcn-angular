# Node Editor — Architecture Spec

**Status:** in progress · **Branch:** `feat/node-editor` · **Wave:** 1
**Prerequisite:** `canvas-engine` (`ui/infinite-canvas`) — **on `specs/wave-0`,
not yet on master.** This branch is cut from `specs/wave-0`; its PR cannot merge
before #119 does.

A node editor is a graph of **nodes with named ports**, connected by **edges
between ports**. The engine already gives pan, zoom, virtualisation, a batched
canvas edge layer and hit-testing, all measured with ~3.4× frame-budget
headroom. What it deliberately does not give — and what this spec is — is
**ports, port-anchored edges, interactive connect/disconnect, node dragging,
selection, and the keyboard/screen-reader model that makes any of it usable
without a mouse.**

---

## 0. The one decision that matters most

**Ports are a node-editor concept and must not leak into the engine.**

The engine's `CanvasEdge` resolves endpoints from item *centres*. A node editor
needs endpoints at *port* positions, and curves rather than straight lines. The
tempting move is to teach the engine about ports. That is wrong: it would make
a generic virtualised-plane primitive carry a graph-editor's domain model, and
every other downstream product (`whiteboard`, `mind-map`, `network-graph`)
would inherit it.

**Instead the engine gains one small, generic capability** — an edge may
declare an *anchor offset* from each endpoint item's origin, and a curve style
— and the node editor computes those offsets from its own port layout.

```ts
// packages/components/ui/infinite-canvas/infinite-canvas.types.ts
export interface CanvasEdge {
  // …existing fields…
  /** World-space offset from the source item's origin. Defaults to its centre. */
  sourceAnchor?: CanvasPoint;
  /** World-space offset from the target item's origin. Defaults to its centre. */
  targetAnchor?: CanvasPoint;
  /** `'bezier'` draws a horizontal-tangent cubic — the node-graph convention. */
  curve?: 'line' | 'bezier';
}
```

This is ~20 lines in `infinite-canvas.edge-renderer.ts`: `centreOf(item)`
becomes `anchorOf(item, offset)`, and `buildCachedEdge` picks `lineTo` or
`bezierCurveTo`. Both are generically useful (an org-chart wants anchored
edges too), neither mentions a port, and the existing AABB/batching/
`isPointInStroke` machinery is untouched — bezier bounds just widen by the
control-point extent.

**Consequence to hold onto:** node-editor never draws an edge itself. It
computes anchors and hands the engine a `CanvasEdge[]`. There is exactly one
edge renderer in the library.

---

## 1. What already exists (verified, not assumed)

| Capability | Where | Notes |
|---|---|---|
| Pan / zoom, pointer state machine | `infinite-canvas.pointer.ts` | Space-drag, wheel-zoom |
| Viewport-culled item mounting, view pool | `infinite-canvas.item-layer.ts`, `.item-pool.ts` | 24 DOM elements for a 10k graph |
| Uniform-hash spatial index | `infinite-canvas.spatial-hash.ts` | `hitTest()` in O(cell) |
| Batched canvas edges + `isPointInStroke` hit test | `infinite-canvas.edge-renderer.ts` | Straight lines, centre-anchored |
| `screenToWorld` / `worldToScreen` / `fitView` / `toJSON` | `infinite-canvas.component.ts` | |
| axe-clean region, decorative canvas hidden | `infinite-canvas.a11y.spec.ts` | **Only** the static a11y |

**Not built, contrary to what §8 of `infinite-canvas-spec.md` describes:**
roving tabindex, spatial arrow navigation, the parallel accessible model,
keyboard move/connect, live-region announcements. The engine's `onKeyDown` is
the space modifier and nothing else. All of it is this spec's scope.

---

## 2. Data model

Plain interfaces, no Angular, so layout and validation are directly unit
testable (`node-editor.types.ts`):

```ts
export type PortDirection = 'in' | 'out';

export interface NodePort {
  id: string;
  direction: PortDirection;
  /** Shown beside the port dot, and used in every announcement. */
  label: string;
  /**
   * Free-form compatibility tag. A connection is allowed only between ports
   * with an equal `type`, or when either side omits it.
   */
  type?: string;
  /** An `'in'` port with `multiple: false` (the default) holds one edge. */
  multiple?: boolean;
  disabled?: boolean;
}

export interface EditorNode extends CanvasItem {
  title: string;
  subtitle?: string;
  ports: readonly NodePort[];
  /** Any CSS colour, painted as the node's header accent. */
  accent?: string;
  /** A node the user may select but not move or delete. */
  locked?: boolean;
}

export interface NodeConnection {
  id: string;
  source: string | number;   // node id
  sourcePort: string;
  target: string | number;
  targetPort: string;
}
```

`EditorNode extends CanvasItem`, so the same array feeds
`<ui-infinite-canvas [items]>` with no mapping.

**`height` is derived, not authored.** A node's height is a function of its
port count (`layout.ts`), because a hand-set height that disagrees with the
rendered card puts every port anchor in the wrong place. Authors set `x`, `y`,
`width`; the editor writes `height` back.

---

## 3. Port layout — pure, and the source of truth for anchors

`node-editor.layout.ts`:

```ts
nodeHeight(node): number
portAnchor(node, portId): CanvasPoint | null   // world offset from node origin
connectionAnchors(nodes, conn): { source, target } | null
```

Inputs stack down the left edge, outputs down the right, in declaration order,
starting below the header. One function computes both the CSS `top` the port
dot is rendered at and the world offset the edge anchors to — **the same
function**, so the dot and the wire cannot drift apart. Any two implementations
of that number would eventually disagree; the drift is a sub-pixel bug nobody
finds by reading code.

---

## 4. Connection validity — pure, and shared by mouse and keyboard

`node-editor.validate.ts` → `canConnect(graph, from, to): ConnectResult`,
returning `{ ok: true }` or `{ ok: false, reason: ConnectRejection }` where
`ConnectRejection` is a discriminated string union — the demo shows it, the
live region announces it, and the tests assert on it rather than on a boolean.

Rules, in order:

1. `same-node` — a node may not connect to itself.
2. `same-direction` — `out` must meet `in`.
3. `port-disabled`.
4. `type-mismatch` — both sides declare a `type` and they differ.
5. `duplicate` — that exact pair is already connected.
6. `occupied` — the `in` port is single-valued and already has an edge.
7. `cycle` — only when `[allowCycles]="false"` (the default is `true`; DAG-only
   graphs opt in). DFS over the existing connections plus the candidate.

Both interaction paths call this one function. A keyboard user who can complete
a connection the mouse would reject — or vice versa — is the bug this
arrangement exists to prevent.

---

## 5. Interaction

### Mouse / touch

- **Drag a node** — pointerdown on the node card (not on a port, not on the
  header's own controls) → move → commit on pointerup. Snap to
  `[gridSnap]` when set. Live edges re-anchor every frame.
- **Connect** — pointerdown on a port → a *pending* edge follows the pointer →
  pointerup over a compatible port commits it, anywhere else cancels. The
  pending edge is dashed, and turns `--destructive` while over an invalid
  target, so rejection is visible *before* release rather than after.
- **Disconnect** — grab the `in` end of an existing edge and drag it off, which
  detaches it into the same pending state. Dropping in space deletes it.
- **Select** — click a node or an edge; shift-click adds; drag on empty plane
  marquee-selects; `Delete` removes the selection.

Touch is not an afterthought: a port dot's hit area is 44×44 under
`(pointer: coarse)` even though it renders as a 10px dot, per CLAUDE.md §6.

### Keyboard — the whole feature, not a fallback

- Roving tabindex: the canvas is one tab stop; `Arrow` keys move focus to the
  nearest node *in that direction on the plane* (not DOM order, which is
  meaningless here). Focusing a culled node pans it into view.
- `Tab` **inside** a focused node cycles its ports.
- `Enter` on a port starts a connection; navigate to another port; `Enter`
  commits, `Escape` cancels.
- `Space`+arrows nudges a node; with `gridSnap`, by one cell.
- `Delete` removes the selection, `Ctrl+A` selects all, `Escape` deselects.

### Announcements

`aria-live="polite"`, reusing `lib/sortable-aria-live.ts`, on move, connect,
disconnect, delete, and **every rejection** — a keyboard user pressing `Enter`
on an incompatible port must hear *why*, or the editor is a silent no-op.

---

## 6. The parallel accessible model

The differentiator, and the piece no node-editor library ships.

Virtualisation means off-screen nodes are **not in the DOM**, so screen-reader
traversal of the spatial view is broken by construction — not by oversight but
by the same design that makes 10k nodes fast.

So the editor renders, alongside the canvas, a visually-hidden `<ul>` mirroring
the **entire** graph: every node, its ports, and what each port connects to, as
real navigable text. It is not a summary — it is the graph. A screen-reader
user reads the structure without the spatial view existing at all.

It stays in sync because it is rendered from the same `nodes()`/`connections()`
signals; there is no second copy of the state.

---

## 7. Public API — dual mode, per CLAUDE.md

**Simple mode** — data in, changes out:

```html
<ui-node-editor
  [nodes]="nodes()"
  [connections]="connections()"
  [allowCycles]="false"
  [gridSnap]="16"
  (connectionsChange)="onConnections($event)"
  (nodesChange)="onNodes($event)"
  (connectionRejected)="toast($event.reason)"
  (selectionChange)="onSelection($event)" />
```

**Custom mode** — project a node template for full control of the card body,
exactly as `ui-infinite-canvas` does with `*uiInfiniteCanvasItem`:

```html
<ui-node-editor [nodes]="nodes()" [connections]="connections()">
  <ng-template uiNodeEditorNode let-node>
    <my-fancy-node [data]="node" />
    <!-- ports are still rendered and wired by the editor -->
  </ng-template>
</ui-node-editor>
```

Ports stay owned by the editor even in custom mode. A projected template that
had to render its own ports would have to re-derive the layout maths from §3,
and would get it wrong.

Sub-components: `ui-node-editor-node`, `ui-node-editor-port`. Every element
carries `data-slot`.

---

## 8. Files

```text
packages/components/ui/node-editor/
  index.ts
  node-editor.component.ts / .html / .css
  node-editor.types.ts
  node-editor.layout.ts          # pure: heights + port anchors
  node-editor.validate.ts        # pure: canConnect + cycle detection
  node-editor.graph.ts           # pure: apply/remove/reindex helpers
  node-editor-node.directive.ts  # *uiNodeEditorNode projection
  sub/
    node-editor-node.component.ts / .html
    node-editor-port.component.ts / .html
  node-editor.layout.spec.ts
  node-editor.validate.spec.ts
  node-editor.graph.spec.ts
  node-editor.component.spec.ts
  node-editor.a11y.spec.ts
  node-editor.stories.ts
```

Plus: the §0 engine change and its tests, a demo page, an e2e harness, and a
registry entry (`sync-registry --fix`).

---

## 9. Performance

The engine's budget is inherited, not re-litigated. Two node-editor-specific
risks:

- **Anchor recomputation on drag.** Dragging one node must recompute anchors
  only for edges touching it, not all of them. An adjacency index in
  `graph.ts`; asserted by a test that counts rebuilt paths.
- **The parallel accessible model is O(nodes) DOM.** At 10k nodes that is the
  one thing in the design that does not virtualise. Mitigation: render it only
  when the graph is under `[a11yTreeLimit]` (default 500) and otherwise expose
  a count plus the selection's neighbourhood. **Verify the real cost before
  choosing the number** — 500 is a placeholder, not a measurement.

---

## 10. Task list

| # | Task | Gate |
|---|---|---|
| T-1 | Engine: `sourceAnchor`/`targetAnchor`/`curve` on `CanvasEdge` | Existing engine tests still green; new tests for anchored + bezier bounds |
| T-2 | `node-editor.types.ts` | — |
| T-3 | `layout.ts` — heights, port anchors | Unit: dot CSS top and edge anchor agree for every port |
| T-4 | `validate.ts` — `canConnect`, cycle detection | Unit: one case per `ConnectRejection` |
| T-5 | `graph.ts` — apply/remove, adjacency index | Unit: incremental anchor recompute |
| T-6 | Node + port sub-components | 44×44 coarse-pointer targets |
| T-7 | Editor component: render, select, drag | Component spec |
| T-8 | Mouse connect / disconnect with pending edge | Component spec |
| T-9 | Keyboard model + roving tabindex | Component spec, keyboard-only |
| T-10 | Parallel accessible model + live region | a11y spec, axe clean |
| T-11 | Stories | All variants |
| T-12 | Demo page | Copy-paste examples |
| T-13 | e2e harness | `npm run e2e -- node-editor` |
| T-14 | Registry + playground | Sweep spec still passes |
| T-15 | Full gates | lint · tests · coverage · **`npm run sonar`** |

**T-9 and T-10 are not optional polish.** Section 8 of the engine spec calls an
accessible node canvas a genuine market gap; shipping this without them would
ship the thing every other library already has.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Engine change breaks a downstream edge consumer | Both new fields optional; centre + straight line remain the defaults, and the existing tests assert that |
| Bezier AABB too tight → edges clipped when culled | Bounds include control points; test with a near-vertical edge, the worst case |
| Keyboard connect and mouse connect diverge | Both call `canConnect`; a spec asserts the same rejection from both paths |
| a11y tree cost at scale | Gated by `[a11yTreeLimit]`, measured before the default is fixed |
| Depends on unmerged #119 | Branch cut from `specs/wave-0`; rebase onto master after it merges |
