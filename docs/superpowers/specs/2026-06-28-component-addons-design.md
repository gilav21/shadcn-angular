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
2. **Attach mechanism = DI host contract, zero runtime ceremony.** The base
   exposes extension points; the addon attaches via Angular DI with no runtime
   registration. Once the addon's attribute is present on a `<ui-data-table>`
   tag, it "just works" — no `registerModules()`, no provider wiring in app code.
3. **`add` and wiring are SEPARATE commands.** `add` only makes the addon
   *available* (copies files, installs deps) and **never touches the dev's app
   code**. A separate **`apply`** command does the optional, explicit,
   targeted text-wiring into a chosen usage. The dev controls where the feature
   is actually used — the CLI does not guess or silently edit consumer files on
   `add`.

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

**CLI UX (`packages/cli/src/core/` + commands):** two distinct commands —
`add` makes an addon *available*, `apply` optionally wires it into a usage.

`add` — **install only, never touches consumer app code:**
- `add data-table` → after resolving the base, if it has `addons`, show an
  interactive **multiselect**: `all / none / pick`. Default = **none** (lean
  base); non-interactive flags `--with ai,export` / `--addons all` / `--no-addons`.
- `add data-table/ai` → the **"later, real quick"** path: install a single addon
  onto an already-installed base. If the base is missing, offer to add it too.
- On install the CLI: writes the addon files into the library folder, installs
  the addon's own `npmDependencies`/`libFiles` (so `xlsx` only arrives with
  `export`). **It does not read or edit any consuming component.** It prints a
  one-line hint: add the `dtExport` attribute where you want it, or run `apply`.

`apply` — **explicit, opt-in, targeted wiring (the only command that edits app code):**
- `apply data-table/export [targeting]` → inserts the addon's `import` + attribute
  into the dev's `<ui-data-table>` usage(s) via best-effort AST edit.
- **Installs the addon first if it isn't already present** (runs the `add` step
  internally), so `apply` is the true one-liner: install + wire in one command —
  the "let me add that real quick" path. If the addon is already installed it
  skips straight to wiring. (`add` alone remains available for install-without-wiring.)
- **Targeting hints** filter *which* usages get wired, so the CLI never guesses.
  Two distinct "class" notions exist — keep them separate flags:
  - `--all` → every `<ui-data-table>` in scope
  - `--component <Name>` (alias `--in`) → only usages inside the named **Angular
    component class** (e.g. `OrdersPageComponent`). Repeatable / comma-separated.
  - `--class <token>` → instances whose tag **CSS `class="…"`** contains the token
  - `--id <token>` → instances matching that id / template-ref / `data-testid`
- **Scope = path-scoped** by default: the current directory, or an explicit path
  arg (`apply data-table/export ./src/app/orders`). `--all` means "all usages
  *within that scope*", keeping blast radius small. `--component`/`--class`/`--id`
  further filter within the scope.
- **Interactive pick** when no targeting hint is given and >1 usage is found: list
  the matched usages grouped by their host component and let the dev multiselect
  which to wire. (This is the "make it a choice" path.)
- **Snippet fallback** (never a hard failure): in non-interactive runs (CI, `--yes`)
  where the target is still ambiguous, or nothing matches, print the exact import +
  attribute lines to paste and edit nothing.
- Idempotent: re-running on an already-wired usage is a no-op.

`update` preserves the set of installed addons. `why` and `list` surface addons.
MCP tools `add_component`, `get_install_plan`, `get_component` surface addons;
an `apply_addon` MCP tool mirrors the `apply` command.

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
  per-addon npm/lib install (no consumer-file editing in the `add` path).
- `packages/cli/src/commands/add*` — multiselect prompt, `--with/--addons/--no-addons`,
  `add <parent>/<addon>` shorthand. **Install-only; never edits app code.**
- `packages/cli/src/commands/apply*` (NEW) — best-effort AST insert of import +
  attribute, `--all/--class/--id` targeting, path-scoped, snippet fallback.
- `packages/cli/src/mcp/tools/*` — surface addons in read/write tools; add an
  `apply_addon` tool mirroring `apply`.
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
- Addon directive uses an **attribute selector** (`[dtExport]`) so the feature is
  off until the dev writes that attribute on a specific table — per-usage opt-in.
  (Alternative: an element selector that auto-applies to *every* `<ui-data-table>`
  once imported — rejected; too blunt for real apps with multiple tables.)
- `apply` targeting set — `--all`, `--component`/`--in` (Angular component class),
  `--class` (tag CSS class), `--id`. The two "class" notions are deliberately
  separate flags to avoid ambiguity. Add more hints only if a real need appears.
- `apply` with no target + >1 usage — **interactive multiselect** (grouped by host
  component); snippet-print is the non-interactive fallback only.
- `apply` scope — **default path-scoped** (current dir / explicit path arg) rather
  than whole-project, to keep edits' blast radius small; targeting flags filter
  within that scope.
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
  (lean — assert no `xlsx` in package.json, no addon files). Then
  `add data-table/export` — assert addon files written + `xlsx` added, and assert
  **the consumer component is untouched** (add must not edit app code). Then
  `apply data-table/export --id ordersTable` — assert the import + `dtExport`
  attribute were inserted into the targeted usage only, and drive Playwright to
  confirm the export button works. Also assert the **snippet fallback** path:
  `apply` with two matching usages and no target prints the snippet and edits
  nothing. Mirror for `context-menu`.
- `npm run e2e:scaffold -- data-table` updates / add an addon-specific harness.
- Confirm the base component compiles and tree-shakes with **no** addon imports
  (proves one-directional decoupling).
