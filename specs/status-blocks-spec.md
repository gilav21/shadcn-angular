# Status Blocks — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> It edits **one existing file** — `packages/blocks/dashboard/dashboard.component.html`
> — to consume the extracted `stat-card`. No other bundle touches that file.

**Status:** not started
**Scope:** `error-page`, `result`, `stat-card`
**Source plan:** `specs/ideas-backlog-2026-08-19.md` §1 Tier B items 7, 9

---

## 1. Product Manager section

### 1.1 Business logic

Three components covering the "something happened — tell the user" surface:

- **`error-page`** — a full-page 404 / 500 / 403 state with illustration slot,
  message, and recovery actions.
- **`result`** — an in-page outcome panel (success / error / warning / info)
  shown after an operation completes, e.g. after a form submit or a payment.
- **`stat-card`** — a KPI tile: label, value, delta, optional trend/sparkline.

`error-page` and `result` are genuinely new. **`stat-card` is an extraction** —
the `dashboard` block already renders exactly this pattern inline.

### 1.2 Why the customer wants this

- **`error-page`**: every app needs 404 and 500 routes on day one. Today a
  developer adopting this library has to hand-build them, and they end up
  looking nothing like the rest of the library. This is one of the first things
  a new user notices is missing.
- **`result`**: after a multi-step form or a checkout, developers currently
  compose card + icon + heading + buttons by hand, differently each time.
- **`stat-card`**: the `dashboard` block proves the pattern is wanted, but it
  is trapped inside a block. A developer who wants just the tile has to copy
  markup out of a block, which is exactly the friction the library exists to
  remove.

Verified: `packages/blocks/dashboard/dashboard.component.html` renders
`ui-card` → `ui-card-header` → `ui-card-description` (label) →
`ui-card-title` (value) → `ui-card-content` → `ui-badge` (delta), inside a
`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. That is the component to extract.

### 1.3 Use cases — definition of done

**`stat-card`**
| ID | Use case |
|---|---|
| UC-1 | A developer sets `label`, `value` and `delta` and gets the tile the dashboard block renders today, pixel-equivalent. |
| UC-2 | A developer sets `trend` (`up`/`down`/`neutral`) and the delta badge colour and icon reflect it. |
| UC-3 | A developer projects a sparkline (or any content) into a chart slot and it renders below the value. |
| UC-4 | **The `dashboard` block is refactored to use `ui-stat-card` and renders identically to before** (visual regression check). |
| UC-5 | A long label or a long value truncates rather than breaking the grid. |

**`result`**
| ID | Use case |
|---|---|
| UC-6 | A developer sets `status` (`success`/`error`/`warning`/`info`), `title` and `description` and gets a centred outcome panel with the right icon and colour. |
| UC-7 | A developer projects action buttons and they render below the description, centred, wrapping on narrow screens. |
| UC-8 | A developer projects arbitrary detail content (e.g. an error dump in a `ui-code-block`) and it renders in an extra slot. |
| UC-9 | The status is announced to assistive tech without stealing focus. |

**`error-page`**
| ID | Use case |
|---|---|
| UC-10 | A developer sets `code` (404/500/403 or any string) and gets a full-page state with the default copy for that code. |
| UC-11 | A developer overrides `title` / `description` and the defaults are replaced. |
| UC-12 | Default actions ("Go back", "Go home") are present and emit outputs; a developer can replace them by projection. |
| UC-13 | A developer projects a custom illustration and it replaces the default. |
| UC-14 | The page renders correctly from 320px to ultrawide and the heading is a real `<h1>`. |

### 1.4 Out of scope

- Routing — `error-page` emits outputs; it never navigates by itself. (No DI
  config, no `Router` dependency — see project convention.)
- Illustrations as shipped assets: default is a typographic code, not an image.
- Error *reporting* / telemetry.
- `empty` component changes — it already exists and covers empty states.

---

## 2. QA section — write these tests FIRST

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `renders label, value and delta` | UC-1 | unit |
| T-2 | `trend up/down/neutral sets badge variant and icon` | UC-2 | unit |
| T-3 | `renders projected chart slot content` | UC-3 | unit |
| T-4 | `dashboard block renders identically after refactor` | UC-4 | visual/story snapshot |
| T-5 | `truncates overlong label and value` | UC-5 | unit |
| T-6 | `renders each status with correct icon and colour` | UC-6 | unit |
| T-7 | `projected actions render and wrap at 320px` | UC-7 | unit + story |
| T-8 | `renders projected detail slot` | UC-8 | unit |
| T-9 | `announces status via role/aria-live without moving focus` | UC-9 | a11y |
| T-10 | `known codes render their default copy` | UC-10 | unit |
| T-11 | `explicit title/description override defaults` | UC-11 | unit |
| T-12 | `default actions emit goBack/goHome outputs` | UC-12 | unit |
| T-13 | `projected illustration replaces default` | UC-13 | unit |
| T-14 | `renders h1 and is responsive 320→1920` | UC-14 | unit + story |
| T-15 | axe clean for all three | UC-9, UC-14 | story a11y |
| T-16 | e2e smoke for all three | all | e2e |

### 2.2 Edge cases

Unknown `code` value (must not crash — falls back to generic copy); zero and
negative `delta`; missing `delta` (badge hidden, not empty); RTL for all three;
`result` with no actions; 320px viewport.

### 2.3 Coverage expectation

≥90% lines on all three new component folders. The `dashboard` block's coverage
must not drop after the refactor.

---

## 3. Architecture

### 3.1 Usability

```html
<!-- stat-card: simple -->
<ui-stat-card label="Total Revenue" value="$45,231.89" delta="+20.1%" trend="up" />

<!-- stat-card: with projected sparkline -->
<ui-stat-card label="Active users" value="2,350">
  <ui-line-chart [series]="spark()" [height]="40" />
</ui-stat-card>

<!-- result -->
<ui-result status="success" title="Payment received"
           description="We emailed your receipt.">
  <ui-button>Back to dashboard</ui-button>
</ui-result>

<!-- error-page -->
<ui-error-page code="404" (goHome)="router.navigate(['/'])" />
```

### 3.2 Efficiency

No meaningful performance concern — all three are static presentational
components. Explicitly noted so no agent invents optimisation work.

### 3.3 DX

Exported types: `StatCardTrend`, `ResultStatus`, `ErrorPageCode`. `error-page`
must not import `@angular/router` — it emits `goBack` / `goHome` outputs and
leaves navigation to the consumer, per the project's no-DI-config convention.

### 3.4 Implementation options — `stat-card` extraction

**Option 1 — New component; leave the dashboard block's inline markup alone.**
Pros: zero risk to the block.
Cons: two copies of the same pattern that will drift. Fails UC-4, and leaves
the original friction (the pattern still lives inside a block) in place.

**Option 2 — New component; refactor the dashboard block to consume it.**
Pros: single source of truth; the block becomes a demonstration of composition,
which is the message the library wants to send; proves the extraction is
faithful because the block must still render identically.
Cons: touches an existing block — needs a visual check (T-4).

**✅ Chosen: Option 2.** The extraction is only worth doing if the original
caller uses it; otherwise it is just a third copy of a card. T-4 is the safety
net, and `stat-card`'s registry entry gains `dashboard` as a reverse dependent,
which `why` will then surface correctly.

### 3.5 Implementation options — `error-page` default copy

**Option 1 — Hard-code English strings.** Simple, but breaks the library's i18n
convention (`*.locales.ts` exists for every component with copy).

**✅ Chosen: Option 2 — an `error-page.locales.ts`** following the existing
pattern, with `code`-keyed default title/description, overridable by input.
This matches every other component with user-visible text.

### 3.6 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Dashboard block visual regression during extraction | T-4 is written and passing *before* the refactor; story snapshot |
| R-2 | `result` `aria-live` steals focus | `role="status"`; never call `.focus()` (T-9) |
| R-3 | `error-page` tempts an agent into adding `Router` | Explicitly out of scope; outputs only. Enforced by T-12 |
| R-4 | Registry churn — three new entries at once | Single `sync-registry --fix` in the final task, not per component |

---

## 4. Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — full server scan (`npm run coverage` then
   `npm run sonar` against `http://localhost:9000`) clean on changed code.
   If token/server/Docker unavailable, the task is **blocked, not done**.
5. **Review gate ≥ 91** — invoke the `review-gate` skill.

Then update the task row with **Completed**, **Score**, **Retrospective**.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write failing tests T-1…T-3, T-5 for `stat-card` | UC-1…UC-3, UC-5 | ✅ Done | 2026-08-20 | 93 | Writing the tests first forced the extraction's invisible constraints into the open — the `display: contents` host, and the arrow having to be an `aria-hidden` `<svg>` so the badge's text stays exactly the delta. Backing the `truncate` check with a real overflow proof turned UC-5 from a class-name assertion into a behavioural one. |
| 2 | Write T-4 dashboard-block snapshot **against current markup** (must pass before refactor) | UC-4 | ✅ Done | 2026-08-20 | 93 | Pinning the rendered result rather than the source markup is what lets one unedited spec straddle the refactor. The Churn-rate row — a falling delta badged `primary` — is the sharpest assertion in the file, and now carries a NOT-A-TYPO comment so Task 4 cannot quietly "fix" the gate away. |
| 3 | Implement `stat-card` + stories + demo page | UC-1…UC-3, UC-5 | ✅ Done | 2026-08-20 | 93 | Three review rounds, and the two findings that mattered were both invisible from the source: `files[]` was missing the barrel in a way `--fix` could never repair, and Tailwind `truncate` was shaving half a pixel off the comma in `$45,231`. Measuring beat reasoning twice — once to reject a false claim about static `class`, once to confirm a real clip I had waved away. |
| 4 | Refactor `dashboard` block to consume `ui-stat-card`; T-4 still passes | UC-4 | ✅ Done | 2026-08-20 | 93 | T-4 passed the refactor with every assertion byte-identical — only its header comment moved — which is exactly what Task 2 existed to buy. The review caught a throwaway edit script I had committed by accident: my `rm` was chained behind a command that failed, so `git add -A` swept it in. |
| 5 | Write failing tests T-6…T-9 for `result` | UC-6…UC-9 | ✅ Done | 2026-08-21 | 93 | Asserting colour against a live `text-destructive` probe rather than a class name turned out to work because Tailwind scans the spec file itself. The review caught two places where the tests over-specified — locking out a legitimate `@if` for the empty actions region, and banning `tabindex="-1"` that R-2 never forbade. |
| 6 | Implement `result` + stories + demo page | UC-6…UC-9 | ✅ Done | 2026-08-21 | 93 | The review found a real a11y bug the tests could not: `aria-live` is inherited, so a projected stack trace was inside the polite live region and would have been read aloud in full. Seeding the barrel and `sub/` file before sync ran is what kept `files[]` complete — the sync reports "in sync" either way. |
| 7 | Write failing tests T-10…T-14 for `error-page` | UC-10…UC-14 | ✅ Done | 2026-08-21 | 92 | R-3 is unguardable behaviourally — a component injecting `Router` passes every behavioural test — so the suite reads its own source. The review was right that the first cut was brittle: it now strips comments and scans `sub/` too, so a JSDoc usage snippet cannot break the build and a smuggled router cannot hide one folder down. |
| 8 | Implement `error-page` + `error-page.locales.ts` + stories + demo page | UC-10…UC-14 | ✅ Done | 2026-08-21 | 94 | The review found two real bugs my own tests had missed: a `contentChild` scoped wider than `ng-content select`, so a nested actions row would suppress the defaults and then project nothing; and a code named `toString` resolving to the inherited prototype member instead of the fallback. Both now pinned. |
| 9 | Register all three (`sync-registry --fix`), scaffold + pass e2e (T-16), axe clean (T-15) | all | ⬜ Not started | — | — | — |

---

## 6. Completion log

> Gate cadence for this bundle: per task — targeted tests, `npm run lint`, and a
> `review-gate` score ≥ 91. The full `npm run coverage` + SonarQube server scan
> (project key `shadcn-angular-status-blocks`) runs once at the end of the
> bundle, not per task.

| # | Task | Completed | Score | Reviewer rationale |
|---|------|-----------|-------|--------------------|
| 1 | Write failing tests T-1…T-3, T-5 for `stat-card` | 2026-08-20 | 93 | All four tests carry real, non-vacuous assertions traceable to their use cases, with the badge-variant expectations matching the real cva output and T-5's `truncate` check backed by a `scrollWidth > clientWidth` overflow proof. Every stat-card edge case in §2.2 is covered — zero/negative delta, missing delta in both empty-string and unbound forms, RTL, and a 320px frame. The reviewer's concerns — an unasserted `display: contents` host, an RTL scan that skipped the card's own classList, and an unratified `neutral` treatment — were all addressed before commit. |
| 2 | Write T-4 dashboard-block snapshot against current markup | 2026-08-20 | 93 | The snapshot sits at the right granularity: an ordered per-tile array of label, value, delta text and badge colour fails on any changed label, value, delta, tile order, tile count or flipped variant, while passing through the two invisible additions the extraction brings. The layout is pinned separately, and `div.grid` correctly avoids matching `ui-card-header`, which also carries a `grid` class. The reviewer noted the Churn-rate quirk was unexplained and the collateral checks were loose; both were tightened before commit — the quirk is now documented, and the chart and activity table are resolved through the shell's direct card children with a position assertion. |
| 3 | Implement `stat-card` + stories + demo page | 2026-08-20 | 93 | A faithful, well-documented extraction: the `display: contents` host keeps `ui-card` as the real grid item, `trend` maps to exactly the two badge variants the block already uses, and `trendIcon=false` plus the `aria-hidden` arrow leaves UC-4 reachable with identical badge colour and text. Registry, barrel, `ui/index.ts`, route, nav and a ten-locale demo are all in place, and the code is clean under Section 4. The rejection of the static-`class` finding is correct and properly evidenced — a measurement rather than a theory. Remaining nits (a contradictory story comment, nav ordering, unexplained `toSorted` churn, and untested `empty:hidden`) were all fixed before commit, as was the descender clip the reviewer caught me asserting rather than measuring. |
| 4 | Refactor `dashboard` block to consume `ui-stat-card` | 2026-08-20 | 93 | The refactor is correct and faithful: twelve lines of inline card/badge markup become one `<ui-stat-card>` whose trend maps to exactly the `default`/`destructive` variants the block produced before, `BadgeComponent` is the only import dropped, and the registry swap `badge` → `stat-card` reflects the real dependencies. The T-4 safety net is intact — the spec diff is 6 added / 4 removed lines all inside the leading JSDoc, and the sharpest assertions (the Churn-rate row badged `primary`, the `badgeTreatment` helper) are byte-identical, so the gate was neither weakened nor rewritten. `[trendIcon]="false"` is sound rather than a dodge: suppressing an arrow that has no direction to point at is what keeps UC-4 true, and the block still exercises four of the component's inputs. The committed throwaway script and the comment placement inside the `@for` body were both fixed before commit. |
| 5 | Write failing tests T-6…T-9 for `result` | 2026-08-21 | 93 | All four test IDs carry real, traceable assertions: per-status glyph uniqueness and colour, projection order and measured wrapping, the detail slot proven to be selected out of the default slot, and `role="status"`/`aria-live="polite"` plus an unmoved `document.activeElement` exactly as R-2 requires. Every §2.2 edge case for `result` is covered, and nothing can pass vacuously — the uniqueness assertions would fail outright if styling never landed. The three noted gaps were closed before commit: the panel's own centring is now asserted, the empty-actions test is agnostic about whether the region is omitted or collapsed, and the tab-order test accepts `tabindex="-1"`. |
| 6 | Implement `result` + stories + demo page | 2026-08-21 | 93 | Every targeted use case is satisfied: a genuinely centred panel with per-status glyph and colour, the `ui-result-detail` slot placed between description and the `empty:hidden` actions row, and `role="status"`/`aria-live="polite"` for every status including error, exactly as R-2 mandates rather than the escalating pattern in `alert.component.ts`. The registry reasoning checks out against `getEntryFile`, and the entry matches disk exactly, so a CLI install is not missing anything. All four nits were fixed before commit: the detail slot now opts out of the live region with `aria-live="off"`, the demo-only `data-testid` hook is gone, the mis-named `a11y*` locale keys are now `noActions*`, and the sub-component was split into the documented `.ts`/`.html` pair. |
| 7 | Write failing tests T-10…T-14 for `error-page` | 2026-08-21 | 92 | Every test ID carries real, non-vacuous assertions traceable to its use case — locale-resolved copy per code with a uniqueness check, fallback for both `418` and the empty string, independent title/description override, both outputs asserted with the sibling's count pinned at zero, projection proven to replace rather than duplicate, a real single `<h1>`, and both responsive ends measured against live layout. The locale shape is sound and consistent with `rating.locales.ts`, deliberately using `codes` so it does not collide with `LocaleMeta.code`. All four nits were fixed before commit: the source guard now strips comments and scans `sub/` with explanatory failure labels, `ErrorPageCode` is imported and used, the `class` merge is asserted, and the full-page centring and standing height are pinned. |
| 8 | Implement `error-page` + locales + stories + demo page | 2026-08-21 | 94 | R-3 is satisfied in substance, not just letter — nothing under the folder imports or names `Router`/`navigate`, and the Task-7 guard keeps it from regressing. The locale design is right: `codes` avoids the `LocaleMeta.code` collision, the fallback covers both an unknown code and an empty string, and all ten locales are complete and idiomatic. Projection is implemented the robust way, with the `ng-content` slots outside the `@if` so the default is skipped rather than the slot destroyed. All four nits were fixed before commit: the query is now `descendants: false` to match projection scope, `Object.hasOwn` guards prototype-key collisions, the root binds `[attr.dir]` like the library's other i18n components, and the stories expose the outputs as Storybook actions while the demo switches one shipped-code example instead of stacking three `<h1>`s. |
