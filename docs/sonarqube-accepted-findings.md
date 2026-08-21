# SonarQube — accepted (Won't-Fix) findings

This file documents the SonarQube findings we **deliberately keep** after the
compliance pass, with the technical reason each is correct as written. They are
all legitimate WAI-ARIA widget patterns (the same ones Radix UI, React-Aria, and
the Angular CDK ship) where the Sonar-suggested native element **cannot** replace
the role without breaking functionality or producing invalid HTML.

Everything else flagged by the scan was fixed by converting to native/semantic
elements (see `git log` for the compliance commits). The demo app, e2e harness,
test bootstrap, and root tooling configs are excluded from the scan in
`sonar-project.properties` because they are **not part of the delivered package**
(clients install the component package + CLI via the CLI, never those files).

> To suppress these in a client's SonarQube: open each issue and mark it
> **Won't Fix** with a link to this file, or mirror it in the project's quality
> profile. The list is intentionally small and concentrated in the advanced
> widgets (rich-text editor, tree, custom selects, drag widgets).

## `Web:S6819` — "use a native element instead of the ARIA role"

Kept only where a native element is impossible:

| Component | Role | Why a native element can't be used |
| --- | --- | --- |
| `rich-text-editor/history` panel revision rows (×2) | `button` | Each row (popover panel + browser dialog) **contains** a nested `<ui-button>` (the "preview" action) and applies on click/Enter/Space. Interactive content can't nest inside a native `<button>`. Moved verbatim from the base editor into the opt-in history addon. |
| `tree-item` children container | `group` | Required by the WAI-ARIA **tree** pattern: a `treeitem`'s child items must live in a `role="group"`. A `<fieldset>` is not a valid child grouping of a `treeitem`. |
| `data-table` column resize handle | `separator` | This is an **interactive splitter** (mouse + touch drag) and it **contains** a child resize-line element. `<hr>` is a void element (no children) and isn't interactive — `role="separator"` is the correct splitter widget role. |
| `rich-text-editor` editable surface | `textbox` | A `contenteditable` rich-text region. `<input>`/`<textarea>` are plain-text only and can't host rich formatting. `role="textbox"` + `aria-multiline` is the WAI-ARIA-endorsed pattern. |
| `rich-text-editor` / `rich-text-mention` / `rich-text-editor/slash-commands` menu (listbox + option) | `listbox`, `option` | Custom, fully-templated mention / slash-command popups. `<select>`/`<datalist>` can't render templated option content (each option is a two-line label + description block). |
| `tree-select` trigger | `combobox` | A custom templated tree-dropdown. `<select>` can't render a tree of templated options. |
| `color-picker` saturation/value area | `slider` | A **two-dimensional** picker (x = saturation, y = value). `<input type="range">` is one-dimensional and cannot represent a 2-D control, so `role="slider"` with `aria-valuetext` is the correct ARIA. (The 1-D hue/alpha sliders use native range inputs.) |

## `typescript:S7741` — "compare with `undefined` directly"

| File | Why `typeof` is required |
| --- | --- |
| `lib/parsers/pdf-pixel-perfect.ts` (`typeof module`) | `module` is a **CommonJS module-scoped** binding, not a global. In an ESM/browser build it is undeclared, so a bare `module === undefined` throws `ReferenceError`. `typeof module !== 'undefined'` is the only safe CJS feature-detection, and `globalThis.module` does not exist. |

All other `S7741` hits were either rewritten (`'window' in globalThis`,
`globalThis.ngDevMode`) or live in the excluded test bootstrap.

## `typescript:S4325` — "unnecessary type assertion"

| File | Why the assertion is required |
| --- | --- |
| `page-renderer.component.ts` (`} as DashboardItem`) | The mapped object literal is structurally **wider** than `DashboardItem` (e.g. `inputs` is a `Record<string, unknown>`), so it is not assignable without the assertion — `satisfies` and removing the cast both fail `tsc`, and dropping it breaks the downstream `item is DashboardItem` type-guard. Sonar's "unnecessary" verdict is a false positive here. |

All other `S4325` assertions were genuinely removable and were deleted.

## `Web:S6845` — "tabIndex on a non-interactive element"

Kept where the focusable `<div>` is a genuinely interactive composite widget
that already has `(keydown)`/`(click)` handlers but cannot take a native
interactive role (it contains its own nested controls):

| Component | Why |
| --- | --- |
| `bento-grid` item | A selectable, drag-and-resizable dashboard card. It has `(click)` + `(keydown.enter/space)` selection handlers, but **contains** its own option button and resize handles, so it can't be a native `<button>`. The `tabindex="0"` is the intended keyboard entry point. |
| `data-table` scroll/keyboard-nav container | The focusable viewport that drives arrow-key cell navigation (`(keydown)="onTableKeydown"`). It hosts the entire interactive table, so it can't be a single native control. |
| `scroll-area` viewport | The `tabindex="0"` makes the scroll viewport keyboard-focusable. This is **required** by axe-core's `scrollable-region-focusable` / WCAG 2.1.1 (keyboard) — removing it fails the project's mandatory axe checks. Sonar's S6845 directly contradicts that rule here, and a `role` can't be added without tripping S6819, so the `tabindex` stays. |
| `virtual-scroll` container | Same `scrollable-region-focusable` case as `scroll-area`: an `overflow-auto` viewport with a `(scroll)` handler that drives the windowing. Without `tabindex="0"` a keyboard-only user cannot scroll the list at all (WCAG 2.1.1) — axe fails the story. It is a scroll container, not a control, so no interactive role applies. |
| `file-viewer` content pane | Same: the `flex-1 overflow-auto` pane that scrolls the rendered document (PDF/DOCX/PPTX/image). Keyboard users reach it only via `tabindex="0"`; axe's `scrollable-region-focusable` requires it. |
| `dock` container | Same: the dock strip is `overflow-x-auto` (it scrolls horizontally when the items exceed `max-w-[calc(100vw-2rem)]`), so axe requires the container to be focusable. The dock items themselves are separately focusable controls; the container is only a scrollport. |
| `tree-item` header | An interactive composite: it carries `(click)` + `(keydown.enter)` + `(keydown.space)` activation and is the tree's per-item focus target, but it **contains** the expand-toggle `<button>`. It therefore can't be a native `<button>` (interactive nesting is invalid HTML) and can't take `role="button"` (a `button` role supports no focusable descendants — axe reports `nested-interactive`, a real WCAG 4.1.2 failure). The `tabindex="0"` is what makes its keyboard handlers reachable; removing it would strip keyboard activation from every tree item. |
| `infinite-canvas` root | The engine's pannable/zoomable plane. It is a genuinely interactive widget — it owns `(pointerdown/move/up)`, `(wheel)` and `(keydown)` handlers, and arrow keys pan while `+`/`-` zoom — so `tabindex="0"` is what makes the whole component keyboard-operable at all (its spec's UC-12). No native control fits: it **contains** the consumer's projected item components, which have their own buttons and form controls, so a native `<button>` or `role="button"` would be invalid interactive nesting (axe `nested-interactive`, a real WCAG 4.1.2 failure). `role="application"` would satisfy "interactive" but is worse: it suppresses browse mode over every projected item, harming the accessibility of the consumer's own content. It is therefore a focusable labelled `role="region"`, the same shape as the scrollport cases above. |

## `Web:S6819` dialog — drawer

| Finding | Why kept |
| --- | --- |
| `drawer` `role="dialog"` | The drawer is a signal-driven modal rendered/removed via `@if`. Switching to a native `<dialog>` would require imperative `showModal()/close()` and change focus-trap, top-layer and `::backdrop` behaviour — a behavioural change. `role="dialog"` + `aria-modal` on a managed div is the same approach the Angular CDK and Radix use. |

(The drawer's backdrop-click dismissal — previously a `MouseEventWithoutKeyboardEquivalentCheck` finding — was fixed by making the overlay a native `<button aria-label="Close">`, which has built-in keyboard activation.)

## `Web:MouseEventWithoutKeyboardEquivalentCheck` — `<ui-button (click)>`

Kept only where the element with the `(click)` handler is a **`<ui-button>`** — the
library's button primitive, which renders a native `<button>` and is therefore
already keyboard-activatable (Enter/Space fire `click`). SonarQube's static HTML
analyzer can't see through the custom tag, so it reports a missing keyboard
handler; **adding one would make the action fire twice on Enter** (once from
ui-button's native activation, once from the redundant `(keydown)`). Raw-element
cases (e.g. the drawer backdrop above) are still fixed with a native `<button>`,
not suppressed — this exemption is scoped to the `ui-button` primitive only.

| File | Instances |
| --- | --- |
| `data-table-range-chart/data-table-range-chart.component.html` | 1 |
| `file-upload/file-upload.component.html` (dropzone `<div>`, see below) | 1 |
| `data-table/data-table.component.html` | 1 |
| `rich-text-editor/rich-text-editor.component.html` | 4 |
| `rich-text-editor/addons/actions/rich-text-actions-dialog.component.html` | 2 |
| `rich-text-editor/addons/links/rich-text-links-form.component.html` | Remove/Cancel/Insert are `<ui-button (click)>` — native `<button>` underneath, Enter/Space already fire click. |
| `rich-text-editor/addons/ai/rich-text-ai-panel.component.html` | Go/Accept/Discard/Retry are `<ui-button (click)>` — native `<button>` underneath, Enter/Space already fire click. |

**The one raw-`<div>` exception — the `file-upload` dropzone.** It is
`role="presentation"` and its `(click)`/drag handlers are a *pointer convenience*,
not the control: the real, natively keyboard-operable control is the
`<input type="file">` **inside** it (visually `sr-only`, fully focusable —
Enter/Space open the picker). So the keyboard path already exists and is the
native one. Adding a `(keydown)` to the wrapper would (a) re-open the picker a
second time when the focused inner input is activated and the event bubbles, and
(b) re-create the focusable-wrapper-around-a-focusable-input `nested-interactive`
axe failure that making it presentational was what fixed. Sonar's static HTML
scan can't see that the keyboard affordance lives on the child input.

## `typescript:S6268` — "make sure disabling Angular built-in sanitization is safe"

Every `bypassSecurityTrust*` call in the package operates **only on
trusted, internally-produced content** — never raw user input — so disabling
sanitization is safe. These were previously suppressed by inline
`// eslint-disable sonarjs/no-angular-bypass-sanitization` comments, but those
shipped into consumers' projects (which don't install `eslint-plugin-sonarjs`)
and surfaced as lint errors. The suppression now lives in the **dev-only,
non-shipped** scanner config (`sonar-project.properties`,
`sonar.issue.ignore.multicriteria`), keyed by rule + file so it survives
re-scans.

| File | Source of the bypassed content |
| --- | --- |
| `file-viewer/file-viewer.component.ts` | `blob:` URLs from `URL.createObjectURL`, and HTML produced by our own DOCX/PDF/PPTX parsers. Never user-supplied strings. |
| `icon/icon.component.ts` | `rawHtml` comes exclusively from `DEFAULT_ICONS` (hardcoded SVG paths) or consumer-registered icons via `provideIcons()`. Never user input. |
| `rich-text-editor/addons/images/rich-text-images-resizer.component.ts` | Trusted static SVG icon constants (alignment + delete) defined in the file. Never user input. |
| `rich-text-editor/addons/images/rich-text-images-button.component.ts` | The trusted static `IMAGE_ICON` SVG constant defined in the file. Never user input. |
| `rich-text-editor/sub/rich-text-toolbar.component.ts` | Trusted static toolbar SVG icons (and developer-supplied custom icons via the public API). Never untrusted end-user input. |
| `rich-text-editor/addons/emoji/rich-text-emoji-button.component.ts` | The trusted static `EMOJI_ICON` SVG constant defined in the file. Never user input. |
| `rich-text-editor/addons/colors/rich-text-colors-button.component.ts` | The trusted static `FOREGROUND_ICON`/`BACKGROUND_ICON` SVG constants defined in the file. Never user input. |
| `rich-text-editor/addons/typography/rich-text-typography-button.component.ts` | The trusted static `SIZE_ICON`/`FAMILY_ICON` SVG constants defined in the file. Never user input. |
| `rich-text-editor/addons/links/rich-text-links-button.component.ts` | The trusted static `LINK_ICON` SVG constant defined in the file. Never user input. |
| `rich-text-editor/addons/tables/rich-text-tables-button.component.ts` | The trusted static `TABLE_ICON` SVG constant defined in the file. Never user input. |
| `rich-text-editor/addons/file-import/rich-text-file-import-button.component.ts` | The trusted static `IMPORT_ICON` SVG constant defined in the file. Never user input. |

> To suppress these in a client's SonarQube: mark each issue **Won't Fix** /
> **Accepted** with a link to this file, or mirror the file/rule exclusion in
> their own scanner config.

## `typescript:S5843` — "regular expression is too complex" (FIXED, not accepted)

The syntax-highlighter keyword matchers in `code-block.component.ts` were single
long `\b(kw1|kw2|…)\b` regex literals (complexity up to 49). They are now built
at runtime from per-language keyword **arrays** via a small `keywordPattern()`
helper, so there is no longer a complex regex *literal* to flag — and the
keyword lists are more maintainable. Matching behaviour is byte-for-byte
identical (same pattern string, no flags), verified by the code-block test
suite. No suppression needed.

## Security Hotspots

ReDoS hotspots (`S5852`) were **eliminated at the source** — every flagged
regex was rewritten to a linear form (negated character classes between
delimiters, collapsed overlapping quantifiers, atomic-group `(?=(\s+))\1`,
unrolled-loop comment matchers) or had its open quantifiers **bounded**
(`{0,N}` with a generous N), so SonarQube no longer reports them. Behaviour is
verified by the parser/markdown/code-block/CLI test suites.

The remaining hotspots are categorical false positives for this codebase and
are marked **Reviewed / Safe** (via `scripts/sonar-hotspots-safe.mjs`):

| Rule | Count | Why safe |
| --- | --- | --- |
| `S2245` (insecure randomness) | 29 | `Math.random()` drives **visual animations** only (confetti, particles, meteors, …) — never a security/cryptographic context. |
| `S4036` (OS command from PATH) | 5 | The **dev CLI** and the maintainer tooling (`check-completeness`, `new-component`, `release-cli`, `migrate-core`) intentionally invoke `git`/`npm`/`npx` from `PATH`; every command is a fixed literal and no argument is attacker-controlled. Resolving these to absolute paths is not possible across the platforms the CLI supports. |

Result: Security Hotspots reviewed = 100%, 0 to-review.

## Notes

- `Web:S6845` ("tabIndex on non-interactive element") and the form-control
  roles (`checkbox`, `radio`, `slider`, `progressbar`) are **not** in this list —
  they were fixed by converting to native inputs / making the focus target
  genuinely interactive. See the compliance commits.

## `Web:S6819` (`role="img"`/`role="group"`) + `MouseEventWithoutKeyboardEquivalentCheck` — data-viz charts

Chart/heatmap components render an inline `<svg>` carrying an ARIA role +
`[attr.aria-label]` — the WAI-ARIA "complex graphic" pattern. S6819 wants a native
`<img>`, which is impossible for inline SVG, so the role is required, not redundant.
Scoped in `sonar-project.properties` to `*chart*`, `heatmap`, `calendar-heatmap`,
`histogram`, `boxplot`, `candlestick` and `treemap` component HTMLs only (raw
non-chart elements stay checked).

### The `*chart*` glob is a pattern-level defect, not a four-name gap

The last four are listed individually for a purely mechanical reason, and it is
worth stating plainly because it will keep recurring:

> **`packages/components/ui/*chart*/` silently fails to match any chart whose
> folder name does not literally contain the substring `chart`.**

`histogram`, `boxplot`, `candlestick` and `treemap` are all charts, all render the
same inline-SVG-under-`role="group"` pattern, and **none of them contains
`chart`** — so the family glob skips all four. `heatmap` and `calendar-heatmap`
were already in this list for exactly the same reason, which means the workaround
has now been applied three separate times.

Confirmed against a real scan rather than assumed: the identical finding fires on
`tree/sub/tree-item.component.html` ("Use `<address>` or `<details>` or
`<fieldset>` or `<optgroup>` instead of the group role"), which is precisely what
these four charts' containers would otherwise report.

**Do not fix this by appending a fifth, sixth and seventh name.** The glob is
matching on a naming coincidence rather than on what the files actually are. The
next person to touch this should replace the name-matching with something that
tracks the real property — for example an explicit chart-family list generated
from the registry's `category: 'charts'`, or a marker the chart components
themselves carry. Until then, every new chart not named `*chart*` needs a manual
entry here and will otherwise fail the Sonar gate for a reason that has nothing
to do with its code.

The same glob shape is used for the CPD exclusions further down
(`sonar.cpd.exclusions`), so it has the identical blind spot there.

Which role: charts whose data points are keyboard-focusable (`tabindex="0"` on
`<rect>`/`<circle>`) use **`role="group"`**, not `role="img"`. `role="img"` makes the
whole subtree presentational, which contradicts — and hides from assistive tech — the
focusable points inside it; axe reports that as `nested-interactive`, and it is a real
WCAG 4.1.2 failure, not a false positive. Static charts with no focusable data points
(`bullet-chart`, `gauge-chart`) keep `role="img"`, which is correct for them. See
`docs/a11y-backlog.md`.

## CPD exclusions — inherently repetitive files

`sonar.cpd.exclusions` skips copy-paste detection on files that are repetitive
**by design**, where CPD is noise: `*-locales.ts`/`*.locales.ts` (i18n
dictionaries — every language carries the same key structure), the generated
`registry/legacy-baselines.ts` hash table, and `emoji-data.ts` (a static lookup
table). Real logic files (including all chart implementations) remain in CPD.

## `Web:S6845` — `tabindex` on the infinite-canvas root

`packages/components/ui/infinite-canvas/infinite-canvas.component.html`

The rule objects to `tabindex` on a non-interactive element. The `<section>` it
flags **is** interactive: it is the pan/zoom surface, and it handles
`pointerdown`/`pointermove`/`wheel` plus a keyboard map (arrow keys pan,
`+`/`-` zoom, `0` resets). Without `tabindex="0"` the canvas is unreachable by
keyboard, which is the WCAG 2.1.1 failure the rule is nominally protecting
against — so honouring it here would *cause* the defect it guards.

The element is not silently a widget either: it carries `aria-label` and
`aria-roledescription="pannable and zoomable canvas"`, and `e2e/harness/
infinite-canvas` asserts that focusing it and pressing `ArrowRight` pans the
plane on one axis only. Making it a `<button>` — the rule's usual remedy — is
wrong: it is a 2-D manipulation surface, not a command.

## `Web:ItemTagNotWithinContainerTagCheck` — `<dt>` in data-list-item

`packages/components/ui/data-list/sub/data-list-item.component.html`

The rule wants every `<dt>` surrounded by a `<dl>` **in the same file**. Here
the `<dt>`/`<dd>` pair lives inside an `<ng-template #row>` that the parent
`ui-data-list` stamps into its own `<dl>` via `ngTemplateOutlet` — so at
runtime the container relationship holds exactly, and it is asserted by both
`data-list.component.spec.ts` and `e2e/harness/data-list`, which check that
`dl > *` yields only `DT`/`DD` with no wrapper element in between.

This indirection is deliberate and load-bearing. The rows were previously
projected with `display: contents` on the host, which does **not** satisfy
`definition-list`/`dlitem`: those rules inspect the DOM tree, not the
accessibility tree, so a host sitting between `<dl>` and `<dt>` is a *serious*
axe violation whatever it computes to. Stamping through a template is what
removes the host from the document entirely. A single-file static check cannot
see across that boundary.
