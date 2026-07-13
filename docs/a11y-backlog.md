# Accessibility Backlog

**Status: PAID. `npm run test-storybook:a11y` is green and is now a gate, not a triage command.**

`.claude/CLAUDE.md` mandates an axe pass for every component ("Accessibility: proper ARIA
attributes and keyboard navigation" in the new-component checklist). The library now meets that
bar. This file records what was broken and how it was fixed, so the debt stays paid.

## How this was found

`.storybook/test-runner.ts` had been configured to run axe (`injectAxe` / `configureAxe` in
`preVisit`, `checkA11y('#storybook-root')` in `postVisit`) and `axe-playwright` +
`@storybook/addon-a11y` were installed — but **no npm script ever invoked the test-runner**, so
the checks had never actually executed. Wiring the runner up (`scripts/test-storybook.mjs`)
surfaced the backlog for the first time: **368 failing tests across 61 of 136 story suites.**

## Reproduce

```bash
npm run test-storybook:a11y     # axe ON  — GREEN, and must stay green
npm run test-storybook          # axe OFF — stories / play functions only
```

**Do not weaken the axe assertions, skip stories, or add rule exclusions to make this pass** —
fix the component. No rule was disabled and no story was narrowed to reach green; every fix
below is a real change to the component or to the demo markup under test.

## Result

| | before | after |
| --- | --- | --- |
| Test suites | 61 failed, 75 passed | **142 passed, 0 failed** |
| Tests | 368 failed, 521 passed | **926 passed, 0 failed** |

(Totals grew from 889 to 926 because stories were added for previously uncovered components in
the same push.)

## Root-cause clusters

The 368 failures were **not** 368 distinct bugs. They were a handful of shared patterns repeated
across the library — a wrapper component here, a hardcoded colour there — each fixed once.

### 1. Trigger wrappers nesting an interactive control (`nested-interactive`)

`ui-popover-trigger`, `ui-dialog-trigger`, `ui-sheet-close`, `ui-drawer-trigger`, … always
rendered `role="button" tabindex="0"` on their own `<span>`. That is right when the consumer
projects inert content, but as soon as the consumer projects a `<ui-button>` — by far the common
case — it produced a button inside a button: a real WCAG 4.1.2 failure that breaks keyboard and
screen-reader users.

`lib/a11y.ts` (`hasInteractiveContent()`) lets each wrapper decide at runtime: if the projected
content is already operable, the wrapper stays a transparent, non-focusable event delegate;
otherwise it supplies the button semantics itself. Same public API, correct semantics in both
modes.

### 2. Charts: `role="img"` over focusable data points (`nested-interactive`)

Chart SVGs carried `role="img"`, which makes the entire subtree presentational — while the data
points inside are `tabindex="0"` and keyboard-focusable. axe flags the contradiction, and it is
a genuine one: the focusable points are unreachable for assistive tech under `role="img"`.

The interactive charts now use `role="group"` (verified: `img` + focusable points fails;
`group` + focusable points passes). Static charts with no focusable points (`bullet-chart`,
`gauge-chart`) keep `role="img"`, which remains correct for them. `docs/sonarqube-accepted-findings.md`
is updated to match.

### 3. `display: contents` hosts swallowing native attributes (`label`, `select-name`)

`<ui-input id="email">` and `<ui-native-select aria-label="…">` put the attribute on the host,
which is a `display: contents` wrapper — not a labelable control. So `<label for="email">`
associated with nothing and the real control reached screen readers **unlabeled**. A non-empty
`placeholder` was masking this in most stories, which is why it went unnoticed.

Both components now read the native attribute off the host and move it to the real inner control.
`ui-input` also falls back to a generated id, so the floating-label variant's own `<label for>`
always binds.

### 4. `role="combobox"` is not named by its contents (`button-name`)

The select triggers render the placeholder text inside the button — but `combobox` is not a
name-from-content role, so that text does not name the control and the combobox was anonymous.
Both the projected trigger and the data-driven trigger now fall back to the resolved placeholder
as their accessible name.

### 5. Angular wrapper elements breaking `<ul>` / `<li>` (`list`, `listitem`)

`ui-sidebar-menu` renders a `<ul>` and `ui-sidebar-menu-item` renders an `<li>` — but Angular
always emits the `<ui-sidebar-menu-item>` tag between them, so the `<li>` was not a child of the
`<ul>` and the list/item relationship was lost. The item host now *is* the list item
(`role="listitem"`), keeping the native `<ul>`.

### 6. "Disabled" that only dimmed (`color-contrast`, and a real functional bug)

`ui-input-group [disabled]` and `ui-chip-list [disabled]` applied `opacity-50` and nothing else —
the contained controls stayed focusable and editable. Both roots are `<fieldset>`, so they now set
the native `disabled` attribute, which genuinely disables every control inside *and* makes the
dimmed text correctly exempt from contrast (WCAG 1.4.3 exempts inactive components). The
file-upload dropzone gets `aria-disabled` for the same reason.

### 7. Hardcoded `white` on a caller-supplied colour (`color-contrast`)

Chip and kanban labels painted `text-white` on any background the caller passed, which drops below
AA on light colours (white on emerald `#10b981` is 2.5:1). `readableForeground()` in `lib/color.ts`
derives the foreground from the background's luminance instead, keeping the caller's colour.

### 8. Collapsed sidebar hiding the accessible name (`button-name`)

The collapsed sidebar hid its button labels with `hidden`, removing them from the accessibility
tree — an icon-only button with no name. It now uses `sr-only`: visually identical, name preserved.

### 9. Animated content read mid-flight (`empty-heading`, transient `color-contrast`)

`ui-typing-animation` types characters into its element, so a heading built from it is **empty**
until the first character lands — and announcing each keystroke would be unusable anyway. The full
text is now exposed in an `sr-only` span while the typed output is `aria-hidden`.

Separately, the harness was auditing pages mid-animation: entrance animations (BlurFade,
StaggerChildren) spend their first few hundred milliseconds at partial opacity, and axe was
measuring a transient frame no user reads at rest. `postVisit` now waits for finite animations to
finish before running axe (indefinite ones — spinners, skeleton pulses — are skipped, and the wait
is capped). This changes *when* axe runs, never *what* it checks.

### 10. Empty/decorative table headers (`empty-table-header`)

The data table's flex filler cell and its no-filter floating-filter cells rendered as empty
`columnheader`s. They are decorative, so they are now `role="presentation"` — `aria-label` does
*not* satisfy this rule (verified).

### 11. Miscellaneous, each a single real fix

- **`aria-conditional-attr`** — data-table rows expose `aria-expanded` / `aria-level` in sub-rows
  mode, which are only valid on a `treegrid`; the table's role is now `treegrid` when
  `enableSubRows` is set (was `table`, where assistive tech ignores them and the hierarchy is lost).
- **`landmark-unique` / `aria-prohibited-attr`** — accordion panels were `<section aria-labelledby>`,
  i.e. *region landmarks*, one per panel with duplicate (or, in the skeleton state, empty) names.
  The WAI-ARIA accordion pattern treats the panel region as optional and discourages it when panels
  repeat, so the panels are now plain `<div>`s; the trigger's `aria-controls` still associates them.
- **`aria-required-attr`, `scrollable-region-focusable`, and demo contrast** — fixed in the demo
  markup itself (a custom trigger claiming `role="combobox"` without the state to back it, a
  scroll container no keyboard user could reach, and several `*-500`/`*-600` text shades below AA).

## Rules that were narrowed

**None.** No `parameters.a11y` narrowing, no disabled rules, no skipped stories.
