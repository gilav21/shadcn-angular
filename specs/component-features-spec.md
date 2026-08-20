# Component Features — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately.
>
> ⚠️ **`file-upload` is a form control.** If `signal-forms-readiness-spec.md`
> is in flight, do **Task 9 last** and re-check for conflicts before editing
> `file-upload`. Every other task here touches a component that bundle does not.

**Status:** not started
**Scope:** eight independent enhancements to existing components
**Source plan:** `specs/ideas-backlog-2026-08-19.md` §2 "Others"

---

## 1. Product Manager section

### 1.1 Business logic

Eight small, independent feature gaps in components that already exist. Each is
one task; there is no shared surface between them, which is why they are
bundled — a single agent can work straight down the list.

**Every item below was verified absent on 2026-08-19.** Items originally
proposed but found already implemented were dropped from this bundle:
`virtual-scroll` variable-height rows (already measures and corrects),
`kanban` WIP limits (`wipLimit` exists), and `sortable` cross-list dragging
(`group`/`listId`/`accepts`/`itemEnter` implement it fully).

### 1.2 Why the customer wants each

| Component | Gap | Pain today |
|---|---|---|
| `toast` | No `promise()` / `loading()` / `update()` / `info()` / `warning()`. Service exposes only `toast`, `success`, `error`, `dismiss`, `dismissAll`. | Every async action needs hand-wired "show loading → dismiss → show result", and the dismiss-then-show flicker is visible. |
| `command` | Only `class`, `shouldFilter`, `search`. No async sources, recent items, nested pages. | A command palette over server-side search or with drill-down submenus has to be rebuilt from scratch. |
| `stepper` | `linear` enforces order but there is no guard hook. | Cannot validate step N before advancing — the single most common stepper requirement. |
| `tour` | No completion persistence, no branching. | Every consumer writes the same localStorage wrapper so the tour does not replay on every visit. |
| `kanban` | No swimlanes. | Cannot group rows by assignee/epic — the standard second axis of a kanban board. |
| `sortable` | No nested lists. | Cannot build a tree/outline reorder UI, despite cross-list already working. |
| `virtual-scroll` | No horizontal virtualization. | Wide datasets outside a data-table have no answer. (`data-table` already has 2D via `VirtualScrollState2D`.) |
| `file-upload` | No directory drop, no inline crop. | Users cannot drag a folder; avatar upload needs a crop step everyone rebuilds. |

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| UC-1 | `toast.promise(p, {loading, success, error})` shows a loading toast, then **mutates it in place** to the result — no dismiss-and-reshow flicker. |
| UC-2 | `toast.loading()`, `toast.info()`, `toast.warning()` and `toast.update(id, …)` exist and behave consistently with `success`/`error`. |
| UC-3 | A developer supplies an async source to `command`; results update as the promise resolves, with a loading state and no race when typing fast. |
| UC-4 | `command` shows recent/frequent items when the query is empty, and the developer controls persistence. |
| UC-5 | A `command` item can open a nested page; Escape/back returns to the parent. |
| UC-6 | A developer supplies a guard on a `stepper` step; returning `false`/rejecting blocks the transition, and an async guard shows pending state. |
| UC-7 | `tour` records completion under a developer-supplied `storageKey` and does not replay once completed. |
| UC-8 | A `tour` step can branch to different next steps based on a predicate. |
| UC-9 | `kanban` groups cards into swimlanes by a developer-supplied key; each lane collapses independently and drag works within and across lanes. |
| UC-10 | `sortable` supports nested lists — dragging an item into a child list works and reports the full path. |
| UC-11 | `virtual-scroll` virtualizes horizontally, and both axes at once. |
| UC-12 | `file-upload` accepts a dropped **directory** and enumerates its files recursively. |
| UC-13 | `file-upload` offers an inline crop step for images before the file is emitted. |
| UC-14 | Every change is backward compatible — no existing input/output/behaviour changes. |

### 1.4 Out of scope

- **`file-upload` transport.** The component has no URL/progress inputs today —
  it is a validated file picker, and "chunked/resumable upload" would mean
  introducing a transport layer. That is a design decision, not an increment.
  **Stay transport-agnostic.** Add progress *inputs* a consumer can drive if it
  is cheap; do not add fetch/XHR.
- `rich-text-editor` collaboration / comments / docx export — far too large for
  this bundle; separate spec later.
- Any change to `data-table` (it already has 2D virtualization).

---

## 2. QA section — write these tests FIRST

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `promise() mutates the same toast id through to resolution` | UC-1 | unit |
| T-2 | `promise() shows the error variant on rejection` | UC-1 | unit |
| T-3 | `loading/info/warning/update exist and behave like success/error` | UC-2 | unit |
| T-4 | `async source populates results and shows loading` | UC-3 | unit |
| T-5 | `out-of-order async responses do not clobber newer results` | UC-3 | unit |
| T-6 | `recent items show on empty query` | UC-4 | unit |
| T-7 | `nested page opens and Escape returns to parent` | UC-5 | unit |
| T-8 | `sync guard returning false blocks the transition` | UC-6 | unit |
| T-9 | `async guard shows pending then allows/blocks` | UC-6 | unit |
| T-10 | `completed tour does not replay for the same storageKey` | UC-7 | unit |
| T-11 | `branching step routes by predicate` | UC-8 | unit |
| T-12 | `cards group into swimlanes; lanes collapse independently` | UC-9 | unit |
| T-13 | `drag works within a lane and across lanes` | UC-9 | unit |
| T-14 | `nested list accepts a drop and reports the full path` | UC-10 | unit |
| T-15 | `horizontal and 2D virtualization render the right window` | UC-11 | unit |
| T-16 | `dropped directory is enumerated recursively` | UC-12 | unit |
| T-17 | `crop step emits the cropped file` | UC-13 | unit |
| T-18 | **existing specs for all eight components still pass unchanged** | UC-14 | regression |
| T-19 | axe clean for every changed component | — | story a11y |
| T-20 | e2e specs for the changed components still pass | UC-14 | e2e |

### 2.2 T-18 is the most important test here

Every task in this bundle **modifies a shipped component with existing
consumers**. Before changing any component, run its existing spec suite and
record that it is green. After the change, it must still be green **without
edits to those tests**. If an existing test needs changing, that is a breaking
change — STOP and report rather than editing the test to fit.

### 2.3 Edge cases

`toast.promise` with an already-settled promise; `command` async source that
throws; `stepper` guard that throws; `tour` with unavailable localStorage
(private mode) — must degrade, not crash; `kanban` swimlane with zero cards;
`sortable` nesting depth > 3; `file-upload` empty directory; crop on a
non-image file (must be skipped, not crash); RTL and touch for all.

### 2.4 Coverage expectation

No uncovered lines introduced. Each modified component keeps or improves its
current coverage.

---

## 3. Architecture

### 3.1 Usability

```ts
toast.promise(saveUser(), {
  loading: 'Saving…', success: 'Saved', error: e => `Failed: ${e.message}`,
});
```

```html
<ui-stepper [steps]="steps" [canLeave]="validateStep" />
<ui-tour [steps]="steps" storageKey="onboarding-v1" />
<ui-kanban [columns]="cols" [cards]="cards" [swimlaneBy]="'assignee'" />
<ui-virtual-scroll [items]="rows" orientation="horizontal" />
```

Every addition is an **optional input or a new service method**. Nothing
changes shape for existing users (UC-14).

### 3.2 Efficiency

Only two matter: `command`'s async source must debounce and discard stale
responses (T-5), and `virtual-scroll` horizontal must reuse the existing
measure-and-correct machinery rather than duplicating it.

### 3.3 DX

New exported types: `ToastPromiseOptions`, `CommandSource`, `StepGuard`,
`TourBranch`, `KanbanSwimlane`, `SortableNestedPath`, `CropResult`. Each goes
in its component's own types file, following existing conventions.

### 3.4 Implementation options — `toast.promise`

**Option 1 — dismiss the loading toast, then show a new one.** Trivial, but
produces a visible flicker and loses position in the stack. Fails UC-1's "in
place" requirement.

**Option 2 — mutate the existing toast by id.** Requires an `update(id, patch)`
primitive, which UC-2 wants anyway. `toast()` already returns an id, so the
handle exists.

**✅ Chosen: Option 2.** `update()` is independently useful, and building
`promise()` on top of it means one mechanism instead of two.

### 3.5 Implementation options — `tour` persistence

**Option 1 — component writes `localStorage` directly** under `storageKey`.
Simple; the common case works with one input.
**Option 2 — outputs only; the consumer persists.** Maximum flexibility, but
every consumer rewrites the same wrapper, which is the pain being fixed.

**✅ Chosen: Option 1, with the Option 2 escape hatch** — `storageKey` is
optional, and the existing `done`/`stepChange` outputs remain, so a consumer
who wants their own store simply omits `storageKey`. This respects the
project's "no DI-based config" rule: behaviour is set by an input on owned
code, not a provider.

### 3.6 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | A change breaks an existing consumer | T-18 regression gate; never edit an existing test to fit |
| R-2 | `command` async races | T-5 asserts stale responses are discarded |
| R-3 | `tour` localStorage unavailable (private mode) | Wrap in try/catch; degrade to non-persistent. Explicit edge case |
| R-4 | `kanban` swimlanes conflict with existing drag/undo history | Do `kanban` after the smaller items; run its full spec suite first |
| R-5 | Scope creep into `file-upload` transport | Explicitly out of scope (§1.4); STOP and report if it seems needed |
| R-6 | `file-upload` collides with `signal-forms-readiness` | Task 9 is last; re-check before starting it |

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

Ordered smallest-and-safest first, so the regression harness is proven before
the riskier components.

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Record green baseline of existing specs for all eight components (T-18 baseline) | UC-14 | ⬜ Not started | — | — | — |
| 2 | `toast`: write T-1…T-3, then implement `update`, `loading`, `info`, `warning`, `promise` | UC-1, UC-2 | ⬜ Not started | — | — | — |
| 3 | `stepper`: write T-8, T-9, then implement the sync/async guard hook | UC-6 | ⬜ Not started | — | — | — |
| 4 | `tour`: write T-10, T-11, then implement `storageKey` persistence and branching | UC-7, UC-8 | ⬜ Not started | — | — | — |
| 5 | `virtual-scroll`: write T-15, then implement horizontal + 2D virtualization | UC-11 | ⬜ Not started | — | — | — |
| 6 | `command`: write T-4…T-7, then implement async sources, recent items, nested pages | UC-3…UC-5 | ⬜ Not started | — | — | — |
| 7 | `sortable`: write T-14, then implement nested lists | UC-10 | ⬜ Not started | — | — | — |
| 8 | `kanban`: write T-12, T-13, then implement swimlanes | UC-9 | ⬜ Not started | — | — | — |
| 9 | `file-upload`: **re-check conflict with signal-forms bundle first**; write T-16, T-17, then implement directory drop + crop | UC-12, UC-13 | ⬜ Not started | — | — | — |
| 10 | Full regression sweep T-18, axe T-19, e2e T-20; update stories and demo pages for all eight | UC-14 | ⬜ Not started | — | — | — |

---

## 6. Completion log

_(empty — no tasks complete yet)_
