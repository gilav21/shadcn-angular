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
| Phase 1 — Audit (19 batches, 118 components) | 2026-05-29 | verified | Full source audit across 5 dimensions; findings report written with 9 systemic clusters + per-component criticals/majors + wave plan. axe deferred (overnight). |
| Wave A — W1 RTL (S1) + W2 responsive (S2) | 2026-05-29 | 95 | 47 files; physical→logical utility swaps + overlay max-width + drawer/sheet/table overflow; LTR-identical; demo build clean; changed-component tests pass; kanban assertion fixed. |
| Wave B — W8 chart keyboard + W5 status politeness + W4 icon names | 2026-05-29 | 96 | chart keyboard activation (2 criticals), alert/toast variant-driven role + Esc + touch dismiss, icon-only aria-labels; additive; 204 tests pass; demo build clean. |
| Wave C — W6 prefers-reduced-motion | 2026-05-29 | 97 | 8 components (sparkles/text-reveal/skeleton/spinner CSS; confetti/streaming-text/number-ticker JS via reused prefersReducedMotion()); settle-to-final, default motion unchanged; sync clean; 92 tests pass; demo build clean. |
| Morning review follow-up — carousel RTL-on-direct-load + chat avatar mirror | 2026-05-29 | 96 | Carousel re-reads RTL in post-content-init timer (constructor getComputedStyle race + change-only observer missed direct rtl load); chat user row `[&>ui-avatar]:order-last` mirrors avatar to outer edge (LTR+RTL). Live browser repro+fix verified (1→2 advance in RTL; ME avatar 451→711px); fix-sensitive unit tests added; 45 tests pass; demo build clean. |

### Remaining (for daytime review — need runtime/AT/visual validation)
- **W3 — modal & trigger a11y (S3+S4):** dialog `role`/`aria-modal`/labelledby; span-triggers `aria-haspopup`/`aria-expanded`; tooltip `role=tooltip`+focus-show+`aria-describedby`; popover Esc+focus.
- **W4 remainder — icon component default `aria-hidden`/`ariaLabel` input** (library-wide default change — validate); remaining icon-only names (page-builder/rich-text-editor toolbars, emoji-picker, dock).
- **W7 — touch contextmenu long-press (S7):** the 4 context-menu directives + data-table/kanban/speed-dial.
- **W9 — behavioral keyboard/ARIA rewrites (highest risk):** calendar grid nav, radio-group, tabs, toggle-group, select activedescendant, context-menu/navigation-menu/menubar keyboard, collapsible, resizable, dock, tree chevron, autocomplete/chip-list chip removal, switch double-toggle, textarea/field/number-input/phone-input/tree-select/input-otp/file-upload a11y, number-ticker AT exposure, kanban/data-table/page-builder touch DnD, tour dialog semantics; i18n (page-builder/file-viewer/shortcut-dialog/color-picker/emoji-picker/data-table).
- **Pre-existing (found during sweep):** `UiComponentOutletDirective` circular-init breaks `page-builder`/`bento-grid`/several demo specs on test import — investigate the component-outlet import cycle.
- **axe pass:** run interactively on demo routes to catch contrast / rendered-focus / `needsRuntimeCheck` items.

## Status / handoff notes

_(running log of progress for morning review)_
