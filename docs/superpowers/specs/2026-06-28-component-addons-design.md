# Component Addons ("Puzzle") System — Design Spec

**Date:** 2026-06-28
**Status:** Approved design — ready for implementation planning

## Context

The library's large compound components (`data-table` at ~5,100 lines,
`rich-text-editor` at ~6,534 lines) have accumulated many optional features —
AI helpers, export, import parsers, context menus — all woven **inline** into a
single monolithic component file. In the shadcn model the source lands in the
consumer's repo and **they own it forever**, so every shipped line is a line the
dev maintains. Even a 55-line AI helper is "another file (or block) living in my
git that I never asked for."

The goal: a **base component + opt-in addons** system where, at `add` time, the
dev chooses which addons to include (all / none / pick), and can add an addon
later in **one command** ("oh, you can have a ready-made context menu for the
data-table — let me add that real quick"). The hard constraint: **do not become
ag-grid module hell** — no runtime `ModuleRegistry.registerModules()`, no
ceremony in app code, no features gated behind 100 commands/installs.

### Why we can avoid ag-grid hell
ag-grid must gate features behind runtime module registration because it ships as
a **compiled npm package** — that's the only way to keep its bundle small. This
library **owns the source** and the CLI assembles files from git at install time,
so puzzle pieces snap together at **`add` time, not runtime**. That is the thing
ag-grid structurally cannot do.

### Decisions already locked (with the user)
1. **Opt-in unit = files.** An addon is a separately-installable set of files,
   chosen by the dev. A feature that is never wanted should not exist in their repo.
2. **Attach mechanism = auto-wire, zero-touch.** The base exposes extension
   points; the addon attaches via Angular DI with no runtime registration and no
   editing of the (owned) base component file. CLI adds the file and wires the
   one attribute/import.

### What today's code actually looks like (verified)
- AI is **already zero-dependency**: `lib/ai.ts` is 55 lines of types + a
  `runAiTask` helper; the component takes `aiProvider = input<AiProvider |
  undefined>(undefined)` and no-ops if unset. No AI SDK is pulled.
- The real weight is (a) **source/cognitive weight** of the monolith the dev
  owns, and (b) **transitive npm deps** like `xlsx`/PDF-DOCX parsers pulled via
  `npmDependencies` whether or not the dev exports.
- Features today are inline, gated only by `enable*` boolean inputs. **None are
  separate files** — so the addon model *requires* extracting them.
- The registry already has unused scaffolding: `optionalDependencies` exists on
  `ComponentDefinition` but is **informational only** (never consulted by the
  resolver); `peerFiles` already models "extra files installed only when needed."

---

## The Addon Architecture

### 1. Code shape: addon = an Angular directive that auto-wires via DI

An addon's primary artifact is a **directive with an attribute selector** that
attaches to the base component's host element and talks to the base through a
small, typed **host contract** obtained by DI.

```
ui/data-table/
  data-table.component.ts          # lean base — knows NOTHING about addons
  data-table.host.ts               # NEW: DataTableAddonHost contract (the API addons use)
  addons/
    context-menu/
      context-menu.directive.ts    # selector: '[dtContextMenu]'
      index.ts
    ai/
      ai.directive.ts              # selector: '[dtAi]'  (+ ai.component.html for its UI panel)
      index.ts
    export/
      export.directive.ts          # selector: '[dtExport]' (pulls xlsx here, not in base)
      index.ts
```

- The base component
  **`providers: [{ provide: DataTableAddonHost, useExisting: DataTableComponent }]`**
  (or exposes itself as the token). Crucially the base **does not import any addon** —
  decoupling is one-directional, so the base stays lean and addons are purely additive.
- The addon directive does `private readonly host = inject(DataTableAddonHost)`
  in its constructor and registers its capability (e.g.
  `host.registerContextMenuProvider(...)`, `host.registerToolbarSlot(...)`,
  reads `host.columns()`, calls `host.applyFilter(spec)`).
- **Zero runtime registry, zero ceremony** — Angular's DI + selector matching is
  the wiring. Per-usage opt-in via the attribute (`<ui-data-table dtContextMenu>`);
  the directive only needs to be in the consuming standalone component's `imports`.

### 2. The host extension contract (the real API-design work)

Each addon-capable base ships a `*.host.ts` defining the **minimum public surface**
addons need — this is the stable boundary that lets the base internals change
without breaking addons. Sketch for data-table:

```ts
export abstract class DataTableAddonHost<T = unknown> {
  abstract columns(): readonly ColumnDef<T>[];
  abstract filteredData(): readonly T[];
  abstract applyFilter(spec: NlFilterSpec): void;
  abstract registerToolbarSlot(slot: ToolbarSlot): () => void;        // returns teardown
  abstract registerContextMenuProvider(p: ContextMenuProvider<T>): () => void;
  abstract registerCellEditor(/* ... */): () => void;
  // ...only what addons genuinely need
}
```

rich-text already has the pattern to mirror: `RichTextCommandRegistry`
(injectable, `registerCommand` returns an unregister fn). The host contract
generalizes that idea to all extension points.

### 3. Registry & CLI mechanism

**Registry schema (`ComponentDefinition` in `packages/cli/src/registry/index.ts`):**
- Addons are first-class registry entries keyed `parent/addon` (e.g.
  `data-table/ai`, `data-table/context-menu`) with new fields:
  ```ts
  type?: 'component' | 'block' | 'addon';
  parent?: ComponentName;                 // addon → its base
  attach?: { import: string; selector?: string; snippet?: string };
  addons?: readonly string[];             // base → its available addon keys
  ```
- `attach` tells the CLI how to wire: which symbol to import and which attribute
  to add to the base's usage tag.
- The existing **informational `optionalDependencies`** is migrated to real
  addon entries and then retired.

**CLI UX (`packages/cli/src/core/` + commands):**
- `add data-table` → after resolving the base, if it has `addons`, show an
  interactive **multiselect**: `all / none / pick`. Default = **none** (lean
  base); non-interactive flags `--with ai,export` / `--addons all` / `--no-addons`.
- `add data-table/ai` → the **"later, real quick"** path: install a single addon
  onto an already-installed base. If the base is missing, offer to add it too.
- On install the CLI: writes the addon files, installs the addon's own
  `npmDependencies`/`libFiles` (so `xlsx` only arrives with `export`), then
  **auto-wires**: best-effort insert of the `import` + attribute into the
  consuming usage; if it can't find a unique usage, **print the exact snippet**
  to paste (graceful fallback, never a hard failure).
- `update` preserves the set of installed addons. `why` and `list` surface addons.
- MCP tools `add_component`, `get_install_plan`, `get_component` surface addons.

**Resolver (`packages/cli/src/core/resolve.ts` / `install.ts`):**
- `resolveDependencies` learns to resolve selected addons alongside the base and
  collect their deps. Base resolution **never** auto-pulls addons.

**sync-registry (`packages/cli/scripts/sync-registry.ts`):**
- Discover `ui/<comp>/addons/<addon>/` folders; each becomes an addon registry
  entry under the parent with its own import-walked `files[]` / `npmDependencies`
  / `libFiles`.
- Enforce the **one-directional boundary**: the base's import-walk must NOT reach
  into `addons/` (else addon files get folded into the base and the lean split is
  lost). The base barrel `index.ts` must NOT re-export addons.

### 4. Base-vs-addon split (recommended starting inventory)

Extract the **cleanly-separable, heaviest** features first; leave deeply-woven
ones inline behind their existing `enable*` flags (extracting virtual-scroll or
cell-range is high-risk and low-reward for v1).

- **data-table base keeps:** sorting, pagination, basic + column filtering, row
  selection, column resize/reorder, inline edit, virtual scroll.
- **data-table addons (v1):** `ai` (nl-filter + fill), `export` (csv/excel +
  `xlsx`), `import` (clipboard/parsers), `context-menu`, `advanced-filter-builder`.
- **rich-text base keeps:** core editing, toolbar, sanitizer, paste-normalizer.
- **rich-text addons (v1):** `ai`, `file-import` (DOCX/PDF + parsers),
  `markdown-mode`, `mentions-tags`, `emoji`, `history`.

> The exact split is a **per-component design pass** during implementation, not
> fixed here. The principle: a feature becomes an addon when its code +
> deps can live behind a clean host-contract boundary and a real subset of devs
> won't want it.

---

## Phasing (keep blast radius small)

1. **Mechanism first, one pilot addon.** Build the registry/CLI/sync addon
   support + the `DataTableAddonHost` contract, and extract **one** clean addon
   (`data-table/context-menu` or `data-table/export`) end-to-end. Prove the
   zero-touch auto-wire and the `add data-table/<addon>` flow.
2. **Extract the rest of data-table's v1 addons** against the proven contract.
3. **Apply to rich-text** (reuse the `RichTextCommandRegistry` precedent).
4. **Retire `optionalDependencies`** once all are migrated.

---

## Files to create / modify (representative)

- `packages/cli/src/registry/index.ts` — `ComponentDefinition`: add `type:'addon'`,
  `parent`, `attach`, `addons`; migrate `optionalDependencies`.
- `packages/cli/src/registry/load.ts` — `isValidRegistryShape` accepts new fields.
- `packages/cli/src/core/resolve.ts`, `plan.ts`, `install.ts` — addon resolution,
  per-addon npm/lib install, auto-wire/print-snippet step.
- `packages/cli/src/commands/add*` — multiselect prompt, `--with/--addons/--no-addons`,
  `add <parent>/<addon>` shorthand.
- `packages/cli/src/mcp/tools/*` — surface addons in read/write tools.
- `packages/cli/scripts/sync-registry.ts` (+ `sync-registry-lib.ts`) — discover
  `addons/`, enforce boundary, emit addon entries.
- `packages/components/ui/data-table/data-table.host.ts` — host contract (NEW).
- `packages/components/ui/data-table/addons/<addon>/...` — extracted addon dirs.
- `packages/components/ui/data-table/data-table.component.ts` — expose host
  contract via `providers`, remove extracted feature code, keep `enable*` flags
  for inline-staying features.
- `packages/components/registry.json` — regenerated by `sync-registry --fix`.

## Open decisions (call out, don't block)
- Exact base/addon split per component (per-component pass in Phase 2/3).
- Auto-apply by import-only vs require attribute — **recommend attribute** for
  per-usage opt-in; revisit if devs want global-on.
- CLI auto-insert of the attribute into existing usages: start with **best-effort
  AST insert + snippet-print fallback**; full AST rewrite can come later.
- Default addon selection on `add` — **recommend `none`** (lean by default).

## Publish impact
This changes **CLI logic + the `ComponentDefinition` shape** → an **npm publish IS
required** (already-installed CLIs can't parse the new manifest otherwise). Add to
the pending-releases memory when the PR lands. (Per CLAUDE.md "When a CLI npm
Publish Is Required".)

## Verification
- Unit: registry-shape validator accepts addon entries; resolver pulls a base
  without addons and a base + selected addons; addon brings its own npm dep
  (`xlsx` only with `export`).
- CLI e2e (the real gate): scaffold a pristine consumer app, `add data-table`
  (lean — assert no `xlsx` in package.json, no addon files), then
  `add data-table/export` (assert files written, `xlsx` added, usage auto-wired),
  then drive Playwright to confirm the export button works. Mirror for `context-menu`.
- `npm run e2e:scaffold -- data-table` updates / add an addon-specific harness.
- Confirm the base component compiles and tree-shakes with **no** addon imports
  (proves one-directional decoupling).
