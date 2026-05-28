# Quality Sweep — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-05-29-quality-sweep-design.md`
**Branch:** `claude/quality-sweep`
**Mode:** autonomous overnight execution; review-gate **≥95** per fix task, scores recorded below + in the spec.

## Phases

- **Phase 1 — Audit (fan-out):** ~19 parallel subagent batches (by category; complex components grouped tightly) score every component against the rubric → structured findings. Optional axe pass on demo routes. Aggregate → `docs/superpowers/audits/2026-05-29-quality-sweep-findings.md`.
- **Phase 2 — Triage:** dedupe, cluster systemic patterns, rank severity×frequency, emit wave plan (appended to the findings doc).
- **Phase 3 — Fix in waves:** systemic-first, then per-component, dimension order a11y → responsive → touch → RTL → i18n within a severity tier. Each wave: fix → review-gate ≥95 → verify (unit tests + demo `ng build` + axe re-run where available) → commit.

## Audit batches (Phase 1)

A1 animation-1 · A2 animation-2 · A3 animation-3 · A4 charts · A5 data-display-complex (calendar/data-table/tree) · A6 data-display-simple · A7 editor-complex · A8 editor-simple · A9 feedback · A10 form-1 · A11 form-2 · A12 form-3 · A13 form-4 · A14 layout · A15 media · A16 navigation-1 · A17 navigation-2 · A18 overlay · A19 utility

## Completion Log

Review gate bar: **≥95**. Highest score per task recorded.

| Task | Completed | Score | Rationale |
|---|---|---|---|
| _(audit + fix tasks recorded here as completed)_ | | | |

## Status / handoff notes

_(running log of progress for morning review)_
