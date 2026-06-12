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
| `file-upload` dropzone | `button` | The dropzone **contains** an `<input type="file">` and, when files are present, nested remove `<button>`s. A native `<button>` may not contain interactive content (invalid HTML), so the activatable container stays `role="button"` with explicit keyboard handlers. |
| `rich-text-editor` history rows (×2) | `button` | Each row **contains** a nested `<ui-button>` (the "preview" action). Interactive content can't nest inside a native `<button>`. |
| `tree-item` header | `button` | The clickable header **contains** the expand-toggle `<button>`. Interactive nesting again. |
| `tree-item` children container | `group` | Required by the WAI-ARIA **tree** pattern: a `treeitem`'s child items must live in a `role="group"`. A `<fieldset>` is not a valid child grouping of a `treeitem`. |
| `data-table` column resize handle | `separator` | This is an **interactive splitter** (mouse + touch drag) and it **contains** a child resize-line element. `<hr>` is a void element (no children) and isn't interactive — `role="separator"` is the correct splitter widget role. |
| `rich-text-editor` editable surface | `textbox` | A `contenteditable` rich-text region. `<input>`/`<textarea>` are plain-text only and can't host rich formatting. `role="textbox"` + `aria-multiline` is the WAI-ARIA-endorsed pattern. |
| `rich-text-editor` / `rich-text-mention` autocomplete (listbox + option) | `listbox`, `option` | Custom, fully-templated mention/autocomplete popups. `<select>`/`<datalist>` can't render templated option content. |
| `tree-select` trigger | `combobox` | A custom templated tree-dropdown. `<select>` can't render a tree of templated options. |
| `color-picker` saturation/value area | `slider` | A **two-dimensional** picker (x = saturation, y = value). `<input type="range">` is one-dimensional and cannot represent a 2-D control, so `role="slider"` with `aria-valuetext` is the correct ARIA. (The 1-D hue/alpha sliders use native range inputs.) |

## `typescript:S7741` — "compare with `undefined` directly"

| File | Why `typeof` is required |
| --- | --- |
| `lib/parsers/pdf-pixel-perfect.ts` (`typeof module`) | `module` is a **CommonJS module-scoped** binding, not a global. In an ESM/browser build it is undeclared, so a bare `module === undefined` throws `ReferenceError`. `typeof module !== 'undefined'` is the only safe CJS feature-detection, and `globalThis.module` does not exist. |

All other `S7741` hits were either rewritten (`'window' in globalThis`,
`globalThis.ngDevMode`) or live in the excluded test bootstrap.

## `Web:S6845` — "tabIndex on a non-interactive element"

Kept where the focusable `<div>` is a genuinely interactive composite widget
that already has `(keydown)`/`(click)` handlers but cannot take a native
interactive role (it contains its own nested controls):

| Component | Why |
| --- | --- |
| `bento-grid` item | A selectable, drag-and-resizable dashboard card. It has `(click)` + `(keydown.enter/space)` selection handlers, but **contains** its own option button and resize handles, so it can't be a native `<button>`. The `tabindex="0"` is the intended keyboard entry point. |
| `data-table` scroll/keyboard-nav container | The focusable viewport that drives arrow-key cell navigation (`(keydown)="onTableKeydown"`). It hosts the entire interactive table, so it can't be a single native control. |

(`scroll-area`'s viewport was fixed by adding `role="region"` + an
`aria-label` input — a labelled scroll region legitimately takes `tabindex`.)

## `Web:S6819` dialog + `MouseEventWithoutKeyboardEquivalentCheck` — drawer

| Finding | Why kept |
| --- | --- |
| `drawer` `role="dialog"` | The drawer is a signal-driven modal rendered/removed via `@if`. Switching to a native `<dialog>` would require imperative `showModal()/close()` and change focus-trap, top-layer and `::backdrop` behaviour — a behavioural change. `role="dialog"` + `aria-modal` on a managed div is the same approach the Angular CDK and Radix use. |
| `drawer` overlay click without keyboard handler | The overlay is `aria-hidden="true"` (decorative). Backdrop-click dismissal is inherently pointer-only; keyboard users dismiss with **Escape**, which is handled on the dialog container (`(keydown)="onKeydown"`). |

## Notes

- `Web:S6845` ("tabIndex on non-interactive element") and the form-control
  roles (`checkbox`, `radio`, `slider`, `progressbar`) are **not** in this list —
  they were fixed by converting to native inputs / making the focus target
  genuinely interactive. See the compliance commits.
