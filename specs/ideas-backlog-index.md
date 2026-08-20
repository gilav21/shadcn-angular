# Ideas Backlog — Spec Index

Bundle map for `specs/ideas-backlog-2026-08-19.md`, produced with the
`plan-to-specs` skill.

**One bundle = one spec file = one agent, start to finish.**

Bundles are grouped by *shared surface area*, so that two bundles marked
"can start now" never edit the same files and can be run in parallel.

---

## Wave 0 — start immediately, no prerequisites

These touch disjoint files and can all run in parallel today.

| Spec | Scope | Tasks | Why first |
|---|---|---|---|
| `signal-forms-readiness-spec.md` | Convert ~12 form controls to `value = model()` | ~13 | **Touches the most shared files.** Land it before anything else edits form controls, or every later bundle rebases. |
| `layout-primitives-spec.md` | `banner`, `page-header`, `data-list`, `masonry` | ~9 | All-new files, zero conflicts |
| `status-blocks-spec.md` | `error-page`, `result`, `stat-card` (extraction) | ~7 | All-new + one block edit |
| `charts-new-spec.md` | `histogram`, `boxplot`, `candlestick`, `treemap` | ~10 | New chart folders; only *reads* `lib/chart-*` |
| `component-features-spec.md` | `toast` promise API, `command` async/recent/nested, `stepper` guards, `tour` persistence, `kanban` swimlanes, `sortable` nesting, `virtual-scroll` horizontal, `file-upload` directory+crop | ~10 | Disjoint components, one task each |
| `quality-gaps-spec.md` | e2e for the 10 blocks, `date-range-picker` orphan, directives category, move `rich-text-editor.ideas.md` | ~6 | Pure hygiene; no API surface |
| `canvas-engine-spec.md` | Infinite canvas phases 1–3 (transform, culling, edges) | ~12 | **Highest technical risk — start early.** Detailed design already in `infinite-canvas-spec.md` |
| `dx-distribution-spec.md` | `llms.txt`, docs site w/ generated API tables, StackBlitz links, `why` size, recipes, version matrix | ~8 | Docs/tooling only, no component code |

## Wave 1 — needs Wave 0

| Spec | Prerequisites | Scope |
|---|---|---|
| `form-controls-small-spec.md` | `signal-forms-readiness` | `time-picker`, `signature-pad`, `currency-input`, `duration-input` — born signal-forms-compliant |
| `data-table-contracts-spec.md` | — (but conflicts with `query-builder-extraction`; run first) | Server-side contract types, full view state, `editType: 'date'`, **ARIA grid semantics** |
| `charts-features-spec.md` | `charts-new` | Annotations, export (PNG/SVG/CSV), streaming append, `syncGroup` sugar, unified drilldown addon |
| `app-shell-spec.md` | `layout-primitives` (needs `page-header`) | `app-shell` composing header + sidebar + breadcrumb |
| `node-editor-spec.md` | `canvas-engine` | Ports, edges, connect/disconnect on the engine |

## Wave 2 — needs Wave 1

| Spec | Prerequisites | Scope |
|---|---|---|
| `query-builder-extraction-spec.md` | `data-table-contracts` | Lift the filter builder out of data-table into a standalone component |
| `crud-page-spec.md` | `data-table-contracts`, `layout-primitives`, `status-blocks` | The flagship composed block |
| `form-builder-spec.md` | `form-controls-small` | Schema-driven form builder, sibling of `page-builder` |
| `scheduler-spec.md` | `form-controls-small` (needs `time-picker`) | Day/week/month event calendar |
| `component-changelog-spec.md` | `dx-distribution` | Per-component CHANGELOG surfaced by `update` / `diff` |

## Deferred / declined

| Item | Decision |
|---|---|
| `network-graph` | Deferred until `canvas-engine` lands — becomes a layout function, not a chart build |
| `sankey` | Held until the four cheap charts ship |
| `geo-map` / choropleth | **Declined** — needs topology data, breaks the zero-dependency property |
| SSR audit | Low priority, maintainer wants it as a learning exercise — spec later |
| `spreadsheet`, `file-manager`, `whiteboard`, `mind-map` | Downstream of the canvas engine; revisit after `node-editor` |

---

## Conflict map

Two bundles must **not** run in parallel if they appear in the same row:

| Contested surface | Bundles |
|---|---|
| `ui/data-table/**` | `data-table-contracts` → then `query-builder-extraction` → then `crud-page` |
| `lib/chart-*.ts` | `charts-new` → then `charts-features` |
| form control components | `signal-forms-readiness` → then everything else touching forms |
| `ui/canvas/**` | `canvas-engine` → then `node-editor` |

### Not a conflict: the registry

`packages/components/registry.json` and `packages/cli/src/registry/index.ts`
are **generated** — `packages/cli/scripts/sync-registry.ts --fix` writes both
from the component source on disk. Every bundle that adds a component will
have regenerated them, so every bundle appears to contend on them.

**They do not need serialising.** The `spec-waves` skill discards both files
from every incoming branch at merge time and regenerates them once on the
integration branch, where the contents are a pure function of the merged
source. Agents may run `sync-registry --fix` locally so their build passes;
that output is expected to be thrown away.

The same treatment applies to any other generated artifact
(`documentation.json`, coverage output). **If a command produces it, it is
regenerated, never merged.**

---

## Progress

| Spec | Written | Implemented |
|---|---|---|
| `signal-forms-readiness-spec.md` | ✅ 2026-08-20 | ⬜ |
| `layout-primitives-spec.md` | ✅ 2026-08-20 | ⬜ |
| `status-blocks-spec.md` | ✅ 2026-08-20 | ⬜ |
| `charts-new-spec.md` | ✅ 2026-08-20 | ⬜ |
| `component-features-spec.md` | ✅ 2026-08-20 | ⬜ |
| `quality-gaps-spec.md` | ✅ 2026-08-20 | ⬜ |
| `canvas-engine-spec.md` | ✅ 2026-08-20 | ⬜ |
| `dx-distribution-spec.md` | ✅ 2026-08-20 | ⬜ |
| `form-controls-small-spec.md` | ⬜ | ⬜ |
| `data-table-contracts-spec.md` | ⬜ | ⬜ |
| `charts-features-spec.md` | ⬜ | ⬜ |
| `app-shell-spec.md` | ⬜ | ⬜ |
| `node-editor-spec.md` | ⬜ | ⬜ |
| `query-builder-extraction-spec.md` | ⬜ | ⬜ |
| `crud-page-spec.md` | ⬜ | ⬜ |
| `form-builder-spec.md` | ⬜ | ⬜ |
| `scheduler-spec.md` | ⬜ | ⬜ |
| `component-changelog-spec.md` | ⬜ | ⬜ |
