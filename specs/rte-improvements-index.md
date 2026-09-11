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


## Follow-ups from the fine-comb review of PR #131 (2026-09-10)

Recorded here rather than done in the PR because each changes a shared
mechanism beyond the RTE.

| # | Follow-up | Why | Where |
|---|-----------|-----|-------|
| F1 | Let the browser canonicalise CSS before judging it: assign the declaration to a detached element, read back `cssText`, then run the function allowlist. | Retires the hand-written escape/comment decoders as the only line of defence; keep the backslash refusal as belt-and-braces. | `rich-text-sanitizer.service.ts` `isStyleValueAllowed` |
| F2 | An overlay layer stack: dialog, sheet, drawer and popover register on open; only the top-most layer consumes Escape. | The popover fix consumes Escape in capture, which is right for one nested layer and ad hoc for three. | new `lib/overlay-stack.service.ts`, the four overlay components |
| F3 | `sanitizeSvgDataUrl`: decode percent-encoded payloads with `percentDecodeToBytes` + `TextDecoder` instead of `decodeURIComponent`. | A stray non-UTF-8 byte is scrubbed instead of silently dropping the image. | `rich-text-sanitizer.service.ts` |

| F4 | Toolbar roving tab stops: compute the stop list from an `afterRenderEffect` keyed on `items()`/`addonSlots()`/`compact()` instead of `ngAfterViewChecked`, which re-queries the DOM and reads `offsetParent` on every change-detection pass. | One `querySelectorAll` plus ~25 layout reads per caret move today. | `sub/rich-text-toolbar.component.ts` |
| F5 | Share `resolveBaseRef` / `changedFilesSince` / dirty-tree and branch refusals between `release-cli.ts` and `release-package-lib.ts`; derive `preflightLegs` from `specs.ts` (`spec.packages`) rather than a hand-written label list; replace `stage-package-lib`'s two directory walkers with `gen-file-sizes`' `readNamespace`. | Two release trains carry copies of the same git logic; a new `pkg-*` spec is run by impact analysis but skipped by the release preflight. | `packages/cli/scripts/` |
| F6 | Decide the link-scheme policy explicitly: keep the fixed allowlist (current), or add a consumer-facing `allowedLinkSchemes` input for intranet schemes (`slack://`, `msteams:`, `geo:`). | The allowlist silently strips custom schemes from existing content on first save. | `rich-text-sanitizer.service.ts` |
| F7 | Comment density: the PR adds ~790 `//` rationale lines inside method bodies, which CLAUDE.md's "no non-JSDoc comments" rule reads literally. Either relax the rule to permit *why* comments or move the histories into the spec logs. | Policy call, not a defect; flagged by the conventions finder. | `.claude/CLAUDE.md` |
