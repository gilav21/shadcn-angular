# Directives

Most registry entries install a **component** — an element you write as a tag,
like `<ui-button>`. A handful install a **directive** instead: you write it as
an *attribute* on an element you already have.

```html
<!-- component: a new element -->
<ui-button label="Save" />

<!-- directive: an attribute on an existing element -->
<input uiInputMask="(000) 000-0000" />
```

They are installed exactly like components:

```bash
npx @gilav21/shadcn-angular add input-mask
```

…and they are listed alongside components in `list` and `help`, because the
registry has a single flat namespace. To tell them apart from the CLI, use
`search` or `why` — both print the entry's description, and **every directive's
description begins with the word "Directive"**:

```bash
npx @gilav21/shadcn-angular search context menu
#   context-menu-attach  [utility] Directive that attaches a context menu to any element…

npx @gilav21/shadcn-angular why copy-to
```

That leading-word convention is enforced by a unit test
(`packages/cli/src/registry/registry-meta.spec.ts`), so it holds for any
directive added later too.

## The full list

| Name | Selector | Attaches to | What it does |
|---|---|---|---|
| `input-mask` | `[uiInputMask]` | any input | Formats input text against a pattern (phone, date, card numbers). |
| `copy-to` | `[uiCopyTo]` | any element | Copies a string to the clipboard on click and shows a localized "Copied!" indicator. |
| `context-menu-attach` | `[uiContextMenuAttach]` | any element | Attaches a context menu, opened by right-click or long-press. |
| `tree-context-menu` | `ui-tree[uiTreeContextMenu]` | `<ui-tree>` | Wires a context menu to tree nodes for per-node right-click actions. |
| `table-context-menu` | `table[uiTableContextMenu]`, `[uiTable]` | `<table>` | Wires a context menu to table rows and headers. |
| `data-table-context-menu` | `ui-data-table[uiDataTableContextMenu]` | `<ui-data-table>` | Adds right-click context menus to data-table rows and columns. |
| `component-outlet` | `[uiComponentOutlet]` | any element | Dynamically renders a component by reference into the DOM. |
| `ripple` | `[uiRipple]` | any element | Adds a Material-style click ripple effect. |
| `magnetic` | `[uiMagnetic]` | any element | Makes an element drift toward the cursor like a magnet. |
| `confetti` | `[uiConfetti]` | any element | Bursts celebratory confetti particles on a triggered event. |

> `data-table-context-menu` (the directive, `uiDataTableContextMenu`) is a
> different entry from the `data-table/context-menu` **addon**. The addon is
> installed with `apply data-table/context-menu` and wires itself in via DI; the
> directive is applied by hand as an attribute.

## Why they are not their own category

A `directives` registry category was considered and rejected. The category
*values* are not validated by `isValidRegistryShape`, so publishing one would
not break already-installed CLIs — but the grouping that would make it *useful*
(`help`'s `CATEGORIES` loop and `CATEGORY_LABELS`) lives in bundled CLI code.
Until an npm release shipped that code, every already-installed CLI would
silently omit the directives from `help` entirely, because `buildComponentsSection`
skips any category it does not know. That is strictly worse discoverability than
today. See `specs/quality-gaps-spec.md` §3.3 and Task 6 for the full finding.
