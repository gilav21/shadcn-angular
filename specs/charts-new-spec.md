# New Charts — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately.
>
> It **reads** `packages/components/lib/chart-*.ts` but must **not modify**
> them — any shared-lib change belongs to `charts-features-spec.md`, which runs
> after this one. If you believe a shared helper must change, STOP and report
> rather than editing it.

**Status:** ✅ complete — all 10 tasks done, review gate 93/100, Sonar clean on changed code
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
| 1 | Audit `bar-chart` + `column-range-chart` for input/tooltip/a11y conventions; record the conventions in this spec | — | ✅ Done | 2026-08-20 | 93 | The two charts named are the OLDER generation; auditing `line-chart` too was necessary, and it exposed two defects not to copy (a tooltip position that is never updated, and missing `data-slot`). |
| 2 | Write failing tests T-1…T-4 for `histogram`, including binning unit tests | UC-1…UC-4 | ✅ Done | 2026-08-20 | 93 | Binning tested directly first. Writing the zero-variance case before the code is what forced `niceDomain` padding into `computeBinEdges`, so the bin width can never be 0. |
| 3 | Implement `histogram` + stories + demo page | UC-1…UC-4 | ✅ Done | 2026-08-20 | 93 | No shared-lib change needed: `linearScale` + `niceDomain` + `observeChartWidth` covered it. Bins are a `computed()` over the sample only, so a resize re-lays out without re-counting. |
| 4 | Write failing tests T-5…T-8 for `boxplot`, including quartile unit tests | UC-5…UC-8 | ✅ Done | 2026-08-20 | 93 | The two API shapes converge in `resolveGroupStats`, so T-6 is a real equality assertion between the raw and pre-computed paths rather than two parallel code paths. |
| 5 | Implement `boxplot` + stories + demo page | UC-5…UC-8 | ✅ Done | 2026-08-20 | 93 | Splitting layout into `layoutVertical`/`layoutHorizontal` kept both orientations under the complexity bar. RTL reverses the band keys instead of the pixel range, which would otherwise give a negative bandwidth. |
| 6 | Write failing tests T-9…T-12 for `candlestick` | UC-9…UC-12 | ✅ Done | 2026-08-20 | 93 | Tests-first paid for itself here: three genuinely failed, and the cause was real — `Date.parse("Week 1")` returns a timestamp in V8, so label-only periods were being placed on the time axis. |
| 7 | Implement `candlestick` (ordinal axis default) + stories + demo page | UC-9…UC-12 | ✅ Done | 2026-08-20 | 93 | Ordinal band scale by default per §3.5, with `axisMode="time"` opting into the continuous scale. The doji floor (`Math.max(1, …)`) is asserted, not assumed. |
| 8 | Write failing tests T-13…T-17 for `treemap`, including squarify unit tests | UC-13…UC-17 | ✅ Done | 2026-08-20 | 93 | Squarify is asserted against slice-and-dice directly, so T-15 measures the property the choice was made for rather than an arbitrary threshold. |
| 9 | Implement `treemap` (squarified) + stories + demo page | UC-13…UC-17 | ✅ Done | 2026-08-20 | 93 | Zero-value nodes get a zero-size rect rather than an `Infinity` aspect ratio; `worstRatio` returns `Infinity` on a zero member so such nodes are excluded from the row search entirely. |
| 10 | Cross-cutting: T-18 resize, T-19 axe/keyboard, T-20 RTL for all four; register (`sync-registry --fix`); scaffold + pass e2e (T-21) | UC-18…UC-20 | ✅ Done | 2026-08-20 | 93 | The Sonar chart exclusions are globbed on `ui/*chart*/`, which none of these four folder names matches — caught in the Task-1 audit and confirmed against a real scan. e2e failed 3/4 in parallel purely on `ng serve` startup contention and passed 4/4 serially. |

---

## 6. Completion log

### Review gate — 93/100 (2026-08-20)

| Task | Completed | Score | Reviewer rationale (compressed) |
|---|---|---|---|
| 1–10 (one bundle diff) | 2026-08-20 | **93** | Squarify is a genuine Bruls implementation that terminates, cannot overflow its container and cannot emit NaN; the quartiles are type-7 and an IQR of 0 correctly reports no outliers; binning cannot produce a zero bin width; the ISO gate correctly rejects the `Date.parse('Week 1')` trap. Every pure function is unit-tested directly with all §2.2 edge cases, and the assertions are non-vacuous — removing the doji floor or swapping squarify for slice-and-dice both fail a test. Held out of the 96+ band by the missing CPD globs, a T-18 that proved re-layout via height rather than width, and two doc inaccuracies — all three since fixed. |

Reviewer concerns addressed after the score (commit `55fb70a7`): the
spread-based extents (a real `RangeError` past ~100k samples, inside the spec's
own budget) are now single-pass with regression tests; T-18 drives
`_measuredWidth` directly, per `line-chart`'s precedent, so the width path is
asserted honestly in the browser; §3.2's histogram budget gained the test it
never had and both perf assertions now time the best of several runs plus a
complexity check; and the two doc inaccuracies are corrected.

### Gate results

| Gate | Result |
|---|---|
| `npm run lint` | exit 0, zero findings |
| `tsc --noEmit` | clean |
| Chart tests | 232 pass, in **both** jsdom and real Chromium |
| Full suite | 386/386 files, 8346/8346 tests |
| Line coverage, 8 new files | **100%** (spec §2.3 asks ≥90%) |
| e2e (T-21) | 4/4 specs, 14 assertions (serially; see caveat) |
| `packages/components/lib/` | untouched — `git diff --stat` empty |
| **SonarQube** (`shadcn-angular-charts-new`) | **0 issues on changed code** — 0 on all four chart folders, 0 on `ui/index.ts` and `cli/src/registry/index.ts`. Project total 14, every one in a file this branch never touches. Coverage imported at 90.9%; duplication 1.6% with **no** duplication finding on the four new folders. |

### The one Sonar issue, and the two globs that hid it

The scan reported exactly one issue on this bundle:
`typescript:S7755` at `histogram.utils.ts:53` — prefer `.at(…)` over
`[….length - index]`. That line was itself a review-gate fix, where `.at(-1)!`
had been swapped for `[length - 1]` to satisfy `no-non-null-assertion` — trading
one rule for another. `sorted.at(-1) ?? sorted[0]` satisfies both.

Surfacing it first required repairing two more config globs that match on a
**name** rather than on what the thing is — the same failure mode as the
`ui/*chart*/` gap in §6.12:

| Config | Had | Missed | Consequence |
|---|---|---|---|
| `sonar.exclusions` | `**/coverage/**` | `**/coverage-*/**` | the CLI coverage leg writes `coverage-cli/`, so the scanner analysed generated lcov HTML and returned **43,411** issues, every sampled one under `coverage-cli/lcov-report/` |
| `eslint.config.mjs` | `e2e/fixture-app/**` | `e2e/.workers/**` | the *parallel* e2e runner clones that fixture per worker, so `npm run e2e` followed by `npm run lint` — the CI order — failed with 57 `parserOptions.project` errors |

`.gitignore` already had both right; the configs had simply drifted out of parity.
Neither exclusion suppresses a real finding: both cover gitignored generated
output that is never shipped. `eslint.config.mjs` already carried a comment
teaching exactly this lesson for `coverage*/**` — it just had not been applied
one entry below it.

**Three instances of the same defect in one bundle** (`ui/*chart*/`,
`**/coverage/**`, `e2e/fixture-app/**`) is the finding worth carrying forward:
these globs encode a naming coincidence, and each new thing that does not happen
to match the name fails a gate for reasons unrelated to its code.

### Environmental caveats (not code defects)

Both are contention artefacts of running eight agents on one machine, and both
are proven environmental by passing in isolation:

| Symptom | Evidence it is environmental |
|---|---|
| `packages/cli/src/core/baseline.spec.ts` timed out at 5s during the coverage chain, aborting it before `fix-lcov.mjs` | the same spec passes in **430ms** run alone; it shells out to `git`, which starves under load. `fix-lcov.mjs` was run by hand. |
| e2e failed 3/4 in parallel — `ng serve did not become ready within 120000ms` | all three pass with `--workers 1`. `boxplot` won the race and passed 3/3 even in the parallel run. **The integration run should serialise e2e rather than re-diagnose this.** |

### Task 1 — Convention audit (2026-08-20)

Audited `bar-chart` and `column-range-chart` as the spec asks, and additionally
`line-chart` because it turned out the two named charts are the **older**
generation and following them literally would reproduce two known defects (see
"Divergences" below). The conventions the four new charts MUST follow are
recorded here.

#### 6.1 File layout

```text
packages/components/ui/<name>/
  index.ts                     # export * from './<name>.component'; + types/utils
  <name>.component.ts
  <name>.component.html        # templateUrl, never an inline template
  <name>.component.spec.ts
  <name>.stories.ts
  <name>.types.ts              # this spec: chart-local public types
  <name>.utils.ts              # this spec: pure binning/quartile/squarify
```

No `.css` file — every chart is Tailwind-in-HTML only. The folder is then
re-exported from `packages/components/ui/index.ts` (charts are grouped in the
block at lines 96-118) and registered by `sync-registry --fix`.

#### 6.2 Component shell

- `selector: 'ui-<name>'`, `changeDetection: ChangeDetectionStrategy.OnPush`,
  `templateUrl`, `host: { class: 'block' }`.
- `private readonly el = inject(ElementRef)`, `destroyRef = inject(DestroyRef)`,
  `_measuredWidth = observeChartWidth(this.el, this.destroyRef)`.
- `svgWidth = computed(() => this._measuredWidth() ?? this.width())`;
  container `relative w-full`; SVG `width="100%"` + `viewBox`.
- **Every** member `readonly` (line-chart does this; bar-chart does not — Sonar
  S2933 flags the older style, so follow line-chart).

#### 6.3 Input vocabulary (verbatim names + defaults)

| Input | Type / default | Notes |
|---|---|---|
| data-ish | `input.required<T[]>()` | `data` / `series` / `points` / `groups` / `nodes` |
| `width` | `input(500)` | design width + pre-measurement fallback |
| `height` | `input(300)` | literal SVG height |
| `showGrid` | `input(true)` | dashed gridlines |
| `showTooltip` | `input(true)` | hover output still fires when off |
| `showLegend` | `input(true)` | only where a legend makes sense |
| `class` | `input('')` | merged via `cn()` |
| `title` | `input<string \| undefined>(undefined)` | prefixes the aria summary |
| `dir` | `input<ChartDirection>('auto')` | `'auto' \| 'ltr' \| 'rtl'` |
| `orientation` | `input<ChartOrientation>('vertical')` | boxplot (UC-8) |
| `barRadius` / `barGap` | `input(4)` / `input(8..12)` | bar-family geometry |
| `unit` | `input('')` | suffix on every formatted number |

Every input carries a prose JSDoc block — the library treats them as the public
API docs (see `column-range-chart` for the house style and length).

#### 6.4 Outputs

`<thing>Click = output<ChartClickEvent<T>>()` and
`<thing>Hover = output<ChartClickEvent<T> | null>()`. Payload is
`{ point, index, event? }` and `event` is forwarded **only** when
`event instanceof MouseEvent`, so keyboard activation leaves it `undefined`.

#### 6.5 RTL

```ts
private readonly _domRtl = signal(false);
readonly isRtl = computed(() => {
  const d = this.dir();
  if (d === 'rtl') return true;
  if (d === 'ltr') return false;
  return this._domRtl();
});
ngAfterViewInit(): void { this._domRtl.set(isRtl(this.el.nativeElement)); }
```

RTL reverses the categorical range (`[right, left]`) and moves the value-axis
tick labels to the opposite gutter. It does **not** flip the value axis.

#### 6.6 Accessibility

- Container (line-chart) or `<svg>` (older charts) carries `role="group"` +
  `aria-label` from `getChartSummary(type, count, title)`.
- Each datum is a focusable `<g>`/`<circle>`/`<rect>` with `tabindex="0"`,
  `role="button"`, an `aria-label` (`getPointAriaLabel(name, value)` or a
  chart-specific phrasing) and handlers
  `mouseenter/mouseleave/focus/blur/click/keydown.enter/keydown.space`.
- Charts drive hover from `focus` as well as `mouseenter`, so the keyboard path
  produces the same tooltip.

#### 6.7 Tooltip

Modern convention is the shared `ui-chart-tooltip`
(`visible/x/y/title/rows/flipX/flipY`, rows are `ChartTooltipRow[]` with
**pre-formatted** `value` strings), positioned from `pointerToSvg()`.

#### 6.8 Stories

`title: 'Charts/<Name>'`, `tags: ['autodocs']`, an `argTypes` entry with a
description for **every** input, matching `args` defaults, one `TEMPLATE`
string + shared `render`, then `Playground`, `Default`, feature stories and
`RightToLeft`.

#### 6.9 Specs

`TestBed.configureTestingModule({ imports: [Cmp] })`, inputs via
`fixture.componentRef.setInput(...)`, and a `ResizeObserverStub` installed on
`globalThis` in `beforeEach` / restored in `afterEach` — jsdom has no
`ResizeObserver` and `observeChartWidth` would throw without it.

#### 6.10 Demo page

There is **no** per-chart demo page. All charts live in the single
`demo/src/app/demos/charts/charts-demo.component.ts` (route `/charts`), and
every heading/description string is i18n'd through
`charts-demo.locales.ts`, which carries **10 locales**:
`en, he, ar, de, fr, es, ja, zh, ru, pt`. Adding a chart therefore means adding
`<name>Heading` / `<name>Description` to the `ChartsDemoLocale` interface and to
all ten locale objects.

#### 6.11 Divergences the new charts will NOT copy

1. **Dead tooltip position.** `bar-chart` and `column-range-chart` both declare
   `tooltipPosition = signal({ x: 0, y: 0 })` and *never update it*, so their
   tooltips are pinned to the container origin regardless of which bar is
   hovered. The new charts use `ui-chart-tooltip` positioned from the pointer,
   as `line-chart` does. (Fixing the two old charts is out of scope here.)
2. **Missing `data-slot`.** Neither audited chart sets one, although
   `CLAUDE.md` requires it; `line-chart` does (`data-slot="line-chart"`). New
   charts set `data-slot` on the container and on notable inner marks.
3. **Non-`readonly` members** in `bar-chart`/`column-range-chart` (S2933).

#### 6.12 Sonar configuration gap found by the audit

`sonar-project.properties` scopes the accepted chart findings — `Web:S6819`
(inline SVG under `role="img"`/`group`), `Web:MouseEventWithoutKeyboardEquivalentCheck`
and the CPD exclusions — with the glob `packages/components/ui/*chart*/…`.
**None of `histogram`, `boxplot`, `candlestick`, `treemap` contains the
substring `chart`**, so the four new folders fall outside every existing
exclusion and would raise the same already-accepted findings as new issues.
`heatmap` and `calendar-heatmap` already set the precedent of adding an
explicit per-folder entry for exactly this reason. Task 10 therefore adds four
matching entries plus the CPD globs, with the rationale recorded in
`docs/sonarqube-accepted-findings.md`. This is a scanner-config change only —
**no `packages/components/lib/` file is touched**, so the spec's read-only
constraint on the shared lib holds.

#### 6.13 Confirmed available from `lib/` (read-only)

`linearScale`, `bandScale`, `timeScale`, `sizeScale`, `niceDomain`,
`niceTimeTicks`, `sequentialColorScale`, `toEpochMs` (`chart-scale.ts`);
`linePath`, `areaPath`, `bandAreaPath`, `stackSeries` (`chart-path.ts`);
`nearestPointX`, `nearestPoint2D`, `pointerToSvg`, `getClientPoint`
(`chart-interaction.ts`); `observeChartWidth` (`chart-responsive.ts`);
`getChartColor`, `formatChartValue`, `getChartSummary`, `getPointAriaLabel`,
`calculateAxisTicks`, `getDataRange` (`chart.utils.ts`). Nothing needed by the
four new charts is missing from these, so **no shared-lib change is required**.

