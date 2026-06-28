# Charts Expansion Spec — Excel/PowerPoint-Flavored Charts + Shared Interactivity

> **Status:** Proposed (not started)
> **Branch:** `worktree-charts-expansion-spec`
> **Scope owner:** charts
> **Living history:** never delete entries from this spec. Mark items done,
> add new findings below, link regressions to their origin.

---

## 1. Context — Why

The library ships **9 chart components** (pie, pie-drilldown, bar,
bar-drilldown, stacked-bar, column-range, bar-race, org-chart,
data-table-range). They are categorical-only and each re-implements its own
inline tooltip. Two gaps block "Excel/PowerPoint"-grade dashboards:

1. **No continuous / time-series charts at all** — no line, area, combo,
   scatter, bubble. Every business dashboard needs a line chart.
2. **No cross-cutting interactivity primitives** — tooltips are copy-pasted
   into each chart, and there is no interactive legend (series toggle), no
   crosshair / nearest-point, no zoom/pan/brush.

**Goal:** add the business-charting set the average Excel/PowerPoint user
expects — plus shared interactivity that lifts *every* chart — **without any
new runtime dependency** and **without changing the look, conventions, or
public API of the existing 9 charts**. Pure SVG + Angular signals, exactly as
today.

**Explicitly out of scope** (per user): ML / data-science visuals (gradient
fields, 3-D, network/Sankey/treemap layout engines). Keep it
business-analyst-friendly.

---

## 2. Hard Constraints (apply to every deliverable)

| Constraint | Rule |
| ---------- | ---- |
| **No new dependencies** | Pure SVG, Angular signals, existing `lib/` utils only. No d3, no charting libs. Verify `package.json` is untouched. |
| **Additive only** | Never edit existing `chart.utils.ts` / `chart.types.ts` signatures or the 9 charts. Append new exports / new interfaces. |
| **Same component line** | Standalone, `ChangeDetectionStrategy.OnPush`, `input()/output()`, `signal/computed`, separate `templateUrl`, `host: { class: 'block' }`, `data-slot`, Tailwind semantic tokens (no per-chart color CSS vars). Clone `bar-chart` (cartesian) / `pie-chart` (polar). |
| **RTL** | Every cartesian chart mirrors the `dir`/`_domRtl`/`isRtl` pattern (§7). |
| **Locales / i18n** | All user-facing strings + number/date formatting go through the i18n + `formatChartValue(locale)` path (§8). No hardcoded copy. |
| **Accessibility** | `role="img"` + `getChartSummary`, per-element `role`/`aria-label`, full keyboard nav, ≥44px touch targets (§9). |
| **SonarQube** | Zero issues; cognitive complexity ≤15; `readonly`; modern APIs; no nested ternaries (§10). |
| **Responsive** | `observeChartWidth`, `viewBox` + `width="100%"`, responsive heights, `max-w-[calc(100vw-2rem)]` overlays (§11). |
| **Touch** | Every drag/hover-reveal has a tap/touch path via `lib/touch.ts` + `pointerToSvg` (§11). |
| **Deeply tested** | Unit (both modes + real behavior) + e2e harness + visual validation per chart (§12). Zero test failures tolerated. |
| **Publish boundary** | Component + lib + `registry.json` data ship **live from master, no npm publish**. Publish only if `ComponentDefinition` shape / CLI logic / baselines change — this spec changes none. |

---

## 3. Existing Infrastructure We Reuse (do not duplicate)

- `packages/components/lib/chart.types.ts` — `ChartDataPoint`, `ChartSeries`,
  `ChartClickEvent<T>`, `RangeDataPoint`, `StackedDataPoint`,
  `DrilldownSeries`, config types (`LegendPosition`, `ChartOrientation`,
  `StackingMode`, `EasingFunction`, `TooltipConfig`, `AxisConfig`,
  `ChartDirection`).
- `packages/components/lib/chart.utils.ts` — `CHART_COLORS` + `getChartColor`;
  `polarToCartesian`, `describeArc`, `getSliceCentroid`; `easingFunctions` +
  `animateValue`; `formatChartValue`, `formatPercentage`; `sumValues`,
  `getDataRange`, `calculateAxisTicks`; `getPointAriaLabel`, `getChartSummary`.
- `packages/components/lib/chart-responsive.ts` — `observeChartWidth(host,
  destroyRef)`.
- `packages/components/lib/utils.ts` — `cn`, `isRtl(el)`.
- `packages/components/lib/touch.ts` — `isTouchDevice`, `onLongPress`,
  `onDoubleTap`.
- Canonical patterns to clone:
  - Cartesian/axis/RTL/tooltip → `packages/components/ui/bar-chart/`.
  - Polar/legend/animation → `packages/components/ui/pie-chart/`,
    `packages/components/ui/bar-race-chart/`.
  - Drag + touch parity → `packages/components/ui/slider/`,
    `packages/components/ui/resizable/`.
- Demo surface → `demo/src/app/demos/charts/charts-demo.component.ts` +
  `charts-demo.locales.ts` (charts are documented on the demo page; only
  `data-table-range-chart` ships a `.stories.ts`).

---

## 4. Deliverables Overview

### New shared lib utilities (Phase 0)
| File | Purpose |
| ---- | ------- |
| `lib/chart-scale.ts` | `linearScale`, `timeScale`, `bandScale`, `sizeScale` (sqrt), `niceDomain`, `niceTimeTicks`, `sequentialColorScale` |
| `lib/chart-path.ts` | `linePath(curve)`, `areaPath(baseline,curve)`, `stackSeries(mode)` |
| `lib/chart-interaction.ts` | `nearestPointX`, `nearestPoint2D`, `pointerToSvg` (mouse+touch) |

### New shared interactivity components (Phase 0)
| Component | Folder | Role |
| --------- | ------ | ---- |
| `ui-chart-tooltip` | `ui/chart-tooltip/` | Reusable positioned tooltip (replaces inline duplication) |
| `ui-chart-legend` | `ui/chart-legend/` | Interactive legend, emits `toggle(key)`; series-hide state owned by host |
| `ui-chart-brush` | `ui/chart-brush/` | SVG zoom/pan/brush overlay (controlled), mouse+touch |

### New chart components (Phases 1–5)
| Phase | Charts |
| ----- | ------ |
| 1 — Line family | `line-chart`, `area-chart`, `combo-chart` (bar+line / Pareto) |
| 2 — Scatter | `scatter-chart`, `bubble-chart` |
| 3 — Radial KPI | `gauge-chart`, `radar-chart`, `bullet-chart` |
| 4 — Heatmap | `heatmap`, `calendar-heatmap` |
| 5 — Funnel/Waterfall | `funnel-chart`, `waterfall-chart` |

**14 new charts + 3 lib files + 3 shared components.**

---

## 5. Phase 0 — Foundation (HARD GATE)

All additive. The 9 existing charts keep compiling; their `libFiles` stay
valid. Phases 1–5 must not start until Phase 0 ships with its own unit tests.

### 5.1 `lib/chart-scale.ts`
Pure functions (no Angular). The missing continuous-axis primitive.
- `linearScale(domain:[number,number], range:[number,number])` → `{ scale(v), invert(px), ticks(count) }`.
- `timeScale(domain, range)` over epoch-ms + `niceTimeTicks(min,max,count)`
  (day/week/month/quarter/year-aligned — the business-calendar case).
- `toEpochMs(v: number | Date): number` — boundary normalizer so time-axis
  inputs accept `Date` or epoch-ms while internals stay numeric (decision §15.3).
- `bandScale(keys, range, paddingInner, paddingOuter)` — formalizes the
  index-based categorical placement bar/stacked charts compute inline today
  (combo needs bars + line on identical band centers).
- `sizeScale(domain, [minR,maxR])` — **sqrt** scale → area-proportional bubble
  radius (correct perceptual encoding).
- `niceDomain(min,max,count)` → padded `[niceMin,niceMax]`. **New**, alongside
  `calculateAxisTicks` (which throws the nice bounds away; `bar-chart` hacks
  `max*1.1`). Do **not** modify `calculateAxisTicks`.
- `sequentialColorScale(domain, [c0,c1])` — HSL interpolation for heatmaps
  (reuse `lib/color.ts` interpolation if present; otherwise add a small HSL
  lerp here).

### 5.2 `lib/chart-path.ts`
- `linePath(points, curve:'linear'|'monotone'|'step')` — `monotone` =
  monotone-cubic (no overshoot, the Excel "smoothed line"); `step` = step
  charts. Extract the cubic-tangent helper to stay <15 complexity.
- `areaPath(points, baselineY, curve)` — closed area to a baseline (supports
  stacked-area where baseline is the prior series' upper edge).
- `stackSeries(series, mode:StackingMode)` → cumulative lower/upper per
  category (stacked area + waterfall running totals). Reuses `StackingMode`.

### 5.3 `lib/chart-interaction.ts`
- `nearestPointX(pointerX, points)` — binary search on sorted x (line/area/
  combo crosshair).
- `nearestPoint2D(pointer, points)` — 2-D nearest via `Math.hypot` (scatter/
  bubble).
- `pointerToSvg(evt, svg)` — single normalizer for `MouseEvent` **and**
  `TouchEvent` (`touches[0]`) through the SVG CTM. Every chart's pointer math
  routes here → touch parity inherited everywhere.

### 5.4 `ui-chart-tooltip` (`ui/chart-tooltip/`)
Component (renders positioned content). `index.ts` barrel. Selector
`ui-chart-tooltip`, `data-slot="chart-tooltip"`.
- Inputs: `visible`, `x`, `y`, `title`, `rows:{label;value;color}[]`,
  `formatter?`, `class`.
- Reproduces the exact existing markup
  (`absolute z-50 px-3 py-2 bg-popover text-popover-foreground rounded-md
  shadow-lg border pointer-events-none`) → visually identical to today.
- Adds the missing `max-w-[calc(100vw-2rem)]` + edge-flip the inline version
  lacks (also fixes `bar-chart`'s latent `tooltipPosition` 0,0 bug when it
  migrates).
- **Migration is incremental:** new charts consume it from day one. The 9
  existing charts are untouched here; a **separate later PR** swaps each inline
  block chart-by-chart (each behavior-preserving, adds `chart-tooltip` to that
  chart's registry `dependencies`).

### 5.5 `ui-chart-legend` (`ui/chart-legend/`)
Selector `ui-chart-legend`, `data-slot="chart-legend"`.
- Inputs: `items:{key;label;color}[]`, `hidden:Set<string>`,
  `position:LegendPosition`, `interactive` (default true), `class`.
- Output: `toggle = output<string>()` (series key).
- **State model:** host chart owns `signal<Set<string>>` of *hidden* keys and
  filters its own series `computed`. Legend is presentational + emits.
  Keyboard: each item `role="button"`, `tabindex=0`, Enter/Space toggles; tap
  works on touch (click, no hover dependency).

### 5.6 `ui-chart-brush` (`ui/chart-brush/`)
Selector `ui-chart-brush`, `data-slot="chart-brush"`. SVG `<g>` overlay inside
the plot area; controlled (`selection` input in **domain units** +
`selectionChange` output). Chart derives a zoomed domain `computed` and feeds
it back into the scale (no data mutation).
- **Touch+mouse parity** (model on `slider`/`resizable`): every `(mousedown)`
  create/move/resize paired with `(touchstart)` + `touch-action:none`; window
  `mousemove/mouseup` paired with `touchmove/touchend`; pointer math via
  `pointerToSvg`. Visible reset/zoom-out button (no wheel-only zoom; wheel is
  optional desktop enhancement). Optional `axis:'x'|'xy'` for 2-D scatter
  selection.
- Used only by dense cartesian charts (line/area/combo/scatter/bubble).

---

## 6. Phases 1–5 — Per-Chart Detail

Each chart: folder `ui/<name>/` with `<name>.component.ts/.html`, `index.ts`
barrel (+ `sub/` only if it has sub-components); OnPush; `dir`/RTL;
`observeChartWidth`; `role="img"` + `getChartSummary`; `data-slot`; Tailwind
semantic tokens; new types **appended** to `chart.types.ts`.

### Phase 1 — Line family (unlocks + validates cartesian foundation)
Build order: line → area → combo.

- **`ui-line-chart`** — Inputs: `series:LineSeries[]`, `width/height`,
  `xAxis/yAxis:AxisConfig`, `curve:CurveType`, `showPoints`, `showGrid`,
  `showTooltip`, `showLegend`, `xScaleType:'category'|'linear'|'time'`,
  `zoomable`, `class`, `title`, `dir`. Uses `chart-scale`, `chart-path.linePath`,
  `chart-interaction` (crosshair), `chart-tooltip`, `chart-legend`, optional
  `chart-brush`. Outputs `pointClick`/`pointHover:ChartClickEvent`. New types:
  `CurveType='linear'|'monotone'|'step'`, `XScaleType`, `XYDataPoint{x;y;label?}`,
  `LineSeries` (new interface — do **not** widen `ChartSeries.data`).
- **`ui-area-chart`** — extends line: `stacked`, `stackingMode:StackingMode`,
  `fillOpacity`, `gradient`. Uses `areaPath` + `stackSeries`. Stacked-area is a
  required deliverable.
- **`ui-combo-chart`** (bar+line / Pareto) — `barSeries`, `lineSeries`,
  `secondaryYAxis:AxisConfig` (dual axis: bars left, cumulative-% line right),
  `showCumulative` helper to auto-build the Pareto line. `bandScale` for bars,
  `linearScale` per axis. New type `ComboSeriesConfig{type;axis;…}`.

### Phase 2 — Scatter / bubble (validates continuous-x + 2-D brush)
- **`ui-scatter-chart`** — `series:XYSeries[]`, `xAxis/yAxis`, `pointRadius`,
  `showGrid/Tooltip/Legend`, `zoomable`. Both axes `linearScale`; nearest via
  `nearestPoint2D` (`Math.hypot`). New: `XYSeries`.
- **`ui-bubble-chart`** — extends scatter: `XYZDataPoint{x;y;z;label?}`, `z` →
  radius via `sizeScale`, `minRadius/maxRadius`. Tooltip shows x/y/z rows.

### Phase 3 — Radial KPI (reuses polar helpers, no cartesian scale)
- **`ui-gauge-chart`** — `value`, `min`, `max`, `thresholds:{value;color}[]`,
  `startAngle/endAngle` (default 180°), `label`, `unit`, `animated` (reuse
  `animateValue`). Uses `describeArc`. New: `GaugeThreshold`, `RadialConfig`.
- **`ui-radar-chart`** — `axes:string[]`, `series:ChartSeries[]`, `levels`,
  `showLegend`, `fillOpacity`. Append polar helpers to `chart.utils.ts`:
  `radarPoint(...)`, `polygonPath(points)`. Legend via `chart-legend`; vertex
  tooltip via `chart-tooltip`. New: `RadarSeries`.
- **`ui-bullet-chart`** — linear KPI (Stephen Few): `value`, `target` marker,
  `ranges:number[]` qualitative bands, `orientation`. Reuses `linearScale`.
  Cheap, high business value.

### Phase 4 — Heatmap family
- **`ui-heatmap`** — `data:{row;col;value}[]`, `colorScale:ColorScaleConfig`,
  `showValues`, `showLegend` (gradient legend). Cells `<rect>`; tooltip via
  `chart-tooltip`; color via `sequentialColorScale`. New: `HeatmapCell`,
  `ColorScaleConfig`.
- **`ui-calendar-heatmap`** (GitHub contributions) — `data:{date;value}[]`,
  `startDate/endDate`, `weekStart`, `colorSteps`. Week-column/day-row grid via
  `timeScale` + date math; RTL flows weeks right-to-left; date+value tooltip.
  New: `CalendarDay`.

### Phase 5 — Funnel / waterfall
- **`ui-funnel-chart`** — `data:ChartDataPoint[]`, `orientation`,
  `showPercentages` (vs first / vs previous), `gap`. Trapezoid `<polygon>` per
  stage; RTL-aware narrowing. New: `FunnelStage`.
- **`ui-waterfall-chart`** — `data:{name;value;type?:'relative'|'total'}[]`,
  `showConnectors`, `positive/negative/totalColor`. Running totals via
  `stackSeries` logic; floating bars + connectors. New: `WaterfallBar`,
  `WaterfallPointType`.

---

## 7. RTL Adherence

Every cartesian chart (line/area/combo/scatter/bubble/combo/heatmap/calendar/
funnel/waterfall/bullet) clones the `bar-chart` RTL pattern verbatim:
```ts
dir = input<ChartDirection>('auto');
private readonly _domRtl = signal(false);
isRtl = computed(() => this.dir() === 'auto' ? this._domRtl() : this.dir() === 'rtl');
ngAfterViewInit() { this._domRtl.set(isRtl(this.el.nativeElement)); }
```
- Plot padding, axis side, category direction, tooltip anchoring, brush
  handles, legend item flow all key off `isRtl()`.
- Calendar-heatmap weeks flow right-to-left; funnel narrows toward the inline
  end; gauge/radar are direction-neutral but their **labels/legends** still
  respect RTL text flow.
- **Verification:** each chart's e2e + visual-validate runs an RTL viewport
  (`dir="rtl"`) and compares mirrored geometry. Unit test asserts `isRtl()`
  flips a representative coordinate.

---

## 8. Locales & i18n

- **No hardcoded user-facing strings.** Default labels (legend "Other", axis
  fallback titles, gauge unit, funnel "vs previous", brush "Reset zoom") go
  through the project i18n path used by existing charts/demo
  (`charts-demo.locales.ts` + the component-i18n mechanism in
  `specs/component-i18n-spec.md`). Any new default copy is added to **all
  locale bundles**.
- **Numbers/dates:** all value formatting uses `formatChartValue(value,
  {compact, decimals, locale})` and `formatPercentage`; calendar-heatmap dates
  use `Intl.DateTimeFormat(locale)`. `locale` is an input (mirroring
  `bar-race-chart`'s `locale`) defaulting to the app locale.
- **Verification:** unit test passes `locale:'de-DE'` and asserts a formatted
  axis tick uses the locale separator; demo page exercises an RTL+non-EN
  locale.

---

## 9. Accessibility

- Container: `role="img"` + `aria-label` from `getChartSummary(type, count,
  title)`.
- Interactive marks (points, bars, slices, cells, legend items, brush handles):
  `role="button"`, `tabindex=0`, `aria-label` from `getPointAriaLabel`,
  Enter/Space activation mirroring `bar-chart`/`pie-chart`.
- Crosshair/tooltip content is also exposed via `aria-live="polite"` region so
  keyboard users hear the focused datum.
- Legend toggle announces hidden/shown state (`aria-pressed`).
- Touch targets ≥44×44px (global `@media (pointer:coarse)` baseline; verify
  small marks like scatter points get an invisible ≥44px hit area on touch).
- **Verification:** unit tests assert roles/aria-labels/keyboard handlers
  exist and fire; `ux-review` skill pass per chart.

---

## 10. SonarQube Compliance

Apply CLAUDE.md §4 from the first line:
- `readonly` on all never-reassigned members (signals, computed, outputs,
  `el`, `destroyRef`, arrow props).
- No `any` — generics or `unknown`; no unnecessary `as`.
- Modern APIs: `Math.hypot` (2-D distance), `Number.isNaN`/`Number.parseFloat`,
  `structuredClone`, `.dataset`, `String.fromCodePoint`, `globalThis`.
- Cognitive complexity ≤15 — push scale/path/curve math into `lib/` pure
  helpers; use early returns; **no nested ternaries** (do NOT copy
  `bar-chart.component.html`'s nested ternary into new charts).
- Merge duplicate imports; extract repeated unions into type aliases
  (`CurveType`, `XScaleType`, `WaterfallPointType` already do this).
- **Verification:** run the `sonar` skill on every new `.ts`/`.html` before
  closing the chart; zero issues required.

---

## 11. Responsive & Touch

- `observeChartWidth(el, destroyRef)`; SVG `viewBox` + `width="100%"`;
  `svgWidth = computed(() => measured() ?? width())`.
- Responsive heights `h-[…] sm:[…] md:[…]`; every overlay (tooltip, legend
  popout, brush label) gets `max-w-[calc(100vw-2rem)]`.
- Touch (CLAUDE.md §6): brush drag + crosshair hover + legend toggle all have
  touch paths via `pointerToSvg` + `lib/touch.ts`; no hover-only or
  wheel-only or dblclick-only interaction.
- **Verification:** e2e runs at 320/375/768/1920 widths and asserts no
  horizontal overflow; a touch-emulation e2e drives brush + tooltip via
  `touchstart/touchmove/touchend`.

---

## 12. Testing & Verification (deeply tested — non-negotiable)

Per chart, all of:
1. **Unit `<name>.component.spec.ts`** — real behavior, not just creation:
   scale domain→pixel correctness, `linePath`/`areaPath` output shape, nearest-
   point index selection, legend toggle hides a path, brush domain transform,
   RTL coordinate flip, locale-formatted tick, aria roles/keyboard. Run
   `npm run test`.
2. **Lib unit tests** for `chart-scale.ts`, `chart-path.ts`,
   `chart-interaction.ts` (pure-function fixtures — exact numeric assertions).
3. **e2e** — `npm run e2e:scaffold -- <name>` then extend
   `e2e/harness/<name>/<name>.spec.ts` with real assertions (SVG
   `path/rect/circle` counts, tooltip appears on hover, legend toggle removes a
   series, brush zooms). Do **not** edit `specs.ts` for single-component specs.
   Run `npm run e2e -- <name>` and `npm run e2e:impact` after each.
4. **Visual validation** — `visual-validate` skill comparing rendered output
   vs a reference (LTR + RTL) page-by-page. Never self-verify visuals.
5. **Full suite gate** — `npm run test-visual` must show **zero** failures
   before a phase is considered done (pre-existing failures count).
6. **Review gate** — run `review-gate` per chart; advance only at ≥91; record
   score + rationale in this spec's Completion Log.
7. **No-dependency check** — `git diff package.json package-lock.json` must be
   empty after every phase.

---

## 13. Cross-Cutting Work (per chart)

1. Folder + `index.ts` barrel (sub-components in `sub/`).
2. `sync-registry --fix` — never hand-edit `registry.json`. Verify
   `category:"charts"`, folder-prefixed `files[]`, complete `libFiles[]`
   (`chart.types.ts`, `chart.utils.ts`, `chart-responsive.ts`, +
   `chart-scale.ts`/`chart-path.ts`/`chart-interaction.ts` as used), and
   `dependencies` listing `chart-tooltip`/`chart-legend`/`chart-brush`. Confirm
   with `npx shadcn-angular why <name>`.
3. **Storybook story** — in-folder `<name>.stories.ts` (CSF3) covering all
   inputs/variants (decision §15.1). **And** a demo section in
   `demo/src/app/demos/charts/charts-demo.component.ts` + strings in
   `charts-demo.locales.ts` (copy-paste-ready example).
4. Responsive + touch + a11y + sonar passes (§9–11).
5. Publish boundary: ships live from master; **no** pending-release entry
   (no CLI/manifest/baseline change).

---

## 14. Sequencing, Risks & Gates

1. **Phase 0 is a hard gate** — line/area/combo all depend on `chart-scale`,
   `chart-path`, `chart-interaction`, `chart-tooltip`, `chart-legend`. Ship
   Phase 0 with its own lib unit tests first. `chart-brush` may land in
   parallel with Phase 1 (only `zoomable` depends on it).
2. **Never destructively refactor the 9 existing charts.** Shared primitives
   are additive; migrating existing inline tooltips is a separate later
   chart-by-chart PR.
3. **Extend, never edit** `chart.utils.ts`/`chart.types.ts`. Add `niceDomain`/
   `niceTimeTicks` beside `calculateAxisTicks`; add `LineSeries`/`XYSeries`/
   `XYDataPoint` as new interfaces.
4. **Touch parity on brush/crosshair** is the highest-risk §6 area — centralize
   in `pointerToSvg`; model on `slider`/`resizable`.
5. **`libFiles` drift** is the top e2e failure mode — re-run `sync-registry
   --fix` + `npm run e2e:impact` after each chart.
6. **No-dependency invariant** — CI/local check that `package.json` /
   `package-lock.json` are untouched after every phase.

### Recommended order
Phase 0 → Phase 1 (line/area/combo) → Phase 2 (scatter/bubble) →
Phase 3 (gauge/radar/bullet) → Phase 4 (heatmap/calendar) →
Phase 5 (funnel/waterfall). Each phase independently shippable.

---

## 15. Resolved Decisions

1. **Storybook for charts — YES.** Every one of the 14 new charts ships an
   in-folder `<name>.stories.ts` covering all inputs/variants (CSF3, same
   style as `data-table-range-chart.stories.ts`). This is a deliberate
   departure from the demo-page-only convention of the legacy 9 charts — the
   new charts get **both** a Storybook story **and** a demo-page section.
   `.stories.ts` is test scaffolding (not a shipped registry entry).
2. **Bullet chart — INCLUDED** in Phase 3 (`ui-bullet-chart`), alongside gauge
   and radar.
3. **Time-scale data shape — epoch-ms internally, `Date` accepted at the API.**
   `timeScale` and `XYDataPoint.x` operate on `number` (epoch-ms) internally;
   inputs accept `number | Date` and a small `toEpochMs(v)` helper in
   `chart-scale.ts` normalizes `Date → number` at the boundary. Keeps internal
   math simple while staying ergonomic for callers.

---

## 16. Completion Log

> Append reviewer scores + rationale per chart/phase here. Never delete.

| Date | Phase / Chart | Review-gate score | Notes |
| ---- | ------------- | ----------------- | ----- |
| _pending_ | Phase 0 foundation | — | not started |
