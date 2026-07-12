# Accessibility Backlog

**Status: real, unpaid debt — not an accepted finding.**

`.claude/CLAUDE.md` mandates AXE-pass for every component ("Accessibility: proper ARIA
attributes and keyboard navigation" in the new-component checklist). The library does not
currently meet that bar. This file is the ledger of what fails, so the gap is tracked rather
than invisible.

This is not a remediation plan. It records what the axe run reports, as of the measurement
below.

## How this was found

`.storybook/test-runner.ts` had been configured to run axe (`injectAxe` / `configureAxe` in
`preVisit`, `checkA11y('#storybook-root')` in `postVisit`) and `axe-playwright` +
`@storybook/addon-a11y` were installed — but **no npm script ever invoked the test-runner**, so
the checks had never actually executed. Wiring the runner up (`scripts/test-storybook.mjs`)
surfaced the backlog for the first time.

## Reproduce

```bash
npm run test-storybook:a11y     # axe ON — RED, see counts below
npm run test-storybook          # axe OFF — stories/play functions only, GREEN
```

`test-storybook:a11y` is expected to exit 1 until this debt is paid. **Do not weaken the axe
assertions, skip stories, or add rule exclusions to make it green** — fix the components. The
axe-off run is the pre-push gate; the axe-on run is the triage command.

## Measurement (2026-07-13)

Full Storybook test-runner run, Chromium, axe on `#storybook-root` per story.

| | with axe (`test-storybook:a11y`) | without axe (`test-storybook`) |
| --- | --- | --- |
| Test suites | **61 failed**, 75 passed, 136 total | 136 passed, 136 total |
| Tests | **368 failed**, 521 passed, 889 total | 889 passed, 889 total |
| Wall time | ~87s | ~64s |

**Every failure is an a11y violation.** With axe off the identical run is 889/889 green — no
story is broken and no play function fails. The 368 failures are purely accessibility defects
in the components themselves.

## Violations by axe rule

Occurrences across the failing run (a single failing story usually trips several rules):

| axe rule | occurrences |
| --- | --- |
| `tabindex` | 346 |
| `nested-interactive` | 260 |
| `aria-label` | 174 |
| `aria-invalid` | 84 |
| `button-name` | 75 |
| `list` | 64 |
| `aria-hidden` | 55 |
| `label` | 45 |
| `color-contrast` | 44 |
| `aria-expanded` | 32 |
| `aria-controls` | 29 |
| `scrollable-region-focusable` | 20 |
| `aria-prohibited-attr` | 20 |
| `region` | 10 |

## Top offending components

Ranked by failure volume in the story run:

1. **RichTextEditor** (`Components/RichTextEditor`)
2. **DataTable** (`Data Table/DataTable`)
3. **CodeBlock** (`UI/CodeBlock`)
4. **ColorPicker** (`UI/ColorPicker`)
5. **Kanban** (`UI/Kanban`)
6. **Charts** — Pie Chart, Bar Chart, Bar Chart Drilldown, Bubble Chart, Stacked Bar Chart
7. Popover, FileUpload, Tree, Drawer, SpeedDial, Emoji Picker, Autocomplete

61 of 136 story files are red in total; the list above is the concentration, not the whole set.
Run the command above for the current, complete list.
