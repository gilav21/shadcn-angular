# RTE Improvements + Packaging — Spec Index

> Source plan: `~/.claude/plans/look-at-the-richtext-snuggly-cook.md`
> (approved 2026-09-03). Ideas history: `specs/rich-text-editor.ideas.md`.
> Each spec is self-contained; an agent reads only its spec file.
> Bar: every task row needs a review-gate score ≥ 91 before a dependent spec
> may start.

## Bundles

| # | Spec | Prerequisites | Conflicts with (same files) | Can start now |
|---|------|---------------|-----------------------------|---------------|
| 1 | [rte-dx-trio-and-base-e2e-spec.md](rte-dx-trio-and-base-e2e-spec.md) | none | 2 (toolbar tables); 6 (`e2e/orchestrator/run.ts`, `specs.ts`) | ✅ |
| 2 | [rte-markdown-input-rules-and-block-toolbar-spec.md](rte-markdown-input-rules-and-block-toolbar-spec.md) | 1 | 3, 4 (`rich-text-editor.component.ts`) | after 1 |
| 3 | [rte-find-replace-v2-and-undo-consistency-spec.md](rte-find-replace-v2-and-undo-consistency-spec.md) | 2 | 4 (`rich-text-editor.component.ts`) | after 2 |
| 4 | [rte-consumer-api-pack-spec.md](rte-consumer-api-pack-spec.md) | 3 (reuses `setContent`) | — | after 3 |
| 5 | [cli-install-summary-and-presets-spec.md](cli-install-summary-and-presets-spec.md) | none | — (CLI only) | ✅ |
| 6 | [npm-packages-rte-and-data-table-spec.md](npm-packages-rte-and-data-table-spec.md) | none | 1 (`e2e/orchestrator`); root `package.json` workspaces | ✅ |

## Waves

| Wave | Specs | Notes |
|------|-------|-------|
| 1 | 1, 5, 6 | Three worktrees. 6 is the largest; start it first. 1 and 6 both touch `e2e/orchestrator` — merge 1 first, then rebase 6 (expected conflict: label expansion vs `packages?` field in `specs.ts`). |
| 2 | 2 | Needs 1 merged (toolbar tables, base e2e harness). |
| 3 | 3 | Needs 2 merged (same component file). |
| 4 | 4 | Needs 3 merged (`setContent`, history entries). |

Wave rule: merge each wave to master before the next starts; regenerate the
registry with `sync-registry --fix` rather than merging `registry.json`.

## Publish consequences

| Spec | CLI publish? | Other publish |
|------|--------------|---------------|
| 1, 2, 3, 4 | No (component/lib/demo/e2e source only, served live from master) | — |
| 5 | **Yes** — CLI logic + optional registry field | — |
| 6 | No (scripts under `packages/cli/scripts/` are dev-only, not bundled) | Two new manual `npm publish --access public` steps (2FA), after merge to master |

## Rejected / parked (for the record)

- Whole-closure single-file "compact" install — rejected (selector/DI identity,
  unmergeable updates).
- Per-folder `--compact` layout — feasible (≈70 files for RTE full), parked.
- Parsers-only npm package — subsumed by spec 6.
- Remaining backlog items — listed in `specs/rich-text-editor.ideas.md`.

## Completion log

| Date | Spec | Event |
|------|------|-------|
| 2026-09-03 | all | Specs written from the approved plan. |

## Cross-spec follow-ups (recorded 2026-09-04)

- After spec 4 lands, add `rich-text-view` to spec 6's staged RTE closure
  (it depends on the editor, so `resolveDependencies(['rich-text-editor/full'])`
  will not pull it). If spec 6 lands first, its stage script should accept an
  explicit extra-roots list so this is a one-line change.
- Spec 4 rewrites the wording of spec 1's `customToolbarItems` breaking note
  (`ref.insertText` → `editor.insertText()` instead of `host.insertTextAtCaret`).
- Spec 1 (label expansion) and spec 6 (`packages?` field) both edit
  `e2e/orchestrator/specs.ts`; merge 1 first, rebase 6.
