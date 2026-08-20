# New Charts — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately.
>
> It **reads** `packages/components/lib/chart-*.ts` but must **not modify**
> them — any shared-lib change belongs to `charts-features-spec.md`, which runs
> after this one. If you believe a shared helper must change, STOP and report
> rather than editing it.

**Status:** not started
**Scope:** `histogram`, `boxplot`, `candlestick`, `treemap`
**Source plan:** `specs/ideas-backlog-2026-08-19.md` §5 "Tier C ranked by real effort"

---

## 1. Product Manager section

### 1.1 Business logic

Four chart types absent from an otherwise 24-strong chart set:

- **`histogram`** — distribution of a single numeric variable, auto-binned.
- **`boxplot`** — quartile summary: box, whiskers, median, outliers.
- **`candlestick`** — OHLC financial series: body plus high/low wicks.
- **`treemap`** — hierarchical part-to-whole as nested area.

### 1.2 Why the customer wants this

The chart set is deep on comparison (bar, line, area, combo) and part-to-whole
(pie, funnel, waterfall) but has **no statistical distribution charts at all**
and **no financial chart**. A developer building an analytics or finance
dashboard hits this wall immediately and has to add a charting dependency —
which breaks the library's single most distinctive property: **zero third-party
runtime dependencies**.

`treemap` specifically is the most-requested part-to-whole chart that `pie`
cannot express, because pie collapses at more than ~7 categories and cannot
show hierarchy at all.

### 1.3 Why these four and not sankey / network-graph / geo-map

Effort was assessed against the existing shared chart infrastructure:
`chart-scale.ts` (`linearScale`, `bandScale`, `timeScale`, `sizeScale`,
`niceDomain`, `niceTimeTicks`), `chart-path.ts`, `chart-polar.ts`,
`chart-interaction.ts`, `chart-responsive.ts`, and `chart.types.ts`.

- `histogram` = bar chart + a binning function. Cheapest possible addition.
- `boxplot` and `candlestick` are both **close relatives of the existing
  `column-range-chart`**, which already renders min/max ranges on an axis.
- `treemap` needs one self-contained layout algorithm and no new scales.
- **`sankey`** (crossing minimisation) and **`network-graph`** (force
  simulation) are real algorithm work — deliberately deferred.
- **`geo-map`** is declined outright: it requires topology data, which would
  break the zero-dependency property.

### 1.4 Use cases — definition of done

**`histogram`**
| ID | Use case |
|---|---|
| UC-1 | A developer passes raw numeric values and gets auto-binned bars without specifying bin edges. |
| UC-2 | A developer overrides `binCount` or explicit `binEdges` and the bars follow. |
| UC-3 | Hovering a bar shows a tooltip with the bin range and the count. |
| UC-4 | Axis ticks use `niceDomain`, so bounds are round numbers, not raw min/max. |

**`boxplot`**
| ID | Use case |
|---|---|
| UC-5 | A developer passes groups of raw values and gets box, median line, whiskers and outlier dots per group. |
| UC-6 | A developer passes pre-computed quartiles instead of raw values and it renders identically. |
| UC-7 | Outliers beyond 1.5×IQR render as individual points and are hoverable. |
| UC-8 | `orientation="horizontal"` transposes the chart. |

**`candlestick`**
| ID | Use case |
|---|---|
| UC-9 | A developer passes OHLC points on a time axis and gets bodies with high/low wicks. |
| UC-10 | Rising and falling candles use distinct, themeable colours. |
| UC-11 | Hovering a candle shows O/H/L/C values in a tooltip. |
| UC-12 | The time axis uses `timeScale` + `niceTimeTicks` and handles irregular gaps (weekends) without blank space. |

**`treemap`**
| ID | Use case |
|---|---|
| UC-13 | A developer passes a flat array of `{label, value}` and gets proportional rectangles. |
| UC-14 | A developer passes nested children and gets nested rectangles with group borders. |
| UC-15 | Rectangles are reasonably square (squarified), not long slivers. |
| UC-16 | Labels hide automatically when their rectangle is too small to fit them. |
| UC-17 | Clicking a node emits a click event with the node's data. |

**All four**
| ID | Use case |
|---|---|
| UC-18 | Each chart is responsive: fills its container width and re-renders on resize. |
| UC-19 | Each chart is keyboard-navigable and passes axe, consistent with the existing charts. |
| UC-20 | Each chart supports RTL. |

### 1.5 Out of scope

- Annotations, export, streaming, crosshair sync — all `charts-features-spec.md`.
- **Any modification to `lib/chart-*.ts`.** Read only.
- `sankey`, `network-graph`, `geo-map`.
- Zoom/brush interaction (`chart-brush` already exists as a separate component).

---

## 2. QA section — write these tests FIRST

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `auto-bins raw values into sensible bins` | UC-1 | unit |
| T-2 | `honours binCount and explicit binEdges` | UC-2 | unit |
| T-3 | `tooltip shows bin range and count` | UC-3 | unit |
| T-4 | `axis bounds are nice numbers` | UC-4 | unit |
| T-5 | `computes quartiles/median/whiskers from raw values` | UC-5 | unit |
| T-6 | `pre-computed quartiles render identically to raw` | UC-6 | unit |
| T-7 | `outliers beyond 1.5 IQR render as points` | UC-7 | unit |
| T-8 | `horizontal orientation transposes` | UC-8 | unit |
| T-9 | `renders bodies and wicks from OHLC` | UC-9 | unit |
| T-10 | `rising/falling colours differ and are themeable` | UC-10 | unit |
| T-11 | `tooltip shows O/H/L/C` | UC-11 | unit |
| T-12 | `time axis omits gaps for missing periods` | UC-12 | unit |
| T-13 | `rect areas are proportional to values` | UC-13 | unit |
| T-14 | `nested children render nested rects` | UC-14 | unit |
| T-15 | `aspect ratios stay within squarified bounds` | UC-15 | unit |
| T-16 | `labels hide when the rect is too small` | UC-16 | unit |
| T-17 | `click emits node data` | UC-17 | unit |
| T-18 | `each chart resizes with its container` | UC-18 | unit |
| T-19 | axe clean + keyboard reachable, all four | UC-19 | story a11y |
| T-20 | RTL renders correctly, all four | UC-20 | unit + story |
| T-21 | e2e smoke, all four | all | e2e |

### 2.2 Edge cases every chart must cover

Empty data (renders an empty state, does not crash); single data point; all
values identical (zero variance — histogram must not divide by zero, boxplot's
IQR is 0); negative values; very large values; `treemap` with a zero-value node;
`candlestick` where open === close (doji — body must still be visible as a line).

### 2.3 Coverage expectation

≥90% lines on all four new chart folders. The binning, quartile, and squarify
functions are pure and must be **unit-tested directly**, not only through the
component.

---

## 3. Architecture

### 3.1 Usability

```html
<ui-histogram [values]="samples()" [binCount]="20" />
<ui-boxplot [groups]="[{ label: 'A', values: [...] }]" />
<ui-candlestick [points]="ohlc()" />
<ui-treemap [nodes]="[{ label: 'Docs', value: 120, children: [...] }]" />
```

Inputs mirror the existing chart components (`height`, `class`, `locale`,
`direction`, legend/tooltip config) so the set stays internally consistent. A
developer who knows `bar-chart` should be able to use `histogram` without
reading docs.

### 3.2 Efficiency

Budget: 10,000 raw values binned and rendered under 16ms for `histogram`;
`treemap` squarify of 1,000 nodes under 8ms. Binning and quartile computation
must be memoised via `computed()` so a resize does not recompute statistics —
only layout.

### 3.3 DX

New exported types, following `chart.types.ts` conventions:
`HistogramBin`, `BoxplotGroup`, `BoxplotStats`, `OhlcPoint`, `TreemapNode`.
Pure helpers live in each chart's folder (e.g. `histogram.utils.ts`) — **not**
in `lib/`, since this spec must not modify shared lib files. Promotion to
`lib/` is a later decision if a second chart needs them.

### 3.4 Implementation options — `treemap` layout

**Option 1 — Slice-and-dice.** Trivial (alternate horizontal/vertical splits).
Produces long thin slivers for skewed data; labels never fit. Fails UC-15.

**Option 2 — Squarified treemap (Bruls et al.).** Greedily fills rows keeping
aspect ratios near 1. ~100 lines, well-documented algorithm, no dependencies.
Pros: near-square rects, labels fit, standard output people recognise.
Cons: slightly more code; ordering is not strictly value-sorted.

**Option 3 — Binary partition by value.** Middle ground; better than slice-and-
dice, worse aspect ratios than squarified, and no simpler to implement.

**✅ Chosen: Option 2 (squarified).** UC-15 and UC-16 exist precisely because
sliver rectangles make a treemap useless — labels cannot render and small
values become invisible lines. Squarified is the standard for this reason, and
at ~100 lines of pure, directly-testable code it is well within reach without a
dependency.

### 3.5 Implementation options — `candlestick` time axis

**Option 1 — Continuous `timeScale`.** Correct for real elapsed time, but
leaves visible blank gaps for weekends/holidays, which finance users read as a
rendering bug.

**Option 2 — Ordinal `bandScale` over the actual periods present.** No gaps;
each candle equal width. Loses true time proportionality.

**✅ Chosen: Option 2 (band scale over present periods),** which is what every
financial charting tool does and what UC-12 asks for. Expose an
`axisMode: 'ordinal' | 'time'` input defaulting to `'ordinal'` so a developer
plotting genuinely continuous data can opt into Option 1.

### 3.6 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Temptation to add helpers to `lib/chart-*.ts`, colliding with `charts-features` | Explicit out-of-scope; helpers live in the chart folder. If a shared change seems necessary — STOP and report |
| R-2 | Zero-variance / single-point data divides by zero | Explicit edge-case tests (§2.2) written before implementation |
| R-3 | Four registry entries landing at once | One `sync-registry --fix` in the final task |
| R-4 | Charts drift from existing conventions (input names, tooltip behaviour) | Task 1 is an explicit convention audit of two existing charts before writing any new one |
| R-5 | `boxplot` accepting both raw values and pre-computed stats creates an ambiguous API | Discriminate on the presence of `values` vs `stats`; T-6 asserts the two paths agree |

---

## 4. Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — full server scan (`npm run coverage` then
   `unset SONAR_TOKEN; npm run sonar` against `http://localhost:9000`) clean on
   changed code. If token/server/Docker unavailable, the task is **blocked, not
   done**.
5. **Review gate ≥ 91** — invoke the `review-gate` skill.

Then update the task row with **Completed**, **Score**, **Retrospective**.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Audit `bar-chart` + `column-range-chart` for input/tooltip/a11y conventions; record the conventions in this spec | — | ⬜ Not started | — | — | — |
| 2 | Write failing tests T-1…T-4 for `histogram`, including binning unit tests | UC-1…UC-4 | ⬜ Not started | — | — | — |
| 3 | Implement `histogram` + stories + demo page | UC-1…UC-4 | ⬜ Not started | — | — | — |
| 4 | Write failing tests T-5…T-8 for `boxplot`, including quartile unit tests | UC-5…UC-8 | ⬜ Not started | — | — | — |
| 5 | Implement `boxplot` + stories + demo page | UC-5…UC-8 | ⬜ Not started | — | — | — |
| 6 | Write failing tests T-9…T-12 for `candlestick` | UC-9…UC-12 | ⬜ Not started | — | — | — |
| 7 | Implement `candlestick` (ordinal axis default) + stories + demo page | UC-9…UC-12 | ⬜ Not started | — | — | — |
| 8 | Write failing tests T-13…T-17 for `treemap`, including squarify unit tests | UC-13…UC-17 | ⬜ Not started | — | — | — |
| 9 | Implement `treemap` (squarified) + stories + demo page | UC-13…UC-17 | ⬜ Not started | — | — | — |
| 10 | Cross-cutting: T-18 resize, T-19 axe/keyboard, T-20 RTL for all four; register (`sync-registry --fix`); scaffold + pass e2e (T-21) | UC-18…UC-20 | ⬜ Not started | — | — | — |

---

## 6. Completion log

_(empty — no tasks complete yet)_
