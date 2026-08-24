# Data-table contracts

> Wave 1. No prerequisites, but **run before `query-builder-extraction`** — that
> spec lifts the filter builder out of `data-table`, and both edit the same
> files. Also unblocks `crud-page`.

---

## 1. Why this exists

`data-table.component.ts` is ~4,000 lines with 100+ inputs, and the
2026-08-19 audit found that almost every feature people ask for is **already
built**: server-side mode, row grouping, tree rows, column virtualization,
keyboard grid navigation, the fill handle, clipboard paste, edit history,
conditional formatting.

So this is not a feature bundle. It is the opposite: the component can already
do these things, and what is missing is the **contract** — the exported types,
the single state token, and the semantics — that let a consumer use them
without reverse-engineering six inputs.

Verified against the source on 2026-08-24, on top of the audit:

| Claim | Verified |
|---|---|
| `aria-rowindex` / `aria-colindex` / `aria-rowcount` / `aria-colcount` | **0 occurrences** across `table/` and `data-table/` |
| Roles — *correcting the audit* | Better than "absent". `ui-table` is div-based and already binds `role="table" \| "treegrid"`; header/body/footer are `rowgroup`, rows are `row`, and `ui-table-head` defaults to `columnheader`. The audit's grep looked for literal attributes and missed the bindings — as did mine, twice. |
| The real role gaps | `'grid'` is not an option in `ui-table`'s union, so an interactive grid declares itself a static `table`; and `ui-table-cell` hard-codes `role="cell"`, which is invalid inside a `grid`/`treegrid` |
| `getViewState` / `applyViewState` | absent; only `getColumnState` / `applyColumnState` |
| `editType` | `'text' \| 'number' \| 'select' \| 'checkbox'` — no `'date'` |
| Server-side mechanism | present (`localSorting`, `localPagination`, `localFiltering`, `total`, `sortChange`, `pageChange`, `filterChange`) |

### 1.1 Scope

1. Publish the server-side contract as exported types plus one worked example.
2. `getViewState()` / `applyViewState()` — the whole view, not just columns.
3. `editType: 'date'`, wired to the library's own `date-picker`.
4. **ARIA grid semantics.**

### 1.2 Out of scope

- `editType: 'autocomplete'` — needs async option loading, a debounce policy and
  a value/display split. That is its own task, not a rider on this one.
- Any change to how server-side mode *works*. The mechanism is not broken; only
  its contract is unpublished. Nothing here alters existing behaviour.
- Lifting the filter builder out (`query-builder-extraction`), which is the
  spec that must come after this one.

---

## 2. Use cases

- **UC-1** A screen-reader user on a virtualized 50,000-row table hears which
  row and column they are on, and how many there are in total — not just what
  is currently in the DOM.
- **UC-2** A consumer writes **one** typed function,
  `(query: DataTableQuery) => DataTableResult<T>`, and wires server-side mode
  with it, instead of deriving the request from six separate inputs.
- **UC-3** A user arranges a table — sorts by two columns, filters three,
  hides one, goes to page 4 — saves it as "My open invoices", and gets exactly
  that back tomorrow.
- **UC-4** A date column is edited with the library's `date-picker` rather than
  a raw text box that accepts `31/02/2026`.
- **UC-5** A saved view survives a JSON round trip, and a view saved by an
  older build is rejected cleanly rather than half-applied.
- **UC-6** The table passes the project's axe gate with grid semantics on.

---

## 3. Design

### 3.1 The server-side contract

`DataTableExportQuery` already exists and is *almost* the right shape — global
filter, column filters, primary sort, multi-sort — and deliberately omits
pagination, because an export returns the whole result set.

The paged query is therefore the same vocabulary plus the page, rather than a
second unrelated shape:

```ts
export interface DataTableQuery {
  readonly globalFilter: string;
  readonly columnFilters: Record<string, unknown>;
  readonly sort: SortState;
  readonly sortStates: readonly SortState[];
  readonly advancedFilter: FilterGroup | null;
  readonly page: PaginationState;
}

export interface DataTableResult<T> {
  readonly rows: readonly T[];
  readonly total: number;
}
```

**A `query` output, not a new mechanism.** The audit's finding was that the
mechanism works and the contract is unpublished, so nothing here replaces
`sortChange` / `pageChange` / `filterChange`. The table gains one additional
output that emits a complete `DataTableQuery` whenever any part of it changes.
That is the thing consumers hand-assemble today.

Rejected: an input taking a fetch callback. It would own loading state, error
state, retry and cancellation — a much larger surface, and a second way to do
what `[data]` already does.

### 3.2 View state is versioned

A view token is **persisted by the consumer** — localStorage, a user
preferences row — so it long-outlives the build that wrote it. `getColumnState`
returns a bare array today and gets away with it; a full view state cannot,
because a later field addition would silently half-apply.

```ts
export interface DataTableViewState {
  readonly version: 1;
  readonly columns: DataTableColumnState[];
  readonly sort: SortState;
  readonly sortStates: SortState[];
  readonly columnFilters: Record<string, unknown>;
  readonly advancedFilter: FilterGroup | null;
  readonly globalFilter: string;
  readonly pagination: PaginationState;
}
```

`applyViewState` **rejects an unknown version** rather than applying what it
recognises. Half-restoring a saved view is worse than refusing it: the user
sees a table that is nearly right and cannot tell which parts are stale.

### 3.3 ARIA grid semantics

The real accessibility debt. Keyboard navigation is complete — arrows, Home,
End, PageUp/Down, Enter/F2, Ctrl+C/V — but nothing tells assistive technology
that this is a grid or where in it the user is.

- `role="grid"` on the table — a new member of `ui-table`'s role union, chosen
  over the current `table` because this component ships full keyboard grid
  navigation, cell selection and in-place editing. `aria-rowcount` and
  `aria-colcount` carry the **dataset** totals, not the DOM's.
- `ui-table-cell` becomes `gridcell` when its table is a `grid` or `treegrid`,
  and stays `cell` in a plain table. `role="cell"` inside a grid is invalid, so
  today's `treegrid` (sub-rows mode) is already malformed. The cell learns which
  it is from the table rather than from an input, so no consumer has to know.
- `aria-rowindex` on every row and `aria-colindex` on every cell, **1-based and
  absolute**, counting the header row as row 1.

Absolute indices are the entire point under virtualization: the DOM holds ~30
rows of 50,000, so a screen reader that counts DOM rows announces "row 3 of 30"
and the user is lost. This is why `aria-rowcount` must be the total and not
`rows.length`.

**Risk of doing it badly is higher than not doing it.** `role="grid"` imposes a
required structure — rows inside rowgroups, every child a `gridcell`,
`columnheader` or `rowheader`. A native `<table>` supplies most of that, but
any presentational wrapper row breaks it, and axe reports a partially-formed
grid more loudly than a plain table. Hence T-1 lands with the axe gate green,
before anything else touches the template.

### 3.4 `editType: 'date'`

The value written back must match what the column already holds, so the editor
round-trips through the existing `valueSetter` / `valueGetter` rather than
imposing a `Date`. The library's `date-picker` is the editor; a raw text box is
what lets `31/02/2026` through.

### 3.5 Risks

| Risk | Mitigation |
|---|---|
| **R-1** A partial `role="grid"` fails axe worse than no grid role | T-1 ships only with the axe gate green; grid semantics are added to the whole table at once, not per-feature |
| **R-2** Virtualized rows make DOM position ≠ data position | `aria-rowindex` is computed from the absolute data index; asserted in a test with a virtualized table, not a 5-row one |
| **R-3** A persisted view token outlives its shape | `version` field, and `applyViewState` refuses an unknown version instead of half-applying |
| **R-4** `editType: 'date'` guesses a value type | Round-trips through the column's existing `valueSetter`; the demo covers a string-dated column and a `Date`-dated one |
| **R-5** Emitting `query` on every keystroke floods a server | The output reports state; it does not fetch. Debouncing is the consumer's, and the worked example shows it |
| **R-6** This spec and `query-builder-extraction` edit the same files | Ordering is recorded in the backlog index; this one runs first |

---

## 4. Definition of done (per task)

Unit tests that assert the outcome rather than a proxy, a Storybook story, the
demo page updated, `npm run e2e -- data-table` green, `check:all` clean, and —
for T-1 — a clean axe pass, which the pre-commit hook enforces anyway.

---

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|---|---|---|---|---|---|
| T-1 | ARIA grid semantics | UC-1, UC-6, R-1, R-2 | ✅ | 2026-08-25 | — | The audit's premise was wrong and had to be corrected first. The numbering bug was a layout spacer row, found only because a count came out one too high. |
| T-2 | `DataTableQuery` / `DataTableResult` + `query` output + worked example | UC-2, R-5 | ⬜ | | | |
| T-3 | `getViewState()` / `applyViewState()` | UC-3, UC-5, R-3 | ⬜ | | | |
| T-4 | `editType: 'date'` | UC-4, R-4 | ⬜ | | | |
| T-5 | Bundle close | coverage, Sonar, docs regen | ⬜ | | | |

T-1 is first because it is the one item the audit called out as real debt
rather than missing sugar, and because it touches the template that every later
task also touches.

---

## 6. Completion log

### T-1 ARIA grid semantics — 2026-08-25

**Two commits.** `ui-table` gained a `grid` role and `ui-table-cell` now derives
`cell` vs `gridcell` from the enclosing table through an injection token — which
fixed a live bug, since sub-rows mode already asked for `treegrid` while serving
invalid `cell` children. Then `data-table` declares `grid`, and stamps
`aria-rowcount` / `aria-colcount` on the grid and `aria-rowindex` /
`aria-colindex` on rows and cells.

**Stamped after render rather than bound in the template.** The template renders
rows from six branches — virtual and non-virtual, flat, tree and grouped — plus
detail rows, full-width rows and group headers that occupy real row positions
without appearing in any row array. 15 row sites, 21 cell sites and 5 head
sites, and a per-branch binding would have numbered the branches it knew about
and silently skipped the rest. Numbering from the DOM is the only thing
guaranteed to agree with what was actually rendered.

**A layout spacer was being counted as a row.** `aria-rowcount` came out at 7
for five rows, which is the kind of off-by-one that a test asserting "has an
aria-rowcount" would have sailed past. The body ends with an empty
`ui-table-row` that stretches it to fill its container; it is now
`aria-hidden`, and the stamping skips decorative rows and cells so a filler
header cell cannot shift the column numbering either.

**Column indices are withheld rather than guessed.** DOM order is the true
visual order — pinned-left, centre, pinned-right — but it is only *absolute*
when every column is present. When the middle columns are windowed, the index
is left off. A missing `aria-colindex` is a gap; a wrong one sends the user to
the wrong column.

**Verified by removing the fix.** 9 of the 12 new tests fail with the stamping
disabled. The virtualized case is asserted against 5,000 rows: `aria-rowcount`
reads 5001 while the DOM holds a few dozen, and the indices are absolute rather
than restarting at 1 on every scroll — which is the whole reason UC-1 exists.

884 tests across `table` and `data-table`, e2e green, lint, `tsc` and `ngc`
clean, axe clean via the pre-commit gate.
