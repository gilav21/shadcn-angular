# Layout Primitives — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> All four components are **new files**. This bundle edits no existing
> component, so it cannot conflict with any parallel bundle.

**Status:** in progress
**Scope:** `banner`, `page-header`, `data-list`, `masonry`
**Source plan:** `specs/ideas-backlog-2026-08-19.md` §1 Tier B items 6, 8, 11, 12

---

## 1. Product Manager section

### 1.1 Business logic

Four small layout components that every application builds by hand today:

- **`banner`** — a persistent, page-level announcement or system-status bar
  (maintenance window, trial expiry, "you are impersonating a user").
- **`page-header`** — the title / description / breadcrumb / actions strip at
  the top of a content page.
- **`data-list`** — a label→value description list; the read-only counterpart
  to `table` for detail panes.
- **`masonry`** — a column-balanced layout for items of uneven height.

### 1.2 Why the customer wants this

Each of these is currently a hand-rolled `<div>` soup that every consumer
rewrites per project, inconsistently. Specifically:

- **`banner`**: `alert` is *inline within content* and `toast` is *transient*.
  Neither is a persistent page-level bar, so developers reach for a raw div and
  lose the theme tokens, the dismiss behaviour, and the a11y semantics.
- **`page-header`**: rebuilt on every page of every app; the responsive
  behaviour (actions wrapping under the title on narrow screens) is the part
  people get wrong.
- **`data-list`**: developers misuse `table` for two-column key/value display,
  which is semantically wrong and reads badly to screen readers.
- **`masonry`**: `bento-grid` covers *deliberate* asymmetric layouts, not
  *content-driven* uneven heights. CSS columns break keyboard/DOM order, which
  is the trap this component exists to avoid.

### 1.3 Use cases — definition of done

**`banner`**
| ID | Use case |
|---|---|
| UC-1 | A developer renders a banner with a message and it spans the full width of its container using theme tokens. |
| UC-2 | A developer sets `variant` (`info` / `warning` / `destructive` / `success`) and the banner's colours change accordingly. |
| UC-3 | A developer sets `dismissible` and the user can close the banner; a `dismissed` output fires. |
| UC-4 | A developer projects custom content (a link, a button) instead of the plain message and it renders in place. |
| UC-5 | A screen reader announces the banner appropriately for its severity, without stealing focus. |

**`page-header`**
| ID | Use case |
|---|---|
| UC-6 | A developer sets `title` and `description` and gets the standard heading block. |
| UC-7 | A developer projects action buttons and they sit end-aligned on desktop and wrap below the title at ≤640px. |
| UC-8 | A developer projects a `ui-breadcrumb` above the title and spacing is correct. |
| UC-9 | The title renders as a real `<h1>` by default, with a `headingLevel` input to change it. |

**`data-list`**
| ID | Use case |
|---|---|
| UC-10 | A developer passes an `items` array of `{label, value}` and gets a rendered description list (simple mode). |
| UC-11 | A developer projects `ui-data-list-item` children with arbitrary content per row (custom mode). |
| UC-12 | A developer sets `orientation="horizontal"` and labels sit beside values; at ≤640px it collapses to stacked. |
| UC-13 | The output uses `<dl>` / `<dt>` / `<dd>` so assistive tech reads label→value pairing. |

**`masonry`**
| ID | Use case |
|---|---|
| UC-14 | A developer passes items of uneven height and they lay out in balanced columns with no large trailing gap. |
| UC-15 | A developer sets responsive column counts and the layout reflows on resize. |
| UC-16 | **DOM order matches visual reading order** so keyboard and screen-reader traversal is correct. |
| UC-17 | Adding or removing an item re-balances without a full re-render flash. |

### 1.4 Out of scope

- Sticky/pinned banner positioning (a consumer concern, not a component one).
- `app-shell` — separate spec, depends on `page-header`.
- Animated masonry reordering.
- Virtualized masonry.

---

## 2. QA section — write these tests FIRST

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `renders message and spans container` | UC-1 | unit |
| T-2 | `applies variant classes for each of the four variants` | UC-2 | unit |
| T-3 | `dismiss button removes banner and emits dismissed` | UC-3 | unit |
| T-4 | `projected content replaces the message input` | UC-4 | unit |
| T-5 | `has correct role/aria-live per variant and does not take focus` | UC-5 | a11y |
| T-6 | `renders title and description` | UC-6 | unit |
| T-7 | `actions wrap below title at 640px` | UC-7 | unit + story |
| T-8 | `renders projected breadcrumb with correct spacing` | UC-8 | unit |
| T-9 | `renders h1 by default and honours headingLevel` | UC-9 | unit |
| T-10 | `simple mode renders items array as dl/dt/dd` | UC-10, UC-13 | unit |
| T-11 | `custom mode renders projected data-list-items` | UC-11 | unit |
| T-12 | `horizontal orientation collapses to stacked at 640px` | UC-12 | unit |
| T-13 | `balances columns with uneven heights` | UC-14 | unit |
| T-14 | `reflows column count on resize` | UC-15 | unit |
| T-15 | `DOM order equals visual reading order` | UC-16 | a11y |
| T-16 | `re-balances on item add/remove without full re-render` | UC-17 | unit |
| T-17 | axe clean for all four components | UC-5, UC-13, UC-16 | story a11y |
| T-18 | e2e smoke for all four | all | e2e |

### 2.2 Edge cases

Empty items array; single item; extremely long unbroken label/value (must
truncate, not overflow); RTL for all four; 320px viewport; touch dismiss target
≥44px.

### 2.3 Coverage expectation

≥90% lines on all four new component folders.

---

## 3. Architecture

### 3.1 Usability

```html
<!-- banner -->
<ui-banner variant="warning" message="Scheduled maintenance at 02:00 UTC." dismissible />
<ui-banner variant="info">
  Trial ends in 3 days. <ui-button size="sm">Upgrade</ui-button>
</ui-banner>

<!-- page-header -->
<ui-page-header title="Invoices" description="Everything billed this quarter.">
  <ui-breadcrumb ... />
  <ui-button>New invoice</ui-button>
</ui-page-header>

<!-- data-list, simple -->
<ui-data-list [items]="[{label: 'Status', value: 'Active'}]" />

<!-- data-list, custom -->
<ui-data-list>
  <ui-data-list-item label="Status"><ui-badge label="Active" /></ui-data-list-item>
</ui-data-list>

<!-- masonry -->
<ui-masonry [columns]="{ base: 1, sm: 2, lg: 3 }">
  @for (c of cards(); track c.id) { <my-card [data]="c" /> }
</ui-masonry>
```

`data-list` follows the dual-mode pattern mandated by `.claude/CLAUDE.md`;
`banner` and `page-header` support projection overriding their inputs.

### 3.2 Efficiency

Only `masonry` has a real cost. Budget: reflow of 200 items under 8ms; one
`ResizeObserver`, not one per item; no layout thrash (batch all reads before
all writes).

### 3.3 DX

Exported types: `BannerVariant`, `DataListItem`, `MasonryColumns`. Everything
else is inputs. `masonry` must document the DOM-order guarantee explicitly —
it is the reason to use it over raw CSS columns.

### 3.4 Implementation options — `masonry` (the only non-obvious one)

**Option 1 — CSS `columns`.**
Pros: zero JS, browser-native balancing, cheap.
Cons: **fills top-to-bottom per column**, so visual order ≠ DOM order. Keyboard
and screen-reader traversal jumps around the page. Fails UC-16 outright.

**Option 2 — CSS Grid with `grid-auto-rows` + row spans.**
Pros: no JS layout math; DOM order preserved.
Cons: requires measuring each item's height to compute its span; needs a fine
row unit and per-item measurement; awkward with dynamic content.

**Option 3 — JS column assignment: measure heights, greedily place each item in
the currently-shortest column, absolutely position or use flex columns.**
Pros: true balancing; DOM order controllable; predictable.
Cons: JS on resize; needs `ResizeObserver`; must batch reads/writes.

**✅ Chosen: Option 3, with Option 2's spans as a documented fallback.**
Option 1 is disqualified — UC-16 is the component's entire reason to exist, and
the accessible-DOM-order guarantee is what makes it worth shipping over three
lines of CSS. Option 3 is the only one that balances *and* preserves order.
Keep items in DOM order and assign them to flex columns so focus order follows
source order.

### 3.5 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | `masonry` layout thrash on resize | Batch all `getBoundingClientRect` reads, then all writes; single rAF |
| R-2 | `banner` `aria-live` too aggressive → screen reader interrupts | `role="status"` for info/success, `role="alert"` only for destructive; never move focus (T-5) |
| R-3 | `page-header` `<h1>` conflicts with a page that already has one | `headingLevel` input (UC-9) |
| R-4 | `data-list` `<dl>` semantics broken by wrapper elements between `dl` and `dt` | `display: contents` on wrappers; assert structure in T-10 |

---

## 4. Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run coverage`
   then `npm run sonar` against `http://localhost:9000`) run and clean on the
   changed code. eslint is NOT a substitute. If the token, server, or Docker is
   unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill.

Then update the task row with **Completed**, **Score**, **Retrospective**.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-5 for `banner` | UC-1…UC-5 | ✅ Done | 2026-08-20 | 95 | Tests written first and observed red (module not found, 0 tests collected) before any implementation existed. Covering T-1…T-5 plus the §2.2 edge cases up front pinned the API — notably that projection must override `message` — before a line of the component was written. |
| 2 | Implement `banner` + stories + demo page | UC-1…UC-5 | ✅ Done | 2026-08-20 | 95 | Angular's native `<ng-content>` fallback content gave UC-4 (projection overrides `message`) with no `@ContentChild` timing games. Review nit fixed: a dismissed banner now drops `role`/`aria-live` so an emptied live region stops being announced. |
| 3 | Write failing tests T-6…T-9 for `page-header` | UC-6…UC-9 | ✅ Done | 2026-08-20 | 94 | Written first and observed red before the component existed. Two rounds of review feedback turned class-string assertions into real evidence: the empty breadcrumb slot is now proven to collapse (`display:none`, zero height, title flush at top), and a bogus element-width "breakpoint" test was replaced with a matchMedia-driven computed-style check plus a CSSOM probe for the 640px rule. |
| 4 | Implement `page-header` + stories + demo page | UC-6…UC-9 | ✅ Done | 2026-08-20 | 94 | `flex-col` → `sm:flex-row sm:justify-between` gives UC-7 with no JS; `empty:hidden` on the breadcrumb slot keeps UC-8 spacing correct whether or not a breadcrumb is projected. `headingLevel` drives an `@switch` over `h1`…`h6` that shares one class string, so R-3 changes the semantics without changing the look. |
| 5 | Write failing tests T-10…T-12 for `data-list` | UC-10…UC-13 | ✅ Done | 2026-08-20 | 94 | Written first and observed red. R-4 is proven by walking every ancestor between `dt` and `dl` and asserting `display: contents`, in both simple and projected modes — not by asserting a class name. |
| 6 | Implement `data-list` (dual mode) + stories + demo page | UC-10…UC-13 | ✅ Done | 2026-08-20 | 94 | Dual mode is additive rather than exclusive — generated `items()` rows render first, projected `ui-data-list-item` rows after — so the two can be mixed in one list. `class` merges onto the inner `<dl>` (the element that carries the grid) so consumer layout utilities actually win. |
| 7 | Write failing tests T-13…T-16 for `masonry` | UC-14…UC-17 | ✅ Done | 2026-08-20 | 93 | Written first and observed red. Everything is measured geometry, not class names: non-decreasing tops for UC-16, per-column bottoms for balance, an asserted observer count of 1, and the 200-item pass timed against the 8ms budget. Review feedback replaced `toEqual` on elements (which falls back to `isEqualNode`) with per-element `toBe` identity, and grew the RTL case from one item to a real column-order check. |
| 8 | Implement `masonry` per Option 3 + stories + demo page | UC-14…UC-17 | ✅ Done | 2026-08-20 | 93 | Option 3 exactly — items stay direct children in source order and are absolutely positioned into the shortest column, so the minimum column height never decreases and DOM order is provably reading order. Breakpoints resolve against the container width rather than the viewport, which makes the component behave correctly inside a narrow pane and makes UC-15 testable. |
| 9 | Register all four (`sync-registry --fix`), scaffold + pass e2e (T-18), axe clean (T-17) | all | ✅ Done | 2026-08-21 | n/a (integration) | Completed on the integration branch. All four registered — `data-list`'s `sub/` files are present, the omission this bundle originally found. e2e passes; `data-list`'s e2e test had to be **rewritten**: it asserted the pre-fix `display: contents` wrapper, i.e. it pinned the very a11y bug R-4 was corrected to remove. Full axe run green, 167 suites. |

---

## 6. Completion log

| Task | Completed | Score | Reviewer rationale (compressed) |
|---|---|---|---|
| 1 — banner tests | 2026-08-20 | 95 | Tests assert real DOM/behavioural outcomes rather than mere creation, and cover the R-2 a11y contract explicitly. |
| 2 — banner impl | 2026-08-20 | 95 | Faithfully covers UC-1…UC-5 with cva theme tokens, the exact R-2 role/aria-live split, and demo/locale/stories/routing wiring mirroring the sibling `alert`. No placeholder code, no `any`, members readonly. |
| 3 — page-header tests | 2026-08-20 | 94 | Assertions carry real evidence — computed styles and CSSOM probes — rather than tautological class-string checks. |
| 4 — page-header impl | 2026-08-20 | 94 | Correctly satisfies UC-6…UC-9; `empty:hidden` costs zero space with no breadcrumb, the row switches at the 640px breakpoint, and `headingLevel` changes the element without changing the visual size. Demo/locale/routes/barrel wiring mirrors the `banner` sibling across ten locales including RTL. |
| 5 — data-list tests | 2026-08-20 | 94 | Computed-style parent-chain walks and `scrollWidth`/`clientWidth` overflow checks rather than tautologies. |
| 6 — data-list impl | 2026-08-20 | 94 | Real `dl`/`dt`/`dd` with `display: contents` rows satisfies UC-13 and R-4; UC-12 collapse verified by grid track count behind matchMedia. The additive dual mode deviates from the literal ContentChild switch in CLAUDE.md but is spec-sanctioned, documented, storied and tested. |
| 7 — masonry tests | 2026-08-20 | 93 | Measured geometry throughout; reference-identity and multi-item RTL checks added after review. |
| 8 — masonry impl | 2026-08-20 | 93 | Genuinely Option 3 with no CSS `columns` anywhere; the batched write-widths / read-heights / write-offsets pass is real, the monotonic-top argument for UC-16 is sound, and one ResizeObserver plus the 8ms budget are asserted rather than claimed. |

> **Gate cadence note.** Per the orchestrator's mid-bundle direction, each task
> is gated on targeted tests + `npm run lint` + review-gate ≥ 91; the full
> `npm run coverage` and SonarQube server scan run once for the whole bundle
> after the last task, against project key `shadcn-angular-layout-primitives`.
> Test-writing tasks (1, 3, 5, 7) are scored together with the implementation
> task they precede, since DoD criterion 1 cannot hold while they are red.
