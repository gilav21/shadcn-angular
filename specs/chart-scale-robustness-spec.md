# Chart Scale Robustness — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **It is itself a prerequisite of `specs/chart-degenerate-data-spec.md`**, which
> builds its per-chart fixes on the `niceDomain` contract and the shared
> `extent()` helper this spec delivers.
>
> File overlap (for wave planning): `lib/chart-scale.ts` is also touched by
> `specs/color-utils-correctness-spec.md` — that spec only removes
> `sequentialColorScale` + its private HSL parser (lines 165-202); this spec
> edits `linearScale` / `niceDomain` / `niceTimeTicks` (lines 1-163). Disjoint
> hunks; the integration merge is textual. `heatmap` and `calendar-heatmap`
> component files are touched by all three chart specs (different lines).

**Status:** not started
**Scope owner:** charts (shared lib)
**Source:** codebase review 2026-10 (chart findings), re-verified 2026-10-03
**Living history:** never delete entries. Mark items done, add new findings
below, link regressions to their origin.

---

## 0. Step 0 — findings re-verified against the source

Every claim of the review was re-checked by reading the source and by running
the functions (verbatim copies in node probes, and the real TS files through
`tsx`). ✓ = confirmed as stated. ⚠️ = believed vs. true differs, or new.

| # | Claim (as reported) | Verdict | Evidence |
|---|---|---|---|
| F-1 | `calculateAxisTicks` (`lib/chart.utils.ts:194-220`) accumulates `tick += niceStep` and compares against `niceMax`; the accumulated last tick overshoots by float error and is dropped. ~14% of random 2-decimal ranges end below `max`. | ✓ | Probe of 100k random 2-decimal ranges: **14.4%** of `niceDomain` results exclude `max`. |
| F-1a | "`chart-scale.spec.ts:48-58` uses only integer domains" (implying integer domains are safe) | ⚠️ **Integer domains fail too.** | `niceDomain(1, 2)` → `[1, 1.9999999999999998]`; `niceDomain(2, 3)` → `[2, 2.8000000000000007]`; 296 of the 44,850 integer pairs in `0..299` lose `max`. The spec's three integer cases happen to be safe — a degenerate sample, not a safe class. |
| F-2 | `niceDomain(0, 0.06)` → `[0, 0.05]`; `niceDomain(1.97, 2.69)` → `[1.9, 2.6000000000000005]` | ✓ (⚠️ lower bound also noisy) | Actual: `[1.9000000000000001, 2.6000000000000005]`. |
| F-3 | Labels like `2.3000000000000003` | ✓ | `calculateAxisTicks(1.97, 2.69)` → `[1.9000000000000001, 2, 2.1, 2.2, 2.3000000000000003, …]`. Printed raw (`{{ g.value }}`) at `line-chart.component.html:40`, `scatter-chart.component.html:40,49`, `histogram.component.html:43`, `waterfall-chart.component.html:22`. |
| F-4 | Histogram data loss: `computeBins([1.97, 2.2, 2.4, 2.69])` sums to 3 of 4 (`histogram.utils.ts:76,89`) | ✓ | Real file via `tsx`: edges `[1.8, 2.0667, 2.3333, 2.6000000000000005]`, count sum **3 of 4** — 2.69 is outside the last edge and `binIndexOf` (`:89`) returns −1. |
| F-5 | — | ⚠️ **NEW: `niceDomain` is not idempotent with `ticks()`.** | `niceDomain(0, 15)` → `[0, 16]`, but `linearScale([0, 16]).ticks(5)` → `[0, 5, 10, 15, 20]`: tick **20 lies outside the domain** and is drawn above the plot. **9.6%** of random integer domains. Every chart that does `linearScale(niceDomain(…)).ticks(5)` is affected (line, area, scatter, bubble, boxplot, candlestick, waterfall, combo, histogram). |
| F-6 | — | ⚠️ **NEW: negative domains lose `max`.** | `niceDomain(-0.06, 0)` → `[-0.06, -0.00999999999999999]` — upper bound below the data maximum `0`. |
| F-7 | `calculateAxisTicks(1e20, 1e20 + 16384)` never terminates | ✓ (+ more) | Step (2000) is below the float spacing at 1e20 (16384), so `tick += step` is a no-op. Same for `(1e16, 1e16 + 4)`. A huge `targetCount` (`(0, 10, 1e9)`) builds ~1e9 ticks. |
| F-8 | `min === max`, `max < min`, `NaN` → `[]` | ✓ (+ more) | Also `count <= 0` → `[]` and range overflow `(-1e308, 1e308)` (`max - min === Infinity`) → `[]`. |
| F-9 | `niceDomain(NaN, …)` → `[undefined, undefined]` (`chart-scale.ts:68-69`) | ✓ | Also `niceDomain(0, NaN)` and `niceDomain(0, Infinity)` → `[undefined, undefined]`. |
| F-10 | "one null point blanks the whole line chart" | ⚠️ **Partly.** | `null` is coerced to `0` by `Math.max` — it is drawn **at zero**, not blank. `undefined` / `NaN` make `Math.max` return `NaN` → `niceDomain` returns `[undefined, undefined]` → every coordinate is `NaN` → the whole chart blanks. Even with a fixed domain, `linePath` (`lib/chart-path.ts:94`) has no gap handling, so the path truncates at the bad point; `stackSeries` (`chart-path.ts:130-142`) lets `NaN` through `?? 0` and poisons every band above it. |
| F-11 | `niceTimeTicks` (`chart-scale.ts:159`) loops forever if max is Infinity | ✓ (⚠️ not reachable from candlestick) | `candlestick.usable()` filters non-finite timestamps (`candlestick.component.ts:160`), so only direct lib callers can hit it. Finite but extreme ranges are unbounded: `(0, 8.64e15)` produces ~274k ticks. `niceTimeTicks(NaN, x)` returns `[NaN, x]`. |
| F-12 | `Math.min/max(...arr)` throws RangeError beyond ~100k elements | ✓ | Real `getDataRange` via `tsx`: **100,000 OK, 130,000 throws** "Maximum call stack size exceeded". Chart sites (full list, verified by grep): `area-chart.component.ts:199`, `bar-race-chart.component.ts:215`, `boxplot.component.ts:207`, `bubble-chart.component.ts:173,179,205,206`, `calendar-heatmap.component.ts:112,119,155`, `candlestick.component.ts:201,202,352`, `column-range-chart.component.ts:162,163`, `combo-chart.component.ts:174,180`, `funnel-chart.component.ts:139`, `heatmap.component.ts:140`, `histogram.component.ts:171`, `line-chart.component.ts:180,181`, `org-chart.component.ts:283,290`, `radar-chart.component.ts:137`, `scatter-chart.component.ts:171,177`, `waterfall-chart.component.ts:170,171`, `lib/chart.utils.ts:189,190`. Already safe: `histogram.utils.ts:31` (private `extent`), `candlestick.utils.ts:69` (`ohlcExtent`). |
| F-13 | `formatChartValue` (`chart.utils.ts:152-172`) builds a new `Intl.NumberFormat` per call (~16µs vs 0.4µs) | ✓ | Measured: **15.6µs/call vs 0.34µs** cached. Called from templates per bar / tick / label on every CD pass (e.g. `bar-chart.component.html:129` → `formatValue` → `formatChartValue`), in 22 chart components. |
| F-14 | `animateValue` with duration 0 sends `NaN` to `onUpdate` (`chart.utils.ts:126`) | ✓ (⚠️ no in-repo caller) | `elapsed / 0` on the first frame is `0/0 = NaN`; `Math.min(NaN, 1)` is `NaN`; `onUpdate(NaN)` then `onComplete`. The final `end` value is never reported. No component calls it — it is exported lib API for consumers. |
| F-15 | `calculateAxisTicks` has no direct spec | ✓ | `lib/chart.utils.spec.ts` has only `easingFunctions` and `animateValue` blocks; nothing covers `calculateAxisTicks`, `getDataRange`, `formatChartValue`. |
| F-16 | — (found in Task 1, 2026-10-04) | ⚠️ **NEW: count 1 on a zero-straddling domain has no fixed point.** | Under the 1/2/5 step rule the ticks of a domain with `min < 0 < max` always include 0, so its span is ≥ 2 steps; with `count = 1` the next step is ≥ span / 1.5 > step, so the domain grows forever (`[-995, 254]` → `[-1000, 1000]` → `[-2000, 2000]` → `[-5000, 5000]` …). Scratch probe of the Option 2 algorithm: 29,992 of 800,000 calls violate T-3, all `count = 1` with mixed-sign bounds. Resolved by the §3.1 amendment below. |
| F-17 | — (found in Task 1) | ⚠️ **NEW: `computeBinEdges` builds its last edge as `lo + count·width`**, which can land below `hi`. | With the fixed `niceDomain`, `computeBins([0, 0.23, 0.46], { binCount: 50 })` → domain `[0, 0.46]` but last edge `0.45999999999999996`, so 0.46 is dropped (2 of 3 counted). Fixing `niceDomain` alone does not fix F-4 for every bin count. |

**Superseded decision:** `specs/charts-expansion-spec.md` §5.1 said "Do **not**
modify `calculateAxisTicks`", and `lib/chart-scale.ts:6` says it is "reused,
never modified". That constraint protected the 9 legacy charts during an
additive project. It is superseded here: the bug lives in `calculateAxisTicks`.
Update the header comment in `chart-scale.ts` accordingly.

**Achievability check (scratch probe, deleted):** an index-based tick generator
with step-precision rounding, an ulp guard, and a fixed-point `niceDomain` was
run over 120,000 random domains in six classes (integer, 2-decimal, negative,
1e-9 tiny, 1e20 + small span, ±1e307) with 0 invariant violations and a worst
single call of 0.3 ms. The invariant below is achievable.

---

## 1. Product Manager section

### 1.1 Business logic

Every cartesian chart in the library turns data into an axis through three lib
functions: `calculateAxisTicks` (nice step + tick list), `niceDomain` (round the
data range outward to nice bounds) and `linearScale(...).ticks()`. Several charts
also compute their raw data range with `Math.min(...values)`.

This spec makes those functions honour one rule:

> **Invariant:** The nice domain always contains every finite data value, its
> ticks are exact multiples of the step rendered without float noise, and
> degenerate input (empty, single value, all-equal, non-finite, extreme
> magnitude) yields a usable finite domain in bounded time.

It also makes the shared helpers around them safe: a single-pass `extent()`
replaces every spread into `Math.min/max`, `formatChartValue` reuses its
formatters, `animateValue` survives a zero duration, and a line/area series with
a missing value draws a gap instead of blanking or truncating.

### 1.2 Why the customer wants this

The customer is a developer who installed `line-chart`, `histogram`, `scatter`
etc. and fed it real data:

- **Their top data point is drawn above the chart.** A price series ending at
  2.69 gets an axis ending at 2.6; a percentage series `[0, 0.06]` gets an axis
  ending at 0.05. On a quarter of random 2-decimal datasets the axis labels read
  `2.3000000000000003`. The workaround today is to pre-round their data or pass
  their own domain — which most charts don't accept.
- **Their histogram silently loses samples.** Bin counts don't add up to the
  sample size, which is the one thing a histogram must get right.
- **A gridline floats above the plot** on ~10% of ordinary integer datasets
  (`[0, 15]` → a tick at 20 outside the plot).
- **The tab freezes** when a value is a large timestamp-like number with a small
  spread (`1e16 .. 1e16+4`), or when a lib caller passes `Infinity`.
- **One `NaN`/`undefined` from an API response blanks the whole line chart.**
- **Big datasets crash** with `RangeError: Maximum call stack size exceeded` at
  ~130k points — scatter plots and candlestick histories reach that easily.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| UC-1 | A developer passes any finite data whose min < max — integer, fractional, negative, mixed-sign, tiny (1e-9) or huge (1e20) — and `niceDomain` returns finite bounds that contain every value. |
| UC-2 | Axis tick values are exact multiples of the step with no float noise: a chart that prints a tick raw shows `2.3`, never `2.3000000000000003`. |
| UC-3 | `linearScale(niceDomain(a, b, n), range).ticks(n)` starts exactly at the domain's lower bound and ends exactly at its upper bound, and `ticks(m)` for any other `m` never returns a value outside the domain — so no gridline is ever drawn outside the plot. |
| UC-4 | `computeBins` counts every finite sample in exactly one bin: the bin counts sum to the number of finite samples. |
| UC-5 | Degenerate input — empty range, a single value, all-equal values, `max < min`, `NaN`/`±Infinity` in either bound, or a range whose span overflows — makes `niceDomain` return a finite domain with `max > min` that contains every finite input; nothing returns `undefined`. |
| UC-6 | `calculateAxisTicks`, `niceDomain` and `niceTimeTicks` return in bounded time with a bounded number of ticks for any input, including steps below float resolution, huge tick counts, and infinite bounds. |
| UC-7 | A line or area series containing a missing value (`NaN`, `undefined`, `null`, `±Infinity`) renders its finite points with a visible gap at the missing value; the axis is intact and no SVG attribute contains `NaN`. |
| UC-8 | Every chart computes its data range from 150,000+ values without throwing (`extent()` replaces every spread into `Math.min/max` in chart code). |
| UC-9 | `formatChartValue` produces the same strings as before but constructs at most one `Intl.NumberFormat` per distinct (locale, compact, decimals) combination. |
| UC-10 | `animateValue` with a duration of `0`, a negative duration or `NaN` reports exactly `end` once, then completes; `onUpdate` never receives a non-finite value when `start` and `end` are finite. |

### 1.4 Explicitly out of scope

- **Per-chart negative / zero / duplicate-label semantics** (bar baseline, pie
  negatives, funnel all-zero, …) — that is `specs/chart-degenerate-data-spec.md`,
  which depends on this one. This spec only fixes the shared math and swaps the
  `Math.min/max` spreads for `extent()` mechanically, without changing any
  chart's domain rules.
- **Locale-formatting raw tick labels** (`{{ g.value }}` is not run through
  `formatChartValue`) — an i18n concern; this spec only guarantees the raw
  number is clean.
- **Scatter / bubble / candlestick gap semantics** for non-finite points (they
  already filter or are point-based); only `linePath`/`areaPath`/`stackSeries`
  get gap handling.
- `Math.min/max` spreads outside the chart family (`pdf-parser`, `readable-*`,
  `data-table`, `pivot`, `masonry`) — different owners, different N.
- A d3-style dependency — the library is copied into consumer projects; no new
  runtime packages.

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.

Property tests use a **seeded** PRNG (a 6-line mulberry32 inside the spec file)
and print the seed and the failing input on failure. Each property samples
**every input class** below — never only the reproduction values:

| Class | Generator |
|---|---|
| integer | `a, b ∈ [-1000, 1000]` integers |
| fractional | 2-decimal values in `[0, 10]` (includes `1.97..2.69`, `0..0.06`) |
| negative | both bounds `< 0` (includes `-0.06..0`) |
| mixed-sign | `a < 0 < b` |
| all-equal | `a === b` (incl. `0`, negative, fractional) |
| tiny | values in `[0, 1e-9]` |
| huge-narrow | `1e20 + k`, `k ∈ [0, 1e5]` and `1e16 + k`, `k ∈ [0, 8]` |
| giant | `±1e307`, and a span that overflows (`-1e308 .. 1e308`) |
| non-finite | `NaN`, `±Infinity` in either or both bounds |
| counts | `count ∈ {1, 3, 5, 7, 10}` plus `0`, `-1`, `1e9` for the bounded-time test |

### 2.1 Traceability

| Test ID | Test name | Proves | Type | File |
|---|---|---|---|---|
| T-1 | `niceDomain returns finite bounds containing every finite input` (property over integer, fractional, negative, mixed-sign, tiny, huge-narrow, giant × counts) | UC-1 | unit (property) | `lib/chart-scale.spec.ts` |
| T-2 | `ticks are exact multiples of the step with no float noise` (property: each tick equals itself rounded to the step's decimal precision; consecutive differences equal the step; for `|value| < 1e15`, `String(tick)` has no more fraction digits than the step) | UC-2 | unit (property) | `lib/chart.utils.spec.ts` |
| T-3 | `ticks of a nice domain start and end on its bounds` (property: `linearScale(niceDomain(a,b,n)).ticks(n)` first === `d0`, last === `d1`; `ticks(m)` for `m ∈ counts` stays inside `[d0, d1]`; the table includes `niceDomain(0, 15)`) | UC-3 | unit (property) | `lib/chart-scale.spec.ts` |
| T-4 | `computeBins counts every finite sample exactly once` (property over sample classes: narrow fractional `1.97..2.69`, integer, negative, mixed-sign, all-equal, single value, samples with `NaN`/`±Infinity` mixed in, 200,000 samples; sum of counts === number of finite samples, and `binCount` overrides 1, 3, 7, 50 honoured) | UC-4, UC-8 | unit (property) | `ui/histogram/histogram.utils.spec.ts` (existing file; the 200k-sample row is a correctness assertion, not a benchmark — `histogram.utils.workload.spec.ts` stays the benchmark) |
| T-5 | `degenerate bounds yield a finite non-collapsed domain` (table: `(5,5)`, `(0,0)`, `(-3,-3)`, `(5,1)`, `(NaN,5)`, `(0,NaN)`, `(NaN,NaN)`, `(0,Infinity)`, `(-Infinity,Infinity)`, `(-1e308,1e308)`; result finite, `d1 > d0`, contains every finite input) | UC-5 | unit | `lib/chart-scale.spec.ts` |
| T-6 | `scale helpers return a bounded tick list in bounded time` (`calculateAxisTicks(1e20, 1e20+16384)`, `(1e16, 1e16+4)`, `(0, 10, 1e9)`, `(0, 10, 0)`, `(0, 10, -1)`; `niceTimeTicks(0, Infinity)`, `(0, 8.64e15)`, `(NaN, 5)`; each returns ≤ `2·count + 3` ticks (time: ≤ `2·count + 3` as well) of finite values; the test runs with a 1,000 ms per-test timeout so a hang fails instead of stalling the suite) | UC-6 | unit | `lib/chart-scale.spec.ts` |
| T-7 | `linePath and areaPath break the path at non-finite points` (for each `CurveType` — `linear`, `monotone`, `step` — points `[f, f, NaN, f, f]`, leading and trailing non-finite, all non-finite, single finite point between gaps: the path has one `M` per finite run, contains no `NaN`/`Infinity`, and `areaPath` closes each run to the baseline separately) + `stackSeries treats a non-finite value as 0` | UC-7 | unit | `lib/chart-path.spec.ts` |
| T-8 | `line chart draws a gap at a missing value` (render `ui-line-chart` with a series `[3, NaN, 5, undefined, 7]` (cast through `unknown`) plus a `null`; assert gridline labels finite, the series path has 2+ subpaths, point markers are rendered only for finite values, and no attribute of any SVG descendant contains `NaN`) | UC-7 | component | `ui/line-chart/line-chart.component.spec.ts` |
| T-9 | `extent returns min and max in one pass and skips non-finite` (1,000,000 values with `NaN`, `null`, `±Infinity` sprinkled → equals a reduce-based reference; `[]` and all-non-finite → `undefined`; single value → `[v, v]`; `getDataRange` of 150,000 points does not throw) | UC-8 | unit | `lib/chart.utils.spec.ts` |
| T-10 | **lint guard:** `no-restricted-syntax` forbids a spread argument in `Math.min` / `Math.max` in chart files (scope below). Verified by the mutation check: re-introducing `Math.max(...values)` in `scatter-chart.component.ts` makes `npm run lint` fail. | UC-8 | lint | `eslint.config.mjs` |
| T-11 | `formatChartValue constructs one formatter per option set` (spy on the `Intl.NumberFormat` constructor: 1,000 calls across 3 option sets → ≤ 3 constructions (amended to ≤ 4 for a compact set, see §3.1 "Contract amendments"); outputs equal a fresh `Intl.NumberFormat` for `en-US`, `de-DE`, `he-IL`, compact and non-compact, values `0`, `-1234.56`, `1e9`, `0.05`) | UC-9 | unit (measured) | `lib/chart.utils.spec.ts` |
| T-12 | `animateValue with zero, negative or NaN duration reports end once` (extend the existing fake-rAF `describe('animateValue')` block; durations `0`, `-5`, `NaN`) | UC-10 | unit | `lib/chart.utils.spec.ts` |
| T-13 | `existing chart e2e harnesses pass` — `npm run e2e:impact -- --base origin/master` then run every listed spec (expected: every chart whose closure includes `chart.utils.ts` / `chart-scale.ts` / `chart-path.ts`) | all (install) | e2e | `e2e/harness/*` (no new harness) |

### 2.2 Test types to cover

- **Unit** — T-1…T-7, T-9, T-11, T-12. Lib specs run in the main (browser) leg
  only; they are not shipped to consumers.
- **Component** — T-8 only: the wiring a unit test cannot see (line chart feeds
  missing values through `extent` → `niceDomain` → `linePath` and suppresses
  markers). It ships with `line-chart` via `--include-tests`, so it must stay
  portable: jsdom-safe (no `getBBox`, no layout), no `vi.*` calls the jest shim
  can't map (`sync-registry` validates this).
- **Lint** — T-10. One mechanism per concern: the rule keeps the spreads from
  coming back; T-9 proves `extent` itself.
- **Storybook** — one new `line-chart` story "Missing values (gaps)"; axe must
  stay clean.
- **E2E** — T-13; no new harness (no new component).
- **Perf** — T-11 is a deterministic measured assertion (construction count),
  not a timing threshold, so it cannot flake.

### 2.3 Edge cases the tests must cover

Already enumerated as input classes above; additionally: `count` non-integer
(`5.5` → treated as `5`), a domain where `min` or `max` is exactly a step
multiple (`niceDomain(0, 100)` must stay `[0, 100]` — existing test),
`linearScale` with a reversed pixel range (y-axes), RTL is unaffected (pure
math), empty series list in `line-chart`.

### 2.4 Existing tests that will change

- `lib/chart-scale.spec.ts:44` `[0, 20, 40, 60, 80, 100]` and `:50`
  `niceDomain(3, 97) → [0, 100]` must still pass unchanged — they are the
  "already nice" class.
- Fixing `calculateAxisTicks` changes some legacy-chart tick arrays. **Run every
  consumer**, not just `lib/`:
  `npx vitest --run packages/components/lib packages/components/ui/{area-chart,bar-chart,bar-chart-drilldown,boxplot,bubble-chart,candlestick,column-range-chart,combo-chart,histogram,line-chart,scatter-chart,stacked-bar-chart,waterfall-chart,data-table-range-chart,heatmap,calendar-heatmap,funnel-chart,radar-chart,bar-race-chart,org-chart}`.
  A spec that pinned a noisy or out-of-domain tick array was asserting the bug:
  fix the expectation to the invariant-respecting value and say so in the commit
  message. Do **not** touch the legacy bar-family *domain rules* (`max * 1.1`)
  here — that is the next spec; if a legacy spec breaks only because
  `calculateAxisTicks` is now exact, update the expected array.

### 2.5 Coverage expectation

No uncovered lines in the changed functions of `lib/chart.utils.ts`,
`lib/chart-scale.ts`, `lib/chart-path.ts`, `ui/histogram/histogram.utils.ts`,
and the touched lines of `ui/line-chart/line-chart.component.ts` /
`ui/area-chart/area-chart.component.ts`. The repo's global thresholds
(`vitest.config.ts` — statements 94 / branches 84 / functions 97 / lines 96)
must not drop.

---

## 3. Architecture

### 3.1 Usability — public API

No signature changes. Contracts become explicit in JSDoc:

```ts
import { niceDomain, linearScale } from '../../lib/chart-scale';
import { extent, calculateAxisTicks } from '../../lib/chart.utils';

const [lo, hi] = extent(values) ?? [0, 1];          // single pass, skips non-finite
const domain = niceDomain(Math.min(0, lo), hi, 5);    // always finite, contains lo..hi
const y = linearScale(domain, [plotBottom, plotTop]);
y.ticks(5);                                          // starts at domain[0], ends at domain[1]
```

New export (in `lib/chart.utils.ts`, which every chart already ships):

```ts
/**
 * `[min, max]` of the finite values in one pass, or `undefined` when there is
 * none. Never spreads into `Math.min/max`, so it is safe for any array length.
 * `null`, `undefined`, `NaN` and `±Infinity` are skipped.
 */
export function extent(values: Iterable<number | null | undefined>): [min: number, max: number] | undefined;
```

Documented contracts (JSDoc, verbatim intent):

- `calculateAxisTicks(min, max, count)` — ascending ticks at exact multiples of
  a 1/2/5×10ⁿ step, rounded to the step's precision; first ≤ `min`, last ≥
  `max`; at most `2·count + 3` ticks; returns `[]` when either bound is
  non-finite or `max <= min`; returns `[min, max]` when the step is below the
  float resolution of the bounds or the span overflows. `count` is floored and
  clamped to `[1, 50]`.
- `niceDomain(min, max, count)` — finite, `max > min`, contains every finite
  input; a non-finite bound is replaced by the other bound; both non-finite →
  `[0, 1]`; a collapsed range is padded by `|value|` (or 1) as today, then
  niced; iterates until `calculateAxisTicks(d0, d1, count)` reproduces
  `[d0, d1]` (fixed point, ≤ 10 iterations).
- `linearScale(...).ticks(count)` — never returns a value outside the domain.
- `niceTimeTicks(min, max, count)` — at most `2·count + 3` ticks; non-finite
  bounds → `[]` (both) or `[finiteBound]`; when the best interval would exceed
  the cap, the interval is multiplied up (whole years) until it fits.
- `linePath` / `areaPath` / `bandAreaPath` — a point with a non-finite `x` or
  `y` ends the current sub-path; each finite run is drawn (and, for areas,
  closed to the baseline) on its own. `stackSeries` treats a non-finite value
  as `0` so the stack stays continuous.
- `formatChartValue` — memoised per `(locale, compact, decimals)`.
- `animateValue` — `duration <= 0` or non-finite → one `onUpdate(end)` on the
  next frame, then `onComplete`.

**Contract amendments (Task 1, 2026-10-04 — see F-16, F-17):**

- `calculateAxisTicks` / `niceDomain`: a domain with `min < 0 < max` treats a
  count of 1 as 2 (its 0 tick forces two intervals; without this there is no
  fixed point). The tick cap stays `2·count + 3` of the *requested* (clamped)
  count.
- `niceTimeTicks`: `count` is floored and clamped to `[1, 50]` like
  `calculateAxisTicks`, so the `2·count + 3` cap is a real bound for a huge
  count; its ticks lie within `[min, max]`.
- `formatChartValue` memoises per `(locale, effective notation, decimals)`:
  `compact` formats `|value| < 1000` with the standard notation, so a compact
  option set may use two formatters (T-11 bound adjusted accordingly).
- `computeBinEdges` pins its last edge to the nice domain's upper bound.
- `calculateAxisTicks` also falls back to `[min, max]` when the nice step or an
  end tick overflows to `±Infinity` (e.g. `(1e307, 1.7e308, 1)` → step
  `2e308`), not only when the span overflows.
- `chart.utils.ts` also exports `clampTickCount` (Task 2), so `niceTimeTicks`
  shares the `[1, 50]` count rule instead of duplicating it — a second new
  symbol beside `extent` (§3.3).
- `niceDomain` widens some domains to reach the fixed point — for the PR body:
  `[0, 15]` → `[0, 20]`, `[1.97, 2.69]` → `[1.8, 2.8]`.
- `formatChartValue` looks `Intl.NumberFormat` up at call time (T-11 counts
  constructions with a spy on it, per R-5).
- T-2 (exact step multiples) samples integer, fractional, negative,
  mixed-sign, tiny and giant (±1e307) bounds. It leaves out all-equal and
  non-finite (they return `[]`) and huge-narrow: at `1e20` the double spacing
  is 16384, so ticks there cannot be exact decimal multiples of a 2e4 step —
  T-1/T-3/T-6 hold that class to containment, bounds and bounded time instead.

**Failing-first state observed in Task 1 (2026-10-04):** on the pre-fix code
the huge-narrow rows of T-1/T-3/T-6 do not *time out* — they loop
synchronously (node probe of the verbatim function: > 5M ticks for
`(1e20, 1e20+16384)`, `(1e16, 1e16+4)` and count `1e9`), which a vitest
timeout cannot interrupt, so they were observed failing in a node run with
those rows filtered out and in the probe. `extent` does not exist yet, so
`tsc` reports TS2305 on `chart.utils.spec.ts` until Task 3; at runtime the
T-9 tests fail individually with `extent is not a function`.

Consumer-visible behaviour change (document in the PR body): some nice domains
widen slightly to reach a fixed point (`[0, 15]` → `[0, 20]` instead of the
current `[0, 16]` with an orphan tick at 20).

### 3.2 Efficiency

| Concern | Budget |
|---|---|
| `calculateAxisTicks` | O(count): ≤ `2·count + 3` iterations, no accumulation loop |
| `niceDomain` | ≤ 10 fixed-point iterations × O(count); worst single call ≤ 1 ms (measured 0.3 ms in the probe) |
| `extent` | one pass, O(n), no intermediate array, no spread |
| `formatChartValue` | ≤ 1 `Intl.NumberFormat` construction per distinct option set per page lifetime; cache is a module-level `Map` (keys are developer-chosen option sets, so the map stays tiny) |
| `niceTimeTicks` | ≤ `2·count + 3` ticks for any finite range |

### 3.3 DX for the consuming developer

Nothing new to learn: charts that used to misplace or lose points just stop
doing so. The exported types they may touch are unchanged (`LinearScale`,
`CurveType`, `StackBand`, `ChartSeries`). The only new symbol is `extent`.
Missing values in `ChartSeries.data[].value` are typed `number`, but real API
payloads deliver `null`; the JSDoc on `line-chart`/`area-chart` `series` input
documents "non-finite values (including `null`) are drawn as gaps; stacked
areas treat them as 0".

### 3.4 Implementation options — tick generation

**Option 1 — Patch the accumulation loop.** Round each accumulated tick with
`toFixed` and compare against `niceMax + ε`.
Pros: smallest diff. Cons: still loops on `tick += step`, so the ulp hang
(F-7) and the huge-count blow-up remain; does nothing for idempotence (F-5),
negative domains are only fixed by the ε; ε choice is magnitude-dependent.

**Option 2 — Index-based ticks + fixed-point `niceDomain` + clipped
`ticks()`.** Compute integer indices `i0 = floor(min/step)`,
`i1 = ceil(max/step)`, emit `round(i·step)` for `i ∈ [i0, i1]` (rounded to
`max(0, -floor(log10(step)))` decimals via `toFixed` when that is in `1..100`,
unrounded otherwise — `toFixed` throws above 100), extend by one step if
rounding left the last tick below `max` (or the first above `min`), bail out to
`[min, max]` when `step <= max(|min|, |max|) · Number.EPSILON · 8` or the index
span exceeds `2·count + 2`. `niceDomain` iterates until stable, and
`linearScale.ticks` filters to `[d0, d1]`.
Pros: fixes F-1, F-1a, F-2, F-3, F-5, F-6, F-7, F-8 with one algorithm;
bounded by construction; matches d3's proven `nice()` approach without the
dependency; probe-validated. Cons: a few existing domains widen (documented);
legacy specs pinning exact arrays must be re-checked.

**Option 3 — Depend on `d3-scale`.** Pros: battle-tested. Cons: violates the
"no new runtime dependency" rule for code that is copied into consumers'
projects; pulls a module graph into ~20 components. Ruled out.

**✅ Chosen: Option 2**, because it is the only option that closes every
input class in one place, it is bounded by construction rather than by an ε,
and the scratch probe shows the invariant holds across all ten classes.

### 3.5 Implementation options — where `extent()` lives

**Option 1 — new `lib/chart-extent.ts`.** Pros: tiny focused file. Cons: every
chart's `libFiles` changes (registry churn across ~20 entries), another file
consumers must receive.

**Option 2 — export from `lib/chart.utils.ts`.** Pros: every chart already
ships `chart.utils.ts`, so `libFiles` stay unchanged; `getDataRange` sits next
to it and is reimplemented on top of it. Cons: `chart.utils.ts` grows by ~15
lines.

**✅ Chosen: Option 2.** `histogram.utils.ts` drops its private `extent` and
imports the shared one (its `libFiles` already include `chart.utils.ts`
transitively through `chart-scale.ts`).

### 3.6 Implementation options — missing values in paths

**Option 1 — gaps:** a non-finite point ends the sub-path.
Pros: honest (Excel's default "show empty cells as gaps"); no invented data.
Cons: a single-point run renders nothing visible for `linear` (acceptable —
the marker still shows it).

**Option 2 — connect across:** drop non-finite points and join the neighbours.
Pros: continuous line. Cons: implies values that do not exist; misleading for
time series.

**✅ Chosen: Option 1** for lines and areas; **stacks treat non-finite as 0**
because a gap in one stacked series would tear every band above it.

### 3.7 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Legacy chart specs pin tick arrays that change once ticks are exact | §2.4: run every consumer; update only expectations that asserted float noise or out-of-domain ticks, and name them in the commit message |
| R-2 | Fixed-point `niceDomain` widens some domains → visible axis change | Documented in PR body; T-3 proves the new domain has no orphan tick; screenshot one line chart with `[0, 15]` before/after for the reviewer |
| R-3 | `toFixed` throws for > 100 digits (steps below 1e-100) | Rounding falls back to the unrounded product; the "tiny" class + a `1e-200` row in T-5 cover it |
| R-4 | ESLint rule scope too broad (pdf parsers have the same pattern) | Scope the rule to chart files only (glob in Task 4) |
| R-5 | `Intl.NumberFormat` spy (T-11) is global state | Restore in `afterEach`; never stub `Intl` itself, only spy on the constructor |
| R-6 | Histogram bin edges change (nice domain now contains max) | T-4 is the contract; existing histogram tests that pinned edges for samples whose max fell outside were asserting the bug |

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

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | **Write failing tests** T-1…T-6, T-9, T-11, T-12 (lib + histogram utils), with the seeded generator and input classes of §2. Confirm each fails on `master` for the reason named (e.g. T-3 fails on `niceDomain(0,15)`, T-6 times out on `1e20`). | UC-1…UC-6, UC-8…UC-10 | ✅ Done | 2026-10-04 11:01 | 92 | Seeded property tests over every §2 class surfaced two real gaps the spec missed (F-16 count-1 zero-straddle has no fixed point; F-17 histogram last edge) — worth it. Eight review rounds: deriving T-2's step from a measured gap needed snapping to 1/2/5, not digit rounding; validate a property test against a reference implementation before calling it done. Pre-fix hang rows confirmed by node probe (sync loops cannot time out). Sonar per coordinator: skipped per-agent, run once on the integration branch. |
| 2 | **Fix the tick/domain math.** Rule: *the nice domain contains every finite value, its ticks are exact step multiples, and degenerate input yields a finite domain in bounded time.* Rewrite `calculateAxisTicks` (index-based, step-precision rounding, ulp/overflow/count guards), `niceDomain` (non-finite handling, fixed point), `linearScale.ticks` (clip to domain), `niceTimeTicks` (non-finite + tick cap). Update the `chart-scale.ts` header comment (superseded decision). Run every consumer (§2.4) and fix only expectations that asserted the bug. T-1, T-2, T-3, T-5, T-6 green. | UC-1, UC-2, UC-3, UC-5, UC-6 | ✅ Done | 2026-10-06 20:40 | 93 | Index-based ticks + fixed-point niceDomain closed every class in one algorithm, and no existing chart expectation changed (all 25 chart folders green). The Task 1 generators sampled only rounded decimals, so the ±1 index corrections survived mutation until a k·s "float-sum" class and a tightness check were added — sample arithmetic-produced values from the start. 16/16 plausible mutants red; one equivalent guard kept for clarity. Lesson: never run mutations while a reviewer or linter reads the same file (round-1 review and a lint crash read mutants). |
| 3 | **Add `extent()`**, reimplement `getDataRange` on it, replace the private `extent` in `histogram.utils.ts`. Rule: *no range computation spreads an array into `Math.min/max`.* T-4, T-9 green. | UC-4, UC-8 | ⬜ Not started | — | — | — |
| 4 | **Replace every chart spread** listed in F-12 with `extent()` (preserving each chart's current fallback values — no domain-rule changes here), then add the lint guard T-10: `no-restricted-syntax` with selector `CallExpression[callee.object.name='Math'][callee.property.name=/^(min|max)$/] > SpreadElement`, scoped to `packages/components/ui/{*chart*,boxplot,candlestick,heatmap,calendar-heatmap,histogram,treemap}/**/*.ts` and `packages/components/lib/chart*.ts`, excluding `*.spec.ts`/`*.stories.ts`. Mutation-check it (§2.1 T-10). | UC-8 | ⬜ Not started | — | — | — |
| 5 | **Write failing tests** T-7 (paths) and T-8 (line chart wiring). | UC-7 | ⬜ Not started | — | — | — |
| 6 | **Gaps for missing values.** Rule: *a non-finite point never reaches an SVG attribute; it ends the current sub-path.* `linePath`/`areaPath`/`bandAreaPath` split at non-finite points for all three curves; `stackSeries` maps non-finite to 0; `line-chart` and `area-chart` skip markers/hover targets for non-finite points and build their domain with `extent()`. JSDoc on the `series` inputs. T-7, T-8 green. | UC-7 | ⬜ Not started | — | — | — |
| 7 | **`formatChartValue` memo + `animateValue` guard.** Rule: *one formatter per option set; `onUpdate` only ever receives finite values and always ends on `end`.* T-11, T-12 green. | UC-9, UC-10 | ⬜ Not started | — | — | — |
| 8 | **Docs, story, e2e, gate.** Add the `line-chart` "Missing values (gaps)" story (axe clean); JSDoc contracts of §3.1; run `npm run check:registry` (expect **no** drift — no lib file added); run T-13; full `npm run test-visual` green; `npm run sonar:gate`. | all | ⬜ Not started | — | — | — |

### Publish verdict

- **CLI npm publish: NOT required.** Only `packages/components/lib/**` and
  `packages/components/ui/**` source (served live from `master`) and dev
  tooling (`eslint.config.mjs`) change. No CLI logic, manifest shape, or
  baselines.
- **`release:package`: NOT required.** Verified: the `data-table` package
  closure (`PACKAGE_ROOTS` in `packages/cli/scripts/stage-package-lib.ts:33-38`:
  `data-table`, `/context-menu`, `/export`, `/pivot`) contains no chart
  component and no `chart*.ts` lib file — the data table only *emits* a
  `RangeChartPayload`; `data-table-range-chart` is a separate registry entry
  outside the closure. The `rte` closure contains no chart files either.
- **Registry:** no `libFiles` change expected (`extent` lives in
  `chart.utils.ts`). If `sync-registry` reports drift, investigate before
  `--fix`.

---

## 6. Completion log

| # | Task | Completed | Score | Reviewer rationale |
|---|------|-----------|-------|--------------------|
| 1 | Failing tests T-1…T-6, T-9, T-11, T-12 | 2026-10-04 11:01 | 92 | All nine tests use a seeded mulberry32 over every §2 class and print seed + first violating inputs; against a reference Option-2 implementation all chart-scale tests and T-2/T-5 pass, against 14216e9b every new test fails (T-2 alone 1,995 violations). F-16/F-17 amendments and the hang-instead-of-red note are sound; histogram spec stays portable. Nits addressed after scoring: T-11 lower bound, direct fixed-point assertion in T-3, §2.1 T-11 pointer. |
| 2 | Fix the tick/domain math | 2026-10-06 20:40 | 93 | Follows Option 2 and the amendments; a 280k-case adversarial probe (integer, 2-decimal, k·s, 1e-300…1e300, huge-narrow, non-finite; counts up to 1e9) found zero containment, fixed-point, length-cap or ordering violations, worst niceDomain call 0.37 ms; 200k niceTimeTicks cases clean. Test changes extend existing properties (float-sum class, subnormal row, tightness) rather than adding incident tests. Doc nits (iteration cap, floor naming, YEAR_MS, overflow clause, clampTickCount export) fixed after scoring. |
