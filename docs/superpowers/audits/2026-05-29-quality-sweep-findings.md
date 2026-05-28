# Quality Sweep — Findings Report

**Date:** 2026-05-29 · **Spec:** `specs/../docs/superpowers/specs/2026-05-29-quality-sweep-design.md` · **Branch:** `claude/quality-sweep`
**Method:** source audit of all 118 components by 19 parallel subagents against the rubric (a11y/RTL/touch/responsive/i18n). axe pass = deferred (see notes).

## Summary

The library is broadly solid; the issues cluster into a small number of **systemic patterns** plus a set of **per-component keyboard/ARIA gaps** in the complex interactive widgets. Severity legend: **critical** (unusable for a class of users), **major** (degraded, workaround exists), **minor** (polish).

Cleanest components (no findings): `blur-fade, gradient-text, magnetic, marquee, meteors, morphing-text, ripple, scroll-progress, shine-border, stagger-children, wobble-card, bar-chart, avatar, aspect-ratio, separator, badge, progress, native-select, input, breadcrumb, button, pagination, kbd, label, component-outlet, accordion, page-renderer, sortable`.

## Systemic patterns (fix these first — one pattern, many files)

### S1 — Physical RTL utilities (MOST FREQUENT; mostly mechanical)
Physical-direction classes/styles that don't flip under `dir="rtl"`. Swap to logical (`me-/ms-`, `ps-/pe-`, `start-/end-`, `border-s/border-e`, `rounded-s/rounded-e`, `text-start/end`) or `ltr:/rtl:` pairs.
**Affected:** comparison-slider, orbit, streaming-text, typing-animation, sparkles(-button), org-chart, pie-chart-drilldown, chat, kanban, code-block, alert (`left-4`/`pl-7`), input-group (addon), color-picker (`text-left`), **date-range-picker (`mr-2` — critical RTL break)**, phone-input, tree-select (`text-left`), command (`ml-auto`), context-menu (`pl-8`/`ml-auto`), dropdown-menu (`ml-auto`), button-group (`rounded-l/r`,`border-l`), navigation-menu (`left-0`,`space-x-1`), sidebar (`border-r`), speed-dial (direction), split-button (`rounded-l/r`,`border-r`,`mr-2`), stepper (`text-left`,`ml-4`), menubar (`ml-auto`), popover (`mr-1/ml-1`,`left/right-full`), tooltip (`mr-2/ml-2`), hover-card (`left-0/right-0`), emoji-picker (`left-0`,`left-2.5`,`pl-8`,`pr-3`), scroll-area (`right-0`,`border-l`), carousel (`-ml-4`/`pl-4`), rich-text-editor (`ml-3`), page-builder (`border-r/l`,`left-3`).

### S2 — Overlay missing `max-w-[calc(100vw-2rem)]` (320px overflow)
**Affected:** select content, date-picker popup, date-range-picker popup, dropdown-menu content + sub-content, emoji-picker (critical — `w-80`, no cap), tree-select popup, tooltip (directive, long text).

### S3 — Bare `<span (click)>` triggers: no keyboard op + no `aria-haspopup`/`aria-expanded`
Trigger sub-components are spans with click-only; rely on consumer projecting a focusable child, and never expose popup state. Add `aria-haspopup`/`aria-expanded` (bound to open state) and either make the trigger a button or document/enforce a focusable child.
**Affected:** dialog, alert-dialog, drawer (+close), sheet (+close), popover, hover-card, tooltip, dropdown-menu, emoji-picker, speed-dial, collapsible (critical — also no role/keyboard at all), dock (critical — non-focusable div items).

### S4 — Modal content missing dialog semantics / labelling
`role="dialog"`/`aria-modal` absent or on the wrapper not the content; no `aria-labelledby`/`aria-describedby`. (Focus trap + restore + Esc ARE implemented correctly in dialog/alert-dialog/drawer/sheet — good.)
**Affected:** dialog (no role at all), alert-dialog, drawer, sheet, shortcut-bindings-dialog; date-picker & date-range-picker popups (no `role="dialog"`/focus mgmt/Esc).

### S5 — Icon-only controls without accessible names
**Affected:** chat send button, page-builder toolbar/toggles, rich-text-editor toolbar (title-only), file-viewer toolbar (critical), bento-grid options + merge-bar, emoji-picker categories/grid/search, dock items, **icon component itself** (no `aria-hidden` default / no label input), bar-race-chart scrubber.

### S6 — Missing `prefers-reduced-motion` (no global baseline exists)
**Affected:** sparkles, text-reveal, streaming-text, typing-animation, number-ticker, spinner (+page-spinner), skeleton, confetti (`disableForReducedMotion` is dead code). Consider a global `@media (prefers-reduced-motion: reduce)` baseline in `packages/styles.css` plus per-JS-animation guards.

### S7 — `(contextmenu)` with no long-press (touch) + no keyboard invocation
**Affected (critical):** context-menu-attach, data-table-context-menu, table-context-menu, tree-context-menu directives; data-table rows; kanban (card + column header); speed-dial-context-trigger. Fix pattern: `onLongPress()` from `lib/touch.ts` + Shift+F10/ContextMenu-key handler.

### S8 — Status-region politeness: `role="alert"` for all variants
alert + toast hardcode assertive `role="alert"`; informational/success should be `role="status"`/`aria-live="polite"`.

### S9 — Hardcoded i18n strings on chrome
**Affected:** page-builder (pervasive, incl `alert()`), file-viewer (no locales file), shortcut-bindings-dialog, color-picker, emoji-picker, chip-list, data-table (pagination/loading/aria), spinner (`aria-label`), input-otp, kanban (toast close), virtual-scroll/empty defaults, several chart aria/tooltip strings.

## Per-component CRITICAL & MAJOR findings

(Minors omitted here — captured in subagent logs; rolled into the relevant systemic wave.)

**Keyboard/ARIA — complex widgets (per-component, higher-risk fixes):**
- **calendar** (critical×3): no `role=grid`/gridcell, no keyboard date nav (arrows/Home/End/PageUp-Down + roving tabindex), no `aria-selected`. (major) bare day-number names.
- **radio-group** (critical): no arrow-key nav / roving tabindex (every radio a tab stop). (major) no group accessible name.
- **select** (critical): no `aria-activedescendant` (focused option unannounced). (major) disabled options keyboard-focusable; (responsive) no max-width.
- **tabs** (major×2): no arrow-key nav (both modes); simple-mode triggers/panels not linked (`id`/`aria-controls`/`aria-labelledby`), panel no `tabindex`. (responsive) tablist clips at 320px.
- **toggle-group** (major): no roving tabindex/arrow nav; (minor) no group name; (responsive) no wrap.
- **context-menu** (critical): top-level menu has no `role=menu`/`menuitem`, no keyboard nav/Esc/focus mgmt (only submenu wired).
- **navigation-menu** (critical): no keyboard model (arrow nav/Esc/focus into panel).
- **menubar**: clean except minor `ml-auto`.
- **collapsible** (critical×2): trigger is click-only `<span>` (no focus/keyboard), no `aria-expanded`/`aria-controls`.
- **resizable** (critical): handle `role=separator`+tabindex but no arrow-key resize; (major) static `aria-valuenow=50`.
- **dock** (critical×2): items non-focusable divs (no role/handler, `onClick`/`href` unwired); labels never render (no `.group` ancestor → permanent `display:none`); (touch major) hover/mouse-only.
- **kanban** (critical): card not keyboard-operable; (touch critical) HTML5-drag only, no touch DnD; (touch major) contextmenu no long-press.
- **data-table** (touch critical×2): row drag HTML5-only; row contextmenu no long-press.
- **page-builder** (touch critical): palette drag HTML5-only; (responsive major) 3-pane fixed layout breaks <breakpoint; (a11y major) icon buttons unnamed/toggles no `role=switch`; (i18n major) pervasive hardcoded English.
- **tour** (critical): no dialog role/`aria-modal`/labelledby, no focus trap, no focus restore.
- **tree** (major): `aria-hidden="true"` on a focusable chevron button.
- **autocomplete** (major): multi-select chip remove is `<span role=button>` not keyboard-removable.
- **chip-list** (major×2): chips not keyboard-removable / no list semantics; `setDisabledState` no-op.
- **switch** (major): label-mode double-toggle risk (`for` + explicit `(click)`).
- **textarea** (major): no `aria-invalid`/`aria-describedby`/`aria-label` inputs.
- **field** (major): generates describedby ids but never applies them / no `aria-invalid`.
- **number-input** (major): min/max/step not bound to native input (spinbutton semantics).
- **phone-input** (critical): country button unnamed + no popup-state ARIA. (major) search input unlabeled.
- **tree-select** (major×2): combobox unlabeled + no `aria-controls`; popup no max-width.
- **input-otp** (major): cosmetic per-segment arrow nav; unnamed by default; uppercase/Latin-forcing.
- **file-upload** (major): drop zone not keyboard-operable as a zone; list changes not announced.

**Charts:**
- **column-range-chart, stacked-bar-chart** (critical): focusable bars/segments with `(click)` but NO keydown — not keyboard-activatable.
- **bar-race-chart** (major×2): scrubber unnamed; race data not exposed to AT.

**Feedback:**
- **number-ticker** (critical): animated value never exposed to AT; digit sub-component stacks two spans (garbled).
- **toast** (major): no Esc-to-dismiss; (touch major) dismiss hover-revealed only.
- **skeleton/spinner** (major): no loading role/`aria-busy` (skeleton); hardcoded non-overridable `aria-label` (spinner).
- **alert** (major): `role=alert` for all variants; physical `left-4`/`pl-7`.

**Responsive (critical):**
- **drawer, sheet**: no `overflow-y-auto` → long content clips.
- **table**: container no `overflow-x-auto` with `min-w-max` rows → clips on narrow.
- **emoji-picker**: `w-80` popup no max-width.

## Wave plan (Phase 3)

Ordered by leverage (systemic-first) and risk (mechanical/verifiable before behavioral rewrites). Each wave: fix → review-gate ≥95 → verify (tests + demo `ng build`) → commit.

- **W1 — RTL logical utilities (S1):** mechanical swap across ~30 components. Low risk, high frequency. Includes the date-range-picker `mr-2` critical.
- **W2 — Responsive overflow/max-width (S2 + drawer/sheet/table/emoji-picker critical):** add `max-w-[calc(100vw-2rem)]` to overlays, `overflow-y-auto` to drawer/sheet, `overflow-x-auto` to table.
- **W3 — Modal & overlay a11y (S3+S4):** dialog `role`/`aria-modal`/labelledby; trigger `aria-haspopup`/`aria-expanded`; tooltip `role=tooltip`+focus show + `aria-describedby`; popover Esc+focus.
- **W4 — Icon-only accessible names (S5) + icon component default `aria-hidden`/label input.**
- **W5 — Status politeness (S8): alert/toast variant-driven role; toast Esc + touch dismiss.**
- **W6 — Reduced-motion (S6):** global baseline + per-JS guards.
- **W7 — Touch contextmenu long-press (S7):** the 4 directives + data-table/kanban/speed-dial.
- **W8 — Chart keyboard activation:** column-range-chart, stacked-bar-chart keydown; bar-race scrubber name.
- **W9+ — Per-component keyboard/ARIA rewrites (HIGHER RISK — recommend runtime/screen-reader + visual validation):** calendar grid nav, radio-group, tabs, toggle-group, select activedescendant, context-menu/navigation-menu/menubar keyboard, collapsible, resizable, dock, tree chevron, autocomplete/chip-list chip removal, switch, textarea/field/number-input/phone-input/tree-select/input-otp/file-upload a11y, number-ticker, kanban/data-table/page-builder touch DnD, tour dialog semantics, page-builder/file-viewer/shortcut-dialog i18n.

## Completion Log (fixes)

| Wave | Completed | Score | Rationale |
|---|---|---|---|
| Wave A (W1 RTL S1 + W2 responsive S2) | 2026-05-29 | 95 | 47 files: physical→logical Tailwind utility swaps across ~30 components + max-w/overflow on overlays/drawer/sheet/table. LTR-identical, true equivalents, correct edge semantics, no over-reach; kanban assertion updated. demo build clean, changed-component tests pass. |
| Wave B (W8 chart keyboard + W5 status politeness + W4 partial icon names) | 2026-05-29 | 96 | column-range/stacked-bar keyboard activation (2 criticals) + bar-race scrubber aria; alert/toast variant-driven role/aria-live + toast Esc + touch-visible dismiss; icon-only aria-labels (chat/file-viewer/bento-grid). Additive, faithful to bar-chart ref, correct WCAG mapping; alert spec updated; 204 tests pass. |
| Wave C (W6 reduced-motion) | 2026-05-29 | 97 | 8 components honor prefers-reduced-motion (CSS guards + JS settle-to-final via reused prefersReducedMotion()); confetti dead option wired; default motion unchanged; sync clean; 92 tests pass. |

**Status:** Waves A–C complete (gated 95/96/97). Remaining W3/W4-remainder/W7/W9 + axe pass documented in the plan doc's "Remaining" section — these involve behavioral keyboard/ARIA rewrites, touch DnD, and i18n that benefit from runtime + screen-reader + visual validation, so they were left for daytime review rather than shipped blind overnight.

## Notes
- **axe pass deferred:** browser automation overnight is unreliable (drives the user's Chrome + permission). The source audit + rubric is the backbone; an interactive axe pass on the demo routes is a recommended morning step to catch contrast/rendered-focus issues flagged `needsRuntimeCheck`.
- **`needsRuntimeCheck` items** (touch-target sizes vs the global coarse-pointer rule, focus-ring visibility, contrast, popover clamping, switch double-toggle, 320px overflow) should be confirmed against rendered output before/while fixing.
