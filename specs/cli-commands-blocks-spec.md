# CLI v2 — `update` / `search` / `doctor` commands + blocks mechanism (Spec A)

## Goal

Extend the shadcn-angular CLI with three new commands and a **blocks** capability,
bundled so they ship in a single npm publish. This is **Spec A** — the foundation
that gates the next publish. The full block **catalog** (Auth, Dashboard, Settings,
Marketing & commerce — 20-40+ authored pages) is **Spec B**, built incrementally
*after* this publish using the `frontend-design` skill + per-block subagents; new
blocks ship as they are authored without re-publishing the mechanism.

This builds directly on the `core/` layer extracted for the MCP server
(`packages/cli/src/core/`): `resolve`, `fetch`, `plan`, `install`, `diff-core`,
`search`. The new commands are thin wrappers over that layer; blocks reuse the
existing `add`/dependency-resolution/install pipeline.

## Decisions (locked during brainstorming)

| Decision | Choice |
| --- | --- |
| Publish gate | **Spec A only** — commands + blocks mechanism + 4 seed blocks. Catalog (B) is post-publish, incremental. |
| Commands | `search`, `update`, `doctor` |
| Block model | A block is a **registry entry with `type: 'block'`** — reuses the add/install pipeline |
| Block repo location | New top-level `packages/blocks/<name>/` |
| Block install destination | Interactive `add` **prompts** (default `aliases.blocks` → `@/blocks`); `--path` overrides; non-interactive uses `aliases.blocks` |
| Seed blocks | 4: `login`, `dashboard`, `settings-profile`, `pricing` |

## Commands

### `search <query>`
Print ranked matches using the existing `core/search.ts` `searchComponents`.
Columns: name, category, short description. `--json` emits the raw `SearchHit[]`.
No project config needed (registry is bundled). Empty query → usage error.

### `update [components...]`
Mirrors `add`'s diff-then-overwrite model, scoped to **installed** components:
1. Resolve the target set — named components, or all currently installed
   (detected by presence on disk under `aliases.ui`).
2. For each, compute a structured diff via `core/diff-core` `diffComponentFiles`.
3. Show which have updates; **prompt** to select which to overwrite
   (reusing the `promptOverwrite` UX). `-y/--yes` selects all; `--dry-run`
   prints the plan and exits without writing.
4. Apply via `core/install` `performInstall({ overwrite })`.
Errors if `components.json` is absent. Flags: `-y`, `--dry-run`, `--remote`,
`-b/--branch`, `-r/--registry`.

### `doctor`
Read-only health report. For every **installed** component (present under
`aliases.ui`), use `core/plan` `detectConflicts` + registry data to report:
- **Missing files** — component partially present (some files absent).
- **Modified (drift)** — local files differ from the registry version.
- **Missing npm dependencies** — declared `npmDependencies` not in the
  consumer's `package.json`.
- **Stale lib files** — `libFiles` differing from the registry.
Prints a sectioned summary; **exits 0 when clean, 1 when any issue is found**
(scriptable). Errors if `components.json` is absent.

## Blocks mechanism

### Registry representation
Extend `ComponentDefinition` with an optional discriminator:
```ts
readonly type?: 'component' | 'block';   // default 'component'
```
A block entry example:
```ts
login: {
  name: 'login',
  type: 'block',
  files: ['login/login.component.ts', 'login/login.component.html', 'login/index.ts'],
  dependencies: ['button', 'input', 'label', 'card', 'checkbox'],
  category: 'auth',                 // new block categories — see below
  description: 'Email/password login page with a card layout and validation.',
  tags: ['login', 'auth', 'sign-in', 'form'],
},
```
The `dependencies` are ordinary components, so `resolveDependencies` pulls them
in and `performInstall` installs them to `aliases.ui` exactly as today.

### Block categories
`CATEGORIES` gains block-family values used only by `type:'block'` entries:
`'auth'`, `'dashboard'`, `'settings'`, `'marketing'`. (Component entries keep the
existing 11-value taxonomy.) The coverage test allows these for blocks.

### Repo location + fetch routing
Block source lives at `packages/blocks/<name>/` (folder + trio + `index.ts`,
mirroring the component layout). Because component source is fetched from
`packages/components/ui` and blocks from `packages/blocks`, fetch must route by
entry kind:
- `paths.ts` gains `getBlockRegistryBaseUrl(branch, registry)` (→
  `…/packages/blocks`) and `getLocalBlocksDir()`.
- `core/fetch.ts` `fetchComponentContent`/`fetchAndTransform` accept an optional
  `kind: 'component' | 'block'` (default `'component'`) selecting the base URL +
  local dir. `core/install` passes the entry's `type` through.
- `sync-registry.ts` scans `packages/blocks/` in addition to `packages/components/ui`,
  emitting block entries with `type:'block'`; `validate-registry` accepts them.

### Install destination
- `Config.aliases` gains optional `blocks?: string` (default `@/blocks` →
  `src/blocks`). Missing in an existing `components.json` → fall back to the default.
- `core/install` routes a block entry's own files to the blocks base
  (`aliases.blocks` or an explicit `path`), while its component dependencies
  still install to `aliases.ui`. (`performInstall` already separates the entry
  set; routing keys off `registry[name].type`.)
- Interactive `add`: when the resolved set contains a block, **prompt** for that
  block's destination (default `aliases.blocks`); `--path` overrides and skips the
  prompt. Non-interactive (`--yes`, MCP) uses `aliases.blocks`/`path`.

### Discovery
- `list`, `help`, and `search` group blocks in a dedicated **Blocks** section
  (grouped by block category), separate from components.
- MCP read tools (`list_components`, `search_components`, `get_component`) include
  the `type` field so agents distinguish blocks; `add_component` installs blocks
  (uses `path`, else `aliases.blocks`).
- `init` writes `aliases.blocks` into new `components.json` files.

## Seed blocks (4)
Authored from existing library components, each a real, responsive page:
- **login** (auth) — card + input + label + button + checkbox.
- **dashboard** (dashboard) — stat cards + a chart + a recent-activity table + sidebar.
- **settings-profile** (settings) — profile form (input, textarea, avatar, button).
- **pricing** (marketing) — responsive pricing tier cards with feature lists + CTA buttons.
Each lives at `packages/blocks/<name>/`, has a registry entry (`type:'block'`),
and is RTL/responsive/touch-compliant per the project's component guidelines.

## Out of scope (Spec B)
The full catalog beyond the 4 seed blocks. Spec B is a separate plan: per-block
authoring via the `frontend-design` skill and per-block subagents, each running
its own ≥95 review gate; blocks ship incrementally post-publish.

## Verification
- **Unit:** `search`, `update`, `doctor` command logic (mock fs + core); block
  fetch-routing in `core/fetch`; block install destination routing in
  `core/install`. Existing CLI suite (176 tests) stays green.
- **Registry:** `sync-registry` includes the 4 blocks and stays in sync;
  `registry-meta` coverage extended to block entries (category ∈ block families,
  description ≤140, tags ≥3, valid `type`).
- **MCP:** integration test asserts `type` is present on `list_components` output
  and that a block appears.
- **E2E:** via the real CLI, `add login` into `e2e/fixture-app` (prompt/`--path`),
  confirm block lands under the chosen dir + component deps under `ui`, then
  `ng build` passes. `update`/`doctor` smoke against the fixture. Reset after.

## Release
Ships inside `@gilav21/shadcn-angular`. Registry changes (new `type` field, 4 block
entries, block categories) → **publish on merge** (bundled with the MCP server work
in PR #68's release if merged together, or its own publish).

## Completion Log
Review gate bar: **≥95**. Highest score per task recorded.

| Task | Completed | Score | Rationale |
|---|---|---|---|
| T1 search | 2026-05-28 | 96 | `search` command over core/search; ranked + `--json` + usage; 3 tests. |
| T2 doctor | 2026-05-28 | 95 | `doctor` drift report via detectConflicts + missing npm deps; pure collector + exit-1 wrapper; 2 tests. |
| T3 update | 2026-05-28 | 95 | `update` diffs installed/named + applies overwrite via performInstall; `--dry-run`; 3 tests. |
| T4 block primitives | 2026-05-28 | 96 | `type` field + block categories + `aliases.blocks`/`getBlocksAlias`; coverage test extended; 187 tests. |
| T5 block fetch routing | 2026-05-28 | 97 | block base url + local dir; SourceKind threaded through fetch; routing tests; 189 tests. |
| T6 block install routing | 2026-05-28 | 97 | performInstall routes block files → blocksBase, deps → ui; `blocksPath`; backward-compatible. |
| T7 add block prompt | 2026-05-28 | 97 | `add` prompts/`--path` for block destination; deps→ui; pure-component `--path` unchanged; 47 tests. |
| T8 sync-registry blocks | 2026-05-28 | 96 | sync-registry skips block entries from the component walker + validates their files exist under packages/blocks; sync clean. |
