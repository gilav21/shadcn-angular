# Data Table & Rich Text Editor — Feature Roadmap Spec

> **Status:** living document. Workstream 1 / A1 implemented; rest pending.
> **Constraint (hard):** strictly self-contained — no new runtime deps, no
> required backend. AI ships only as a bring-your-own-provider callback that
> degrades gracefully (mirrors the existing `mentionSearch` / `imageUploader`).

## Context

The data table is positioned to "replace 99% of ag-grid use cases" and the rich
text editor is already a dependency-free Notion/Word-class component. Both are
feature-complete enough that the valuable work is **closing genuine gaps** and
adding **delighters**, not rebuilding basics.

This spec captures the approved roadmap: three independent workstreams shipped
as separate branches / PRs. Brainstorm catalog and scoring live in
`C:\Users\dasha\.claude\plans\i-want-you-to-cheeky-bunny.md`.

### Scope decisions

- **Cut: A3 status bar.** ~70% overlapped the existing footer aggregations
  (`showFooter` + `aggregateFn`). Its only net-new bit — live aggregates of a
  *selected cell range* — is folded into **A2**. The demo's hand-rolled
  `selectionCount()` stays demo-side.
- **Cut: all editor power-ups (category C)** — margin comments, track changes,
  callout blocks, math, embeds, footnotes, multi-column, PDF/DOCX export.
  ("More code for things I don't believe in.") The editor still gains AI via D1.

## Workstreams (build order)

1. **WS1 — ag-grid wow bundle**: A1 conditional formatting + A2 range-selection
   actions (live aggregate readout + charts). Zero external surface.
2. **WS2 — Excel fill bundle**: B1 fill handle, B2 smart paste, B3 edit undo/redo.
3. **WS3 — AI hook**: `aiProvider` callback on both components.

Every workstream owes the `.claude/CLAUDE.md` gate: `OnPush`, `class` input,
`data-slot` hooks, a11y + RTL, touch parity, responsive, SonarQube zero-issues,
tests for both modes, Storybook, demo page, `e2e:scaffold` coverage, and a
registry-publish check.

---

## WS1 · A1 — Conditional formatting  *(IMPLEMENTED)*

**Goal:** value-driven cell styling declared on the `ColumnDef`, no custom cell
component required. Two usage modes preserved: project a `component`/`template`
for full control (formatting is *not* applied there); use the simple inputs
below for the common case.

### Public API — new optional `ColumnDef<T>` fields

```ts
cellClassRules?: CellClassRule<T>[];                                   // value → CSS classes
cellStyleRules?: (value: unknown, row: T) => Record<string,string> | undefined;
colorScale?: ColorScale;        // { min, max, from, to } heat-map background
dataBar?: DataBar;              // { min, max, color, track? } inline Excel data bar
iconSet?: (value: unknown, row: T) => CellIcon | undefined;           // value → glyph prefix

interface CellClassRule<T> { when: (value: unknown, row: T) => boolean; class: string; }
interface ColorScale { min: number; max: number; from: string; to: string; }
interface DataBar   { min: number; max: number; color: string; track?: string; }
interface CellIcon  { icon: string; class?: string; }
interface ResolvedCellFormatting {       // returned by getCellFormatting()
  class: string;
  style: Record<string, string>;
  dataBar: { width: string; color: string; track: string } | null;
  icon: CellIcon | null;
}
```
*(All in `packages/components/ui/data-table/data-table.types.ts`, re-exported via
the barrel `export *`.)*

### Implementation

- **One public resolver**, `getCellFormatting(col, row): ResolvedCellFormatting
  | null`, plus small private helpers (`_hasConditionalFormatting`,
  `_resolveCellClassRules`, `_resolveCellStyle`, `_colorScaleBackground`,
  `_resolveDataBar`, `_toFiniteNumber`, `_positionPercent`). Returns `null` when
  the column declares nothing → unformatted cells render exactly as before, zero
  overhead. Each helper kept small for cognitive-complexity ≤ 15.
- **Color scale & heat** use native CSS `color-mix(in srgb, <to> <pct>%, <from>)`
  — zero-dep, already used elsewhere in the component (tree row tint).
- **Single render site:** the shared `#cellContentTpl` in
  `data-table.component.html`. The value branches (`col.cell` + default) are
  wrapped only when `getCellFormatting` returns non-null, with:
  - `<span data-slot="cell-formatted" class="… {{fmt.class}}" [style]="fmt.style">`
  - `<span data-slot="cell-data-bar">` absolutely positioned behind text (width %)
  - `<span data-slot="cell-icon">` glyph prefix
  - the value text in a `relative min-w-0 truncate` span (paints above the bar).
  - **Not touched:** the ~8 `getCellClass`/`getCellStyle` call sites (those stay
    cached + value-independent). Value-aware work lives only in the template.

### Tests (`data-table.component.spec.ts`, `conditional formatting (A1)` block)

Logic: null-when-undeclared, class-rule matching + join, style rules, color-mix
output, clamped data-bar %, icon resolution. DOM: data bars render with computed
width, icon glyphs + conditional classes appear, no wrapper when undeclared.
**9 tests, green under `vitest --browser=chromium` (304/304 in the file).**

### Demo & Storybook

- Story `ConditionalFormatting` (`data-table.stories.ts`): data bars on Sales,
  icon+class on Growth, color-scale heat on Score.
- Demo section "Conditional formatting" (`data-table-demo.component`):
  `conditionalColumns()` — amount data bar + status icon/classes.

---

## WS1 · A2 — Range-selection actions  *(PENDING)*

**Goal:** select a cell range → live Sum/Avg/Count of the selection + "Chart it"
using the library's existing chart components (no charting dep).

- **DRY refactor:** extract `computeAggregate()`'s body into a pure
  `computeAggregateValue(values, fn: AggregateFn): string` shared by the footer
  and the new readout.
- Read selection via `normalizedCellRange` + `getCellValue`. Build
  `ChartDataPoint[]`/`ChartSeries[]` from `packages/components/lib/chart.types.ts`
  (`getChartColor`, `formatChartValue`); render `ui-bar-chart` / `ui-pie-chart` /
  `ui-stacked-bar-chart` inside a `ui-dialog` with a type switcher.
- New input `enableRangeActions`. Floating bar anchored to the range
  (`data-slot="range-actions"`), `max-w-[calc(100vw-2rem)]`, RTL-aware. Emits
  `rangeChartOpen`. Row/selection counts stay demo-side.

---

## WS2 — Excel fill bundle  *(PENDING)*

- **B1 fill handle:** `data-slot="fill-handle"` at the range corner;
  `(mousedown)`+`(touchstart)` drag to extend a preview, release to fill. Series
  detection (numeric step, date step, trailing-number text, else copy). Applies
  via `applyValueSetter` + `validateEdit`; emits `fillSeries`; one undo entry.
- **B2 smart paste:** `Ctrl/Cmd+V` on a focused cell → parse TSV/CSV → write a
  grid from the focused cell across visible columns; rejects → `editError`;
  emits `cellsPaste`; one undo entry.
- **B3 edit undo/redo:** internal `{apply, revert}` command stack over
  `valueSetter`; `Ctrl+Z`/`Ctrl+Y` in `onTableKeydown`; `canUndo()/canRedo()` +
  `editUndo`/`editRedo` outputs; toolbar buttons. Documents the immutable-data
  contract (re-emits `cellEdit` with inverse values).

---

## WS3 — AI assist via `aiProvider` hook  *(PENDING)*

One optional provider callback powers AI in both components; zero deps; no
provider wired → no AI UI (mirrors `mentionSearch` / `imageUploader`).

```ts
type AiTask = 'rewrite'|'shorten'|'expand'|'fix-grammar'|'translate'|'summarize'
            |'continue'|'custom'|'table-fill'|'nl-filter';
interface AiRequest { task: AiTask; input: string; prompt?: string;
                      context?: Record<string, unknown>; signal?: AbortSignal; }
type AiResult = Observable<string> | Promise<string> | string;   // streaming via Observable
aiProvider = input<((req: AiRequest) => AiResult) | undefined>(undefined);
```

- **Editor:** "✨ Ask AI" on the floating toolbar + `/ai` slash command (guarded
  by `when: () => !!aiProvider`); streams output into a live `TextNode`
  placeholder; Accept/Discard/Retry; save/restore selection via existing
  `savedRange`/`restoreSelection`.
- **Table:** AI-fill a column (apply via `valueSetter`+`validateEdit`, one undo
  entry); natural-language filter (provider returns a JSON filter spec → mapped
  onto `globalFilter`/`columnFilters`, shown as removable chips; provider code is
  never executed, only its data).
- Demo ships a tiny mock provider so AI is exercisable offline / in e2e.

---

## Verification

- Per workstream: `vitest --browser=chromium` (authoritative; headless lacks
  layout — a pre-existing PageDown test only passes in the browser),
  `sonar` skill (zero issues), `e2e:scaffold` + `e2e -- <name>`.
- Full suite `npm run test-visual` — **zero failures tolerated**.
- Registry: run `sync-registry --fix` + `validate-registry`; publish the CLI
  package only if the registry index / CLI / utils actually change.

## Change log (living history)

- **2026-06-22** — Roadmap approved; A3 + category C cut. **A1 implemented**:
  types + `getCellFormatting` resolver + single-site `#cellContentTpl` wiring +
  9 tests (green, 304/304 in file under browser) + story + demo. Branch
  `feat/data-table-conditional-formatting`. A2/WS2/WS3 pending.
