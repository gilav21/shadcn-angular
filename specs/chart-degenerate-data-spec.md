# Chart Degenerate Data — Spec

> # 🛑 STOP — READ BEFORE ANY WORK
>
> **This spec depends on:** `specs/chart-scale-robustness-spec.md`
>
> **Before writing any code, verify each prerequisite is complete** by checking
> its Completion Log — every task row must show a review score ≥ 91.
>
> **If any prerequisite is incomplete: STOP IMMEDIATELY. Do not start. Do not
> work around it. Do not implement the prerequisite yourself.** Alert the user
> that this spec is blocked, name the missing prerequisite, and end your turn.
>
> Why: every fix below builds on the prerequisite's fixed `niceDomain` (always
> finite, contains every value, ticks start/end on its bounds) and its shared
> `extent()` in `lib/chart.utils.ts`. Without them the bar-family migration
> would inherit the dropped-max and orphan-tick bugs.

**Status:** not started
**Scope owner:** charts
**Source:** codebase review 2026-10 (chart findings), re-verified 2026-10-03
**Living history:** never delete entries. Mark items done, add new findings
below, link regressions to their origin.

**Split note:** the review's lower-priority colour/util items (`readableForeground`
alpha, hue units, `sequentialColorScale`, `medianCutPalette`, the `chart-brush`
window listener) would have pushed this spec past ten tasks. They live in
`specs/color-utils-correctness-spec.md` (no prerequisites).

---

## 0. Step 0 — findings re-verified against the source

✓ = confirmed as stated. ⚠️ = believed vs. true differs, or new. Line numbers
are as of `master` @ `6fae7f7f`; the prerequisite spec will shift some of them
(it replaces the `Math.min/max` spreads with `extent()`).

| # | Claim (as reported) | Verdict | Evidence |
|---|---|---|---|
| D-1 | Legacy bar family doesn't use `niceDomain`/`linearScale`; `{min: 0, max: max*1.1}` | ✓ | `bar-chart.component.ts:159-167`, `bar-chart-drilldown.component.ts:202-210`, `stacked-bar-chart.component.ts:184-206` (`maxValue` = total × 1.1, ticks `calculateAxisTicks(0, max)`). ⚠️ `column-range-chart.component.ts:156-172` is not 0-based: it pads ±10% of the span. |
| D-2 | All-negative `[-50, -10]` → ~1113px bar overflowing | ✓ | Default `height` 300, plot height 245; `(-50 - 0) / (-11 - 0) × 245` = **1113.6px**. SVG is `overflow-visible` (`bar-chart.component.html:12`). |
| D-3 | Mixed negatives → negative bars height 0 (vanish) | ✓ | Negative normalised length clamped by `Math.max(0, …)` at `bar-chart.component.ts:190-191`, `bar-chart-drilldown.component.ts:240`. |
| D-4 | All-zero → NaN in rect y/height, empty axis | ✓ (⚠️ stacked differs) | bar-chart / drilldown: `0/0` → `NaN` y and height (`Math.max(0, NaN)` is `NaN`); ticks `calculateAxisTicks(0, 0)` → `[]`. **Stacked-bar** guards `maxVal > 0` (`:237`) so no NaN, but its axis is still empty. |
| D-5 | Ticks overshoot (max 100 → ticks to 120 drawn above the plot) | ✓ | `calculateAxisTicks(0, 110)` → `[0, 20, …, 120]`; tick 120 maps above the plot top. |
| D-6 | column-range `[9, 21]` → ticks 8 and 22 outside the plot | ⚠️ **Corrected.** | Padded domain `[7.8, 22.2]`; ticks `[6, 8, …, 22, 24]`. **6 and 24** lie outside; 8 and 22 are inside. The existing spec pins this: `column-range-chart.component.spec.ts:201` expects `[-10, -5, 0, 5, 10, 15, 20, 25]` — a test asserting the bug. |
| D-7 | — | ⚠️ **NEW (stacked-bar negatives).** | A negative segment gets `height 0` but still moves the `currentY` cursor (`stacked-bar-chart.component.ts:229-253`), so every later segment is displaced and overlaps. Percent mode divides by the signed total, which is `≈ 0` for mixed signs. |
| D-8 | — | ⚠️ **NEW (column-range `low > high`).** | Height `lowY - highY` is negative → clamped to 1px at the wrong `y` (`column-range-chart.component.ts:201,210`). |
| D-9 | Area: `niceDomain(0, yDomainMax)` ignores min → negatives below the axis; line does `Math.min(0, …)` | ✓ | `area-chart.component.ts:221`; line `line-chart.component.ts:180-182`. |
| D-10 | — | ⚠️ **NEW: combo-chart has the same bug, worse.** | `combo-chart.component.ts:213` `niceDomain(0, primaryMax)`; secondary axis `:218` `linearScale([0, secondaryMax])` is not even niced — negative line values fall below the plot. |
| D-11 | Pie + pie-drilldown accept negatives: `[100, -30]` → 142.9% slice, negative sweep, overlapping wedges; `describeArc` always uses sweep-flag 1 | ✓ | `pie-chart.component.ts:118-121`, `pie-chart-drilldown.component.ts:157-160`; `chart.utils.ts:75,82`. 100/70 = 142.9%. |
| D-12 | "Also check single 100% slice (start == end arc degeneration)" | ⚠️ **Already handled.** | `describeArc`'s `isFullCircle` branch (`chart.utils.ts:53-62`) splits a full sweep into two half arcs. No fix needed — keep it covered by T-1's single-point class. |
| D-13 | "… and all-zero total" | ⚠️ **Already handled** (+ a new sibling class). | `total === 0` → `slices = []` (`pie-chart.component.ts:112`). But a mixed-sign dataset that *sums* to 0 (`[50, -50]`) also empties the chart. And a zero-value entry renders a zero-area wedge that is still a focusable `role="button"` (`pie-chart.component.html:15-24`). |
| D-14 | Funnel all-zero → NaN polygon points (`funnel-chart.component.ts:~150`) | ✓ | `maxValue` 0 (`:137-140`) → `0/0` widths (`:157-159`). Negatives give inverted (crossed) trapezoids. |
| D-15 | Bar-race all-zero frame → NaN widths (`:215`) | ✓ | `Math.max(0) × 1.1 = 0` → `0/0` (`bar-race-chart.component.ts:212-216, 241-242`). Negative-only frame: `max` negative → negative bars get *positive* widths. |
| D-16 | Duplicate `@for` track keys: boxplot outliers, heatmap legend when all equal, waterfall/funnel/bar-race/combo by name; `bandScale` maps duplicate names to one x index | ✓ (+ more) | `boxplot.component.html:126` (`track point.value`); `heatmap.component.html:52` + `heatmap.component.ts:203-210` (equal domain → five equal `stop.value`); `waterfall-chart.component.html:40` + `waterfall-chart.component.ts:178,194`; `funnel-chart.component.html:8`; `bar-race-chart.component.html:49`; `combo-chart.component.html:43,52` + `combo-chart.component.ts:208,230,242,247`. `bandScale` (`chart-scale.ts:85`) builds a `Map` from keys — duplicates collapse to the last index. **⚠️ Also found:** `line-chart.component.html:43` (`track c.name`) and `:78` (`track p.name`); `area-chart.component.html:43`; `radar-chart.component.html:18,46` (`track spoke.axis` / `v.axis`); `heatmap.component.html:20` key `row + '-' + col` collides (`"a-b"+"c"` vs `"a"+"b-c"`) and duplicates; `chart-tooltip.component.html:12` (`track row.label`); `stacked-bar-chart.component.html:101` (`track s.id ?? s.name`). Already index-keyed (✓ no change): boxplot boxes (`boxplot.component.ts:243`), candlestick (`candlestick.component.ts:320`), scatter/bubble points, pie slices. |
| D-17 | Radar: negative values drawn on the opposite side of centre | ✓ (+ more) | `radarPoint` ratio `value / max` (`lib/chart-polar.ts:24`) is negative → `polarToCartesian` with a negative radius. Also an explicit `maxValue` below the data draws vertices beyond the outer ring. |
| D-18 | Bar-race constructor `setTimeout` autoplay not cancelled on destroy; `colorMap` mutated inside a `computed()` and never reset | ✓ | `bar-race-chart.component.ts:268-274`: if the component is destroyed before the macrotask runs, `play()` still starts, and `ngOnDestroy` (`:276`) has already run — with `loop` on, the timer chain never stops. `:72` (`ngAfterViewInit`) has the same unguarded pattern (harmless signal write). `colorMap` (`:170`) is written inside `displayBars` (`:233-239`) and keeps names from previous `frames` forever. |
| D-19 | Missing `data-slot` on bar-chart, bar-chart-drilldown, bar-race-chart, column-range-chart, pie-chart, pie-chart-drilldown, stacked-bar-chart; hover tooltips lack `max-w-[calc(100vw-2rem)]` | ✓ (+ org-chart) | `grep -c data-slot` = 0 in all seven templates; **⚠️ `org-chart.component.html` has none either.** Inline tooltips without the cap: `bar-chart.component.html:162`, `bar-chart-drilldown.component.html:120`, `column-range-chart.component.html:107`, `pie-chart.component.html:79`, `pie-chart-drilldown.component.html:98`, `stacked-bar-chart.component.html:115`. (bar-race has no tooltip; the shared `ui-chart-tooltip` already has the cap.) |
| D-21 | — | ⚠️ **NEW (found by Task 1): Angular reports a duplicate `@for` key only when it *reconciles*, not on first creation.** | `reconcile()` in `@angular/core` records duplicate keys only while walking existing live items, so a chart rendered once with duplicate labels logs no NG0955 (a plain `@for` with `track n` over `['a','a','b']` warns only on the second change-detection pass). T-2 therefore re-sets the inputs with fresh arrays and detects again before reading the console spy; a single render would pass vacuously on every chart. |
| D-22 | — | ⚠️ **NEW (found by Task 1): `describeArc` recurses forever on a sweep past a full turn.** | `chart.utils.ts:53-62`: `isFullCircle` splits at `start + π` and recurses into `(half, end)`, which is again "full" when `end − half ≥ 2π − 0.001` — a 143% pie wedge (`[100, -30]`) or any total smaller than the sum of the positives hits `Maximum call stack size exceeded` (T-1 `donut` / `pie-drilldown` / `pie` classes `tiny`, `mixed-sign`). The pie fix removes the over-100% input, but the arc builder must terminate for every finite angle pair, so Task 5 also splits at `start + π` and `start + 2π`. |
| D-20 | — | ✓ precedent | `treemap.utils.ts:22,83` already treats non-finite and non-positive values as 0 — the decision below for pie/funnel follows it. |

**Existing tests that assert the bug** (fix them with the code, and say so in
the commit message): `column-range-chart.component.spec.ts:176-206` (padded
range and out-of-plot ticks), `stacked-bar-chart.component.spec.ts:125-131`
(`max * 1.1`, ticks `[0…50]`), `bar-chart-drilldown.component.spec.ts:403`
(comment + geometry derived from `50 × 1.1`), `bar-chart.component.spec.ts:265-332`
(positions derived from `dataRange().max`). `bar-race-chart.component.spec.ts:113-116`
pins the 1/1.1 width — **that one stays** (bar-race keeps its 10% label
headroom, see §3.4).

---

## 1. Product Manager section

### 1.1 Business logic

> **Invariant:** Every chart renders any finite dataset — negative, mixed-sign,
> all-zero, duplicate labels/values — with every mark inside the plot area and
> no NaN in any SVG attribute.

Concretely: the four legacy bar-family charts move onto the same
`extent → niceDomain → linearScale` pipeline the newer charts use, with an
explicit zero baseline; area and combo include negative values in their
domain; pie, funnel, bar-race and radar define what a non-positive value means;
every `@for` tracks by an identity that is unique by construction; bar-race's
timers die with the component; and the seven legacy charts get the `data-slot`
hook and viewport-capped tooltips every newer chart already has.

Per-chart semantics (the decisions this spec makes, see §3.4):

| Chart | Negative / mixed values | All-zero | Duplicate labels |
|---|---|---|---|
| bar, bar-drilldown (vertical + horizontal) | Bars grow from a **zero baseline**: positive up/right, negative down/left (mirrored in RTL) | Zero-length bars on the baseline, axis `[-1, 1]` niced | Each point its own band (position = identity) |
| stacked-bar | **Diverging stacks**: positive segments stack up from 0, negative segments stack down from 0. Percent mode: share = `|v| / Σ|v|`, sign kept | Zero-height segments, usable axis | Each category its own band |
| column-range | `low > high` is normalised (`min(low, high)` … `max(low, high)`); domain = `niceDomain` of all lows/highs (no ad-hoc ±10%) | Zero-span ranges drawn as a 1px line at their value | Each point its own band |
| line, area, combo | Domain includes 0 and the minimum; area fills to the zero line; stacked percent uses `|v| / Σ|v|` | Domain `[-1, 1]`, flat line on 0 | Category position = index |
| pie, pie-drilldown | A non-positive or non-finite value contributes **no wedge** and no share; legend still lists the entry with its raw value; a dataset with no positive value shows the empty state | Empty state | Index-keyed (already) |
| funnel | Width ∝ `max(0, v) / max(positive)`; all-zero → zero-width stages, no NaN | Zero-width stages | Stage position = index |
| bar-race | Zero baseline inside the plot; negative bars extend toward the start edge (RTL mirrored); 10% label headroom on the positive side kept | Zero-width bars | Within one frame, the **last** entry for a name wins (name = entity identity across frames) |
| radar | Centre = `min(0, dataMin)`, outer ring = explicit `maxValue` ?? `dataMax`; values clamp into `[centre, ring]`; a vertex always lies on its own axis ray | All vertices at the centre | Axis position = index |
| waterfall, boxplot, heatmap, calendar-heatmap, histogram, scatter, bubble, candlestick, gauge, bullet | Already correct domains (verified D-16/T-1); only track-key fixes where listed | — | Position = index; heatmap duplicate `(row, col)` → later cell paints on top |

Series identity for legend toggling stays `id ?? name` (documented: two series
with the same name and no `id` toggle together); DOM tracking never relies on
it.

### 1.2 Why the customer wants this

A developer charts profit/loss, temperature anomalies, or deltas — negative
numbers are ordinary business data. Today:

- A **bar chart of losses draws one bar 1,100px tall** across the page, and a
  P&L chart with mixed signs **silently drops every loss bar**. The workaround
  is to shift data by a constant and relabel the axis by hand.
- A **dashboard before data arrives (all zeros) renders `NaN`** into SVG
  attributes, floods the console with attribute errors and shows an empty axis.
- A **pie with a refund line** draws a 143% wedge over the others.
- **Two categories that share a name** ("Other", a repeated month across years)
  are drawn on top of each other and Angular logs NG0955 duplicate-key
  warnings; DOM nodes are reused for the wrong items.
- A **radar with a negative score** plots it on the opposite axis — the reader
  sees the wrong metric.
- **Bar-race keeps animating after its page is gone** when destroyed early,
  burning CPU and emitting `frameChange` into a dead view.
- The legacy charts can't be targeted by `data-slot` like every other component,
  and their tooltips overflow a 320px phone.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| UC-1 | A developer passes all-negative data to `ui-bar-chart` / `ui-bar-chart-drilldown` (vertical or horizontal, LTR or RTL) and every bar grows from a zero baseline at the plot edge, inside the plot area. |
| UC-2 | With mixed-sign bar data, positive bars rise and negative bars fall from a visible zero gridline; no bar disappears; bar length is proportional to `|value|`. |
| UC-3 | With all-zero bar data, bars have zero length on the baseline, the value axis shows at least two ticks, and no attribute contains `NaN`. |
| UC-4 | Every value-axis tick and gridline of bar, bar-drilldown, stacked-bar and column-range lies inside the plot area (no tick above the top data value's nice bound). |
| UC-5 | A stacked bar with negative segments stacks positives upward and negatives downward from zero without overlap; in percent mode the absolute segments of each category span exactly 100% of the scale. |
| UC-6 | A column-range point with `low > high`, or `low === high`, is drawn inside the plot at the correct values. |
| UC-7 | Negative values in `ui-area-chart` (overlaid and stacked) and `ui-combo-chart` (bars and lines) are drawn inside the plot, and the axis includes them. |
| UC-8 | In `ui-pie-chart` / `ui-pie-chart-drilldown`, a non-positive value gets no wedge and no share, the remaining shares sum to 100%, the legend still lists the entry, a dataset with no positive value shows the empty state, and no zero-area wedge is focusable. |
| UC-9 | `ui-funnel-chart` and `ui-bar-race-chart` render all-zero and negative data with finite geometry inside the plot (funnel: zero width; bar-race: bars from a zero baseline). |
| UC-10 | In `ui-radar-chart`, every vertex lies on its own axis ray between the centre and the outer ring, for negative values and for values above an explicit `maxValue`. |
| UC-11 | Data with duplicate category labels or duplicate values renders one mark per data point at its own position, and the console shows no NG0955 duplicate-key warning, in every chart. |
| UC-12 | Destroying `ui-bar-race-chart` (even before its first autoplay tick) stops every timer; no `frameChange` is emitted afterwards. Replacing `frames` resets the name→colour assignment to palette order. |
| UC-13 | Every chart's root element carries `data-slot="<component-name>"`, and every legacy hover tooltip stays inside a 320px-wide viewport (`max-w-[calc(100vw-2rem)]`). |

### 1.4 Explicitly out of scope

- The shared tick/domain math, `extent()`, gaps for non-finite values — the
  prerequisite spec. This spec assumes **finite** values (non-finite handling is
  already the prerequisite's contract).
- Migrating the legacy inline tooltips to `ui-chart-tooltip` (would add a
  registry dependency to six charts; tracked refactor debt). Only the width cap
  is added.
- A shared cartesian base component for the legacy charts (charts-expansion
  refactor debt).
- Pareto cumulative-% semantics with negative bars in combo (a Pareto chart is
  defined on non-negative counts; documented in JSDoc, not handled).
- Localising `calendar-heatmap`'s hardcoded `Mon/Wed/Fri` labels and raw
  `{{ g.value }}` tick labels — i18n.
- Colour/util items — `specs/color-utils-correctness-spec.md`.

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.

### 2.0 Data classes sampled by every property test

| Class | Example (one representative; the generator varies values with a seeded PRNG) |
|---|---|
| positive fractional | `[1.97, 2.2, 2.4, 2.69]` |
| all-negative | `[-50, -10, -0.5]` |
| mixed-sign | `[-30, 45.5, -0.01, 12]` |
| all-zero | `[0, 0, 0]` |
| single point | `[42]` and `[-42]` |
| all-equal (non-zero) | `[7, 7, 7]` |
| duplicate labels | names `['Q1', 'Q1', 'Other', 'Other']` |
| duplicate values | `[5, 5, 9, 5]` (and boxplot samples with repeated outliers) |
| huge magnitude | `[1.2e12, 3.4e12, -5e11]` |
| tiny magnitude | `[1e-6, 3e-6, -2e-6]` |

### 2.1 Traceability

| Test ID | Test name | Proves | Type | File |
|---|---|---|---|---|
| T-1 | `every chart renders every finite data class with marks inside the plot and no NaN` — `it.each` over charts × classes (§2.0). For each render: (a) no attribute of any SVG descendant contains `NaN` or `Infinity`; (b) every mark's `getBBox()` lies inside the plot rect (cartesian: the box spanned by the outermost value-axis gridlines and the band range; polar/radial: the circle of radius R; others: the viewBox) with 0.5px tolerance; (c) every tick/gridline lies inside the plot rect. Charts: bar (vertical, horizontal, RTL), bar-drilldown, stacked-bar (absolute, percent), column-range, bar-race, line, area (overlaid, stacked, percent), combo, scatter, bubble, waterfall, boxplot, candlestick, histogram, heatmap, calendar-heatmap, funnel, pie, pie-drilldown, radar, gauge, bullet, treemap. A per-chart table maps each class to that chart's input shape and names its mark selector. | UC-1…UC-4, UC-6, UC-7, UC-9, UC-10 | browser (property) | `packages/components/lib/chart-invariants.browser.spec.ts` (new) |
| T-2 | `duplicate labels and values give one mark per point at its own position, without NG0955` — `it.each` over every chart taking labelled categories; spy on `console.warn`/`console.error` for `NG0955`; mark count === data length; band centres strictly monotonic along the category axis (LTR) | UC-11 | browser (property) | same file as T-1 |
| T-3 | `every chart root carries its data-slot` (`it.each` over all chart components, including org-chart) + `legacy tooltips stay inside a 320px viewport` (6 legacy charts; hover a mark with a 200-character label at viewport 320px; tooltip `getBoundingClientRect().width ≤ innerWidth − 32`) | UC-13 | browser (rendered geometry) | same file as T-1 |
| T-4 | `bars grow from the zero baseline` — bar-chart and bar-chart-drilldown, classes all-negative / mixed-sign / all-zero / all-positive, orientations vertical / horizontal, LTR / RTL: each bar's baseline edge equals the zero gridline's coordinate (±0.5px); length ∝ `|value|`; all-zero shows ≥ 2 tick labels | UC-1, UC-2, UC-3 | component (attributes) | `ui/bar-chart/bar-chart.component.spec.ts`, `ui/bar-chart-drilldown/bar-chart-drilldown.component.spec.ts` |
| T-5 | `stacked segments diverge from zero` — absolute: positive segments contiguous above 0, negative contiguous below 0, no overlap; percent: per category Σ of segment lengths = 100% of the scale | UC-5 | component | `ui/stacked-bar-chart/stacked-bar-chart.component.spec.ts` |
| T-6 | `column ranges are drawn between their values in any order` — `low < high`, `low > high`, `low === high`, negative ranges | UC-6 | component | `ui/column-range-chart/column-range-chart.component.spec.ts` |
| T-7 | `negative values sit inside the area and combo plots` — area overlaid/stacked/percent with mixed-sign series; combo with negative bars and negative line values: lowest mark ≥ plot top and ≤ plot bottom, a zero gridline exists; stacked-percent bands within ±100 | UC-7 | component | `ui/area-chart/area-chart.component.spec.ts`, `ui/combo-chart/combo-chart.component.spec.ts` |
| T-8 | `non-positive values get no wedge` — pie and pie-drilldown with `[100, -30, 0, 50]`, `[50, -50]`, `[0, 0]`, `[-5]`: wedge count = positive count; displayed shares sum to 100 (±0.05); legend lists every entry; no-positive datasets show the empty state; no focusable element has a zero-area wedge | UC-8 | component | `ui/pie-chart/pie-chart.component.spec.ts`, `ui/pie-chart-drilldown/pie-chart-drilldown.component.spec.ts` |
| T-9 | `funnel and bar-race degenerate geometry` — funnel all-zero → every polygon point finite, stage widths 0; negative → width 0; bar-race negative bars extend from the zero baseline toward the start edge (LTR and RTL), duplicate name in a frame → one bar with the last value | UC-9, UC-11 | component | `ui/funnel-chart/funnel-chart.component.spec.ts`, `ui/bar-race-chart/bar-race-chart.component.spec.ts` |
| T-10 | `radar vertices stay on their own axis inside the ring` — for negative, mixed, all-zero, and above-explicit-max values: vertex angle equals its axis angle (±1e-6) and distance from centre ∈ `[0, R]`, equal to `R·(v − lo)/(hi − lo)` before clamping | UC-10 | unit (`radarPoint`) + component wiring | `lib/chart-polar.spec.ts`, `ui/radar-chart/radar-chart.component.spec.ts` |
| T-11 | `bar-race stops all timers on destroy and resets colours with new frames` — fake timers: create with `autoPlay` + `loop`, destroy before the first tick, advance 10 × `animationDuration`: zero `frameChange` emissions after destroy; then a live instance: set `frames` to a new dataset → the first-ranked name gets palette colour 0 | UC-12 | component | `ui/bar-race-chart/bar-race-chart.component.spec.ts` |
| T-12 | `touched charts still install and render in a consumer app` — run the existing e2e harness of every touched chart (list in Task 10) | all (install) | e2e | `e2e/harness/*` (no new harness) |

### 2.2 Test types to cover

- **Browser property spec (T-1…T-3)** — one table-driven file, the single
  place the invariant is asserted for *every* chart. It lives in `lib/` and is
  suffixed `.browser.spec.ts`, so it runs only in the real-browser leg
  (`getBBox()` and rendered tooltip widths need a real layout engine) and is
  never shipped to consumers via `--include-tests`. There is no precedent for a
  `lib/` spec importing `ui/` components: after adding it, run
  `npm run check:registry` and confirm **no drift** (lib specs are not
  `libFiles`).
- **Component specs (T-4…T-11)** — one per chart semantic the property test
  cannot see (baseline edges, diverging stack order, share sums, axis angles,
  timers). They ship with their components, so they must stay portable
  (jsdom-safe: read SVG attributes, never `getBBox`; no non-shimmable `vi.*`).
- **Storybook** — add a "Negative & mixed values" story to `bar-chart`,
  `stacked-bar-chart`, `area-chart`, `pie-chart`, `radar-chart`; axe clean.
- **Demo** — one "Negative values" example on the charts demo page
  (`demo/src/app/demos/charts/charts-demo.component.ts`, strings in
  `charts-demo.locales.ts`) showing a P&L bar chart, copy-paste ready.
- **E2E (T-12)** — existing harnesses only; the bar family's `libFiles` gain
  `chart-scale.ts`, which only an install catches.

### 2.3 Edge cases

Covered by the §2.0 classes, plus: RTL for every cartesian chart in T-1;
horizontal orientation for bar-chart; percent stacking; drilldown into a child
series with all-negative values; a radar with an explicit `maxValue` below the
data; bar-race `frames` replaced while playing; empty `data` (existing empty
states must keep working).

### 2.4 Coverage expectation

No uncovered lines introduced in any touched component or lib file. Global
thresholds in `vitest.config.ts` must not drop. The `.browser.spec.ts` file is
excluded from the portable leg by name, so the jsdom coverage leg relies on
T-4…T-11 for the touched branches — check `npm run coverage` per-file numbers
for the touched components, not just the global ratchet.

---

## 3. Architecture

### 3.1 Usability — public API

No new inputs. Behaviour that used to be broken becomes defined:

```html
<!-- P&L: losses fall below a zero baseline -->
<ui-bar-chart
  [data]="[
    { name: 'Q1', value: 120 },
    { name: 'Q2', value: -45 },
    { name: 'Q3', value: 30 },
    { name: 'Q4', value: -10 }
  ]"
  title="Quarterly profit" />

<!-- Diverging stacks -->
<ui-stacked-bar-chart [series]="flows" [categories]="months" stacking="absolute" />

<!-- Two categories called 'Other' are two bars -->
<ui-waterfall-chart [data]="[{ name: 'Other', value: 5 }, { name: 'Other', value: -3 }]" />
```

Members the tests pin (named in this spec so an implementation does not have to guess them): `valueDomain()` on bar, bar-drilldown and stacked-bar (the `[lo, hi]` value axis), `dataRange()` kept on bar, bar-drilldown and column-range as `{ min, max }`, `baselineX()` on bar-race (the x of value 0), and `radarPoint(cx, cy, radius, axis, axisCount, value, maxValue, minValue = 0)`. Pie and pie-drilldown render a `[data-slot="pie-empty"]` ring (no text, so nothing to localise) exactly when no value is positive. Stacked-bar percent mode with no negative segment keeps its fixed `[0, 25, 50, 75, 100]` ticks (desktop appearance must not change); with a negative segment its ticks come from `niceDomain`.

Each chart's `data`/`series` input JSDoc states its negative / zero / duplicate
semantics (the §1.1 table row), so compodoc's API tables document it.

### 3.2 Efficiency

No meaningful new cost: domains are O(n) via `extent()`; bar geometry stays
O(n) per CD-free `computed()`. Budget: the T-1 matrix must finish within the
existing per-file browser timeout; keep each class to ≤ 12 points (huge-N is
the prerequisite's concern). Bar-race's colour map becomes a pure `computed()`
over all frames — O(frames × names) once per `frames` change, not per frame.

### 3.3 DX for the consuming developer

- Nothing to learn for positive data; the only visible change for positive-only
  bar charts is the axis top: a nice bound instead of `max × 1.1` (e.g. data max
  100 → axis to 100, not a tick at 120 floating above the plot).
- Exported types touched: none. `bandScale` (lib) keeps its signature; callers
  pass index keys (`String(i)`) as boxplot/candlestick already do.
- Same-named series without an `id` toggle together in the legend — JSDoc on
  `series` says "give series an `id` to toggle same-named series separately".

### 3.4 Implementation options

#### Bar-family scale

**Option 1 — Patch each legacy chart in place.** Keep `calculateAxisTicks`,
add zero-baseline arithmetic inline in four components.
Pros: no `libFiles` change. Cons: four more hand-rolled copies of scale math;
the tick-outside-plot class (D-5, D-6) needs its own per-chart fix.

**Option 2 — Migrate to `extent → niceDomain → linearScale`** like the 14 newer
charts. Domain = `niceDomain(min(0, lo), max(0, hi), 5)` (column-range: no
forced 0 — a range chart's baseline is not meaningful); bar geometry =
`[scale(min(0, v)), scale(max(0, v))]`; `axisTicks` = `scale.ticks(5)`;
`getTickPosition` = `scale.scale(tick)`.
Pros: one scale implementation for the whole family; the prerequisite's
invariant (ticks start/end on the domain) carries over for free; removes the
`* 1.1` hack. Cons: `chart-scale.ts` joins the four charts' `libFiles`
(registry data, regenerated by `sync-registry --fix`); legacy specs that pinned
`max * 1.1` geometry must be updated (they asserted the bug).

**Option 3 — Extract a shared cartesian base component.**
Pros: ends the duplication for good. Cons: a cross-chart refactor (tracked
debt in `specs/charts-expansion-spec.md`); far larger blast radius than this
bug class needs. Ruled out here.

**✅ Chosen: Option 2**, because it fixes the whole class with the lib that is
already proven on the newer charts, and the registry change is data-only.

#### Duplicate labels

**Option 1 — Position is identity.** Bands keyed by index, `@for` tracks by
`$index` or an index-qualified key; labels are display text.
Pros: every data point drawn; matches boxplot/candlestick/scatter today; no
data rewriting. Cons: two categories with the same label read the same on the
axis (that is what the data says).

**Option 2 — Merge duplicates by label (sum).** Cons: silently changes the
data; wrong for waterfall and funnel, whose order is meaning.

**Option 3 — Dev-mode warning and drop duplicates.** Cons: blocks legitimate
data ("Other" twice).

**✅ Chosen: Option 1.** Exceptions, both documented: **bar-race**, where the
name is the entity tracked across frames (duplicates within one frame → last
wins), and **heatmap**, where `(row, col)` is the cell (duplicates → later cell
paints on top; tracked by `$index`).

#### Pie negatives

**Option 1 — Absolute value** (Excel). Cons: a refund drawn as a positive share
misrepresents the whole.
**Option 2 — Exclude non-positive** (Highcharts; also this repo's `treemap`,
`treemap.utils.ts:22,83`). Pros: shares are always a true partition of the
positive total; consistent with treemap. Cons: the entry has no wedge — so the
legend keeps listing it with its raw value, keeping the data visible.

**✅ Chosen: Option 2.**

#### Radar negatives

**Option 1 — Clamp negatives to the centre.** Cons: `-5` and `0` look identical.
**Option 2 — Centre = `min(0, dataMin)`** (Excel radar's axis minimum).
Pros: every value has a distinct radius on its own axis. Cons: rings no longer
start at 0 when data is negative — the ring labels (if any) must show `lo`.

**✅ Chosen: Option 2**, with values clamped into `[lo, hi]` so an explicit
`maxValue` below the data cannot push a vertex past the ring.

#### Bar-race timers

**Option 1 — Store the constructor timeout handle and clear it in
`ngOnDestroy`.** **Option 2 — Start autoplay from `afterNextRender`** (does
not run after destroy) **and register teardown with `DestroyRef`.**

**✅ Chosen: Option 2** — `afterNextRender` is Angular's own "after first
render, never after destroy" hook, and the `_checkDirection` timeout at `:72`
moves to the same hook. The colour map becomes a `computed()` over
`frames()` (first-appearance order across all frames, each frame walked in rank order — value descending — so the first-ranked name of the first frame takes palette colour 0), removing the mutation
inside `displayBars`.

#### Tooltip width

**Option 1 — Migrate the six inline tooltips to `ui-chart-tooltip`.** Cons:
adds a registry dependency to six charts and rewrites their hover code.
**Option 2 — Add `max-w-[calc(100vw-2rem)]` (and `break-words`) to the
existing inline tooltip class lists.** Pros: minimal footprint; meets §5
"Overflow Protection" exactly.

**✅ Chosen: Option 2.**

### 3.5 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Positive-only bar charts change appearance (nice top instead of ×1.1) | Expected and documented; screenshot `bar-chart`, `stacked-bar-chart`, `column-range-chart` demo before/after at 375px and 1024px for the reviewer; delegate the comparison to the `visual-validate` skill |
| R-2 | Value labels on the tallest bar sit in the top padding once headroom is gone | Labels are text, not marks; they may use the padding. T-1 checks marks, not labels; the screenshot check covers legibility |
| R-3 | `data-table-range-chart` (bar, pie, stacked) changes with them | It is in the T-12 run list and in T-1 indirectly; its own spec must stay green |
| R-4 | `lib/` spec importing `ui/` confuses `sync-registry` | §2.2: `npm run check:registry` must show no drift after adding the file |
| R-5 | NG0955 is a dev-mode warning; a production-mode test run would miss it | T-2 runs under the default (dev-mode) TestBed and asserts on the console spy |
| R-6 | Legacy specs pinned buggy geometry | Listed in §0; fix with the code and name each in the commit message |
| R-7 | `heatmap` and `calendar-heatmap` component files are also touched by the prerequisite (extent) and by `color-utils-correctness-spec` (colour-scale import) | Different lines; spec-waves merges sequentially by prerequisite order |

---

## 4. Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run sonar:gate`
   against `http://localhost:9000` — coverage re-measured unless the tree
   fingerprint proves it current) run and clean on the changed code. eslint is NOT a substitute. If the token, server, or Docker
   is unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.

---

## 5. Tasks — table order is implementation order

Each fix task states its rule; the tests sample the rule's classes (§2.0), not
the reproduction values.

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | **Write all failing tests** T-1…T-11 (the cross-chart browser property spec first, then the per-chart specs) and fix the legacy specs listed in §0 that assert the bug (they must now fail for the right reason). Confirm the T-1 matrix fails on the classes Step 0 predicts and passes on the charts Step 0 found correct. If a chart Step 0 believed correct (gauge, bullet, treemap, scatter, bubble, boxplot, candlestick, histogram, waterfall, heatmap, calendar-heatmap) fails a row, record it as a new ⚠️ finding in §0 and add a task row for it below Task 9 — never weaken the row. | UC-1…UC-13 | ⬜ Not started | — | — | — |
| 2 | **Bar + bar-drilldown.** Rule: *every bar spans `[scale(min(0,v)), scale(max(0,v))]` on a `niceDomain` that includes zero.* Migrate both to `extent → niceDomain → linearScale` (vertical, horizontal, RTL); `axisTicks`/`getTickPosition` from the scale. T-4, T-1 rows green. | UC-1…UC-4 | ⬜ Not started | — | — | — |
| 3 | **Stacked-bar + column-range.** Rules: *positive segments stack up from zero and negative segments down from zero; percent share is `|v|/Σ|v|`* and *a range is drawn between `min(low,high)` and `max(low,high)` on the `niceDomain` of all bounds.* T-5, T-6, T-1 rows green. | UC-4…UC-6 | ⬜ Not started | — | — | — |
| 4 | **Area + combo.** Rule: *the value domain is `niceDomain(min(0, lo), max(0, hi))` over every drawn value, on every value axis.* Area overlaid/stacked (bands' lower and upper), `stackSeries` percent by `Σ|v|` (`lib/chart-path.ts`); combo primary **and** secondary axes. T-7, T-1 rows green. | UC-7 | ⬜ Not started | — | — | — |
| 5 | **Pie + pie-drilldown.** Rule: *a wedge's share is `max(0, v) / Σ max(0, v)`; a zero share renders no wedge and nothing focusable.* Legend unchanged (lists every entry). T-8, T-1 rows green. | UC-8 | ⬜ Not started | — | — | — |
| 6 | **Funnel + radar.** Rules: *funnel width ∝ `max(0, v)/max(positive)`, 0 when there is no positive value* and *a radar vertex lies on its own axis at `R·clamp((v−lo)/(hi−lo), 0, 1)` with `lo = min(0, dataMin)`.* `radarPoint` gains the `lo` parameter (`lib/chart-polar.ts`). T-9 (funnel part), T-10, T-1 rows green. | UC-9, UC-10 | ⬜ Not started | — | — | — |
| 7 | **Bar-race.** Rules: *no timer scheduled by the component fires after it is destroyed*, *colours are a pure function of `frames`*, *bars grow from a zero baseline*, *within a frame the last entry for a name wins.* `afterNextRender` + `DestroyRef`; colour map as `computed()`; zero-baseline geometry with 10% positive headroom. T-9 (bar-race part), T-11, T-1 rows green. | UC-9, UC-11, UC-12 | ⬜ Not started | — | — | — |
| 8 | **Duplicate identity everywhere else.** Rule: *every `@for` tracks a key unique by construction, and every band is positioned by index.* `bandScale` callers pass index keys (waterfall, combo); track keys at every site in D-16 (boxplot outliers, heatmap cells + legend, waterfall, funnel, combo, line, area, radar, chart-tooltip rows, chart-legend items, stacked-bar legend). T-2 green. | UC-11 | ⬜ Not started | — | — | — |
| 9 | **`data-slot` + tooltip cap.** Rule: *every chart root has `data-slot="<name>"`; every overlay has `max-w-[calc(100vw-2rem)]`.* Seven legacy charts + org-chart; six inline tooltips. T-3 green. | UC-13 | ⬜ Not started | — | — | — |
| 10 | **Docs, stories, demo, registry, e2e, gate.** JSDoc semantics on each touched `data`/`series` input; the five stories of §2.2 (axe clean); the demo "Negative values" example; `npm run check:registry` then `--fix` (expect `chart-scale.ts` added to bar-chart, bar-chart-drilldown, stacked-bar-chart, column-range-chart `libFiles`); `npm run docs:regen`; T-12: `npm run e2e -- <name>` for bar-chart, bar-chart-drilldown, stacked-bar-chart, column-range-chart, area-chart, combo-chart, pie-chart, pie-chart-drilldown, funnel-chart, radar-chart, bar-race-chart, waterfall-chart, boxplot, heatmap, line-chart, chart-tooltip, chart-legend, org-chart, data-table-range-chart; `npm run test-visual` green; `npm run sonar:gate`. | all | ⬜ Not started | — | — | — |

### Publish verdict

- **CLI npm publish: NOT required.** Component and lib source under
  `packages/components/**` plus `registry.json` *data* (`libFiles` additions)
  are served live from `master`. No CLI logic, manifest shape, or baselines
  change.
- **`release:package`: NOT required.** Verified closure of the `data-table`
  package (`stage-package-lib.ts:33-38`) contains no chart component or chart
  lib file; `data-table-range-chart` is outside it. The `rte` closure contains
  no chart files.
- If `npm run docs:regen` regenerates `documentation.json`, restore the tracked
  stub before committing (`git checkout origin/master -- documentation.json`).

---

## 6. Completion log

| # | Task | Completed | Score | Reviewer rationale |
|---|------|-----------|-------|--------------------|
