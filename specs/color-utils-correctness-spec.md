# Colour Utils Correctness — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> It was split out of `specs/chart-degenerate-data-spec.md` (which would
> otherwise have exceeded ten tasks). It groups the review's lower-priority
> colour/util findings plus the `chart-brush` global-listener finding — all
> independent of the chart degenerate-data work.
>
> **File overlap (for wave planning):** `lib/chart-scale.ts` — this spec only
> *removes* `sequentialColorScale` and its private HSL parser (lines 165-202);
> `specs/chart-scale-robustness-spec.md` edits lines 1-163 of the same file.
> `ui/heatmap/heatmap.component.ts` and `ui/calendar-heatmap/calendar-heatmap.component.ts`
> — this spec changes one import line each; both chart specs edit other lines.
> Disjoint hunks; merge textually.

**Status:** not started
**Scope owner:** shared lib (colour) + `chart-brush`
**Source:** codebase review 2026-10 (lower-priority chart/colour findings), re-verified 2026-10-03
**Living history:** never delete entries. Mark items done, add new findings
below, link regressions to their origin.

---

## 0. Step 0 — findings re-verified against the source

Probed by running the real TS files through `tsx` (scratch probe, deleted).
✓ = confirmed as stated. ⚠️ = believed vs. true differs, or new.

| # | Claim (as reported) | Verdict | Evidence |
|---|---|---|---|
| C-1 | `readableForeground` (`lib/color.ts:~401`) ignores alpha | ✓ | `color.ts:401-406` drops `bg.a`. `readableForeground('rgba(0,0,0,0.05)')` and `('#00000010')` → `#ffffff` — white text on what renders as near-white. Callers: `chip-list.component.ts:113`, `kanban-card.component.ts:115`, `org-chart.component.ts:320`. |
| C-2 | `parseHsl`/`parseOklch` ignore hue units (`0.5turn` read as 0.5°) | ✓ (+ more) | `parseHslFunc` (`color.ts:115-127`) and `parseOklchFunc` (`:129-142`) use `Number.parseFloat` on the hue. `parseColor('hsl(0.5turn 100% 50%)')` → `{r:255, g:2, b:0}` (red); the browser renders cyan. `3.14159rad` → red, should be cyan. **⚠️ Also:** an oklch chroma percentage (`oklch(70% 50% 200)`, CSS Color 4: 100% = 0.4) is read as `50`; the `none` keyword makes the parse return `null`. |
| C-3 | `sequentialColorScale` interpolates hue the long way (350→10 via 180) and silently goes black on non-hsl input | ✓ (+ more) | `chart-scale.ts:171-202`: midpoint of `hsl(350,…)`→`hsl(10,…)` is `hsl(180, 80%, 50%)` (cyan, should be red). Its private `HSL_PATTERN` only matches the comma syntax, so `#ffffff`→`#1d4ed8` **and** the modern space syntax `hsl(200 80% 90%)` both interpolate through `hsl(0, 0%, 0%)` — black. Consumers: `heatmap.component.ts:144`, `calendar-heatmap.component.ts:123` (their JSDoc at `:81` / `:69` warns the input must be comma-HSL, but nothing enforces it). |
| C-4 | `medianCutPalette` (`lib/color-extract.ts:~218`) stops early and splits at midpoint not median | ✓ | Early stop: `:218-221` `break`s the whole loop when the highest-priority box can't split, even if other boxes can. Probe: 1,000 identical pixels + two distinct reds, `count: 3` → **2 colours**. Midpoint: `:193` `midValue = (min + max) / 2` — Heckbert's median cut splits at the median. The existing test `color-extract.spec.ts:47` ("returns up to `count` colors") only samples equal-population mixes, the one class where midpoint and median coincide. |
| C-5 | `chart-brush` permanent `(window:mousemove)` host listener runs CD on every mouse move app-wide | ✓ (+ mouseup) | `chart-brush.component.ts:36` (plus `:37-39` `mouseup`/`touchend`/`touchcancel`). `onWindowMove` returns early when idle (`mode === 'idle'`), but Angular marks the view dirty for every bound listener invocation, so every mouse move anywhere schedules change detection. The same file already does it right for `touchmove` (`:223-236`: added on gesture start, removed on end). |

**Package impact verified:** `color.ts` and `color-extract.ts` are in the
**`rte` package closure** (`rich-text-editor/colors` → `color-picker`, whose
`libFiles` include both). Hence `release:package -- rte` after merge (see
Publish verdict).

---

## 1. Product Manager section

### 1.1 Business logic

Five small correctness fixes in shared colour code and one chart overlay:

1. `readableForeground` judges contrast against the colour the user actually
   sees — a translucent background composited over its backdrop.
2. `parseColor` reads every CSS hue unit and oklch chroma percentages the way
   the browser does.
3. The heatmap colour ramp interpolates along the shorter hue arc and accepts
   every colour format `parseColor` accepts.
4. Median-cut palette extraction returns the requested number of colours when
   the image has them, and splits at the median.
5. An idle `ui-chart-brush` adds no work to mouse moves elsewhere on the page.

> **Invariants:**
> - *The foreground chosen by `readableForeground` has the higher contrast
>   against `background` composited over the backdrop.*
> - *`parseColor` agrees with the browser's own rendering of every CSS Color 4
>   `hsl()` / `oklch()` value it accepts.*
> - *The sequential ramp passes through the shorter hue arc between its
>   endpoints and never produces a colour that is not between them.*
> - *Median cut returns `min(count, distinct colours)` colours and splits each
>   box at its median.*
> - *`chart-brush` holds window-level pointer listeners only while a gesture is
>   in progress.*

### 1.2 Why the customer wants this

- A developer gives a kanban label or chip a translucent colour
  (`rgba(…, 0.15)` is the common "soft badge" style) and gets **white text on a
  near-white badge** — an axe `color-contrast` failure the helper exists to
  prevent.
- A developer pastes a modern CSS colour (`hsl(0.5turn …)`, `oklch(70% 50% 200)`)
  into the colour picker and gets **a different colour back**.
- A heatmap from red-ish 350° to orange 10° **passes through cyan**; a heatmap
  configured with the brand's hex colours renders **black cells**. The only
  workaround is converting brand colours to comma-HSL by hand.
- "Extract 5 colours" from a photo with a large flat sky returns **fewer than
  5** — the palette UI shows empty swatches.
- A dashboard with a brush strip **re-renders on every mouse move anywhere**,
  measurable as jank on heavy pages.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| UC-1 | A developer calls `readableForeground` with a translucent colour and gets the foreground that reads better on that colour composited over the backdrop (default white; an optional `backdrop` argument overrides it). Opaque colours give the same answer as today. |
| UC-2 | `parseColor` returns, within ±1 per channel, the RGB the browser renders for `hsl()` and `oklch()` values using unitless, `deg`, `rad`, `grad` and `turn` hues, percentage oklch chroma, and the `none` keyword. |
| UC-3 | A heatmap whose ramp runs from hue 350° to hue 10° shows reds/oranges at mid values, never cyan. |
| UC-4 | A heatmap configured with hex, `rgb()`, space-syntax `hsl()`, `oklch()` or named endpoints shows a ramp between those colours, never black (unless an endpoint is black). |
| UC-5 | Median-cut extraction of `n` colours from pixels containing at least `n` distinct colours returns exactly `n` colours, even when one colour dominates the image. |
| UC-6 | Median cut splits each box at the median of its longest axis, so the two halves hold equal pixel counts (up to ties at the median). |
| UC-7 | With an idle `ui-chart-brush` on the page, moving the mouse anywhere triggers no change detection from the brush; mouse and touch drags still work, including when the pointer leaves the strip. |

### 1.4 Explicitly out of scope

- Theme-aware backdrops for `readableForeground` callers (chip-list, kanban,
  org-chart keep calling it with the default white backdrop; resolving the real
  page background is a separate design question).
- Interpolating the heatmap ramp in OKLCH (perceptually better, but changes
  every existing heatmap's colours) — HSL shortest-arc only.
- `kmeansPalette`'s `Math.random` seeding (non-deterministic palettes) — not
  reported, not verified here.
- CSS relative colour syntax, `color()` / `lab()` / `lch()` parsing.
- The other chart overlays' listeners (`chart-tooltip`, `chart-legend` have no
  window listeners — verified by grep).

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.

### 2.1 Traceability

| Test ID | Test name | Proves | Type | File |
|---|---|---|---|---|
| T-1 | `readableForeground picks the higher-contrast foreground on the composited colour` — property (seeded): random RGB × alpha ∈ {0, 0.05, 0.15, 0.5, 0.95, 1} × backdrop ∈ {white, black, `#1e293b`}; the returned foreground's contrast against `composite(bg, backdrop)` ≥ the other's; opaque inputs give the same answer as the current implementation | UC-1 | unit (property) | `lib/color.spec.ts` |
| T-2 | `parseColor matches the browser for every hue unit` — browser oracle: for hues sampled across 0…720° expressed in each unit (unitless, `deg`, `rad`, `grad`, `turn`, negative angles), and oklch with percentage chroma and `none`, paint the CSS string to a 1×1 canvas (`fillStyle` + `fillRect` + `getImageData`) and compare to `parseColor` within ±1 per channel (oklch: ±2, gamut-clipped by the browser) | UC-2 | unit (browser oracle) | `lib/color.spec.ts` (lib specs run only in the real-browser leg) |
| T-3 | `the sequential ramp follows the shorter hue arc` — property: random hue pairs (including pairs straddling 0°/360°, opposite hues 180° apart, and achromatic endpoints), `t ∈ {0.25, 0.5, 0.75}`: the output hue lies on the shorter arc within 1°; saturation/lightness are between the endpoints'; the endpoints themselves are returned unchanged at `t ≤ 0` / `t ≥ 1` | UC-3 | unit (property) | `lib/chart-color-scale.spec.ts` (new; the existing three `sequentialColorScale` tests move here from `chart-scale.spec.ts:137-153`) |
| T-4 | `the ramp accepts every parseColor format` — endpoint pairs in hex (3/6/8 digit), `rgb()`, comma `hsl()`, space `hsl()`, `oklch()`, named: midpoint is not black (unless an endpoint is black) and equals the midpoint computed from the parsed endpoints; an unparseable endpoint makes interior values return the nearer endpoint string, never black | UC-4 | unit | `lib/chart-color-scale.spec.ts` |
| T-5 | `median cut returns min(count, distinct) colours` — extend the existing `color-extract.spec.ts:47` test (it sampled only equal populations) with the classes: one dominant colour (1,000 px) + 2 rare colours, `count: 3` → 3; a single colour, `count: 3` → 1 (tighten `:30`'s `toBeGreaterThanOrEqual(1)` to exactly 1); 5 distinct colours, `count: 8` → 5; 2 distinct colours with 1:99 populations, `count: 2` → 2 | UC-5 | unit | `lib/color-extract.spec.ts` |
| T-6 | `median cut splits at the median` — skewed single-axis distribution (98 px spread over r ∈ 20…22, 2 px at r ∈ 250…251), `count: 2`: nearest-colour assignment puts each half within ±(ties at the median) of 50 px; the equal-population 2-colour test (`:36`) still passes | UC-6 | unit | `lib/color-extract.spec.ts` |
| T-7 | `an idle brush adds no change detection on window mouse moves` — host component rendering `ui-chart-brush` plus a template binding that counts evaluations; dispatch 20 `mousemove` and 5 `mouseup` events on `window` with no gesture active; after `whenStable()` the count is unchanged. The existing drag tests in `chart-brush.dom.spec.ts:71-110` (mouse moves and ups on `window` during a drag, incl. leaving the strip) stay green unchanged | UC-7 | component | `ui/chart-brush/chart-brush.dom.spec.ts` |
| T-8 | `colour consumers still install and render` — `npm run e2e --` for `color-picker`, `eyedropper`, `chip-list`, `kanban`, `org-chart`, `rte-colors`, `rich-text-editor`, `heatmap`, `calendar-heatmap`, `chart-brush` | all (install) | e2e | `e2e/harness/*` (no new harness) |

### 2.2 Test types to cover

- **Unit** — T-1…T-6 (lib; not shipped). T-2 uses the browser as the oracle
  for a spec-defined algorithm (CSS Color 4) instead of hand-computed
  expectations — "for spec-defined behaviour, read the spec".
- **Component** — T-7; `chart-brush`'s specs ship (`testFiles`), so T-7 must be
  portable: no `vi.*` the jest shim can't map, jsdom-safe.
- **Storybook** — `heatmap` story "Hex endpoints" (axe clean); no other new
  options.
- **E2E** — T-8, existing harnesses only.

### 2.3 Edge cases

Fully transparent background (`alpha 0` → the backdrop decides); hue exactly
180° apart (either arc is "shorter" — the implementation must be deterministic:
increase hue); achromatic endpoint (`s = 0`: adopt the other endpoint's hue so
the ramp does not swing through unrelated hues); negative and > 360° angles;
oklch chroma > 100%; median cut with all pixels identical; `count: 1`; empty
pixel array (existing test).

### 2.4 Coverage expectation

No uncovered lines in the changed functions of `lib/color.ts`,
`lib/color-extract.ts`, the new `lib/chart-color-scale.ts`, and
`ui/chart-brush/chart-brush.component.ts`.

---

## 3. Architecture

### 3.1 Usability — public API

```ts
// Unchanged call sites keep working (backdrop defaults to white):
readableForeground('rgba(15, 23, 42, 0.15)');                 // '#000000'
// New optional backdrop for callers that know what is underneath:
readableForeground('rgba(255, 255, 255, 0.1)', '#0f172a');    // '#ffffff'

parseColor('hsl(0.5turn 100% 50%)');   // { r: 0, g: 255, b: 255, a: 1 }

// Moved from lib/chart-scale.ts to lib/chart-color-scale.ts:
import { sequentialColorScale } from '../../lib/chart-color-scale';
const color = sequentialColorScale([0, 100], ['#eff6ff', '#1d4ed8']);
```

```html
<!-- heatmap: any CSS colour format now works -->
<ui-heatmap [data]="cells" fromColor="#eff6ff" toColor="oklch(45% 0.2 264)" />
```

Signature change: `readableForeground(background: string, backdrop = '#ffffff')`.
`sequentialColorScale` keeps its signature; only its module moves (pre-1.0, no
re-export shim — consumers own their copies and `tsc` finds the import).

### 3.2 Efficiency

- `readableForeground` / `parseColor`: O(1); no change.
- Sequential ramp: endpoints parsed once per scale (as today), O(1) per value.
- Median cut: choosing the median per split is O(n log n) per split (sort along
  one axis) vs O(n) today; with the default sample cap (`maxEdge`-downscaled
  image) and ≤ `count` splits this stays well under a frame. Budget: the
  existing `extractDominantColors` test (`color-extract.spec.ts:169`) must not
  slow measurably; if it does, use quickselect.
- `chart-brush`: zero listeners while idle (down from four window listeners).

### 3.3 DX for the consuming developer

- Heatmap `fromColor`/`toColor` JSDoc (`heatmap.component.ts:81`,
  `calendar-heatmap.component.ts:69`) changes from "must be `hsl(h, s%, l%)`"
  to "any CSS colour `parseColor` accepts".
- Exported types touched: none new. `RGBA` stays the colour model.

### 3.4 Implementation options

#### `readableForeground` and alpha

**Option 1 — composite over a `backdrop` parameter (default white).**
Pros: correct for translucent inputs; call sites unchanged. Cons: wrong in a
dark theme when the caller doesn't pass the real backdrop.
**Option 2 — callers resolve the real backdrop from the DOM** (computed
background of the nearest opaque ancestor). Pros: right in every theme.
Cons: DOM reads in three components, SSR concerns — a feature, not a fix.
**Option 3 — treat `alpha < 0.5` as "the backdrop decides".** Cons: a
threshold, not the rule; wrong at alpha 0.4 on saturated colours.

**✅ Chosen: Option 1** — it fixes the helper's contract; Option 2 is listed
out of scope and composes with it later (callers would just pass the backdrop).

#### Hue units

**Option 1 — parse the angle token** (`/^(-?[\d.]+)(deg|rad|grad|turn)?$/`
→ degrees, `none` → 0) per CSS Color 4; oklch chroma `%` → `× 0.4 / 100`.
**Option 2 — let the browser parse** (canvas round trip). Cons: not SSR-safe,
slow, and `color.ts` is pure today.

**✅ Chosen: Option 1**, validated against the browser by T-2.

#### Where the sequential ramp lives

**Option 1 — keep it in `chart-scale.ts` with its own extended parser.**
Cons: a second colour parser to keep in sync with `color.ts`.
**Option 2 — keep it in `chart-scale.ts` and import `parseColor` from
`color.ts`.** Cons: `chart-scale.ts` is in ~15 charts' closures, so every one
of them would start shipping the 433-line `color.ts`.
**Option 3 — move it to a new `lib/chart-color-scale.ts` that imports
`parseColor`/`rgbToHsl`/`formatHsl` from `color.ts`.** Pros: one parser; only
`heatmap` and `calendar-heatmap` gain `color.ts` + `chart-color-scale.ts` in
`libFiles`. Cons: an import path changes for any consumer who imported it from
`chart-scale`.

**✅ Chosen: Option 3.** Output stays `hsl(h, s%, l%)`, so existing ramp
expectations for comma-HSL endpoints (`chart-scale.spec.ts:137-153`, moved)
stay valid.

#### Median cut

**Option 1 — median split + skip unsplittable boxes** (keep them aside and
continue with the next candidate; stop only when no box can split).
**Option 2 — make k-means the default.** Cons: non-deterministic output
(random init), changes every palette.

**✅ Chosen: Option 1** — it is the textbook algorithm (Heckbert 1982) the
function is named after.

#### `chart-brush` listeners

**Option 1 — add `mousemove`/`mouseup`/`touchend`/`touchcancel` window
listeners on gesture start and remove them on gesture end and on destroy**,
mirroring the existing `touchmove` pattern (`chart-brush.component.ts:223-236`).
**Option 2 — keep host listeners but run them outside Angular.** Cons: the
library is used in zoneless apps where "outside Angular" does not apply;
host-listener bindings still mark the view dirty.

**✅ Chosen: Option 1.** Remove the four `host` window bindings; register with
`DestroyRef` so a component destroyed mid-drag leaves no listener behind.

### 3.5 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | Opaque-colour answers of `readableForeground` change | T-1 asserts opaque inputs match the current implementation |
| R-2 | Browser gamut mapping makes the oklch oracle (T-2) disagree for out-of-gamut values | Sample in-gamut oklch values for the strict comparison; ±2 tolerance; document the out-of-gamut behaviour (clip, as today) |
| R-3 | Moving `sequentialColorScale` breaks consumer imports | Pre-1.0 policy: no shim; registry `libFiles` regenerated; release notes name the move |
| R-4 | A component destroyed mid-drag leaves window listeners | `DestroyRef` teardown; T-7 includes destroy-during-drag |
| R-5 | `color.ts` change ships in the compiled RTE package only after a package release | Publish verdict below: `release:package -- rte patch` after merge |
| R-6 | A spec changed while running in a worktree trips the CRLF file-size trap | Run the full suite from the main checkout before the final gate (see project memory on CRLF blobs) |

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
| 1 | **Write all failing tests** T-1…T-7, including the strengthened existing median-cut tests (`color-extract.spec.ts:30,47`) and moving the three `sequentialColorScale` tests into the new `lib/chart-color-scale.spec.ts`. Confirm each fails for the reason Step 0 names. | UC-1…UC-7 | ✅ Done | 2026-10-16 21:19 | 93 | Browser-canvas oracle for CSS Color 4 kept hand-computed expectations out of the colour tests; T-6 uses 98 distinct reds instead of the spec's tie-heavy spread because nearest-colour read-back cannot tell median from midpoint under ties. Reviewer needed four rounds, mostly on listener-lifecycle tests that must go through the DOM `mousedown` path. |
| 2 | **`readableForeground` alpha.** Rule: *the chosen foreground has the higher contrast against `background` composited over `backdrop`.* Add the `backdrop` parameter (default `#ffffff`). T-1 green. | UC-1 | ✅ Done | 2026-10-16 21:45 | 95 | Compositing in unrounded floats keeps near-tie contrast decisions stable and the opaque path is bit-identical to before. Mutations (flipped alpha weight, ignored backdrop) each turned three tests red; the five colour consumers' specs stay green. |
| 3 | **Hue units + oklch chroma %.** Rule: *`parseColor` agrees with the browser for every CSS Color 4 `hsl()`/`oklch()` it accepts.* Shared `parseHue` (unitless/deg/rad/grad/turn/`none`), oklch chroma `%`. T-2 green. | UC-2 | ⬜ Not started | — | — | — |
| 4 | **Sequential ramp.** Rule: *the ramp follows the shorter hue arc and accepts every `parseColor` format.* Create `lib/chart-color-scale.ts`, delete `sequentialColorScale` + `HSL_PATTERN`/`parseHsl`/`lerp` from `chart-scale.ts`, repoint `heatmap` and `calendar-heatmap`, update their `fromColor`/`toColor` JSDoc; `npm run check:registry` then `--fix` (expect `chart-color-scale.ts` + `color.ts` added to both `libFiles`). T-3, T-4 green. | UC-3, UC-4 | ⬜ Not started | — | — | — |
| 5 | **Median cut.** Rule: *return `min(count, distinct)` colours, splitting each box at its median.* T-5, T-6 green; existing `color-extract.spec.ts` green. | UC-5, UC-6 | ⬜ Not started | — | — | — |
| 6 | **`chart-brush` listeners.** Rule: *window-level pointer listeners exist only while a gesture is in progress.* Remove the four `host` window bindings; add/remove on gesture start/end and on destroy. T-7 green; `chart-brush.dom.spec.ts` drag tests green unchanged. | UC-7 | ⬜ Not started | — | — | — |
| 7 | **Docs, story, e2e, gate.** `heatmap` "Hex endpoints" story (axe clean); `npm run docs:regen` (restore `documentation.json` stub before commit); T-8; `npm run test-visual` green; `npm run sonar:gate`. | all | ⬜ Not started | — | — | — |

### Publish verdict

- **CLI npm publish: NOT required.** Lib/component source and `registry.json`
  data only.
- **`release:package -- rte patch`: REQUIRED after merge.** `color.ts` and
  `color-extract.ts` are in the RTE package's frozen closure (via
  `rich-text-editor/colors` → `color-picker`). Run
  `npm run release:package -- rte patch --dry-run` first (see
  `docs/local-gates.md`); the publish itself is manual (2FA).
- **`release:package -- data-table`: NOT required** — no colour or chart file in
  its closure.

---

## 6. Completion log

| # | Task | Completed | Score | Reviewer rationale |
|---|------|-----------|-------|--------------------|
| 1 | Failing tests T-1…T-7 | 2026-10-16 21:19 | 93 | Every red test fails for the reason Step 0 names (rad/grad/turn hues, oklch chroma %, `none`, translucent `readableForeground`, median-cut early stop and midpoint split, idle brush change detection); a scratch shorter-arc ramp passed all chart-color-scale tests and mutants without the arc fold or achromatic hue adoption failed. Nits: endpoint identity only checked for same-hue pairs; the idle-brush test folds three phases. |
| 2 | `readableForeground` alpha | 2026-10-16 21:45 | 95 | Implements the rule exactly: composites the parsed background over the parsed backdrop (white default and fallback) and compares black/white contrast on the unrounded composite; opaque input is unchanged. Tests are a seeded property plus concrete examples with an independent oracle. Nit: the parsed backdrop's alpha is silently ignored, as documented. |
