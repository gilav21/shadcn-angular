# Ideas Backlog — 2026-08-19

Survey of the library as it stands, plus candidate work: new components,
features for existing ones, and consumer-DX improvements.

Everything in "Where we stand" was read off the repo, not assumed. Everything
below it is a proposal.

> **Audit pass, 2026-08-19.** Every proposal was re-checked against the source
> and anything already implemented was struck or narrowed. Corrections are
> marked ⚠️ or called out inline. Headline: `data-table` already ships most of
> what was proposed for it, `query-builder` and `stat-card` are extractions
> rather than builds, a datetime picker already exists, and Signal Forms needs
> no Angular-20 escape hatch at all.

**Layout note:** the 10 block components live in their own top-level package,
`packages/blocks/` — *not* under `packages/components/ui/`. That separation
already exists and makes the blocks push cheaper than assumed.

---

## Where we stand (verified)

| Fact | Value |
| --- | --- |
| Registry entries | 163 |
| Angular | 21.2.17 |
| Third-party npm deps across the whole library | **0** |
| e2e harnesses | 159 dirs + multi-component specs in `specs.ts` |
| a11y | axe gate green (`docs/a11y-backlog.md`), 926 story tests |
| Demo routes | 113 |
| CLI commands | init, add, apply, update, diff, merge-report, migrate, doctor, why, search, status, list, change-theme, set-density, set-locale, set-motion, set-radius, set-test-runner |
| Public surface | Storybook + demo app on Netlify; compodoc JSON feeds Storybook autodocs |

Category spread: charts 24, form 24, editor 22, animation 21, navigation 15,
utility 12, data-display 10, overlay 8, feedback 7, layout 7, marketing 4,
auth 3, media 3, settings 2, dashboard 1.

**The shape of that table is the headline.** Charts, form controls, editor and
animation are deep. **Blocks (auth 3 + dashboard 1 + settings 2 + marketing 4 =
10) are the thinnest layer, and blocks are the thing that makes a dev pick a
library on day one.** Layout is similarly thin (7) for a library this size.

Zero npm dependencies is a genuinely rare selling point — it should be stated
louder than "Lightweight" in the README.

---

## 1. New components — ranked

### Tier A — highest leverage

1. **`crud-page` block** (list + filters + table + detail drawer + create/edit
   dialog + confirm-delete). This is the screen every line-of-business Angular
   app builds five of. Every primitive already exists — this is composition,
   not new engineering, and it is the single most persuasive demo artifact the
   library could ship.
2. **`query-builder` — this is an *extraction*, not a build.** ⚠️ Corrected
   2026-08-19: it already exists inside data-table as
   `sub/data-table-filter-builder.component.ts`, with `FilterOperator`,
   `FilterCondition`, `FilterGroup` and `FilterRule` types and an
   `advancedFilter` model. The work is lifting it out into a standalone,
   table-independent component, which is far cheaper than the original
   estimate — and the payoff (a reusable predicate builder) is unchanged.
3. **`form-builder`** — sibling of the existing `page-builder`, emitting a
   schema that renders through the existing `field` + control set. The
   page-builder/page-renderer pair already proves the architecture.
4. **`scheduler` / event-calendar** — day/week/month agenda with events,
   drag-to-move, resize. `calendar` today is a date picker, not a calendar.
   Big, but it is the most common "we had to buy a component" gap.
5. **`time-picker` (standalone, time-only).** ⚠️ Corrected 2026-08-19: a
   *datetime* picker already exists — `date-picker` has a `showTime` input that
   adds the calendar's time-of-day selector and keeps the popup open after a
   day is picked. So the only real gap is picking a time with **no date**
   (opening hours, durations, schedules). Small.

### Tier B — fills obvious holes

6. **`data-list` / description-list** — the read-only counterpart to `table`;
   every detail pane needs one.
7. **`stat-card` / KPI tile — also an extraction.** The `dashboard` block
   already renders the exact pattern inline (`ui-card` + `card-description`
   label + `card-title` value + a `ui-badge` delta, in a
   `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`). Formalise that into a
   component, add trend arrow / sparkline slot, and reuse it in the block.
8. **`banner`** — page-level announcement/system-status bar. `alert` is
   inline, `toast` is transient; neither covers it.
9. **`error-page`** (404 / 500 / 403) and **`result`** (success/failure
   outcome screen). Two files, ships instantly, closes an embarrassing gap.
10. **`app-shell`** — header + `sidebar` + content + breadcrumb wired
    together with the responsive/collapse behaviour already solved once.
11. **`masonry`** — the one layout primitive `bento-grid` doesn't cover.
12. **`page-header`** — title + description + breadcrumb + action slot.
13. **`diff-viewer`** — side-by-side / unified. The CLI already computes diffs
    (`diff`, `merge-report`); a viewer would dogfood well.
14. **`signature-pad`**, **`currency-input`**, **`duration-input`** — small
    form controls, high request frequency, `input-mask` does most of the work.
    `currency-input` is pre-acknowledged in the code: `number-input` carries the
    comment *"The internal parse/format remains locale-neutral (JS Number) — a
    fully locale-aware parse/format is a follow-up task."*

### Tier C — charts (the deep set has specific holes)

15. **`sankey`** and **`treemap`** — the two most-requested chart types absent
    from an otherwise 24-strong set.
16. **`candlestick` / OHLC** — finance dashboards.
17. **`boxplot`** and **`histogram`** — statistical/analytics dashboards.
18. **`network-graph`** (force-directed) — `org-chart` covers hierarchy only.
19. **`geo-map` / choropleth** — expensive (needs topology data); probably a
    deliberate "no", but worth recording the decision.

### Tier D — bigger bets

20. **`whiteboard` / node-flow editor** — nodes, edges, pan/zoom. Large, but
    `page-builder` + `sortable` + `orbit` show the pieces exist.
21. **`spreadsheet`** — `data-table` + fill-handle + formulas. The
    table/editor roadmap already has Excel-fill as a workstream; this is where
    that road ends.
22. **`file-manager` block** — tree + grid + preview, from `tree` +
    `file-viewer` + `virtual-scroll`.

---

## 2. Features for existing components

### Cross-cutting

- **Signal Forms — and Angular 20 support is free.** See the dedicated
  subsection below; this was the open question and it resolved well.
- **SSR / hydration audit.** Only 24 of 127 component folders reference
  `isPlatformBrowser` / `afterNextRender`. That is not proof of a bug, but it
  is unmeasured — an e2e leg that runs `ng build && serve:ssr` against the
  fixture app would turn an unknown into a gate. Given how many Angular
  consumers use SSR, "works under SSR" is a claim worth being able to make.
- **Per-component CHANGELOG.** `update` 3-way-merges upstream changes into
  user-edited files; today the user cannot see *why* a file changed. A
  changelog entry per registry component, surfaced by `update`/`diff`, turns a
  scary merge into an informed one.

### Signal Forms without dropping Angular 20

**Verified against the installed `@angular/forms@21.2.17`.**

The contract is `FormValueControl<T>` (and `FormCheckboxControl` for booleans),
declared in `types/signals.d.ts`:

> *"The value is the only required property in this contract. A component that
> wants to integrate with the `Field` directive via this contract **must**
> provide a `model()` that will be kept in sync with the value of the bound
> `FieldTree`."*

Everything else on the interface — `disabled`, `required`, `pattern`, `min`,
`max`, `errors`, `name`, `focus()` — is **optional** and auto-synced if present.

**The decisive point: satisfying it requires no import from
`@angular/forms/signals` at all.** It is a structural contract. A component
whose `value` is a `ModelSignal` *is* a signal-forms control; a component that
never imports the module compiles identically on Angular 20.

So the answer to "how do we support Angular 20?" is: **we don't have to do
anything.** No addon, no version gate, no conditional import, no peer-dep bump.
Do not defer this.

**What the work actually is** — audited across the 28 `ControlValueAccessor`
components:

| Current shape | Components | Action |
| --- | --- | --- |
| `value = model()` / `checked = model()` | `input-otp`, `checkbox`, `switch` | **Already compliant.** Nothing to do. |
| `value = input()` **+** `valueChange = output()` | `autocomplete`, `select`, `number-input`, `phone-input`, `radio-group`, `slider`, `toggle-group` | Collapse the pair into `value = model()`. |
| `value = signal()` (internal only) | `input`, `textarea`, `rating`, `color-picker`, `input-group-input` | Promote to `value = model()`. |

The middle row is the important one: an `input` + `valueChange` output pair is
the manual expansion of `model()`, so `[(value)]` already works for consumers
today and **the conversion is non-breaking** — the public template API is
identical. But an input/output pair is not a `ModelSignal`, so the `Field`
directive will not accept it. The conversion is both required and free.

Roughly a dozen mechanical, individually-testable component changes, each safe
on Angular 20. Only *demos, docs and tests* that import `form()`, `Field`, or
the validators (`required`, `email`, `min`, `validateAsync`, `validateHttp`, …)
are Angular-21-only, and those never ship to a consumer's app.

This also means the library can claim first-class Signal Forms support earlier
and more cheaply than assumed — the first-mover window argument stands, and the
cost dropped from "28 adapters" to "12 signal conversions".

### `data-table` (the flagship)

**Audited against the source on 2026-08-19. Most of the original proposals were
already built** — `data-table.component.ts` is ~4,000 lines with 100+ inputs.
Corrected status:

| Proposal | Status | Evidence |
| --- | --- | --- |
| Server-side mode | **Already exists** | `localSorting` / `localPagination` / `localFiltering` inputs (set `false` → server-side), `total` input, `sortChange` / `pageChange` / `filterChange` outputs. |
| Row grouping + tree rows | **Already exists** | `groupBy`, `collapsedGroups`, `groupAggregates`; `enableSubRows`, `getChildren`, `setChildren`, `subRowSelectionMode`, `subRowFilterMode`, `subRowsPaginated`; types `GroupRow`, `FlattenedTreeRow`, `SubRowContext`. |
| Column virtualization | **Already exists** | `virtualColumnBuffer`, `virtualAutoColumnWidth`, `virtualVariableRowHeight`, `virtualRecycleComponents`, `virtualAutoThreshold`; type `VirtualScrollState2D`. |
| Keyboard grid navigation | **Already exists** | `handleNavigationKeydown` handles Arrow×4, Tab, Home, End, PageUp, PageDown; Enter/F2 to edit, Escape to clear range. Plus Ctrl+C/V and undo/redo. |
| Cell-editor set | **Mostly exists** | `ColumnDef.editType: 'text' \| 'number' \| 'select' \| 'checkbox'`, plus `editOptions`, `editComponent`, `editTemplate`, `editValidator`, `valueSetter`. |
| Saved views | **Half exists** | `getColumnState()` / `applyColumnState()` cover width / visible / pin / order only. |

Also already shipped and *not* worth re-proposing: Excel fill handle
(`enableFillHandle`, `fillSeries`), clipboard paste (`cellsPaste`), edit
history with undo/redo (`enableEditHistory`), cell range selection, conditional
formatting (`cellClassRules`, `colorScale`, `dataBar`, `iconSet`), floating
filters, row drag with tree mode, pinned columns, AI/NL filter (`enableNlFilter`).

**What actually remains — three narrow items:**

1. **Publish the server-side contract as exported types + docs.** The mechanism
   exists; what is missing is a single typed request/response shape
   (`{sort, filters, page, pageSize} → {rows, total}`) and one worked example.
   Today every consumer re-derives it from six separate inputs. This is the
   item worth doing — it matches the "easy to understand exported types and
   interfaces" goal directly.
2. **Full view state, not just column state.** Extend to
   `getViewState()` / `applyViewState()` covering sorting, multi-sort, column
   filters, `advancedFilter`, and pagination alongside the existing column
   state — one JSON token a consumer can persist as a named view.
3. **`editType: 'date'`** (and probably `'textarea'`, `'autocomplete'`), wired
   to the library's own `date-picker` / `autocomplete`. This is the only real
   hole in the editor set, and it is small.

**ARIA grid semantics are a genuine gap.** Keyboard navigation is complete, but
`role="grid"`, `aria-rowindex`, `aria-colindex`, `aria-rowcount` appear **zero
times** in `data-table.component.html`. With virtualized rows, a screen reader
cannot know where it is in the dataset. This is the one real accessibility debt
found in the audit, and it matters more than any feature above.

### Charts

- **Annotations** — reference lines, bands, thresholds, event markers.
  *Confirmed absent* (no `referenceLine` / `annotation` anywhere; `GaugeThreshold`
  is gauge-specific).
- **Export** — PNG / SVG / CSV. *Confirmed absent* (no `toDataURL` / `toBlob`
  in any chart).
- **Streaming/append mode** — push a point without re-rendering the series.
- Generalize the drilldown pattern (`bar-chart-drilldown`, `pie-chart-drilldown`
  are separate components today) into one shared addon.
- **Cross-chart crosshair sync — the primitive already exists.** `setHover(index)`
  is public and its JSDoc says explicitly *"Exposed so a host can sync the
  highlight with another chart"*, paired with the `pointHover` output. So this
  is not a feature build: add a declarative `syncGroup` input as sugar over the
  existing primitive, and — more importantly — write the recipe down. It is
  currently possible and undiscoverable.

### Others

Audited; several were already built.

**Confirmed still missing — worth doing:**

- `toast` — no `promise()`, `loading()`, `update()`, `info()` or `warning()`.
  The service exposes only `toast` / `success` / `error` / `dismiss` /
  `dismissAll`. The promise API is the valuable one.
- `command` — only `class`, `shouldFilter`, `search` inputs. No async result
  sources, recent/frequent items, or nested pages.
- `file-upload` — no directory drop, no inline crop. Note it has **no upload
  transport at all** (no URL/progress inputs) — it is a validated file picker.
  "Chunked/resumable" therefore means introducing a transport, which is a
  design decision, not an increment. Recommend staying transport-agnostic and
  adding progress inputs instead.
- `virtual-scroll` — **horizontal** virtualization only.
- `kanban` — **swimlanes** only.
- `sortable` — **nested lists** only.
- `stepper` — async/guarded step transitions. `linear` enforces order but there
  is no `canLeave` / `beforeChange` guard hook.
- `tour` — completion persistence (`storageKey`) and branching steps.
- `rich-text-editor` — collaboration (CRDT), comments/suggestions, docx/pdf
  export. None of the 15 existing addons cover these.

**Already exists — dropped from the list:**

- `virtual-scroll` variable-height rows — rows are measured after render and
  the estimate corrected; `minItemHeight` is only the pre-measurement estimate.
- `kanban` WIP limits — `wipLimit` input on `kanban-column` (kanban also
  already has undo/redo history).
- `sortable` cross-list dragging — `group`, `listId`, `accepts`, `itemEnter`,
  `dropRejected` implement it fully.

---

## 3. Consumer DX — where the biggest wins are

The users are devs. Ranked by leverage:

1. **`llms.txt` + a machine-readable usage corpus.** An MCP server already
   exists. Publishing a stable `llms.txt` / per-component usage snippets means
   Cursor/Copilot/Claude users generate *correct* shadcn-angular code on the
   first try. For a copy-paste library, being the one an AI gets right is
   compounding distribution. Highest ratio of impact to effort on this list.
2. **A real docs site.** Storybook + demo app are two half-answers. Devs want
   one page per component: install command, live preview, copy-paste code, and
   an API table. The API table can be generated — `documentation.json`
   (compodoc) is already produced and currently only feeds Storybook autodocs.
3. **"Open in StackBlitz" from every demo page**, plus the exact
   `npx @gilav21/shadcn-angular add <name>` line rendered on the page.
   Time-to-first-render is the metric that decides adoption.
4. **Make the zero-dependency fact loud.** `why <component>` already prints
   file **count** and reverse dependents; add installed **size** (bytes / LOC)
   so a dev can see the cost before adding. README should lead with "0 runtime
   dependencies" — it is the strongest claim the project has.
5. **A theme/token playground** — sliders for radius/density/motion, live
   preview, emits the CSS to paste. The CLI already has `set-density`,
   `set-radius`, `set-motion`, `change-theme`; the visual front-end for them is
   missing and is what people screenshot and share.
6. ~~`add --dry-run`~~ — **already exists** (`add.ts` supports `--dry-run`,
   `--yes`, `--overwrite`, `--path`, `--include-tests`). Dropped.
7. **A recipes/cookbook section** — composed patterns (table + filters +
   drawer, multi-step form with validation, dashboard layout). Devs copy
   patterns, not components.
8. **Publish a supported-versions/upgrade matrix.** README says "built using
   Angular 21, further versions have not been tested" — that sentence costs
   adoption. A tested-matrix line, even a short one, reads as maintained.

---

## 4. Quality gaps found while surveying

- **10 block components have no interactive e2e**: `login`, `signup`,
  `forgot-password`, `dashboard`, `settings-profile`, `settings-account`,
  `pricing`, `hero`, `features`, `faq`. They are covered only by
  `add-all-smoke` (install + production build), so a broken form submit or a
  dead link in a block would ship silently. These are the *first* components a
  new user touches. Verified against `e2e/orchestrator/specs.ts` and
  `e2e/harness/`.
- **`date-range-picker`** exists as a flat `.stories.ts` under `ui/` with no
  registry entry and no folder — either finish it into a component or delete
  the orphan.
- **Directive registry entries** (`input-mask`, `context-menu-attach`,
  `copy-to`, the three `*-context-menu` directives) are filed under `utility`
  and `form`. They are a different kind of thing from components and are hard
  to discover; a `directives` category (or a docs section) would help.
- **`rich-text-editor.ideas.md`** sits inside `ui/` — it belongs in `specs/`.

---

## 5. Decisions — 2026-08-19

Reviewed with the maintainer. Outcome:

- **Tier A — all five approved.** crud-page, query-builder, form-builder,
  scheduler, time-picker/datetime-picker.
- **Tier B — all approved.** data-list, stat-card, banner, error-page, result,
  app-shell, masonry, page-header, diff-viewer, signature-pad,
  currency-input, duration-input.
- **Tier C — take the cheap end only** (ranking and rationale below).
- **Tier D — the infinite canvas is a priority**, designed deep before any
  code. See `specs/infinite-canvas-spec.md`.

### Tier C ranked by real effort

Effort is judged against the existing chart infrastructure in
`packages/components/lib/`: `chart-scale.ts` (linear/band/time/size/sequential
scales, `niceDomain`, `niceTimeTicks`), `chart-path.ts` (line/area/band paths,
`stackSeries`), `chart-polar.ts`, `chart-interaction.ts`, `chart-responsive.ts`,
and the shared types in `chart.types.ts`.

| Chart | Effort | Why |
| --- | --- | --- |
| **histogram** | **Cheapest** | A bar chart plus a binning function. `bandScale` + `linearScale` + the existing `BarRect` type do everything else. |
| **boxplot** | **Cheap** | Quartile math plus one glyph (box + whiskers + outliers). `column-range-chart` already renders min/max ranges — this is that, with more marks. |
| **candlestick / OHLC** | **Cheap** | Body + wicks on a time axis. `timeScale` exists; again very close to `column-range-chart`. |
| **treemap** | **Medium** | Needs a squarified-layout algorithm (~100 lines), but no new scales and no new interaction model. Self-contained. |
| **sankey** | **Medium-hard** | Node layering, ordering, crossing minimisation, ribbon paths. Real algorithm work. |
| **network-graph** | **Deferred** | Force simulation + heavy render perf. **Do not build standalone** — it becomes a layout function over the canvas engine (see the canvas spec §13), which turns it from hard into medium. |
| **geo-map / choropleth** | **Declined** | Requires shipping or fetching topology data; breaks the zero-dependency property. Recording the "no" so it stops resurfacing. |

**Take:** histogram, boxplot, candlestick, treemap. Hold sankey until the four
above are done; drop geo-map; sequence network-graph after the canvas engine.

### Sequencing

1. **Canvas engine phases 1–3** (`specs/infinite-canvas-spec.md`) — the whole
   technical risk of Tier D lives here. Start it early, because if the perf
   budget fails it changes the plan; everything else on this list is
   low-risk work that can proceed in parallel or after.
2. **Blocks push** — crud-page, error-page, result, app-shell, page-header,
   stat-card, plus interactive e2e for the 10 existing blocks. Mostly
   composition of parts that already work; biggest change to the day-one
   impression.
3. **`llms.txt` + docs site with generated API tables.** Distribution work, not
   component work, and it multiplies everything already built.
4. **Signal Forms adapters.** Angular 21 timing is a first-mover window that
   closes once the large libraries ship theirs.
5. **Cheap Tier C charts** — good filler work between the above.

`query-builder` and `scheduler` are the highest-value remaining Tier A items but
are real engineering; schedule them after the blocks push.
