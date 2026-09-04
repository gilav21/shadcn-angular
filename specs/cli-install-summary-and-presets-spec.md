# CLI — Grouped Install Summary, `--preset`, and Install-Time Maintenance Messaging

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-09-03
> **Source plan:** `C:\Users\dasha\.claude\plans\look-at-the-richtext-snuggly-cook.md`, spec #5
> ("Install summary + presets — cheap fears 1 & 2"), debate rounds 3–4.
> **Living history:** never delete a completed row or a superseded decision —
> mark it and append below.

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.

---

## 0. Step-0 verification — what the source actually says

Every claim this spec rests on was re-read in the tree on 2026-09-03. Line
numbers are cited so the executing agent can re-check before touching a file.

| # | Claim | Evidence |
| --- | --- | --- |
| V1 | `add` prints a spinner headline plus a **flat** name list; requested components, addon pulls and shared primitives are indistinguishable; no file counts. | `packages/cli/src/commands/add.ts:374-389` (`printInstallResult`), `:319-336` (`printDryRunSummary`), `:338-347` (`printSkipSummary`). |
| V2 | `--dry-run` prints the same flat list (`Would install N component(s):` + names). | `add.ts:325-329`. `add.spec.ts:961-969` asserts the literal `[Dry Run] No changes will be made.` and `Would install`; `:993-1001` parses `/Would install (\d+) component/` — **these strings must survive**. |
| V3 | `add` already knows the three sets the summary needs: `componentsToAdd` (requested), `extraDeps` (optional companions + addons chosen) and the closure `allComponents`; conflict scan yields `toInstall` / `toSkip` / `conflicting`. | `add.ts:391-414` (`resolveComponentsAndConflicts`), `:440-447`; `core/plan.ts:26-32` (`ConflictCheckResult`), `:121-153` (`detectConflicts`). |
| V4 | Per-component file counts are **not** in `InstallPlan`; they are trivially `registry[name].files.length` (+ `libFiles`). `InstallPlan` today: `toInstall/toSkip/conflicting/peerFilesToUpdate/npmDependencies/breakingChanges/suggestedAddons`. | `core/plan.ts:196-227`; `registry/index.ts:53-135` (`ComponentDefinition.files`, `libFiles`). |
| V5 | `core/sizes.ts` computes **bytes/lines/files for a whole closure** from `file-sizes.json` (local or fetched, `null` offline) — used only by `why`. It does not group per component and needs a manifest fetch, so the summary does **not** use it; counts come from the in-memory registry (offline-safe). | `core/sizes.ts:129-165` (`summarizeInstallSize`), `:79-110` (`loadFileSizes`); `commands/why.ts:91-102`. |
| V6 | `why` prints `Files (N)`, install size, direct deps, addon meta, reverse dependents, lib files. Output is built from `buildComponentRecord` (shared with MCP `why`/`get_component`). | `commands/why.ts:104-161`, `:72-84` (`formatAddonMeta`); `core/why-core.ts:17-70`. |
| V7 | `promptAddons(resolved, options)` offers the `addons[]` of resolved bases; `--no-addons`/`--yes` → none, `--with` → flag parse, `--all` → all, else multiselect with nothing pre-selected. It does **not** receive the requested names. | `add.ts:161-203`; `--with` parser `:135-159`. |
| V8 | `AddOptions` carries `with?: string`, `addons?: boolean`, `yes`, `all`, `dryRun`, … — no `preset`. Nothing named `preset` exists under `packages/cli/src`. | `core/plan.ts:8-24`; grep `preset` → 0 hits in `packages/cli/src` (only the demo and the actions addon's unrelated "presets" concept). |
| V9 | Commander wiring for `add` (options list) and the parity test that fails when a CLI command / MCP tool is unmapped or lacks source flags. Non-source flags (`--with`, `--dry-run`) are **not** parity-checked. | `packages/cli/src/program.ts:46-62`; `mcp/parity.spec.ts:43-90`, `:204-255`. |
| V10 | MCP `add_component` accepts `names/overwrite/optionalDeps/path/includeTests/testRunner` + source; `get_install_plan` returns `planInstall()` = `summarizePlan(...)`; `planInstall` knows `input.components` (requested) and `optionalDeps`. | `mcp/tools/write-tools.ts:118-148`; `mcp/tools/read-tools.ts:139-157`; `core/install.ts:300-307`. |
| V11 | The registry `addons[]` field on a base is a plain string list; `rich-text-editor` declares 14 addons (13 features + the `full` composite); `data-table` declares 3 (`context-menu`, `export`, `pivot`). | `packages/components/registry.json:2565-2580`, `:886-890`; literal at `packages/cli/src/registry/index.ts:964`, `:423`. |
| V12 | `rich-text-editor/full` is an addon whose `dependencies` are exactly the other 13 addons; its `attach.selector` is `uiRteFull`. | `registry.json:5212-5252`. |
| V13 | Registry shape validation only checks `name` (string), `files` (array), and — when present — `addons`/`testFiles`/`testDependencies` are string arrays; addon entries need `parent` + `attach`. **Unknown keys are never inspected**, so an old CLI keeps parsing a manifest that gains an optional field. | `registry/load.ts:26-52` (`isValidRegistryEntry`, `isValidRegistryShape`), `:107-114` (`applyManifest` copies whole objects). |
| V14 | `sync-registry --fix` rewrites only the `files`/`dependencies`/`libFiles` arrays **in place** in `index.ts` and then emits `registry.json` as `JSON.stringify` of the freshly imported registry object — any hand-authored field on an entry (a new `presets` object included) survives `--fix` and lands in `registry.json` verbatim. The parser splits nested object literals safely. | `packages/cli/scripts/sync-registry-lib.ts:1365-1368` (`applyUpdatesToSource`), `:1758-1761` (`serializeRegistryJson`), `:568-585` (nested-object parse note); `scripts/sync-registry.ts:56-59`, `:97-100`. |
| V15 | `.claude/hooks/validate-registry.mjs` auto-inserts a minimal entry for new component files; it validates no field set — no change needed for a new field. | `.claude/hooks/validate-registry.mjs:1-60`. |
| V16 | Demo presets: `core: []`, `writing: [slashCommands, links, history, outline]`, `media: [images, tables, fileImport]`, `styling: [colors, typography, emoji]`, `everything: ADDON_KEYS` (13). Registry keys per addon in `ADDON_META.registry`. `BASE_FILES = 12` equals the registry's 12 `files[]` for `rich-text-editor`. | `demo/src/app/demos/inputs/rich-text-editor-addons-demo.component.ts:40-67`, `:58-59`; `registry.json:2581-2594`. |
| V17 | Demo `installCommands` emits `add rich-text-editor` then one `apply rich-text-editor/<addon>` line **per enabled addon**; locale keys `commandsLabel`, `commandsBaseNote` exist in en + he. | demo component `:226-233`; `rich-text-editor-addons-demo.locales.ts:35-36`, `:81-82`, `:125-126`. |
| V18 | `update` semantics: default is a **3-way merge** of upstream into local edits; conflicts written as `<<<<<<<` markers; `--overwrite` (or `components.json` `update.overwrite`) replaces whole-file **without** a per-file prompt; a locally-edited file with **no recorded baseline is kept and warned**, not merged. | `commands/update.ts:203-218` (advice text), `:271-292`, `:299` (`options.overwrite ??= config.update?.overwrite`); `core/install.ts:84-90` (`warnFellBack`). |
| V19 | `doctor` reports `Locally modified (your edits — update will 3-way merge upstream changes into them)` and `Update available (newer registry version)`; `--fix` never touches user edits. `status` prints the same two buckets. | `commands/doctor.ts:357-374`, `:389-395`; `commands/status.ts:197-208`. |
| V20 | The CLI's own hints are package-qualified: `npx @gilav21/shadcn-angular apply …` / `diff …` / `init`. | `add.ts:244`, `:295`, `:422`. |
| V21 | `add --yes` **does** overwrite conflicts without asking (`promptOverwrite` returns every conflicting name under `--yes`) and `add` never 3-way merges. The "what now" block must not claim otherwise for `add`. | `add.ts:278-286`; `program.ts:51`. |
| V22 | CLI test suite: `npm run test:cli` (`vitest --config vitest.config.cli.ts`), coverage leg `npm run coverage:cli`. Specs are co-located `packages/cli/src/**/*.spec.ts`; `add.spec.ts` mocks `fs-extra`, `prompts`, `ora`, `performInstall`, `getConfig` and captures `console.log`. | `package.json:28`, `:41`; `commands/add.spec.ts:26-63`, `:868-915`. |
| V23 | Existing e2e runner always calls `add <names…> --yes`; `ComponentSpec` has `names/initArgs/label/harnessFolder`, no way to pass extra `add` flags. Fourteen `rte-*` harnesses exist, incl. `rte-links` (installs `rich-text-editor` + `links`). | `e2e/orchestrator/run.ts:84-86`; `e2e/orchestrator/specs.ts:32-53`, `:156-159`; `e2e/harness/rte-*`. |
| V24 | `help` lists `add` flags and an "Addons" paragraph; `packages/cli/README.md` has an `add` options table and an Addons section (hand-written — `gen-readme.ts` targets the **root** `README.md` facts block only). | `commands/help.ts:78-88`, `:157-168`; `packages/cli/README.md:82-131`; `scripts/gen-readme.ts:15`. |

### Plan corrections (⚠️ recorded inline, never rewritten)

- ⚠️ The plan's Option-3 wording "Small change, no publish beyond the next CLI
  release" understates it: **this spec requires a CLI npm publish** — it changes
  CLI logic (`add.ts`, `plan.ts`, new `core/presets.ts`, `program.ts`, MCP
  tools) **and** the manifest validator (`registry/load.ts`). The `presets`
  registry *data* goes live on merge, but only a published CLI reads it. Adding
  the PR to the pending-releases memory is the lead's job, not this spec's.
- ⚠️ The brief wrote the hint as `npx shadcn-angular why <name>`; the CLI's own
  hints are `npx @gilav21/shadcn-angular …` (V20). This spec uses the
  package-qualified form everywhere for consistency with existing output.
- ⚠️ The brief's phrase "`update` … never overwrites your edits without asking"
  is only true for the default path. `--overwrite` / `update.overwrite` clobber
  without a prompt, and no-baseline files are kept-and-warned (V18). The
  "what now" wording below is the truthful version.
- ⚠️ The demo's `everything` preset toggles the **13 feature addons**; the CLI
  registry also has the `rich-text-editor/full` composite (V11–V12), and the
  demo's "everything" template snippet is the one-liner `uiRteFull`
  (demo `:216-218`). The CLI `everything` preset therefore lists **the 13
  addons plus `rich-text-editor/full`** so a consumer who copies the demo's
  `uiRteFull` template actually has it. All other lists are copied verbatim.
- ⚠️ The plan says the CLI test script is `npm run test-cli`; it is
  `npm run test:cli` (V22).
- ⚠️ `validate-registry.mjs` is at `.claude/hooks/`, not
  `packages/components/`, and validates no field set (V15) — no change.
- ⚠️ `promptAddons` cannot pre-select a preset as-is: it never sees the
  requested names (V7). This spec adds a `preselected` parameter rather than
  re-deriving requested-ness inside it.

Nothing in this bundle already exists; every item is a build, not an extension
— except the summary, which **extends** the existing `printDryRunSummary` /
`printInstallResult` / `summarizePlan` trio (V1, V4).

---

## B. Product Manager section

### B.1 Business logic

Three cheap, independent changes to the copy-model install flow:

1. **Grouped install summary.** Before (`--dry-run`) and after a real `add`,
   the CLI prints *what* it wrote and *why*, in four groups — what you asked
   for, the addons you chose, the shared UI components other components reuse
   that were not yet in your project, and what was already there and skipped —
   each with component + file counts, a total, and a one-line pointer to
   `why <name>`. The same grouping is returned by MCP `get_install_plan`.
2. **`--preset <name>`.** A base component may declare named addon bundles in
   the registry. `add <base> --preset <name>` pre-selects those addons in the
   addon prompt; `--yes` accepts them non-interactively. `rich-text-editor`
   ships the five presets the demo already uses; `data-table` ships four.
   `why` and MCP `get_component` list a component's presets. The addons demo
   page emits a single `--preset` (or `--with`) command instead of one `apply`
   line per addon.
3. **Install-time maintenance messaging.** After a successful install, a
   3-line "What now?" block tells the developer the files are theirs to edit,
   how `update` treats their edits, and that `doctor` / `status` show drift.

### B.2 Why the customer wants this

The customer (a developer adopting the library) voiced three fears; this spec
answers the two cheap ones (the plan's rounds 3–4):

- **"I didn't ask for 30 components."** Today `add rich-text-editor/full` (or
  answering *yes* to the addon prompt) prints a flat list of 35 names. Nothing
  says which were requested, which are addons, and which are `button`,
  `dialog`, `popover` — shared primitives the project would need for any other
  component too. The workaround is to run `why` on each name by hand, or to
  read the registry. The summary makes the split visible before a single file
  is written (`--dry-run`) and again after.
- **"Now I have to maintain all this."** The developer does not know that
  `update` 3-way merges, that `doctor` distinguishes *their* edits from
  upstream drift, or that the files are meant to be edited. The workaround is
  reading the README. Three lines at the moment of install fix that.
- **"Which addons do I even want?"** Thirteen RTE addons, no guidance. The
  demo already defines five kits; the CLI makes them one flag away and the
  demo stops printing 14 commands.

### B.3 Use cases = definition of done

All use cases are from the consuming developer's point of view and are
observable from the terminal, the MCP client, the demo page, or the e2e run.

**Grouped summary**

- **UC-1** `add rich-text-editor --dry-run --yes` in a fresh project prints,
  under the existing `[Dry Run] No changes will be made.` / `Would install N
  component(s)` lines, a **Requested** group (`rich-text-editor` · 12 files)
  and a **Shared UI components** group (`separator` · N files), a **total
  files** line, and the line `Why is a component here?  npx
  @gilav21/shadcn-angular why <name>`.
- **UC-2** The real run prints the same grouped block after `Success! Added N
  component(s)`, built from what was **actually written** (`result.installed`),
  not from the plan.
- **UC-3** Components already present and identical appear under **Already in
  your project — skipped** with counts; components whose local edits were kept
  appear under the existing `Components skipped (kept local changes)` line;
  neither is counted in the total files written.
- **UC-4** Addons that were chosen (prompt, `--with`, `--preset`, `--all`)
  appear under **Addons chosen**; a component pulled in only because an addon
  needs it (e.g. `emoji-picker` for `rich-text-editor/emoji`) appears under
  the shared group, never under Requested.
- **UC-5** Shared lib files are counted **once** across the written set and
  reported as `+ N shared lib files` (deduped, not per component).
- **UC-6** Empty groups are omitted (no `(0)` noise); a run with nothing to
  write still prints only the existing `No components to install.` /
  skipped lines.
- **UC-7** MCP `get_install_plan` returns the same grouping as a `summary`
  object on the plan (requested / addons / shared / skipped, each with
  `components[]`, `files`, plus `totalFiles`, `libFiles`).

**Presets**

- **UC-8** `add rich-text-editor --preset writing --yes` installs the base
  plus exactly `rich-text-editor/slash-commands`, `links`, `history`,
  `outline` (and their dependencies) with **no prompt**.
- **UC-9** `add rich-text-editor --preset writing` (interactive) opens the
  addon multiselect with those four **pre-selected**; the developer may add or
  remove; the final selection is what installs.
- **UC-10** `--preset core` installs no addons and shows no addon prompt.
- **UC-11** `--preset media --with rich-text-editor/ai` installs the union
  (media's three + ai).
- **UC-12** `--preset writing --no-addons` exits 1 with `--preset and
  --no-addons contradict each other`.
- **UC-13** An unknown preset exits 1 and lists the available names:
  `Unknown preset "wrting" for rich-text-editor. Available: core, writing,
  media, styling, everything`. A base that declares no presets exits 1 with
  `button declares no presets — see: npx @gilav21/shadcn-angular why button`.
- **UC-14** `why rich-text-editor` prints a `Presets:` line
  (`core (0 addons), writing (4), media (3), styling (3), everything (14)`);
  MCP `get_component` / `why` include `presets` in the record.
- **UC-15** MCP `add_component({ names: ['rich-text-editor'], preset:
  'writing' })` installs the same set as UC-8; an unknown preset returns the
  UC-13 error text.
- **UC-16** Registry integrity: `rich-text-editor` declares the five presets
  with the exact lists in §D.1; `data-table` declares `core`, `menus`,
  `reporting`, `everything`; every preset addon key is a member of the
  parent's `addons[]`; `registry.json` carries `presets` after
  `sync-registry --fix`; `isValidRegistryShape` accepts entries with and
  without `presets` and rejects a malformed one.
- **UC-17** `help` and `packages/cli/README.md` document `--preset <name>`.
- **UC-18** The addons demo page's "Install commands" panel shows **one**
  `add rich-text-editor --preset <name>` line when the toggles match a preset,
  `add rich-text-editor --with a,b,c` otherwise, and `--preset core` when all
  toggles are off — in both `en` and `he`.
- **UC-19** e2e: `add rich-text-editor --preset writing --yes` in a pristine
  Angular app builds, and the existing `rte-links` Playwright spec passes
  against it.

**Maintenance messaging**

- **UC-20** After a successful install (`installed.length > 0`), `add` prints
  a `What now?` block with exactly three bullets (files are yours; `update`
  3-way merges — conflicts as `<<<<<<<` markers, `--overwrite` replaces
  whole-file, no-baseline files kept and warned; `doctor` / `status` show what
  you edited vs. what has an update). It is **not** printed on `--dry-run` or
  when nothing was installed.

### B.4 Explicitly out of scope

- Per-folder `--compact` layout, `--vendor`, and any file-count reduction
  (plan rounds 2–3) — separate work.
- The npm packages (spec #6).
- Presets for `apply` (`apply --preset`) or for `update`.
- Presets on `infinite-canvas` / `node-editor` — only `rich-text-editor` and
  `data-table` get data; the mechanism is generic.
- A `--with` input on MCP `add_component` — only `preset` is added.
- Persisting the chosen preset in `components.json`.
- Changing what `--yes` means for conflicts (V21) — the block documents, it
  does not alter.
- Size-in-bytes in the summary (that stays `why`'s job via `file-sizes.json`).

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> Every new test is sabotage-verified (break the behaviour it guards, derived
> from the contract, not from its own assertions — see the testing-policy
> memory) before its task may be marked done.

Runner for everything under `packages/cli/`: `npm run test:cli` (V22).
Demo spec runs under the root `vitest` browser suite (`npm run test-visual`).

### C.1 Traceability table

| Test ID | Test name | Proves | Type | File |
| --- | --- | --- | --- | --- |
| T-1 | `buildInstallSummary groups a lone requested base and its shared deps` | UC-1 | unit | `core/plan.spec.ts` |
| T-2 | `counts files per component from registry.files and totals them` | UC-1, UC-5 | unit | `core/plan.spec.ts` |
| T-3 | `dedupes shared lib files across the written set` | UC-5 | unit | `core/plan.spec.ts` |
| T-4 | `puts chosen addons under addons and an addon's own deps under shared` | UC-4 | unit | `core/plan.spec.ts` |
| T-5 | `puts skipped (identical) components under skipped with counts and excludes them from totalFiles` | UC-3 | unit | `core/plan.spec.ts` |
| T-6 | `add --dry-run prints Requested / Shared groups with counts, the total and the why hint` | UC-1 | unit (console capture) | `commands/add.spec.ts` |
| T-7 | `add prints the grouped block after Success! from result.installed` | UC-2 | unit | `commands/add.spec.ts` |
| T-8 | `add omits empty groups and keeps "skipped (up to date)" / "kept local changes" lines` | UC-3, UC-6 | unit | `commands/add.spec.ts` |
| T-9 | `get_install_plan returns summary groups` (via `planInstall`) | UC-7 | unit | `core/install.spec.ts` |
| T-10 | `summary is present on the get_install_plan MCP result` | UC-7 | integration (in-memory MCP client) | `mcp/server.spec.ts` |
| T-11 | `resolvePreset returns the preset's addon keys for a declaring base` | UC-8 | unit | `core/presets.spec.ts` |
| T-12 | `resolvePreset throws PresetError listing available names for an unknown preset` | UC-13 | unit | `core/presets.spec.ts` |
| T-13 | `resolvePreset throws PresetError when no requested component declares presets` | UC-13 | unit | `core/presets.spec.ts` |
| T-14 | `resolvePreset unions presets across several declaring bases` | UC-8 | unit | `core/presets.spec.ts` |
| T-15 | `promptAddons with --yes returns the preselected addons without prompting` | UC-8 | unit | `commands/add.spec.ts` |
| T-16 | `promptAddons pre-selects the preset in the interactive multiselect and returns the picks` | UC-9 | unit | `commands/add.spec.ts` |
| T-17 | `promptAddons with --preset core and --yes returns [] and does not prompt` | UC-10 | unit | `commands/add.spec.ts` |
| T-18 | `promptAddons unions --preset with --with` | UC-11 | unit | `commands/add.spec.ts` |
| T-19 | `add exits 1 on --preset with --no-addons` | UC-12 | unit | `commands/add.spec.ts` |
| T-20 | `add exits 1 on an unknown preset and lists the available names` | UC-13 | unit | `commands/add.spec.ts` |
| T-21 | `add exits 1 when the requested base declares no presets` | UC-13 | unit | `commands/add.spec.ts` |
| T-22 | `formatAddonMeta lists a base's presets with addon counts` | UC-14 | unit | `commands/why.spec.ts` |
| T-23 | `buildComponentRecord exposes presets` | UC-14 | unit | `core/why-core.spec.ts` |
| T-24 | `add_component accepts preset and forwards the resolved addons as optionalDeps` | UC-15 | unit (mock `performInstall`) | `mcp/tools/write-tools.spec.ts` |
| T-25 | `add_component returns the PresetError text for an unknown preset` | UC-15 | unit | `mcp/tools/write-tools.spec.ts` |
| T-26 | `rich-text-editor declares the five demo presets with exact lists` | UC-16 | registry integrity | `commands/add.spec.ts` (registry describe) |
| T-27 | `data-table declares core/menus/reporting/everything` | UC-16 | registry integrity | `commands/add.spec.ts` |
| T-28 | `every preset addon key is in its parent's addons list and every parent with presets has a core preset` | UC-16 | registry integrity | `commands/add.spec.ts` |
| T-29 | `isValidRegistryShape accepts an entry with presets, rejects a non-object / non-string-array preset, ignores unknown keys` | UC-16 | unit | `registry/load.spec.ts` |
| T-30 | `parseRegistrySource keeps an entry parsable when a presets object precedes files` | UC-16 | unit | `scripts/sync-registry-lib.spec.ts` |
| T-31 | `registry.json carries presets for rich-text-editor` (reads the committed manifest) | UC-16 | registry integrity | `registry/registry-meta.spec.ts` |
| T-32 | `help mentions --preset` | UC-17 | unit | `commands/help.spec.ts` |
| T-33 | `installCommands emits --preset when the toggles match a preset` | UC-18 | unit (TestBed) | `demo/.../rich-text-editor-addons-demo.component.spec.ts` (new) |
| T-34 | `installCommands emits --with for a non-preset selection and --preset core for none` | UC-18 | unit | same |
| T-35 | `installCommands uses the he locale note under UI_LOCALE_ID='he'` | UC-18 | unit | same |
| T-36 | `rte-preset-writing` e2e — `add rich-text-editor --preset writing --yes`, `ng serve`, `rte-links` spec passes | UC-19 | e2e | `e2e/orchestrator/specs.ts` (EXPLICIT_SPECS) |
| T-37 | `add prints the What now? block after a successful install` | UC-20 | unit | `commands/add.spec.ts` |
| T-38 | `add does not print What now? on --dry-run or when nothing was installed` | UC-20 | unit | `commands/add.spec.ts` |
| T-39 | `What now? names update (3-way merge, <<<<<<< markers, --overwrite) and doctor / status` | UC-20 | unit | `commands/add.spec.ts` |

Every UC-1 … UC-20 appears at least once.

### C.2 Test types

- **Unit** (`packages/cli/src/**/*.spec.ts`, vitest node) — the bulk.
  `add()` tests follow the existing shell pattern: mocked `fs-extra`,
  `prompts`, `ora`, `performInstall`, `getConfig`; `console.log` captured into
  `logged[]`; `process.exit` throws `ExitError` (`add.spec.ts:850-915`).
- **Integration** — the in-memory MCP client already used by
  `mcp/server.spec.ts` (T-10).
- **Registry integrity** — assertions against the real registry literal and
  the committed `registry.json` (T-26 … T-28, T-31), same style as
  `add.spec.ts:733-778`.
- **Demo unit** — TestBed spec next to the demo component, following
  `demo/src/app/demos/inputs/rich-text-editor-demo.component.spec.ts`.
  Read the protected computed via bracket access
  (`component['installCommands']()`).
- **e2e** — one new `EXPLICIT_SPECS` entry (T-36). No Storybook / axe: this
  bundle ships no UI component (the demo page changes are text only).
- No perf claims → no measured assertions.

### C.3 Edge cases and failure modes the tests must cover

- Requested list contains an **addon key directly** (`add
  rich-text-editor/emoji`): the addon is Requested (the user typed it); its
  base `rich-text-editor` is Shared, not Requested (T-4 variant).
- Requested component is itself in `toSkip` (already installed): it appears in
  Skipped, not Requested; `totalFiles` = 0 when nothing is written (T-5).
- Optional companions picked via `promptOptionalDependencies` (e.g.
  `context-menu` for `tree`): grouped under **Addons chosen** too — they were
  an explicit pick — with the group heading reading `Addons & companions
  chosen` only when at least one non-addon companion is present (T-4).
- `--include-tests`: counts stay `files[]` only; a trailing `+ N test files`
  line is **not** added (out of scope; assert absence so a later change is a
  conscious one).
- `--preset` with **several** requested bases where only one declares the
  name: applies where declared; no error (T-14). Error only when **no**
  requested component declares presets or the name is missing on **every**
  declaring one (T-12, T-13).
- Preset key not in the offered choices at runtime (stale live manifest):
  skipped with a `console.warn`, never a crash (covered inside T-15 with a
  hand-built preset list).
- `--preset` + `--all`: `--all` wins (every addon), no error (T-18 variant).
- Non-TTY stdin with `--preset` and without `--yes`: behaviour is unchanged
  from today's `--with`-less interactive path (`prompts` is invoked); this is
  a documented risk (§D.5), not a new guard.
- Demo: `he` locale (RTL) note text (T-35); the command string itself is LTR
  ASCII and must not be localised.
- What-now block under `--yes` and under an interactive run: identical (T-37).
- Registry shape: `presets: []` (array, not object) → invalid; `presets:
  { writing: 'links' }` (string, not array) → invalid; `presets: {}` → valid
  (T-29).

### C.4 Coverage expectation

Files touched must not drop below their current line coverage in
`npm run coverage:cli`, and new files are ≥ 95 % lines:
`core/plan.ts`, `core/presets.ts` (new), `commands/add.ts`, `commands/why.ts`,
`core/why-core.ts`, `registry/load.ts`, `mcp/tools/read-tools.ts`,
`mcp/tools/write-tools.ts`, `program.ts`, `commands/help.ts`. The demo
component spec covers the three `installCommands` branches.

---

## D. Architecture section

### D.1 Usability — the public API

#### The registry field (data, hand-authored in `packages/cli/src/registry/index.ts`)

```ts
// registry/index.ts — ComponentDefinition (add after `addons`)
/**
 * For addon-capable bases: named addon bundles `add --preset <name>`
 * pre-selects. Keys are preset names; values are `parent/addon` keys that MUST
 * also appear in `addons`. `core` (empty list) means "no addons, don't ask".
 * Optional and additive — CLIs that predate it ignore the key.
 */
readonly presets?: Readonly<Record<string, readonly string[]>>;
```

```ts
// rich-text-editor entry — copied from the demo (V16); `everything` also
// carries the `full` composite (see Plan corrections).
presets: {
  core: [],
  writing: ['rich-text-editor/slash-commands', 'rich-text-editor/links', 'rich-text-editor/history', 'rich-text-editor/outline'],
  media: ['rich-text-editor/images', 'rich-text-editor/tables', 'rich-text-editor/file-import'],
  styling: ['rich-text-editor/colors', 'rich-text-editor/typography', 'rich-text-editor/emoji'],
  everything: [
    'rich-text-editor/actions', 'rich-text-editor/ai', 'rich-text-editor/colors', 'rich-text-editor/emoji',
    'rich-text-editor/file-import', 'rich-text-editor/history', 'rich-text-editor/images', 'rich-text-editor/links',
    'rich-text-editor/mentions', 'rich-text-editor/outline', 'rich-text-editor/slash-commands',
    'rich-text-editor/tables', 'rich-text-editor/typography', 'rich-text-editor/full',
  ],
},

// data-table entry
presets: {
  core: [],
  menus: ['data-table/context-menu'],
  reporting: ['data-table/export', 'data-table/pivot'],
  everything: ['data-table/context-menu', 'data-table/export', 'data-table/pivot'],
},
```

`registry.json` is regenerated by `npx tsx packages/cli/scripts/sync-registry.ts --fix`
(V14) — never hand-edited.

#### CLI — simple mode (one flag)

```bash
npx @gilav21/shadcn-angular add rich-text-editor --preset writing --yes
npx @gilav21/shadcn-angular add data-table --preset reporting
npx @gilav21/shadcn-angular add rich-text-editor --preset core        # base only, no prompt
npx @gilav21/shadcn-angular add rich-text-editor --dry-run --yes      # grouped plan, nothing written
npx @gilav21/shadcn-angular why rich-text-editor                      # …now includes a Presets: line
```

#### CLI — custom mode (compose with existing flags)

```bash
# preset as a starting point, then tweak interactively
npx @gilav21/shadcn-angular add rich-text-editor --preset media
#   ◉ rich-text-editor/images   ◉ rich-text-editor/tables   ◉ rich-text-editor/file-import   ◯ …

# preset + extra addon, non-interactive
npx @gilav21/shadcn-angular add rich-text-editor --preset media --with rich-text-editor/ai --yes
```

#### What the developer sees (dry run, fresh project)

```text
[Dry Run] No changes will be made.

  Would install 6 component(s) — 41 files:

  Requested (1 component, 12 files)
    + rich-text-editor (12 files)
  Addons chosen (4 components, 26 files)
    + rich-text-editor/slash-commands (7 files)
    + rich-text-editor/links (8 files)
    + rich-text-editor/history (5 files)
    + rich-text-editor/outline (6 files)
  Shared UI components other components reuse — not yet in your project (1 component, 3 files)
    + separator (3 files)
  + 7 shared lib files (utils, i18n, …)

  Why is a component here?  npx @gilav21/shadcn-angular why <name>
```

(Counts above are illustrative except `rich-text-editor` = 12 and the
per-addon numbers, which match V16; the implementation reads
`registry[name].files.length` at runtime.)

#### What the developer sees (real run)

```text
✔ Success! Added 6 component(s)

  Components added — 41 files:
  Requested (1 component, 12 files)
    + rich-text-editor (12 files)
  …same groups as above…

  Why is a component here?  npx @gilav21/shadcn-angular why <name>

What now?
  • These files are yours — edit them freely. They live under src/components/ui (your `ui` alias).
  • `npx @gilav21/shadcn-angular update` 3-way merges upstream changes into your edits; conflicts are written as <<<<<<< markers, never silently dropped. `--overwrite` replaces a file whole; a file you edited before it had a recorded baseline is kept and flagged.
  • `npx @gilav21/shadcn-angular doctor` and `status` show what you edited vs. what has an update available.

Optional addons available (not installed):
  …existing block, unchanged…
```

The `ui` path in bullet 1 is `aliasToProjectPath(config.aliases.ui)` (or the
`--path` override) — the same value `add` already resolves at
`add.ts:408-409`.

#### MCP

```jsonc
// get_install_plan → InstallPlan gains:
"summary": {
  "requested": { "components": [{ "name": "rich-text-editor", "files": 12 }], "files": 12 },
  "addons":    { "components": [ … ], "files": 26 },
  "shared":    { "components": [{ "name": "separator", "files": 3 }], "files": 3 },
  "skipped":   { "components": [], "files": 0 },
  "declined":  [],
  "libFiles": 7,
  "totalFiles": 41
}

// add_component input gains:
"preset": "writing"          // optional; resolved exactly like the CLI flag
// get_component / why records gain:
"presets": { "core": [], "writing": [ … ], … }   // only when the entry declares them
```

### D.2 Efficiency

No meaningful performance concern. The summary is computed from the in-memory
registry (`O(closure)`, no I/O) after the conflict scan that already fetched
every file; presets resolve by a map lookup. No new network calls, no new
dependencies (the repo rule: zero new runtime deps — `prompts`, `chalk`,
`commander`, `zod` are already present).

### D.3 DX for the consuming developer

**Must learn:** one flag, `--preset <name>`, and that `why <base>` lists the
names. **Can ignore:** everything else — the summary and the what-now block
are informational; defaults are unchanged (lean install, addon prompt still
opt-in, `--yes` still means no addons unless a preset is named).

**Error messages (exact text, all exit 1):**

| Situation | Message |
| --- | --- |
| unknown preset | `Unknown preset "wrting" for rich-text-editor. Available: core, writing, media, styling, everything` |
| no requested base declares presets | `button declares no presets — see: npx @gilav21/shadcn-angular why button` (one line per requested base; when several bases were requested and none declares presets: `None of button, badge declare presets.`) |
| `--preset` + `--no-addons` | `--preset and --no-addons contradict each other — drop one.` |
| preset key missing from the live manifest's offered addons | `console.warn`: `Preset "writing" lists rich-text-editor/outline, which this registry does not offer — skipping.` (continues) |

**Exported types they may touch:** none new for app code. CLI-internal exports:
`InstallSummary`, `InstallSummaryGroup`, `buildInstallSummary` (`core/plan.ts`);
`resolvePreset`, `PresetError`, `PresetResolution` (`core/presets.ts`);
`ComponentDefinition.presets` and `ComponentRecord.presets`.

**Help text additions** (`help.ts` + README `add` table):

```text
    --preset <name>      Pre-select a named addon bundle (see `why <component>` → Presets)
```

and in the Addons paragraph: *"Bases that declare presets can be installed with
`add <base> --preset <name>` — `why <base>` lists them; `--preset core` means
no addons."*

### D.4 Implementation options

#### (a) Grouped summary

**Option 1 — Format-time grouping inside `add.ts`**
Pros: smallest diff; nothing exported. Cons: MCP `get_install_plan` cannot
reuse it (UC-7), the grouping logic is untestable except through console
capture, and the dry-run and real-run paths would duplicate the classification.

**Option 2 — Pure `buildInstallSummary()` in `core/plan.ts`, printed by
`add.ts`, returned by `summarizePlan()`**
Pros: one classifier, three consumers (dry-run, real run, MCP); unit-testable
on data; `planInstall` already has `input.components` + `optionalDeps` (V10).
Cons: `InstallPlan` grows (additive).

**✅ Chosen: Option 2**, because UC-7 needs the data shape and the two CLI
paths must not drift.

Signature:

```ts
export interface InstallSummaryGroup { readonly components: readonly { name: ComponentName; files: number }[]; readonly files: number; }
export interface InstallSummary {
  readonly requested: InstallSummaryGroup;
  readonly addons: InstallSummaryGroup;       // chosen addons + optional companions
  readonly shared: InstallSummaryGroup;       // closure members neither requested nor chosen, being written
  readonly skipped: InstallSummaryGroup;      // toSkip (present & identical)
  readonly declined: readonly ComponentName[];// conflicting, kept local edits
  readonly libFiles: number;                  // deduped across `written`
  readonly totalFiles: number;                // sum of requested+addons+shared files
  readonly hasCompanions: boolean;            // any non-addon in `addons` → heading variant
}
export function buildInstallSummary(input: {
  requested: readonly ComponentName[];
  chosen: readonly ComponentName[];           // extraDeps
  written: readonly ComponentName[];          // dry-run: toInstall+toOverwrite; real: result.installed; MCP: toInstall
  skipped: readonly string[];
  declined: readonly ComponentName[];
}): InstallSummary;
```

Classification order per `written` name: requested → chosen → shared.
`files = registry[name].files.length`. Lib files: union of
`registry[n].libFiles` over `written`.

#### (b) Presets

**Option 1 — Registry field on the parent entry (`presets`)**
Pros: data lives with the addons it names; served live from `master`;
`why`/`get_component` discover it; `sync-registry --fix` carries it for free
(V14); optional field keeps old CLIs parsing (V13). Cons: the validator gains
one check (manifest-shape change → publish; but the CLI logic already forces a
publish).

**Option 2 — Preset as a registry *entry* (`rich-text-editor/preset-writing`,
an addon whose `dependencies` are the bundle), reusing the `full` composite
machinery**
Pros: zero CLI code — `add rich-text-editor/preset-writing` works today.
Cons: every preset appears in the addon prompt and in `addons[]` (noise, the
opposite of the goal); each needs a generated barrel + marker selector file in
the consumer's tree (more files, fear #3); `core` cannot be expressed;
`apply` would try to wire a marker.

**Option 3 — Hard-coded map in the CLI (`core/presets.ts` constant)**
Pros: no registry change. Cons: every preset edit needs an npm publish; not
discoverable from the manifest; MCP/`why` would read CLI constants instead of
the registry the rest of the tooling trusts.

**✅ Chosen: Option 1**, because it is discoverable, additive, and the data
ships live while the mechanism ships once.

Resolution core:

```ts
// core/presets.ts
export class PresetError extends Error {}
export interface PresetResolution { readonly addons: ComponentName[]; readonly declaredBy: ComponentName[]; }
/** Union of `preset` across the requested bases that declare it. Throws PresetError (see §D.3) otherwise. */
export function resolvePreset(requested: readonly ComponentName[], preset: string): PresetResolution;
```

`promptAddons(resolved, options, preselected: readonly ComponentName[] = [])`
decision order (extract `selectAddons()` to keep cognitive complexity ≤ 15):

1. no choices → `[]`
2. `options.addons === false` → `[]` (the contradiction with `--preset` is
   rejected earlier in `add()` before any prompt)
3. `options.with !== undefined` → union(preselected, `selectAddonsByFlag`)
4. `options.yes` → preselected (filtered to offered choices, warn on misses)
5. `options.all` → every choice
6. multiselect with `selected: preselected.has(choice)`; message
   `Optional addons available (preset "<name>" pre-selected):` when a preset
   was named, else the existing text.

`add()` flow change (`add.ts:416-471`): after `validateComponents`, if
`options.preset` → reject `--no-addons`, then `resolvePreset(componentsToAdd,
options.preset)` (catch `PresetError` → red message, `process.exit(1)`), and
pass `.addons` into `resolveComponentsAndConflicts` → `promptAddons`.

`AddOptions` gains `preset?: string`; `program.ts` gains
`.option('--preset <name>', 'Pre-select a named addon bundle (see `why <component>` → Presets)')`.

MCP `add_component`: `preset: z.string().optional()`; on
`PresetError` → `err(message)`; else `optionalDeps = [...(args.optionalDeps ?? []), ...resolution.addons]`.

#### (c) What-now block

**Option 1 — Static three bullets in `add.ts` (`printWhatNow(uiPath)`)**
Pros: trivial; wording verified against `update`/`doctor`/`status` (V18–V19).
Cons: does not adapt when `components.json` sets `update.overwrite`.

**Option 2 — Config-aware wording**
Pros: exact per project. Cons: another branch to test for one sentence; the
`--overwrite` clause already covers the configured case truthfully.

**✅ Chosen: Option 1.** The block is printed from `printInstallResult` when
`result.installed.length > 0` and `!options.dryRun` (dry-run never reaches it).

#### (d) Demo page

Add `presetFor(enabled: AddonKey[]): PresetKey | null` (exact set match
against `PRESETS`; `everything` matches when all 13 are on) and rewrite
`installCommands` (demo `:226-233`):

```ts
const base = 'npx @gilav21/shadcn-angular add rich-text-editor';
const preset = presetFor(enabled);
const command = preset
  ? `${base} --preset ${preset}`
  : `${base} --with ${enabled.map(k => `rich-text-editor/${ADDON_META[k].registry}`).join(',')}`;
return `${this.t().commandsBaseNote}\n${command}`;
```

`commandsBaseNote` (en/he) becomes `# one command installs the base editor and
the selected addons:` / its Hebrew equivalent. `--preset core` is what
`presetFor([])` yields (`core` matches the empty set). The rest of the page is
untouched.

### D.5 Risks

| Risk | Mitigation |
| --- | --- |
| Existing `add.spec.ts` assertions on literal strings (`Would install`, `Success! Added N component(s)`, `skipped (up to date)`, `kept local changes`) break. | Keep every existing headline verbatim (V2); the grouped block is added **under** them. T-6/T-8 assert both old and new strings. |
| `--preset` + non-TTY stdin without `--yes` blocks or auto-accepts (pre-existing exposure shared with today's interactive path). | Documented; scripts use `--yes`. Not widened by this spec. |
| Live `registry.json` (older master) lacks `presets` while a new CLI runs → `--preset` errors "declares no presets". | Correct behaviour; the message points at `why`. Bundled snapshot regenerated with presets so offline fallback also works. |
| An old CLI reads the new manifest. | Validator never inspects unknown keys (V13); T-29 asserts unknown-key tolerance explicitly. |
| Sonar S3776 on `promptAddons` / `printInstallResult` after the additions. | Extract `selectAddons`, `printSummaryGroup`, `printWhatNow`; each ≤ 15. |
| Demo `everything` vs. CLI `everything` mismatch confuses readers. | `presetFor` matches on the 13 toggles; the emitted CLI preset installs those 13 + `full`, which is exactly what the demo template (`uiRteFull`) needs. Documented in the demo locale note? No — keep the note short; the discrepancy is invisible to the consumer. |
| e2e `addArgs` extension to `ComponentSpec` touches the runner. | One optional field, spliced before `--yes`; impact analyzer reads `names` only (unchanged). |
| Publish forgotten. | §E task 9 re-verifies the boundary and states the consequence in the completion log. |

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Write failing tests T-1 … T-10 (summary: `plan.spec`, `add.spec`, `install.spec`, `server.spec`) | UC-1 … UC-7 | ✅ Done | 2026-09-04 04:26 | 92 | 17 tests written across 4 files; all confirmed failing for the right reason (`buildInstallSummary is not a function`, `summary` undefined) before any implementation. Scored jointly with task 2. |
| 2 | Implement `buildInstallSummary` in `core/plan.ts`, add `summary` to `InstallPlan`/`summarizePlan`/`planInstall`; print grouped block in `printDryRunSummary` + `printInstallResult` (keep existing headlines) with the `why` hint | UC-1 … UC-7 | ✅ Done | 2026-09-04 04:42 | 92 | Option 2 as specced: one pure classifier, three consumers. 7 sabotages run; sabotage 3 (group from plan not from `result.installed`) initially passed — T-7 was strengthened to assert the file total and now catches it. Reviewer then found two real defects the tests had missed: `(1 files)` for the 11 single-file entries, and the dry-run printing every name twice (old flat list left above the grouped block). Both fixed with regression tests. Lesson: assert rendered output end-to-end, not only the data layer. |
| 3 | Write failing tests T-11 … T-32 (presets: `presets.spec` new, `add.spec`, `why.spec`, `why-core.spec`, `write-tools.spec`, `load.spec`, `sync-registry-lib.spec`, `registry-meta.spec`, `help.spec`) | UC-8 … UC-17 | ✅ Done | 2026-09-04 04:44 | 93 | ~40 tests across 9 files. Four passed before implementation because existing code already satisfied them (`--all`, `--preset core`, two registry-integrity cases); kept as regression guards and noted to the reviewer rather than dropped. Scored jointly with tasks 4–5. |
| 4 | Registry: add `presets?` to `ComponentDefinition` (JSDoc), the two data blocks (§D.1), `isPresetMap` check in `load.ts`; run `sync-registry --fix` (registry.json + snapshot regenerated); `ComponentRecord.presets` + `why` `Presets:` line | UC-14, UC-16 | ✅ Done | 2026-09-04 04:47 | 93 | V14 confirmed in practice: `sync-registry --fix` carried the hand-authored `presets` object into registry.json verbatim, and the nested literal needed no parser change (T-30 passed unmodified). |
| 5 | `core/presets.ts` (`resolvePreset`, `PresetError`); `AddOptions.preset`; `promptAddons(…, preselected)` + `selectAddons`; `add()` contradiction/unknown handling; `program.ts` flag; `help.ts` + `packages/cli/README.md`; MCP `add_component.preset` | UC-8 … UC-13, UC-15, UC-17 | ✅ Done | 2026-09-04 05:02 | 93 | First review (88) caught a real regression: I had hoisted `--all` above `--yes` in `selectAddons`, silently changing pre-existing `add --all --yes` from installing no addons to installing every one. Restored §D.4(b)'s order and added two tests that guard the ORDER, not just the flags. Also pinned the §D.3 stale-manifest warning verbatim. Lesson: reordering a decision table is a behaviour change even when each branch is individually correct. |
| 6 | What-now block: write T-37 … T-39 first, then `printWhatNow(uiPath)` from `printInstallResult` (not on dry-run / empty install) | UC-20 | ✅ Done | 2026-09-04 05:14 | — | 6 tests first, 2 sabotages caught (unconditional print; the brief's untrue "never overwrites without asking" wording). Path printed with posix separators — `aliasToProjectPath` yields backslashes on Windows and a path to read should not look like escapes. Scored with tasks 7–8. |
| 7 | Demo: write T-33 … T-35 first (new `rich-text-editor-addons-demo.component.spec.ts`), then `presetFor` + `installCommands` rewrite + `commandsBaseNote` en/he | UC-18 | ✅ Done | 2026-09-04 05:24 | — | The page's first spec. A sabotage (match presets on set SIZE only) passed all 7 original tests — every case used an exact preset selection, so none could discriminate. Added two same-cardinality-different-addons cases, which catch it. Scored with tasks 6+8. |
| 8 | e2e: `ComponentSpec.addArgs?` + `run.ts` splice; `EXPLICIT_SPECS` entry `{ names: ['rich-text-editor'], addArgs: ['--preset', 'writing'], label: 'rte-preset-writing', harnessFolder: 'rte-links' }`; `npm run e2e -- rte-preset-writing` green | UC-19 | ✅ Done | 2026-09-04 05:36 | — | Registered exactly as specced; loader resolves it (`names`, `addArgs`, harness `rte-links`, 187 specs, no duplicate labels). **`npm run e2e -- rte-preset-writing` → 1/1 passed, 3 Playwright tests green in 193s**, proving UC-19: the four addons come from the registry preset, not the command line, and `links` wires up in a pristine consumer install. `e2e:reset` run afterwards. ⚠️ Spec correction: the worktree had an EMPTY `node_modules`, so both `npm run e2e` and the coverage leg of `sonar:gate` failed on a missing `node_modules/vitest/vitest.mjs` until a local `npm install` was run; the `@modelcontextprotocol/sdk` install also landed without its `package.json` and needed a targeted reinstall. Worth noting for any future worktree-isolated agent. |
| 9 | Gates: `npm run test:cli`, `npm run coverage:cli`, `npm run lint`, `npm run docs:check`, `npm run sonar:gate`; re-verify the publish boundary against `registry/load.ts` + `core/fetch.ts` and record "**CLI publish required**" in the completion log | all | 🟡 In progress | — | — | `test:cli` 1474 passed / 1 failed (the pre-existing `gen-file-sizes-lib` CRLF artifact, verified to fail identically with every change stashed). `lint` 0 errors. Coverage on the changed files: plan.ts 100% lines, presets.ts 100%, why-core.ts 100%, add.ts 98.71%, load.ts 98.3%. `docs:check` green except `file-sizes.json is stale` — also verified pre-existing (same CRLF artifact). Sonar scan + e2e still running. |

Task sizing: each row is one coherent commit. Tasks 1–2 and 3–5 are two
independent tracks and may be done by one agent sequentially; 6–8 depend on 5.

### Implementation notes the executing agent must honour

- **Publish consequence (state it, do not action it):** this bundle changes
  CLI logic and the manifest validator → **an npm publish of
  `@gilav21/shadcn-angular` is required** for consumers to get any of it. The
  registry `presets` data alone goes live on merge and is inert for old CLIs.
  Recording the PR in the pending-releases memory is the lead's job.
- Registry edits go in `packages/cli/src/registry/index.ts` only;
  `registry.json` and the `full/index.ts` barrel are regenerated by
  `sync-registry --fix` (V14). On Windows, run `--fix` then push without a
  checkout in between (see the Windows push/hook memory).
- Keep every string the existing `add.spec.ts` asserts (V2).
- Sonar rules from `.claude/CLAUDE.md` §4 apply to CLI code too: `readonly`
  members, no nested ternaries, cognitive complexity ≤ 15, `for-of`, no
  negated `if/else`.
- No new runtime dependencies.
- `docs:check` must stay green (`file-sizes.json`, llms, component docs are
  unaffected, but run it — `sync-registry --fix` touches the snapshot).

---

## Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run sonar:gate`
   against `http://localhost:9000` — coverage re-measured unless the tree
   fingerprint proves it current) run and clean on the changed code. eslint is NOT a substitute. If the token, server, or Docker
   is unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.

---

## Completion Log

| Row | Date | Task | Reviewer score | Notes |
| --- | --- | --- | --- | --- |
| 1 | 2026-09-04 | Tasks 1–2 — grouped install summary (tests first, then `buildInstallSummary` + printing) | 92 | Architecture matches §D.4(a) Option 2; classifier is pure and feeds all three consumers. Reviewer independently re-ran the sabotages rather than trusting the report and confirmed the four correctness questions (built from `result.installed`, skipped excluded from `totalFiles`, lib files deduped, empty groups omitted). Two real defects found and fixed after the score: `(1 files)` for single-file entries, and the dry-run naming every component twice. Commits `0161c209`, `93fd259c`. |
