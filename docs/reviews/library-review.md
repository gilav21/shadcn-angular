# Code Review — library-wide sweep

**Date:** 2026-08-09 (fixes applied 2026-08-10) · **Scope:** all 127 component
folders under `packages/components/ui/` (612 source files, 67,016 LOC).

Same four criteria as the [`rich-text-editor` review](./rich-text-editor-review.md):
cleanliness · easy to use and modify · easy to read · not over-abstracted.

**What has been acted on** (everything else in this document remains a
recommendation, not a change):

| Done | Effect |
|---|---|
| Two live bugs fixed — RTE history bullet, popover top-layer downgrade | see [Findings 2 and 2b](#-finding-2--mojibake-one-file-one-live-bug) |
| Mojibake eliminated library-wide | 409 → **0** |
| RTE comment purge (banners deleted, rationale promoted to JSDoc) | library non-JSDoc comments 467 → **261** |

Not done, still open: the systemic JSDoc gap (Finding 1), the `data-table`
review (L3), type exports (L4), and every structural recommendation.

Every number here is reproducible:

```bash
node scripts/review-audit.mjs                       # summary + flagged folders
node scripts/review-audit.mjs --all --md            # every folder, markdown
node scripts/review-audit.mjs --component <name>    # one folder, with detail
node scripts/review-audit.mjs --json                # machine-readable
```

The script covers the mechanical half only. It deliberately does **not**
re-implement `readonly` (S2933), cognitive complexity (S3776), or unused
declarations — `npm run sonar` and `npm run lint` already own those.

---

## Headline

| Metric | Value | Read |
|---|---|---|
| Components | 127 | |
| Source files / LOC | 612 / 67,016 | excludes specs & stories |
| Spec + story LOC | 113,093 | **1.7× the source** |
| `any` occurrences | **0** | ✅ excellent |
| Cross-component deep imports | **0** | ✅ barrel discipline works |
| Mojibake characters | 409, in **1 file** → **0** | 🔴 contained a live bug · **fixed** |
| Non-JSDoc comments | 467 across 64 files → **261** | 48% were in one component · **RTE purged** |
| Unexported types | 72 | |
| Folders without a barrel | 1 (`directives/`, by design) | ✅ |
| Top-level files not in a barrel | 3 | |
| **input/output JSDoc coverage** | **16%** (1,358 missing of 1,621) | 🔴 systemic |
| **Public-method JSDoc coverage** | **13%** (1,064 missing of 1,220) | 🔴 systemic |

**Size distribution is healthier than expected.** Only 3 of 127 components exceed
2,000 LOC:

| Tier | Threshold | Count |
|---|---|---|
| A | > 2,000 LOC | **3** — rich-text-editor (18,667), data-table (7,889), kanban (2,423) |
| B | 500–2,000 | 18 |
| C | < 500 | **106** |

83% of the library is under 500 lines. The "god component" problem is real but
confined to three folders.

---

## 🔴 Finding 1 — The documentation gap is systemic, and it is the biggest issue in the library

**84% of `input()`/`output()` declarations and 87% of public methods have no
JSDoc.** In a library whose entire premise is *"the source lives in YOUR
project"*, the public API of a copied component is the only documentation a
consumer gets. There is no hosted API reference to fall back on.

This is not a few neglected corners — it is the default state:

| Component | LOC | input/output JSDoc | public-method JSDoc |
|---|---|---|---|
| tour | 848 | **100%** | 33% |
| rich-text-editor | 18,667 | 64% | 42% |
| card-accordion | 244 | 44% | 0% |
| page-builder | 616 | 42% | 4% |
| eyedropper | 272 | 33% | 0% |
| input | 221 | 32% | 0% |
| carousel | 458 | 25% | 0% |
| rating | 310 | 22% | 6% |
| **data-table** | **7,889** | **20%** | **28%** |
| select | 950 | 20% | 0% |
| **button** | 248 | **5%** | 0% |
| **emoji-picker, file-viewer, context-menu, menubar, sidebar, speed-dial, popover, tree, sortable, bento-grid, dropdown-menu, …** | — | **0%** | ~0% |

Spot-verified rather than trusted: `button/button.component.ts` really does have
**1 documented input out of 13** (`ariaLabel` at `:77`); `variant`, `size`,
`disabled`, `type`, `class`, `label`, `ripple`, `rippleColor`, `loading`,
`skeleton` and the `clicked` output all carry none.

**Two consequences worth stating plainly:**

1. `button` is the most-copied component in the library and has the worst
   documentation-to-usage ratio in it.
2. **The `rich-text-editor` review's "~90 members lack JSDoc" finding is
   misleading in isolation.** RTE is 4× the library average on inputs/outputs and
   3× on methods. It is one of the *best*-documented components here. The
   recommendation stands, but its priority relative to the rest of the library
   should be *lower*, not higher.

**Recommendation L1.** Treat input/output JSDoc as a merge requirement, starting
with the components consumers actually copy most (`button`, `input`, `select`,
`dialog`, `card`, `table`). A one-line `/** … */` per input is the whole ask.
Tier C components average ~12 inputs, so most folders are a 10-minute job.
Consider a lint rule (`jsdoc/require-jsdoc` scoped to `input(`/`output(`
initializers) so the gap can't silently regrow — but land the top-20 components
by hand first, since a rule that fails 1,358 times gets disabled.

> **Status: in progress.** Use `node scripts/jsdoc-gaps.mjs` (added alongside
> `review-audit.mjs`) to see the live worklist — it names every undocumented
> member with `file:line`, so the gap is now trackable rather than just countable.
>
> The bar applied: **a doc must add information the signature does not already
> give.** `/** The variant. */` on `variant` is worthless and was explicitly
> rejected. Real examples produced under this rule:
> - checkbox `indeterminate` — *"purely visual — it does not change `checked`, and toggling clears it only if the consumer does"*
> - alert-dialog `title` — *"when unset, neither the header nor the default buttons render, and `description`/`actionText`/`cancelText` have no effect"*
> - kanban `wipLimit` — *"turns the count badge destructive and the border red — it never blocks a drop or an add"*
>
> **Documenting is finding bugs.** Reading each member closely enough to describe
> it surfaced nine real defects that no test covers (see Finding 1b).

---

## 🔴 Finding 1b — Thirty-eight defects found *by writing the documentation*

> **Count correction.** Earlier revisions of this document, and the commit
> message and PR body for the documentation work, said "21 defects / 19
> unfixed". That was wrong — it was written mid-campaign and never revised as
> later passes reported more. The accurate figure is **38 unfixed defects**,
> enumerated in full below. Two further defects (the rich-text-editor history
> bullet and the popover top-layer downgrade) were fixed and are recorded in
> Findings 2 and 2b, for **40 found in total**.

None of these are doc gaps; they are behavioural bugs, and **not one is covered by
a test**. All were found by reading members closely enough to describe them —
which is the strongest practical argument for closing Finding 1: the documentation
gap was concealing a defect backlog. **None has been fixed**; they are outside the
scope of the work authorised so far.

The dominant pattern, appearing **nine times** across unrelated components, is an
**input that nothing reads** — usually a `disabled` flag whose class list keys off
a `data-disabled` attribute that is never set. It type-checks, it autocompletes,
it is in the public API, and it does nothing. A consumer has no way to discover
this short of testing the behaviour by hand.

**A `disabled` flag that does nothing (4 occurrences, same shape).** The class
list reacts to a `data-disabled` attribute that nothing ever sets:

| Component | Consequence |
|---|---|
| `SelectItemComponent.disabled` | Applies `pointer-events-none` but never sets `data-disabled`, which `SelectContentComponent.onKeydown` filters on — **a disabled item is still reachable by arrow keys**. |
| `DropdownMenuSubTriggerComponent.disabled` | Neither dims the row nor blocks opening the submenu. |
| `MenubarSubTriggerComponent.disabled` (`menubar-sub-trigger.component.ts:50`) | Never bound, never checked in `onClick`/`onMouseEnter`/`onKeydown`. Fully inert. |
| `ContextMenuSubTriggerComponent.disabled` (`context-menu-sub-trigger.component.ts:48`) | Its `data-[disabled]:` classes can never match. |

**Focus-ring scoping**
- `DropdownMenuContentComponent.getFocusableItems()` is unscoped, so items in an
  open submenu join the root menu's ring.
- `menubar-trigger.component.ts:116` queries plain `[role="menuitem"]`, unlike
  `MenubarContentComponent.getFocusableItems()` which filters
  `:not([data-disabled])` — so opening a menu whose first item is disabled focuses
  it, and arrow keys then skip it.
- `focusNextTrigger`/`focusPrevTrigger` query document-wide, so **two `<ui-menubar>`
  elements on one page share a single wrap-around arrow ring**.

**Form-control contract violations**
- `chip-list.setDisabledState` is a no-op — `control.disable()` does **not**
  disable the control.
- `date-picker`'s `date` input ignores `null`, so it cannot clear a selection;
  only `writeValue` or a form control can.

**Lifecycle**
- `MenubarService.unregister` is dead code — destroyed triggers leave stale map entries.
- `MenubarSubComponent.leave()` / `ContextMenuSubComponent.leave()` leave a pending
  100 ms `setTimeout` running if destroyed inside the grace period.
- `page-builder` has **no `ngOnDestroy`** — a simulated-data interval keeps ticking
  after the component is destroyed.

**More inert inputs (same shape as the `disabled` cluster — an input nothing reads)**

| Input | Reality |
|---|---|
| `ResizablePanel.minSize` / `maxSize` | **Never read.** `resizable-handle.component.ts` clamps to a hardcoded `>= 10 && <= 90` percent. *Verified in source, not just taken from a report.* |
| `SidebarComponent.variant` | Appears only at its own declaration — all three values render identically. *Verified: no other occurrence in the folder.* |
| `SidebarComponent.collapsible` | Never read. |
| `BentoGrid.columnWidth` | Does not affect layout — `gridTemplateColumns` is always `repeat(cols, minmax(0,1fr))`. It only feeds hit-testing and the background pattern, so a non-`1fr` value **desynchronises drop targeting from the rendered grid**. |
| `DockItemData.href` / `onClick` | Ignored by the data-driven template; simple-mode dock items are decorative. |

**State / correctness**
- **`color-picker` echoes on `writeValue` — confirmed in source.** The constructor
  effect on `currentColor` calls `onChange` and emits `colorChange`, and
  `writeValue` → `applyRgba` re-triggers it, so a written value bounces straight
  back out *and marks the form dirty*. This matches the long-standing note about
  guarding consumers against the echo; it is a real defect, not a quirk to live with.
- **`resizable` handle drags bypass panel state.** The handle writes `flex-basis`
  directly to the DOM, so `ResizablePanel.size` goes stale and `sizeChange` never
  fires for user drags (only the handle's own `resized` does). `updateSize()` is
  unclamped and doesn't adjust the sibling, so panels can sum to ≠ 100%.
- **`bento-grid` drop semantics differ by target** — dropping on a widget shrinks
  neighbours; dropping on empty canvas *silently discards* an overlapping move.

**Accessibility / touch**
- `resizable`'s handle is `tabindex="0" role="separator"` with **no keydown
  handler**, and `aria-valuenow` is hardcoded to `"50"` — focusable but not operable.
- `dock` magnification measures `clientX` only, so `position="left" | "right"`
  magnifies the entire column at once.
- `bento-grid`'s two context menus are right-click-only with no long-press, so they
  are **unreachable on touch** — a violation of CLAUDE.md §6.
- `pagination` emits duplicate `@for` track keys (both ellipses are `-1`),
  producing `NG0955` at runtime. Visible in the test output today as a warning.

**Further inert members (completing the nine-plus pattern)**

| Member | Reality |
|---|---|
| `DataTableComponent.localReorder` (`data-table.component.ts:495`) | **Defaults to `true`, and its Storybook description claims it reorders the local array.** It appears only at its own declaration across all of `ui/` — rows never move unless the consumer handles `rowReorder` and writes `data` back. |
| `PopoverContentComponent.restoreFocus` (`popover-content.component.ts:61`) | Nothing in the component moves focus — no `.focus(` call in the file. |
| `BlurFadeComponent.replay` (`blur-fade.component.ts:50`) | An `output()` that is never emitted; only `playAnimation()` restarts the animation. |

**Rendering / data correctness**

- `rating.size` does not scale the glyph — `starClasses()` sizes the `<button>`
  (`h-4/h-5/h-6`) but every star SVG hardcodes `h-5 w-5`
  (`rating.component.html:45,55,88`). `size="lg"` renders a 20px star in a 24px
  box; `size="sm"` clips it.
- `calendar.selectDay` **mutates its argument** — `setHours()` is called on a
  `Date` that, in template use, is an element of the `calendarDays()` computed
  array, so a computed's cached value is mutated in place.
- `calendar.updateEndTime` is a no-op in `single` mode — the end field updates
  `selectedTimeRange` but never the selected `Date`.
- `org-chart` **silently drops subtrees** — the `tree()` builder assigns `root` in
  a loop without breaking, so with several parentless nodes the last wins.
- `file-upload` overflow past `maxFiles` is **silent** — `accept`/`maxSize`
  rejections emit `fileError`, but `maxFiles` breaks out of the loop with no
  event, so the host cannot say why files vanished.
- `stagger-children.playAnimation()` and `flip-text.playAnimation()` bypass the
  `prefers-reduced-motion` check that their automatic paths honour.

**`data-table` state handling (7)**

- `collapseSubRow` / `collapseAllSubRows` **delete rather than pin**, so with a
  non-zero `subRowDefaultExpanded` the node immediately re-renders expanded.
- `getColumnState` / `applyColumnState` are **asymmetric on pin** — the getter
  reports the *declared* pin, not the runtime `columnPinOverrides`, and the setter
  ignores `pin` entirely, so a save/restore round-trip silently loses pins.
- `showAllColumns` **replaces** `columnVisibility` rather than merging, dropping
  entries for keys no longer in `columns`.
- `isFilterValueEmpty` treats `[]` as non-empty, so a multiselect filter must
  clear to `null` or it filters everything out.
- `onAdvancedFilterChange` **does not reset the page index** (the global and
  column filter paths do), so narrowing can strand the view past the end.
- `getCellStringValue` exports raw values for template/component-rendered columns
  — only a `cell` formatter is honoured, so **copy/export can differ from what is
  on screen**.
- `DataTableMultiselectFilterComponent.selected` resolves by scanning `options`,
  silently dropping values with no matching option — a selection set before the
  options arrive is lost.

## 🔴 Finding 2 — Mojibake: one file, one live bug

409 double-encoded UTF-8 characters, **all in
`rich-text-editor/rich-text-editor.component.ts`**. Nothing else in `ui/` or
`lib/` matches the signature `ג€|ג”|Ã¢|â€|Â»|Ã©`.

One of them is a **shipped defect**: `:4091` renders every history-panel list item
as `ג€¢` instead of `•`. Details, the safe fix, and the trap that makes a
whole-file transcode wrong are in the
[RTE review](./rich-text-editor-review.md#-ship-now-defect).

**Note for anyone running a bulk fix:** a naive `ג` search returns **39 files** —
the other 38 are legitimate Hebrew in `*.locales.ts`. Use the precise signature.

**Recommendation L2.** Fix the one file. Then add the precise-signature grep to
the pre-push hook — it's near-zero cost and this class of bug is invisible in
review (the characters look like noise in a comment until one lands in a string
literal, as it did here).

---

## 🔴 Finding 2b — Silent `catch` fallbacks hide consumer-facing degradation

Surfaced while acting on Finding 2, and worth generalising.

`popover/sub/popover-content.component.ts` promoted a `strategy="fixed"` popover
to the native top layer via `showPopover()`, inside a `try/catch` that fell back
to a `document.body` portal. Two facts combined into a real defect:

- `showPopover()` throws `InvalidStateError` when the element is **not yet
  connected** — verified by direct browser probe, not inferred.
- The retry loop only re-ran while placement reported failure, but the `catch`
  called `portalToBody()`, which **succeeds and reports success**.

So whenever opening raced Angular's attachment, the popover permanently lost its
above-any-modal guarantee — and the `catch` swallowed any trace of it. A
consumer's popover inside a dialog could render *below* the modal, intermittently,
with no error. It presented as a ~20% flaky test; the test was right and the
component was wrong.

**Fixed** by distinguishing *not yet attached* (retry next frame) from *engine
lacks the API* (genuine fallback), plus an explicit last-resort portal so the
retry budget still ends somewhere sensible.

**The generalisable lesson:** a `catch` that silently substitutes a
lower-capability path converts a loud failure into a rare, un-diagnosable one.
There are 60+ `try/catch` blocks across `ui/`; the ones worth auditing are those
whose `catch` **changes behaviour** rather than merely ignoring a non-critical
operation. Not yet swept — a candidate for the next pass.

## 🔴 Finding 2c — The browser suite has at least three independent flakes

`vitest.config.ts:83-87` records retries as deliberately retired after "six
consecutive full runs at `--retry=0`". Measured over ~40 full runs during this
work, that conclusion was optimistic — six clean runs cannot clear a ~12% flake.

| Spec | Rate observed | Cause | Status |
|---|---|---|---|
| `popover.component.spec.ts` | 1 in 5 | Component defect, not a test bug — see Finding 2b | ✅ fixed, 20+ clean runs since |
| `number-ticker.component.spec.ts` | 1 in 8 | Recorded animations by patching `Element.prototype.animate`. Any other spec file patching or restoring that prototype mid-test silently removed the recorder, so the suite waited on an animation that *was* created but never recorded (`expected [] to have a length of 1`). | ✅ fixed — records via an own-property spy on the container element, which no other file can clobber. 10/10 clean since. |
| `data-table.coverage.spec.ts` | 1 in ~22 | **Unknown.** Failed wholesale (many tests at once), suggesting a file- or context-level failure rather than individual assertions. | ⬜ **not fixed** — did not reproduce in 12 subsequent runs and no error text was captured. Within-file hygiene checks out: fake timers are wrapped in `try/finally` with `useRealTimers()`, and `afterEach` calls `restoreAllMocks()`. |

**On the third one: no fix was attempted, deliberately.** Without a reproduction
or an error message, any change would be a guess dressed as a fix. What it needs
is capture, not speculation — when it next fails, keep the *full* reporter output
rather than a filtered summary. (Two of the runs in this campaign lost the failure
identity to an over-narrow grep, which cost several extra full-suite runs.)

**The generalisable lesson**, and it now has two independent confirmations in this
repo: **patching a shared prototype or global in a spec is cross-file shared
state.** It works in isolation and fails under a full parallel run, in a way that
looks like flakiness in an unrelated component. Stub the instance, not the
prototype.

## ✅ Finding 3 — Three things the library gets right

Worth recording, both as credit and so nobody "fixes" them.

1. **Zero `any` across 612 source files.** For a library this size — including a
   PDF parser, a DOCX renderer and a rich-text engine, all of which invite
   `any` — this is genuinely hard to achieve.
2. **Zero cross-component deep imports.** The CLAUDE.md rule ("cross-component
   imports go through the barrel") is holding at 100%. 126 of 127 folders have a
   barrel; the exception is `directives/`, which is correct per the convention
   that directives stay flat and unfolderized.
3. **The size distribution is good.** 106 of 127 components are under 500 lines.
   The house pattern is producing small, readable components by default.

The one barrel-rule leak is a **spec** file, so the audit (which skips specs)
doesn't flag it: `packages/components/ui/rich-text-security.spec.ts` deep-imports
`./rich-text-editor/rich-text-sanitizer.service`.

---

## Finding 4 — Which RTE findings generalize (and which don't)

The point of the sweep was to establish this. Results:

| RTE finding | Generalizes? | Evidence |
|---|---|---|
| Missing JSDoc | **Yes — far worse elsewhere** | 16% library-wide vs RTE's 64% |
| Mojibake | **No** | 1 file library-wide |
| Non-JSDoc comments | **Mostly no** | RTE holds 226 of 467 (48%). Outside RTE, only `icon` (81), `data-table` (15), `kanban` (15), `emoji-picker` (9), `page-builder` (9), `sortable` (9) exceed 8. 63 of 127 components have **zero** |
| Unexported types | **Yes, mildly** | 72 library-wide; RTE 14, data-table 10, tour 6, eyedropper 5. Long tail of 1–2 per folder |
| `any` | **No — clean everywhere** | 0 |
| Deep imports | **No — clean everywhere** | 0 |
| God component | **Yes — and RTE isn't the worst single file** | see below |
| Duplicated `coerceEnabled` helper | **Confined to RTE** | the 10 copies are all RTE addons; `data-table`'s 3 addons don't repeat it |
| Context-token-per-button | **Confined to RTE** | `data-table` does not use this pattern |

### The single largest file in the library is not in rich-text-editor

| File | Lines |
|---|---|
| **`data-table/data-table.component.ts`** | **4,965** |
| `rich-text-editor/rich-text-editor.component.ts` | 4,198 |
| `file-viewer/file-viewer.component.ts` | 1,589 |
| `icon/icon.component.ts` | 1,285 |
| `bento-grid/bento-grid.component.ts` | 992 |
| `emoji-picker/emoji-data.ts` | 907 (data table — fine) |
| `sortable/sortable.component.ts` | 907 |
| `tour/tour.component.ts` | 846 |

`data-table.component.ts` is **767 lines longer** than the RTE component, with
20% input/output JSDoc coverage against RTE's 64%. By the review's own criteria
it is in worse shape than the component that prompted this review — it just
hasn't been looked at yet.

### Longest functions (cognitive-complexity candidates)

Only 8 functions library-wide exceed 45 lines, and they are spread across 8
different components — so this is not a systemic problem, just a short list:

| Lines | Location |
|---|---|
| 61 | `rich-text-editor.component.ts` `applySelectionColor()` |
| 50 | `bento-grid.component.ts` `splitItem()` |
| 49 | `file-viewer.component.ts` `renderDocxTable()` |
| 49 | `marquee.component.ts` `setupAnimation()` |
| 48 | `data-table.component.ts` `onSortChange()` |
| 48 | `kanban/sub/kanban-column.component.ts` `onDragOver()` |
| 47 | `org-chart.component.ts` `calculatePositions()` |
| 47 | `select/sub/select-content.component.ts` `calculatePosition()` |

Cross-check these against `npm run sonar` S3776 rather than acting on line count
alone — length and cognitive complexity aren't the same thing.

### Barrel reachability

Three top-level source files aren't reachable from their folder's barrel:

- `color-picker/color-picker.utils.ts`
- `emoji-picker/emoji-data.ts`
- `sortable/sortable.types.ts`

`sortable.types.ts` is the notable one — a `.types.ts` that consumers can't
import defeats its purpose. The other two are plausibly internal by design;
confirm before changing.

---

## Finding 5 — Test-to-source ratio

113,093 lines of spec/story against 67,016 of source — **1.7:1**. That's healthy
in aggregate, but the distribution has the same god-file problem as the source:

- `rich-text-editor.component.spec.ts` — 6,291 lines
- `rich-text-paste-normalizer.service.spec.ts` — 2,328 lines

Splitting these along the same seams as the source is zero-risk, but it only
helps whoever maintains the tests — no consumer-visible benefit. Low priority.

---

## Recommendations

Ordered by value ÷ effort. None of these were applied.

| # | Recommendation | Scope | Effort | Risk |
|---|---|---|---|---|
| **L1** | **JSDoc every `input()`/`output()`**, starting with the 20 most-copied components (`button`, `input`, `select`, `dialog`, `card`, `table`, `tabs`, `checkbox`, …). Add a scoped lint rule *after* the top 20 are done. | 127 folders | High but trivially parallel | Zero |
| **L2** | Fix the mojibake file and add the precise-signature grep to the pre-push hook. | 1 file + 1 hook | Minutes | Zero |
| **L3** | **Review `data-table` next.** It is the largest single file in the library, at 20% JSDoc coverage, and shares RTE's host+addon architecture — so RTE's recommendations likely transfer with little re-derivation. | 1 folder | Medium | Zero (review) |
| **L4** | Export the 72 private types **in place**. Don't consolidate into `.types.ts` — see the RTE review's reasoning; most types read better beside their only consumer. | 72 sites | Low | Zero |
| **L5** | Act on the RTE review, Tiers 0–2. | 1 folder | Medium | Low |
| **L6** | Fix the `rich-text-security.spec.ts` deep import and decide on the 3 barrel-unreachable files (`sortable.types.ts` especially). | 4 files | Minutes | Zero |
| **L7** | Comment purge — but **only** `icon` (81), `data-table` (15), `kanban` (15), `emoji-picker` (9), `page-builder` (9), `sortable` (9) outside RTE. 63 components already have zero. Use the RTE review's three-bucket rule: promote load-bearing rationale to JSDoc, don't delete it. | 6 folders | Low | Low |
| **L8** | Cross-check the 8 long functions against `npm run sonar` S3776 and split only those the scanner actually flags. | 8 sites | Low | Low |

**Deliberately not recommended:**

- A library-wide `.types.ts` migration — the churn exceeds the benefit, and it
  multiplies `registry.json` `files[]` entries across every component.
- Extracting `data-table` / RTE features into services — the same
  port-interface-with-one-implementation objection from the RTE review applies.
- Any restructuring of the 106 Tier-C components. They are small, clean, and the
  metrics flag nothing beyond missing JSDoc.

---

## Method and limits

**What the audit measures directly:** mojibake (precise signature), non-JSDoc
comments (via the TypeScript parser's comment ranges), `any`, LOC, largest file,
longest function, declared-vs-exported types, barrel reachability, deep imports,
and JSDoc presence on `input()`/`output()`/public methods.

**Known limits, stated so the numbers aren't over-read:**

- Comment counting is parser-based, which matters: a plain `//` grep over-counts
  (it matches `https://` and string contents) and a raw `ts.createScanner`
  under-counts (it can't tell regex-start from divide in regex-heavy files).
  Both were tried and produced wrong answers before the parser approach; the
  RTE review's figures were corrected accordingly.
- "Longest function" is a line count, **not** cognitive complexity. Use it to
  build a shortlist, then confirm against Sonar.
- JSDoc presence ≠ JSDoc quality. A `/** The variant. */` on `variant` counts as
  documented. The 16% figure is therefore an *optimistic* ceiling.
- Spec and story files are excluded from all source metrics, which is why the
  one real barrel-rule violation (in a spec) doesn't appear in the deep-import
  count.
- Criteria 2–4 (ease of use, readability, over-abstraction) cannot be measured
  mechanically. They were assessed in depth for `rich-text-editor` only. The
  three Tier-A folders each warrant that treatment; `data-table` is next (L3).

## Gates

The fixes listed at the top cleared these: `tsc` clean, lint clean, 8,022/8,022
tests passing, and **zero SonarQube issues on every changed file** (server scan
against `localhost:9000`, not the eslint subset).

Acting on any remaining recommendation makes the CLAUDE.md §4 gates mandatory
again:

```bash
npm run lint
npm run coverage      # MUST precede sonar, or it reports 0% and skews findings
npm run sonar         # Dockerized scanner → localhost:9000, fix ALL new issues
npm run test-visual   # full suite; zero failures tolerated
npm run e2e:impact -- --base origin/master   # then run the subset it reports
node scripts/sync-registry.ts --fix          # after any file add/delete
```
