# Quality Sweep — Design Spec

**Date:** 2026-05-29
**Status:** Approved (brainstorming) → pending implementation plan
**Approach:** Full audit up front (all entries × all dimensions) → triage → fix in severity-ranked waves.

## Goal

Audit the entire shadcn-angular component library — **118 components + 12 blocks (130 registry entries)** — across five quality dimensions (a11y, RTL, touch, responsive, i18n), produce **one prioritized findings report**, then **fix in severity-ranked waves** until the library is clean against an explicit, written rubric.

This is the quality/consistency thread (#4) from the original brainstorm. The components were built under CLAUDE.md §4–6 rules, so the sweep is primarily about **catching what slipped through**, backed by evidence rather than assumption.

## Scope

**In scope (audited + fixed):**
- Every `type:'component'` registry entry's source: `<name>.component.ts` / `.html` / `.css` (and folderized `sub/` files), plus directives and pipes under `packages/components/ui/`.
- The 12 `type:'block'` entries (shipped, user-facing pages) — audited for their own markup; lower priority than primitives since they largely inherit component compliance.
- `packages/components/lib/touch.ts` and any lib utility that materially affects a11y/RTL/touch behavior.

**Out of scope:**
- The demo app, the CLI, the e2e harness, and non-visual lib utilities (chart math, parsers, etc.) except where they affect the five dimensions.
- New features or redesigns. Fixes restore compliance; they do not change a component's intended appearance or API (desktop appearance must not regress).

## The Rubric

A single authored checklist is the contract every auditor scores against. Derived from CLAUDE.md §4 (Sonar/strictness), §5 (Responsive), §6 (Touch), plus WCAG 2.1 AA for a11y and the project's RTL conventions.

### Dimensions & checks

**a11y (WCAG AA)**
- Every interactive control has an accessible name (icon-only buttons need `aria-label`/`aria-labelledby`; inputs associated to a `<label for>`).
- Keyboard operability: all interactive elements focusable and activatable (Enter/Space); overlays close on `Esc`; composite widgets (menu, tabs, listbox, tree, accordion, combobox) implement the expected arrow-key/Home/End pattern and correct ARIA roles/states (`aria-expanded`, `aria-selected`, `aria-controls`, `role`).
- Visible focus indicator (`focus-visible` ring) on every focusable element.
- Focus management in overlays: focus moves into the overlay on open, is trapped while open, and returns to the trigger on close.
- No `tabindex > 0`; no `aria-hidden` on a focusable element; no positive-only color signaling without a text/icon cue.
- Color contrast via design tokens (flag literal colors that may fail AA).

**RTL**
- Logical utilities only — flag every physical `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right/border-l/border-r/rounded-l/rounded-r` and `(translateX|left|right)` inline styles that aren't direction-aware.
- Directional icons/affordances (arrows, chevrons used for "next/prev/back") flip or are logically chosen under `dir="rtl"`.

**Touch**
- Interactive targets ≥ 44×44px (or covered by the global `@media (pointer: coarse)` baseline — note when relying on it).
- Every `(mouseenter)`/hover-only reveal of essential UI has a tap/click path.
- Every `(mousedown)` drag has a matching `(touchstart)` + `touch-action`; every `(window:mousemove/up)` has `(window:touchmove/end)`.
- Every `(contextmenu)` has a long-press alternative; every `(dblclick)` has a double-tap alternative.
- No keyboard-shortcut-only feature without a visible touch-reachable control.

**Responsive (320px → ultrawide)**
- No `w-[Npx]/min-w-/max-w-[Npx]` or fixed heights without responsive variants.
- Flex toolbars/control rows wrap (`flex-wrap`).
- Every absolutely/fixed-positioned overlay has `max-w-[calc(100vw-2rem)]`.
- Long text in constrained containers truncates/clamps.

**i18n**
- User-facing strings are inputs or locale-driven, not hardcoded English baked into the component (data-driven defaults are acceptable; flag hardcoded labels on structural chrome).

### Severity
- **Critical** — unusable for a class of users: interactive element not keyboard-operable or unnamed; content clips/overflows at 320px; drag/contextmenu/dblclick with no touch path; mirrored/broken layout in RTL.
- **Major** — significant degradation with a workaround: missing visible focus ring; hover-only reveal reachable another way; physical RTL utility causing a cosmetic mirror issue; non-wrapping toolbar that scrolls.
- **Minor** — polish: hardcoded string in low-traffic chrome, target slightly under 44px but covered by the global rule, missing truncation on an unlikely-overflow element.

## Phase 1 — Audit (fan-out)

- **Mechanism:** parallel subagents (Agent tool), **batched by category** (~12 batches mirroring the registry categories; the complex interactive components — `data-table`, `kanban`, `tree`, `select`, `combobox`/`autocomplete`, `dialog`/`popover`/`dropdown-menu`/`command`, `calendar`, `carousel`, `resizable`, `slider` — get **solo** audits). The rubric is passed verbatim to every auditor for consistency.
- **Per-component output — structured findings** (one row per issue):
  `{ component, dimension, severity, issue, location (file:line or file), suggestedFix, needsRuntimeCheck }`.
  Static source review flags `needsRuntimeCheck: true` for anything only verifiable when rendered (contrast, actual focus-ring visibility, 320px overflow).
- **Automated axe pass (objective a11y):** with the demo running, drive each component's demo route in the browser, inject `axe-core` (present at repo root), run `axe.run()` scoped to the demo content, and capture violations (id, impact, target, help). Cross-reference axe hits against the source findings — axe catches what static review misses (and vice-versa: axe can't see keyboard/focus-management gaps).
- **Aggregation:** merge all subagent findings + axe results into one durable report:
  `docs/superpowers/audits/2026-05-29-quality-sweep-findings.md`.

## Phase 2 — Triage

- Dedupe; **cluster by systemic pattern** (e.g. "23 components lack a `focus-visible` ring", "9 use physical `ml-`"). Systemic issues share one fix pattern and are the cheapest per-fix, so they lead.
- Rank by **severity × frequency**.
- Emit a **wave plan**: ordered list of fix waves. Within a severity tier, dimension order is **a11y → responsive → touch → RTL → i18n**.

## Phase 3 — Fix in waves

- Execute waves **systemic-first, then per-component**.
- Each wave: apply fixes → **review-gate ≥95** → verify: unit tests for touched components, demo `ng build`, **axe re-run** on changed routes, and **visual validation** (independent `visual-validate`) for any layout-affecting change to confirm desktop appearance didn't regress and the mobile/RTL case is correct.
- The findings report is **living history**: mark each issue fixed (with the commit), never delete; link any regression to its original entry.
- Fixes are committed in coherent units (per systemic pattern or per component) so each is independently reviewable; batched into PRs against `master`.

## Findings report format

`docs/superpowers/audits/2026-05-29-quality-sweep-findings.md`:
1. **Summary** — counts by dimension × severity; total issues; components affected.
2. **Systemic patterns** — clustered issues with affected-component lists and the single fix pattern (filled in at triage).
3. **Per-component findings table** — `component | dimension | severity | issue | location | suggested fix | status`.
4. **axe appendix** — raw axe violations per route.
5. **Wave plan** — ordered fix waves (filled in at triage).

## Verification

- **Audit quality:** the rubric is explicit and every auditor uses it verbatim; axe provides an independent objective signal for a11y; `needsRuntimeCheck` items are resolved during fixing, not guessed.
- **Fix quality:** zero unit-test failures (project policy), clean demo `ng build`, axe-clean on changed routes, review-gate ≥95 per wave, and visual validation for layout changes (no desktop regression).
- **Registry integrity:** if a fix changes a component's file set, `sync-registry` stays in sync and the change is bundled for the next CLI publish.

## Deliverables

1. The audit rubric (in this spec).
2. The findings report (durable, prioritized, living).
3. The fixes, committed in waves, each review-gated and verified.
4. A final summary: issues found, fixed, deferred (with reasons), and any new tooling/lint rules worth adding to prevent regressions.

## Out of scope / future

- Adding automated lint rules / CI gates to *prevent* future violations (e.g. an ESLint rule banning physical-direction utilities) — a worthwhile follow-up the audit will inform, but not part of this sweep's fixing.
- Redesigns or new component features.
