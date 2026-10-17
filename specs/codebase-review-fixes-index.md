# Codebase Review Fixes — Spec Index

> Source: full read-only codebase review, 2026-10-03, covering the CLI,
> component guideline conformance, form and overlay components, lib and charts,
> parsers, and repo hygiene. The repo owner approved turning the findings into
> specs.
> Every spec ran Step 0 (re-verification against source at `6fae7f7f`). Each
> spec's own Step 0 table records refuted and corrected findings (⚠️ / ❌).
> Each spec is self-contained; an agent reads only its spec file.
> Bar: every task row needs a review-gate score ≥ 91 before a dependent spec
> may start.

## Bundles

| # | Spec | UCs | Tasks | Prerequisites | Conflicts with (same files) | Can start now |
|---|------|-----|-------|---------------|-----------------------------|---------------|
| 1 | [cli-registry-path-safety-spec.md](cli-registry-path-safety-spec.md) | 10 | 7 | none | 2 (`core/install.ts`, `core/merge.ts`, `core/lib-reconcile.ts`, `commands/add.ts`, `mcp/tools/write-tools.ts`); 3 (`utils/package-manager.ts`, `registry/load.ts`) | ✅ |
| 2 | [cli-install-integrity-spec.md](cli-install-integrity-spec.md) | 14 | 8 | none (merge after 1) | 1 | after 1 merges |
| 3 | [cli-network-and-package-manager-spec.md](cli-network-and-package-manager-spec.md) | 9 | 4 | none (merge after 1) | 1 | after 1 merges |
| 4 | [selector-independent-component-identity-spec.md](selector-independent-component-identity-spec.md) | 9 | 7 | none | 7 (`e2e/orchestrator/specs.ts`, additive); 15 (`rich-text-mention-popover.component.ts`) | ✅ |
| 5 | [import-and-parser-hardening-spec.md](import-and-parser-hardening-spec.md) | 14 | 8 | none (merge after 6) | 6 (`lib/parsers/pdf-parser.ts`, `pdf-readable/`) | after 6 merges |
| 6 | [parser-resource-limits-spec.md](parser-resource-limits-spec.md) | 12 | 10 | none | 5 | ✅ |
| 7 | [overlay-stack-scroll-lock-and-escape-spec.md](overlay-stack-scroll-lock-and-escape-spec.md) | 18 | 8 | none | 8 (dropdown-menu / menubar / context-menu **spec files**, `registry.json`); 15 (popover, emoji-picker, dialog family); 4 (`specs.ts`) | ✅ |
| 8 | [keyboard-and-touch-activation-spec.md](keyboard-and-touch-activation-spec.md) | 14 | 8 | none (merge after 7, 14) | 7; 14 (the flat context-menu directives exported via `context-menu-integrations.ts`, which 14 deletes; `kanban` locales rename); 15 (tooltip, `data-table-context-menu`) | after 7 + 14 merge |
| 9 | [slider-and-numeric-input-correctness-spec.md](slider-and-numeric-input-correctness-spec.md) | 13 | 10 | none | 10 (`signal-forms/field-round-trip.spec.ts`, `docs/signal-forms.md`, text-only) | ✅ |
| 10 | [toggle-group-and-input-otp-forms-spec.md](toggle-group-and-input-otp-forms-spec.md) | 14 | 9 | none (merge after 9) | 9; 15 (`input-otp/sub/*` `data-slot` — check before starting) | after 9 merges |
| 11 | [chart-scale-robustness-spec.md](chart-scale-robustness-spec.md) | 10 | 8 | none | 12, 13 (`lib/chart-scale.ts`, heatmap / calendar-heatmap); 15 (`eslint.config.mjs`) | ✅ |
| 12 | [chart-degenerate-data-spec.md](chart-degenerate-data-spec.md) | 13 | 10 | **11** | 11, 13 (heatmap, calendar-heatmap, `lib/chart-path.ts`) | after 11 |
| 13 | [color-utils-correctness-spec.md](color-utils-correctness-spec.md) | 7 | 7 | none (merge after 12) | 11 (`chart-scale.ts` lines 165-202, a different region); 12 | after 12 merges |
| 14 | [repo-hygiene-and-docs-drift-spec.md](repo-hygiene-and-docs-drift-spec.md) | 13 | 11 | none | 8 (deletes `context-menu-integrations.ts`, renames `kanban-locales.ts`); root `package.json` / vitest configs | ✅ |
| 15 | [component-guideline-conformance-spec.md](component-guideline-conformance-spec.md) | 13 | 10 | none (run last) | ~100 `ui/` files: 4, 7, 8, 10, 11 | after waves 1–2 |

Totals: 15 specs, 183 use cases, 125 tasks.

**Status (2026-10-17): all 15 specs are implemented, merged to master and released.**
The "Can start now" column above is the original plan, kept as history.

## Waves

| Wave | Specs | Notes |
|------|-------|-------|
| 0 | 14 (CLAUDE.md part of Task 10 + agent-guidance deletions) | ✅ Done 2026-10-03. Pulled ahead of everything because every executing agent loads `.claude/CLAUDE.md`. Committed before any worktree was created. |
| 1 | 1, 4, 6, 7, 9, 11, 14 | ✅ Merged to master and released. Seven worktrees on pairwise-disjoint source. The only shared file is `e2e/orchestrator/specs.ts` (4 and 7 each add an `EXPLICIT_SPECS` entry); merge 4 first, then rebase 7. |
| 2 | 2, 3, 5, 8, 10, 12 | ✅ Merged to master and released (with wave 1: CLI 0.0.53, rte 0.2.1, data-table 0.3.1). 2 and 3 are disjoint from each other and both rebase on 1. 5 rebases on 6. 8 rebases on 7 and 14. 10 rebases on 9. 12 needs 11. |
| 3 | 13, 15 | ✅ Done 2026-10-17: PR #205 merged (`dd4397ef`), released as CLI 0.0.54, rte 0.2.2, data-table 0.3.2. Both worktrees removed. One CodeQL finding on the PR (`js/incomplete-multi-character-sanitization` in the completeness gate's comment stripping, spec 15) was fixed before merge in `2664bf53`. 13 rebases on 12 (heatmap). 15 touches files from almost every UI spec, so it runs last; its Task 9 (overlay family) must read the merged 7 and 8 first. |

Wave rule: merge each wave to master before the next starts. Regenerate the
registry with `sync-registry --fix` rather than merging `registry.json`.

## Publish consequences

| Spec | CLI publish? | Package releases |
|------|--------------|------------------|
| 1, 2, 3 | **Yes** — CLI logic | — |
| 4 | **Yes** — `utils/prefix.ts` | `release:package rte` patch (closure changed) |
| 5 | No | `release:package rte` (**security fix**) |
| 6 | No | `release:package rte` (pdf-parser, pixel-perfect, pdf-readable) |
| 7, 8 | No | `release:package rte` **and** `data-table` |
| 9, 10, 11, 12 | No | — |
| 13 | No | `release:package rte` patch (`color.ts`, `color-extract.ts`) |
| 14 | No (`obsoleteFiles` is registry data) | RTE picks up the locale rename at its next release |
| 15 | No | `release:package rte` and `data-table` |

All publishes are manual (2FA) and done by the human **after** merging to master.
Batch the CLI publish once 1–4 have merged, rather than publishing four times.

## Needs human approval before executing

- ~~**Spec 14** edits `.claude/CLAUDE.md`… applied only after the human signs
  off.~~ ✅ Done in wave 0 at the human's direction (2026-10-03); see spec 14 §6.
- **Spec 1** changes the prune rule to: prune if clean, **or** if untracked and
  it matches a published baseline. It also fixes `install.spec.ts:319`, a test
  that currently asserts the bug.

## Recorded out of scope (follow-up candidates)

| Item | Found by | Why deferred |
|------|----------|--------------|
| `ui-dialog` has no `role="dialog"` / `aria-modal` | spec 7 Step 0 | a11y gap outside the stack/scroll/escape invariant. **Recommend its own small spec next.** |
| `--include-tests` under a custom prefix ships 62 spec files with 131 `ui-` tag queries that break | spec 4 Step 0 | Test scaffolding, not runtime; needs its own design (rewrite in specs vs. data-slot queries). ⚠️ 2026-10-17: re-measured at **100 calls in 41 files** (a lower bound); **spec written: [`include-tests-prefix-safety-spec.md`](include-tests-prefix-safety-spec.md)** |
| Run parsers in a Web Worker | spec 6 | Containment, not correctness. DOM-based parsers block it. ⚠️ 2026-10-17: only docx/pptx/xlsx-reader/svg-sanitizer use `DOMParser`; the PDF/DOC/PPT family can move. **Spec written: [`parsers-in-web-worker-spec.md`](parsers-in-web-worker-spec.md)** |
| Public "truncated / limits hit" flag on parse results | spec 6 | API addition; revisit for file-viewer UX |
| SSR safety sweep (68 bare `document.*` refs) | spec 15 | Mostly handler-time and safe; render-time cases in sheet/drawer/dialog are fixed by spec 7 |
| `readonly` sweep (~1,400 public members) | spec 15 | S2933 flags only private members (0 found); no Sonar impact |

## Completion log

| Date | Spec | Event |
|------|------|-------|
| 2026-10-03 | all | Specs written from the codebase review; Step 0 run per spec. |
| 2026-10-03 | 14 | Wave 0: CLAUDE.md corrections C-1…C-11, `COMPONENT_GUIDELINES.md` and 7 demo agent-scaffold files deleted. |
| 2026-10-09 | 9, 11 (Tasks 1-8), 4, 1, 14 | Wave 1 merged into `wave-1-integration` (spec 11 Tasks 3-8 finished by the lead after the agent stopped). |
| 2026-10-09 | 7 | Overlay stack v2 (Tasks 2-8) on `wave-1-integration`; completion log in the spec. |
| 2026-10-10 | 6 | Parser resource limits (Tasks 3-10) done on `wave-1-integration`; completion log in the spec. `release:package rte` required. |
| 2026-10-12 | 8 | Keyboard and touch parity (Tasks 1-8) on its worktree branch; every task scored 92-93 by a fresh reviewer; completion log in the spec. `release:package data-table` and `rte` required. |
| 2026-10-17 | follow-ups | Specs written (not started) for two recorded follow-ups: [`include-tests-prefix-safety-spec.md`](include-tests-prefix-safety-spec.md) and [`parsers-in-web-worker-spec.md`](parsers-in-web-worker-spec.md). Both are independent of the 15 specs above and of each other. |
