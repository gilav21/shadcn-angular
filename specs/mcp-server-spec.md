# MCP Server — agent-native component installation (`shadcn-angular mcp`)

## Goal

Make the library **agent-native**: ship an MCP (Model Context Protocol) server so
AI coding agents (Claude Code, Cursor, Copilot) can discover, read, and install
shadcn-angular components conversationally inside a consumer's Angular project.

The server is a new **subcommand of the existing CLI** (`shadcn-angular mcp`)
that speaks the MCP **stdio** transport. A consumer registers it once in their MCP
client config (e.g. `npx -y @gilav21/shadcn-angular mcp`) and the agent can then
run the full component lifecycle: discover → read source/examples → plan →
init / add / update / diff.

This is thread #1 of a four-part brainstorm. Queued separately and **out of scope
here**: (#2) a standalone CLI `update` command + a `blocks`/templates system;
(#3) Charts Pack v2 (line/area/scatter/radar/gauge/sparkline/heatmap/funnel/
treemap); (#4) a quality/consistency sweep (orphaned `date-range-picker`,
a11y/RTL/touch/i18n audit).

## Decisions (locked during brainstorming)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Capabilities | **Full lifecycle** (discover + init + add + update + diff) | Maximum usefulness; mutation is gated by the MCP host's approval UX |
| Packaging | **Subcommand** of `@gilav21/shadcn-angular`, **stdio** transport | One package to publish; maximal reuse of existing install logic |
| Metadata | **Inline** in the registry — add `category`/`description`/`tags` to `ComponentDefinition` | Single source of truth; also powers a future `search` command and replaces `help.ts`'s hardcoded category map |
| Examples | Sourced from existing `.stories.ts` | No new content to author; stories already show every variant |

## The core problem (verified by reading `add.ts`)

`add.ts` is **already well-factored**. The pure, non-interactive logic is
separated and largely exported:

- `resolveDependencies` — transitive dependency graph walk
- `detectConflicts` / `classifyComponent` / `checkFileConflict` — conflict
  detection (already concurrency-limited, already parameterised by
  `targetDir`/`options`)
- `fetchAndTransform` / `fetchComponentContent` / `fetchLibContent` — source
  retrieval with local→remote fallback + import/prefix rewrites
- `writeComponentFiles` / `writePeerFiles` / `installLibFiles` /
  `installNpmDependencies` / `ensureShortcutService` — the write side

Only three functions touch `prompts` (`selectComponents`,
`promptOptionalDependencies`, `promptOverwrite`); only the `add()` orchestrator
uses `ora` + `console` + `process.exit`. No module-level state — every helper
takes `cwd`/`targetDir` as a parameter.

**So this is an extraction, not a rewrite.** The work is: (a) move the
already-pure functions into a `core/` layer, (b) write a thin **non-interactive
orchestrator** that takes explicit options where the CLI prompts, (c) extract a
couple of currently-private helpers. The CLI keeps its interactive shell and
calls `core/`; MCP tools call the same `core/` with explicit options.

Two facts the read settled:

- **`update` is glue, not engineering.** `add()` with `overwrite: true` already
  re-fetches and overwrites — exactly an update. `update_component` = core add
  with `overwrite` + a diff preview. No new install machinery.
- **Local-vs-remote is already handled.** `fetchComponentContent` falls back to
  remote when `getLocalComponentsDir()` is null (the `npx` case, which dominates
  MCP usage). `peerFiles` and shortcut-registry generation are preserved
  automatically by reusing these functions.

## Target structure

```text
packages/cli/src/
  registry/index.ts        # + optional category/description/tags on ComponentDefinition
  core/                    # NEW — pure, non-interactive, returns data (no prompts/ora/exit)
    resolve.ts             #   transitive dep graph (move from add.ts)
    plan.ts                #   install plan + conflict detection (the dry-run substitute)
    install.ts             #   non-interactive orchestrator: write files, transforms, npm, shortcuts
    init-core.ts           #   config/tailwind/postcss setup (extract from init.ts)
    diff-core.ts           #   structured local-vs-remote diff (extract from diff.ts)
    fetch.ts               #   source retrieval (wraps paths.ts + fetchAndTransform)
    search.ts              #   fuzzy search over the enriched registry
  commands/                # refactored to thin wrappers that call core/ (keep prompts/ora here)
    add.ts init.ts diff.ts list.ts why.ts help.ts
  mcp/
    server.ts              # MCP server bootstrap, stdio transport, tool registration
    tools/                 # one file per tool
      list-components.ts search-components.ts get-component.ts
      get-component-source.ts get-component-examples.ts
      get-install-plan.ts init-project.ts add-component.ts
      update-component.ts diff-component.ts
  index.ts                 # register the `mcp` command
```

New dependency: `@modelcontextprotocol/sdk`.

## Tools

### Read-only (`readOnlyHint: true`)

- **`list_components`** → `name`, `category`, `description`, `tags` for every
  registry entry.
- **`search_components(query)`** → ranked matches. Reuse the Levenshtein helper
  from `why.ts` plus tag/description substring matching.
- **`get_component(name)`** → registry record with **resolved transitive**
  `dependencies`, plus `npmDependencies`, `libFiles`, `category`, `description`.
- **`get_component_source(name)`** → actual source of the component's files
  (local→remote), with import/prefix transforms applied to match the target
  project's `components.json`.
- **`get_component_examples(name)`** → contents of the component's `.stories.ts`
  (shows all variants/inputs).
- **`get_install_plan(names[])`** → dry-run: files to write/skip/conflict, npm
  deps, optional deps. This is the **non-interactive substitute** for `add`'s
  prompts — the agent calls this first, then decides.

### Mutating (`destructiveHint: true`, host-gated)

- **`init_project(options)`** → `init-core`: writes `components.json`, Tailwind,
  PostCSS. Mirrors the CLI `--defaults` flag — every field
  (tailwind/baseColor/theme/cssVariables/prefix) has a hard default, each
  overridable via an explicit argument. Returns what was created; errors clearly
  if already initialized.
- **`add_component(names[], { overwrite?, optionalDeps?, path? })`** → install
  via `core/install`. Conflicts are **not** auto-overwritten unless the file is
  listed in `overwrite`.
- **`update_component(names[])`** → `diff-core` preview + core add with
  `overwrite`. Interim until the standalone CLI `update` command (thread #2).
- **`diff_component(names[])`** → structured local-vs-remote diff.

## Non-interactivity & safety

- No prompts inside any tool. `add_component` requires an explicit `overwrite`
  list; conflicts are surfaced through `get_install_plan` first so the agent
  (and, via the host, the user) decide.
- Tool annotations (`readOnlyHint` / `destructiveHint`) drive the MCP host's
  approval UX.
- Project root is resolved from `components.json` via the existing `config.ts`.
  Read/plan tools work even when uninitialized (the registry is bundled with the
  CLI); mutating tools return a clear "run `init_project` first" error.

## Registry metadata — discrete sub-task (own review gate)

Populating `category`/`description`/`tags` across the ~80 registry entries is
**content authoring**, not plumbing — and it is precisely what the agent uses to
choose components, so quality matters. Scope it as its own unit:

1. Define the field shape on `ComponentDefinition` and an **allowed category
   taxonomy** (reuse `help.ts`'s existing groups as the seed: UI, Charts, Layout,
   Animation, Kanban — expand as needed).
2. Fill entries (descriptions ≤ ~140 chars, 3–6 tags each).
3. Make `help.ts` derive its categories from the registry (removes the hardcoded
   map — incidental cleanup this enables).

This is roughly a third of the total effort and should pass its own review gate
before the search/list tools depend on it.

## Verification

- **Unit:** `core/resolve`, `core/plan` (conflict detection), `core/search`
  against a fixture registry. Existing `add.spec.ts` must stay green after the
  extraction.
- **MCP integration:** spawn `node dist/index.js mcp` over stdio, call every
  tool, assert structured responses (list/search/get/plan are deterministic).
- **End-to-end install:** point the server at the e2e fixture-app
  (`npm run e2e:reset` first), call `init_project` then
  `add_component(['button','card'])`, and confirm files are written, npm deps
  installed, and the app builds (`ng build`). Mirrors the existing e2e harness
  contract.
- **Registry integrity:** `npm run sync-registry` stays clean; the new metadata
  fields don't break `sync-registry` / `validate-registry`.
- **Manual smoke:** register in a local MCP client (Claude Code `.mcp.json` →
  `npx shadcn-angular mcp`), ask the agent to "add a data table," and confirm the
  full discover → plan → add flow with host approval on the mutating step.

## Release

The MCP server ships inside `@gilav21/shadcn-angular`. Per release policy, the
registry-metadata enrichment is a registry change → the package must be published
once merged.

## Completion Review

Review gate bar: **≥95**. One row per gated task (highest score recorded).

| Task | Completed | Score | Rationale |
|---|---|---|---|
| 0.1 | 2026-05-28 | n/a | Trivial dependency bump; review-gate excludes version bumps. |
| 0.2 | 2026-05-28 | 96 | Metadata shape (`CATEGORIES`/`Category` + optional description/category/tags) added cleanly; build + tests pass; taxonomy covers the library. |
| 1.1 | 2026-05-28 | 96 | `core/fetch.ts` extracted verbatim; add.ts re-exports keep add.spec/diff working; dead imports removed; 48 tests pass. |
| 1.2 | 2026-05-28 | 96 | `core/resolve.ts` extracted verbatim; add.ts re-exports; self/transitive/diamond tests; 50 tests pass. |
| 1.3 | 2026-05-28 | 97 | `core/plan.ts` extracted (conflict detection) + `summarizePlan`/`InstallPlan`; add.ts re-exports; dead imports removed; 51 tests pass. |
| 1.4 | 2026-05-28 | 96 | `core/install.ts` non-interactive orchestrator; corrected overwrite/skip semantics; add.ts delegates writes via precomputedConflicts (single detect); 52 tests. |
| 1.5 | 2026-05-28 | 97 | `core/init-core.ts` `initProject` (created/warnings); init.ts keeps prompts + delegates; reuses fetchLibContent; 3 tests. |
| 1.6 | 2026-05-28 | 97 | `core/diff-core.ts` structured diff; hasChanges counts fetch errors; diff.ts re-colors + decoupled from add.js; 5 tests. |
| 1.7 | 2026-05-28 | 97 | `core/search.ts` ranked search (name/tag/desc/fuzzy) reusing `levenshtein`; CLI suite 167 tests green. |
| 2.1 | 2026-05-28 | 96 | All 118 entries given category/description/tags; pure additions; sync clean; coverage test enforces. |
| 2.2 | 2026-05-28 | 97 | `help.ts` categories now flow from registry (`groupByCategory`); hardcoded sets removed; 170 tests green. |
| 3.1+3.2 | 2026-05-28 | 95 | `shadcn-angular mcp` stdio server: 10 tools reusing core/; z.enum-validated init; stderr logging; stdio smoke passes. |
