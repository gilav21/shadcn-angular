# Compiled npm packages — `@gilav21/shadcn-angular-rte` and `@gilav21/shadcn-angular-data-table`

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-09-04
> **Source plan:** `C:\Users\dasha\.claude\plans\look-at-the-richtext-snuggly-cook.md`
> (spec set row 6; design in "Package design — `@gilav21/shadcn-angular-rte` and
> `@gilav21/shadcn-angular-data-table`", the user's FINAL DECISION of 2026-09-03)
> **Companion spec:** `specs/rte-dx-trio-and-base-e2e-spec.md` §0 C-1/C-6 (the
> `addons/full` barrel contract and the NG3004 rule this package must respect)
> This document is append-only history. Never delete a task row, a superseded
> decision or a fixed bug — mark it and add the new entry below.

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.

It is **purely additive** to the CLI copy model: nothing under
`packages/cli/src/**` changes, no registry entry changes, no CLI publish is
required. It can run in a parallel worktree alongside the RTE feature specs;
the only shared files are `package.json` (new devDependency + scripts),
`angular.json` (two new projects), `e2e/orchestrator/{specs,run,paths,reset-app,worker,impact}.ts`
(new spec kind) and the repo-wide excludes (`tsconfig.json`,
`tsconfig.eslint.json`, `eslint.config.mjs`, `sonar-project.properties`,
`.gitignore`). Merge those as small hunks.

---

## 0. Step-0 verification — what the plan got wrong (⚠️ corrections)

Every claim below was checked against the working tree on 2026-09-04. The plan
doc is not edited by this spec (the brief forbids it); corrections are recorded
here and reported to the lead.

| # | Plan claim | What the source says | Consequence for this spec |
|---|---|---|---|
| ⚠️ C-1 | "`scripts/stage-package.ts` … reusing `resolveDependencies`". | Root `scripts/` holds only `.mjs` runners (`sonar.mjs`, `preflight.mjs`, `coverage.mjs`, …) plus one Playwright helper; **none imports a CLI TypeScript module**. Every maintainer script that imports CLI `src/` lives in `packages/cli/scripts/*.ts` and is run with `tsx` (`package.json:13-14, 39-45`; e.g. `sync-registry.ts` imports `./sync-registry-lib`, `e2e/orchestrator/specs.ts:27-30` imports `../../packages/cli/src/registry/index.js` — tsx resolves the `.js` suffix to `.ts`). The vitest CLI leg only collects `packages/cli/src/**`, `packages/cli/scripts/**`, `e2e/orchestrator/**` (`vitest.config.cli.ts:7-11`); Sonar **excludes** root `scripts/**` (`sonar-project.properties:34`). `release-cli-lib.ts:110-117` (`isCliDevOnly`) classifies `packages/cli/scripts/` as never-shipped, so a file there never forces a CLI publish. | The stage and release scripts live in **`packages/cli/scripts/`** (`stage-package.ts` + `stage-package-lib.ts`, `release-package.ts` + `release-package-lib.ts`, `package-build.ts`), exposed as root npm scripts `stage:package`, `build:package`, `release:package`. Same `<entry>.ts` + `<entry>-lib.ts` + `-lib.spec.ts` layout as `sync-registry` / `release-cli`. |
| ⚠️ C-2 | "`theme.css` generated from `packages/cli/src/templates/styles.ts`". | `getStylesTemplate(baseColor = 'neutral', themeColor = 'zinc')` (`styles.ts:341`) is the function `init` writes as the consumer's `tailwind.css` (`init-core.ts:132`). Its output **starts with `@import "tailwindcss";` and two `@source "../src/**"` lines** (`styles.ts:347-351`) — both wrong inside a package theme file (the consumer already imports Tailwind; the `@source` globs would point into `node_modules/<pkg>/../src`). | The stage script post-processes the template: drop the `@import "tailwindcss";` line, the "Tell Tailwind…" comment and every `@source` line; keep `@custom-variant dark`, `:root {…}`, `.dark {…}`, `@theme inline {…}`, `@layer base {…}`. `templates/styles.ts` is **not** edited (it is bundled CLI code — editing it would force a CLI publish). |
| ⚠️ C-3 | "`resolveDependencies()` … computes the closure". | Confirmed: `packages/cli/src/core/resolve.ts:3-14`, signature `resolveDependencies(names: ComponentName[]): Set<ComponentName>`, walks `registry[name].dependencies` transitively. `sync-registry-lib.ts:1638-1648` has a second helper `dependencyClosure(name, depsByName)` that works over freshly-derived updates (a `Map`), not the registry — **not** the right tool for a published-registry closure. | `stage-package-lib.ts` calls `resolveDependencies` from `../src/core/resolve.js`; file lists come from `registry[name].files` / `.libFiles` (`packages/cli/src/registry/index.ts:55-60`). |
| ⚠️ C-4 | "Closures … RTE full: 35 components / 236 files / 35 lib files … 27 parser files". "Data table + 3 addons: 23 components / 160 files / 15 lib files". | Recomputed from `registry.json` on 2026-09-04: RTE = 35 components, 236 `files[]` (179 `.ts`, 38 `.html`, 19 `.css`), 35 distinct `libFiles[]`; data-table = 23 components, 160 files (122 `.ts`, 17 `.html`, 21 `.css`), 15 lib files. Neither closure declares any `npmDependencies`. `utils.ts` is a **baseline** lib file that no entry lists (`sync-registry-lib.ts:662` `BASELINE_LIB_FILES`), so it must be added explicitly — plan is right on that. The parser count is **22**, not 27 (`parsers/` has docx-parser, docx-to-editor-html, image-validator, inflate, pdf-parser, pdf-pixel-perfect, 12 × `pdf-readable/*`, svg-sanitizer, ttf-builder, ttf-parser, zip-reader). An import audit (static + dynamic `import()`, lib→lib transitive) found **zero** lib files imported by either closure that are not in its `libFiles[]` ∪ `{utils.ts}`, and **zero** UI files reached outside the closure — 17 RTE lib files (`inflate`, `pdf-parser`, `pdf-pixel-perfect`, `pdf-readable/readable-*`, `ttf-*`, `zip-reader`, `i18n.token`) are reachable only through the three lazy `import()`s in `addons/file-import/rich-text-file-import.directive.ts:221-229` and lib→lib chains, which is why they are declared but never statically imported. | Staged set = ⋃ `files[]` ∪ ⋃ `libFiles[]` ∪ `{lib/utils.ts}`: **272** files for `rte`, **176** for `data-table`. T-4 re-runs that audit against the staged tree, so exactness is proven by a test, not by this table. |
| ⚠️ C-5 | "All imports are relative … zero `@/` alias imports". | Confirmed: `grep -rl "from '@/" packages/components/{ui,lib}` → 0 files. Also verified: no `?raw` imports, no `import.meta`, no `new Worker(`, no `require(` in either closure; `button.component.ts:51-52` uses `templateUrl`/`styleUrl` (ng-packagr inlines both); component `.css` files use only `@layer components {}` + density `calc()` — no `@apply`/`@reference`/`@import`/`theme()` (scanned all 40 `.css` files in the two closures). | Sources are copied **verbatim**; no rewrite step. |
| ⚠️ C-6 | "zero `npmDependencies` anywhere" (implying no runtime deps). | True for the registry field, but `lib/utils.ts:1-2` imports `clsx` and `tailwind-merge`; `button`, `badge`, `input`, `input-group` and `rich-text-editor.component.ts` import `class-variance-authority`; `rich-text-editor.component.ts`, `data-table.component.ts` and others import `@angular/forms` (CVA) and `rxjs`; several addon buttons and `icon` import `DomSanitizer` from `@angular/platform-browser`. `init` installs the three utility packages for every consumer (`init-core.ts:21-23`). | Package `dependencies`: `clsx`, `tailwind-merge`, `class-variance-authority`, `tslib`; `peerDependencies`: `@angular/common`, `@angular/core`, `@angular/forms`, `@angular/platform-browser` (all `^21.0.0`), `rxjs ^7.8.0`. ng-packagr refuses non-peer deps unless whitelisted → `allowedNonPeerDependencies` in `ng-package.json`. |
| ⚠️ C-7 | "`@angular/build:ng-packagr` builder is available once `ng-packagr` is added". | Confirmed: `node_modules/@angular/build/src/builders/ng-packagr/{builder.js,schema.json}` exist (options: `project`, `tsConfig`, `watch`, `poll`); `builder.js:63-70` lazy-requires `ng-packagr` and errors "The "ng-packagr" package was not found" otherwise. `@angular/build/package.json` peer: `"ng-packagr": "^21.0.0"` (optional). `@angular/cli` 21.2.21 is hoisted at root (`node_modules/@angular/cli/package.json`), so `npx ng build <project>` from the repo root works against the root `angular.json`. `ng-packagr` is not in `node_modules` and not in `package-lock.json` as a resolved package. | devDependency `"ng-packagr": "^21.0.0"` in the root `package.json`. The executing agent reviews the lock diff for dropped packages (memory: lockfile rule) — do **not** hand-edit. |
| ⚠️ C-8 | "Peer range `^21.0.0`; the e2e leg … needs a 21-based fixture or a bump of the fixture." | `e2e/fixture-app/package.json` pins `@angular/* ^20.3.0` and `node_modules/@angular/core` there is **20.3.25**. The README calls it "a pristine Angular 20 fixture" (`e2e/README.md:22`) and every one of the ~230 copy-model specs runs on it — it is the proof that copied components work in an Angular-20 consumer. A 21-compiled partial-Ivy library cannot be linked by a 20 consumer. | **Add a second fixture, `e2e/fixture-app-21/`** (same scaffold, `@angular/* ^21.2.0`, budgets 2 MB/4 MB), and a `fixture: 'ng21'` field on the spec. Bumping the existing fixture is rejected: it would silently drop the Angular-20 consumer proof for the whole suite. See §D.4 Option set C. |
| ⚠️ C-9 | Brief: "a `pkg-*` harness that installs no registry component needs a design". | `specs.ts:291-332`: every `e2e/harness/<X>/` folder with `<X>-demo.component.ts` is auto-discovered as `{ names: [X] }` unless an `EXPLICIT_SPECS` entry **claims** the folder (`specHarness`); `validateSpecs` (`:305-316`) throws for any `names[]` entry that is not a registry component — so `pkg-rte` as a bare folder would abort the whole orchestrator at module load. `run.ts:73-101` always runs `init` + `add <names>`. `installHarness` (`install-harness.ts:20-27`) already handles a non-canonical fixture path. `impact.ts:66-72` matches specs by `names.includes(name)`. | New optional fields on `ComponentSpec`: `packages?: readonly PackageId[]` and `fixture?: FixtureId`; `names` may be **empty** only when `packages` is non-empty (validated). The three `pkg-*` entries are `EXPLICIT_SPECS` rows (they claim their folders). `runOne` branches on `packages`. `impact.ts` maps a package's **root components** (plus the package folder and the stage script) to its specs. See §D.4 Option set B. |
| ⚠️ C-10 | "`public-api.ts` exports base barrel + every addon + `RTE_FULL`". | `rich-text-editor/index.ts` exports 8 base modules; `addons/full/index.ts` named-re-exports the 13 directive **classes only** and `RTE_FULL` (generated by `renderCompositeBarrel`, `sync-registry-lib.ts:1088-1113`). Addon **types** consumers need — `RichTextActionDefinition` (`addons/actions`), `MentionItem`, `RichTextEntitySearchFn` (`addons/mentions`), `RichTextAiRequest`, … — are only in the per-addon barrels (the `rte-all` harness imports them from there: `e2e/harness/rte-all/rte-all-demo.component.ts:5-6`). An export-name collision scan across the 15 RTE barrels and the 4 data-table barrels found **no** two distinct symbols sharing a name (the 13 directive classes appear twice — same declaration re-exported — which TypeScript accepts under `export *`). | `public-api.ts` = `export *` from the base barrel, **every addon barrel**, and `addons/full` (for `RTE_FULL` + the named class block that satisfies NG3004 in the package entry point). Data-table: base barrel + the three addon barrels. Generated, never hand-edited. |
| ⚠️ C-11 | "`scripts/release-package.ts` mirroring `release-cli.ts`: … preflight, bump, changelog, commit, tag, push, then STOP". | In `release-cli.ts:216-268` the order is verdict → preflight → bump → changelog → commit → `npm publish` → tag → push. For a **compiled** package the version in the published `dist/<pkg>/package.json` is copied by ng-packagr from the source `package.json`, so the build that produces the tarball must run **after** the bump. `release-cli-lib.ts` helpers are reusable value→value functions, but `tagName` (`:96`), `RELEASE_PATHS` (`:101`), `releaseCommitArgv` (`:109`) and `CHANGELOG_HEADER` (`:340`) are CLI-specific literals. | Order: guards → verdict → **bump + changelog** → preflight (`stage` → `ng build` → `npm pack` → package e2e legs) → commit → annotated tag `rte-v<version>` / `data-table-v<version>` → push `--follow-tags` → **STOP** printing the manual `npm publish --access public` command. On preflight failure the bumped files are reverted (`git checkout -- <paths>`). `release-cli-lib.ts` gets two **parameterised** helpers (`releaseCommitArgv(tag, paths, scope)`, `prependRelease(existing, block, header)`) with defaults preserving CLI behaviour; `release-package-lib.ts` owns the package literals. |
| ⚠️ C-12 | Layout: `packages/rte-package/` and `packages/data-table-package/`. | Root `package.json:6-9` declares `"workspaces": ["packages/*", "demo"]`; today only `packages/cli/package.json` exists, so the glob resolves to one workspace. A new `packages/rte-package/package.json` would become an npm **workspace**: `npm install` would symlink `node_modules/@gilav21/shadcn-angular-rte` → the *source* folder and auto-install its peer deps. | `workspaces` becomes `["packages/cli", "demo"]` (explicit; the lock's resolved workspace list is unchanged). Package folders are plain directories built by ng-packagr into `dist/<id>-package/` (root `.gitignore:5` already ignores `dist`). |
| ⚠️ C-13 | Not in plan: repo-wide gates and the generated `src/`. | Root `tsconfig.json` has **no `include`** (everything under the repo is a program input except the listed `exclude`s, `tsconfig.json:44-53`); `tsconfig.eslint.json:7-11` includes `packages/**/*.ts`; `eslint.config.mjs:16-45` ignores are path globs; Sonar `sonar.sources=packages,.storybook` (`sonar-project.properties:24`). A generated 272-file copy of the closure would be type-checked, template-checked (`ngc -p tsconfig.json`), linted and Sonar-scanned twice, and `check:registry` (`sync-registry`) walks `packages/components/ui` only — unaffected. | Add `packages/*-package/src/**` (+ `packages/*-package/theme.css`) to: root `tsconfig.json` `exclude`, `tsconfig.eslint.json` `exclude`, `eslint.config.mjs` `ignores`, `sonar.exclusions`, and `.gitignore`. Verified by T-9. |
| ⚠️ C-14 | "Verification: `ng build` both packages clean (AOT is the real proof)"; "verify `import()` survives ng-packagr". | The three dynamic imports are at `rich-text-file-import.directive.ts:221, 222, 229`. ng-packagr flattens each entry point with a `dir`-output rollup/rolldown build, which emits dynamic-import targets as sibling chunks (`fesm2022/<name>-<hash>.mjs`) rather than inlining them. Nothing in this repo has exercised that yet. | **T-6** is the proof: after `ng build rte-package`, `dist/rte-package/fesm2022/` must contain the entry FESM **plus ≥ 1 chunk**, the entry must contain `import('./` and must **not** contain `function parsePdfReadable`, and a chunk must. If the assertion fails, the executing agent stops and reports — inlining ~20 parser files into the entry FESM is a size regression the user must decide on, not a silent fallback. |
| ⚠️ C-15 | Verification: package e2e installs the tarball and runs "`ng build` + Playwright smoke". | `e2e/fixture-app/angular.json:33-44` sets production budgets `initial` 500 kB warn / **1 MB error**. `ng serve` (development) ignores budgets, but a production `ng build` of the RTE closure (~42 k source lines) is expected to exceed 1 MB. | `e2e/fixture-app-21/angular.json` sets `maximumWarning: 2MB, maximumError: 4MB` (the demo's own values, `angular.json:57-60`). The pkg legs run `ng build --configuration production` **and** `ng serve` + Playwright. |

**Facts the design rests on (verified, cite-able):**

- Registry closure roots: `rte` = `['rich-text-editor', 'rich-text-editor/full']`
  (`rich-text-editor/full` depends on all 13 addons, `registry.json`); `data-table`
  = `['data-table', 'data-table/context-menu', 'data-table/export', 'data-table/pivot']`.
  Addon selectors: `[uiRteFull]` (composite marker on every RTE addon directive),
  `[uiDtContextMenu]` (`addons/context-menu/context-menu.directive.ts:38`),
  `[uiDtExport]` (`export.directive.ts:24`), `[uiDtPivot]` (`pivot.directive.ts:15`).
- Orchestrator plumbing: `paths.ts` (`FIXTURE_APP`, `WORKERS_ROOT`, `DEV_SERVER_PORT=4250`),
  `reset-app.ts:19-22` (`git checkout HEAD -- e2e/fixture-app` + `git clean -fd`),
  `worker.ts:186-213` (`createWorkers`: worker 0 = canonical fixture, clones under
  `e2e/.workers/`), `run-cli.ts:44-56` (`runCli`, `npmInstall`), `serve.ts:24-62`
  (`ng serve --port`), `spawn.ts` (`run`/`capture`/`captureBoth`), `run.ts:171-195`
  (exact label matching, exit 2 on unknown), `e2e/playwright.config.ts` (`testDir:
  'harness'`, `E2E_BASE_URL`, 30 s per test).
- `init` on a fixture writes `components.json`, `src/lib/utils.ts`, `src/tailwind.css`
  (from `getStylesTemplate`), prepends `@import "./tailwind.css";` to `src/styles.scss`,
  installs `clsx tailwind-merge class-variance-authority tailwindcss postcss
  @tailwindcss/postcss`, writes `.postcssrc.json` `{ "plugins": { "@tailwindcss/postcss": {} } }`
  and adds the `@/*` path alias (`init-core.ts:19-52, 111-150`). The package legs
  replicate **only** the Tailwind/PostCSS part of that, by hand, from the README
  contract — that is the point of the leg.
- `release-cli.ts` git plumbing: `git()` / `gitOrNull()` (`:52-65`), `npm()` via
  shell (`:72-74`, Windows `.cmd` shim), `resolveBaseRef()` via `git describe --tags
  --abbrev=0 --match 'cli-v*'` (`:81-90`), annotated tag + `push --follow-tags`
  (`:248-256`). `preflight.mjs` stages: `check:all`, `check:registry`,
  `check:completeness`, `coverage:cli`, `test:ci:coverage` (`scripts/preflight.mjs:34-45`).
- `check-completeness-lib.ts:203-226` derives e2e coverage from `spec.names[]` only —
  an entry with empty `names` neither covers nor orphans anything.
- Sonar: `packages/cli/scripts/**` is scanned (under `packages`), unit-tested by the
  CLI leg with coverage ratchets `statements 74 / branches 68 / functions 77 / lines 74`
  (`vitest.config.cli.ts:46-51`) — new lib files must not drag those below the floor.

---

## B. Product Manager section

### B.1 Business logic

Two **compiled Angular libraries** are published to npm from this repo, each a
frozen snapshot of one registry closure:

| Package | Closure roots | What a consumer gets |
|---|---|---|
| `@gilav21/shadcn-angular-rte` | `rich-text-editor` + `rich-text-editor/full` | `RichTextEditorComponent`, its services/types, all 13 addon directives, `RTE_FULL`, every addon type — 35 components' worth of code as one FESM (+ lazy parser chunks) |
| `@gilav21/shadcn-angular-data-table` | `data-table` + `context-menu` + `export` + `pivot` addons | `DataTableComponent`, column builder, filters, the three `uiDt*` addon directives and their types |

A consumer installs one npm package, adds one `@source` line and one theme
import to their CSS, and uses the same `ui-*` selectors, inputs and addon
directives the copy model documents. Nothing lands in their source tree.

The CLI copy model stays the default and is untouched. The packages are built by
a **registry-driven stage script** (the same closure `add` would install),
compiled by ng-packagr through the Angular CLI, verified by e2e legs that install
the real `npm pack` tarball into a pristine Angular 21 app, and released by a
script that stops one step short of `npm publish` (manual 2FA).

### B.2 Why the customer wants this

| Pain today | Workaround forced today |
|---|---|
| "`add rich-text-editor/full` put **271 files** into my repo. My reviewers think I vendored a library." (plan §"hundreds of files" problem, user decision round 4) | Accept the files; or hand-roll a private npm package from the copied tree and maintain it. |
| "I never customise the editor; I just want `npm update` to give me the fixes." | Run `npx shadcn-angular update` and resolve 3-way merges for files they never edited. |
| "Our platform team forbids copied third-party source in app repos." | Cannot adopt the editor or the table at all. |
| "I want the table with export + pivot in three internal apps. Each one now carries 176 identical files." | Copy into each app, or build an internal package by hand. |

### B.3 Use cases = definition of done

Written from the consuming developer's (or the maintainer's, where marked) point
of view. Each is observable without reading the source and atomic.

**Staging (maintainer-facing)**

- **UC-1** `npm run stage:package -- rte` writes `packages/rte-package/src/` containing
  **exactly** the registry closure of `rich-text-editor` + `rich-text-editor/full`:
  every `files[]` entry under `src/ui/`, every `libFiles[]` entry plus `utils.ts`
  under `src/lib/`, nothing else (no `.spec.ts`, `.stories.ts`, `__screenshots__`),
  and a generated `src/public-api.ts`. Re-running is idempotent (stale files from a
  previous run are removed first).
- **UC-2** `npm run stage:package -- data-table` does the same for `data-table` + its
  three addons, into `packages/data-table-package/src/`.
- **UC-3** The generated `public-api.ts` re-exports the base barrel, every addon
  barrel and (for `rte`) `addons/full`, so `import { RichTextEditorComponent,
  RTE_FULL, RichTextActionsDirective, type RichTextActionDefinition, type
  MentionItem } from '@gilav21/shadcn-angular-rte'` and `import { DataTableComponent,
  DataTableExportDirective, type ColumnDef } from '@gilav21/shadcn-angular-data-table'`
  both resolve, and `imports: [RichTextEditorComponent, RTE_FULL]` compiles under a
  consumer's AOT build with no NG3004.
- **UC-4** `packages/rte-package/theme.css` (and the data-table twin) is generated
  from `getStylesTemplate()` **without** `@import "tailwindcss"` and without any
  `@source` line, and still contains `@custom-variant dark`, `:root {`, `.dark {`,
  `@theme inline {` and `@layer base {`.

**Building and packing (maintainer-facing)**

- **UC-5** `npx ng build rte-package` and `npx ng build data-table-package` succeed
  from the repo root and write `dist/<id>-package/` with `package.json`,
  `fesm2022/*.mjs`, type declarations, `README.md` and `theme.css`.
- **UC-6** The RTE build keeps the file-import parsers **lazy**: `dist/rte-package/fesm2022/`
  holds the entry FESM plus at least one chunk; the entry contains `import('./` and
  not `function parsePdfReadable`; a chunk does.
- **UC-7** `npm run build:package -- rte` produces `dist/packs/gilav21-shadcn-angular-rte-<version>.tgz`
  whose file list (`npm pack --json`) contains `package.json`, `README.md`,
  `theme.css`, `fesm2022/`, `index.d.ts` and **no** `*.spec.*`, `*.stories.*`,
  `.ts` sources or `__screenshots__`. The packed `package.json` has `sideEffects:
  false`, `exports["./theme.css"]`, `peerDependencies` on `@angular/core ^21.0.0`,
  and `dependencies` on `clsx`, `tailwind-merge`, `class-variance-authority`, `tslib`
  only.

**Consuming (developer-facing)**

- **UC-8** In a pristine Angular 21 app with **no** shadcn-angular CLI involvement:
  `npm install <rte tarball>`, `npm install -D tailwindcss @tailwindcss/postcss postcss`,
  the README's three CSS lines and a `.postcssrc.json`, then `ng build --configuration
  production` succeeds and the served page renders `<ui-rich-text-editor uiRteFull>`
  with all 11 toolbar addon slots visible, an `[ngModel]` round-trip, and a
  control editor with zero addon slots.
- **UC-9** Same for the data-table tarball: a `<ui-data-table uiDtContextMenu uiDtExport
  uiDtPivot>` renders its rows, the ⋮ row-action button opens the addon menu, the
  export addon downloads `rows.csv`, and `getPivot()` returns the expected total.
- **UC-10** Mixed mode: an app that ran `init --yes` + `add button` (CLI copy) **and**
  installed the RTE tarball builds and renders both `<ui-button>` (copied) and the
  package editor on one page with no console error, and the copied button's click
  handler fires — proving selector coexistence and no DI crash.
- **UC-11** Each package README states the consumer contract verbatim: the install
  line, the three CSS lines (`@import "tailwindcss";`, `@source
  "../node_modules/<pkg>";`, `@import "<pkg>/theme.css";` with "skip if already
  CLI-initialised"), fixed `ui-` selectors (no `--prefix`), inputs-only
  configuration (no DI config API), `[locale]` and `uiRte*` / `uiDt*` addon usage, and
  the note that a package instance and CLI-copied components keep **separate**
  singletons (`ShortcutBindingService`, i18n token, `AddonSlotRegistry`). The snippet
  the README prints is the same string the e2e leg writes into the fixture (one
  source, drift-proof).

**Releasing (maintainer-facing)**

- **UC-12** `npm run release:package -- rte patch --dry-run` prints a publish verdict
  computed from the closure diff since the last `rte-v*` annotated tag (or the
  package's first-commit fallback), the next version, the CHANGELOG block from
  conventional commits touching the closure, and the exact commands it would run —
  ending with the **manual** `cd dist/rte-package && npm publish --access public`
  step — and changes nothing on disk or in git.
- **UC-13** `npm run release:package -- rte patch` (real run, verdict REQUIRED or
  `--force`): bumps `packages/rte-package/package.json`, prepends
  `packages/rte-package/CHANGELOG.md`, runs the package preflight (stage → build →
  pack → `npm run e2e -- pkg-rte pkg-mixed`), commits only those two files, creates
  the **annotated** tag `rte-v<version>`, pushes with `--follow-tags`, and then STOPS
  with the publish hand-off. It never calls `npm publish`.
- **UC-14** A verdict of "NOT required" (no closure file, package folder, theme
  template or stage script changed since the tag) aborts with exit 1 unless
  `--force`; a dirty tree or non-`master` branch aborts unless `--allow-dirty` /
  `--allow-branch`.

**Orchestration (maintainer-facing)**

- **UC-15** `npm run e2e -- pkg-rte pkg-data-table pkg-mixed` runs exactly those three
  labels on the Angular 21 fixture, building each package tarball **once** per run;
  `npm run e2e` (no args) includes them; an unknown label still exits 2.
- **UC-16** `npm run e2e:impact -- --base <ref>` schedules `pkg-rte` (and `pkg-mixed`)
  when any file of the RTE closure, `packages/rte-package/**`, the stage script or
  `templates/styles.ts` changed; `pkg-data-table` for the table closure; and
  `pkg-*` are **not** scheduled by an unrelated component change (e.g. `accordion`).
- **UC-17** The generated `packages/*-package/src/` and `theme.css` are git-ignored
  and excluded from `npm run lint`, `npm run typecheck`, `npm run typecheck:templates`,
  `check:registry` and the Sonar scan — running the stage script and then `npm run
  check:all` yields the same result as before staging.

### B.4 Explicitly out of scope

- Any change to the CLI copy model, `packages/cli/src/**`, the registry data or
  `registry.json`. No `preset`, no `--package` flag on `add`, no `eject` command.
- Secondary entry points (`@gilav21/shadcn-angular-rte/addons/emoji`) — a single
  entry point with `sideEffects: false` is the design; measured tree-shaking is a
  later concern.
- Packages for any other component (`button`, `dialog`, …) or a "core" package.
- A `--prefix` equivalent for the packages; selectors are fixed `ui-*`.
- DI-based configuration or a provider API (project policy: inputs only).
- Bundle-size budgets or size regression tracking beyond UC-6's laziness proof.
- Running `npm publish` (manual, 2FA), npm provenance, or any GitHub Actions change
  (local-first policy). The existing `e2e.yml` will pick up the new labels through
  the impact analyzer without edits.
- Storybook stories or demo pages — the packages ship existing components; their
  stories/demos already exist in the copy model.
- Angular 20 consumers of the packages (peer `^21.0.0`; the copy model remains the
  Angular-20 path).

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> This is the mechanism that keeps implementation honest against the PM section.

### C.1 Traceability table

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `stage-package-lib: computeClosure('rte') equals resolveDependencies of the two roots — 35 components; ('data-table') — 23` | UC-1, UC-2 | unit (CLI leg) |
| T-2 | `stage-package-lib: stagedFiles('rte') = ⋃files ∪ ⋃libFiles ∪ {utils.ts}, 272 entries, none matching /\.(spec|stories)\.ts$/ or __screenshots__; ('data-table') 176` | UC-1, UC-2 | unit |
| T-3 | `stage-package-lib: stagePackage() into a temp dir writes exactly stagedFiles + public-api.ts, removes a planted stale file on re-run` | UC-1 | unit (fs, temp dir) |
| T-4 | `stage-package-lib: every relative import (static or import()) inside the staged tree resolves to a file inside the staged tree` (walk `.ts`; resolve `x`, `x.ts`, `x/index.ts`) | UC-1, UC-2 | unit (exactness audit) |
| T-5 | `stage-package-lib: renderPublicApi('rte') lists export * for the base barrel, all 13 addon barrels and addons/full; ('data-table') base + 3 addons; and the staged addons/full/index.ts still carries the named export {…} block for all 13 classes` | UC-3 | unit |
| T-6 | `package-build (integration, run under the e2e leg, not vitest): fesm2022 has entry + ≥1 chunk; entry contains "import('./" and not "function parsePdfReadable"; some chunk contains it` — implemented as an assertion inside `e2e/orchestrator/package-build.ts` that throws on violation (so it fails `npm run e2e -- pkg-rte` and `release:package`) | UC-6 | integration |
| T-7 | `stage-package-lib: toPackageTheme(getStylesTemplate()) has no "@import \"tailwindcss\"", no "@source", keeps @custom-variant dark / :root / .dark / @theme inline / @layer base; is byte-stable across two calls` | UC-4 | unit |
| T-8 | `stage-package-lib: consumerCssSnippet('rte') === the three README lines; README.md of each package contains that exact snippet and the package name (drift test reads packages/<id>-package/README.md)` | UC-11 | unit (drift) |
| T-9 | `repo excludes: root tsconfig.json, tsconfig.eslint.json, eslint.config.mjs ignores, sonar-project.properties exclusions and .gitignore each contain the packages/*-package/src pattern` (reads the files as text) | UC-17 | unit (drift) |
| T-10 | `release-package-lib: parsePackageArgs accepts <rte|data-table> <patch|minor|major> in either order with the release-cli flags; rejects unknown id/level/flag with ArgError` | UC-12 | unit |
| T-11 | `release-package-lib: packageTagName('rte','0.1.1') === 'rte-v0.1.1'; ('data-table', …) === 'data-table-v…'` | UC-13 | unit |
| T-12 | `release-package-lib: packageVerdict(changedFiles, closurePaths, id) — REQUIRED for a closure ui file, a closure lib file, lib/utils.ts, packages/<id>-package/{package.json,README.md,ng-package.json,tsconfig.lib.json}, packages/cli/src/templates/styles.ts, packages/cli/scripts/stage-package*.ts; NOT required for accordion files, demo/, docs/, the OTHER package's folder, or packages/<id>-package/CHANGELOG.md alone` | UC-12, UC-14 | unit |
| T-13 | `release-package-lib: releaseCommitArgv(tag, paths, scope) is pathspec-scoped to the two package files and the message is chore(rte): release rte-v…; prependRelease(existing, block, header) uses the package header` (+ existing CLI defaults unchanged: `release-cli.spec.ts` keeps passing) | UC-13 | unit |
| T-14 | `release-package.ts (subprocess, repo-fixtures.ts): --dry-run on a fixture repo prints the verdict, "0.1.0 → 0.1.1", the CHANGELOG block, the would-run list ending in the manual "npm publish --access public" line, and leaves git status clean and no tag` | UC-12 | unit (subprocess) |
| T-15 | `release-package.ts (subprocess): real run with --skip-preflight on a fixture repo commits exactly package.json + CHANGELOG.md, creates an ANNOTATED tag rte-vX (git cat-file -t → "tag"), and the stdout contains no "npm publish" execution (fixture npm stub asserts it was never invoked)` | UC-13 | unit (subprocess) |
| T-16 | `release-package.ts (subprocess): NOT-required verdict exits 1 without --force; dirty tree exits 1 without --allow-dirty; non-master exits 1 without --allow-branch` | UC-14 | unit (subprocess) |
| T-17 | `specs.ts: ALL_COMPONENTS contains labels pkg-rte, pkg-data-table, pkg-mixed with packages/fixture set; a spec with empty names and no packages throws at load; harness folders pkg-* are claimed (not auto-discovered)` | UC-15 | unit (orchestrator) |
| T-18 | `impact.spec.ts: a change to packages/components/ui/rich-text-editor/addons/emoji/rich-text-emoji.directive.ts schedules pkg-rte and pkg-mixed; ui/data-table/data-table.component.ts schedules pkg-data-table; packages/rte-package/README.md → pkg-rte + pkg-mixed; packages/cli/scripts/stage-package-lib.ts → all three pkg-* (via the packages/cli tripwire = ALL, asserted as kind 'all'); ui/accordion/accordion.component.ts schedules none of them` | UC-16 | unit (orchestrator) |
| T-19 | `e2e/harness/pkg-rte/pkg-rte.spec.ts: all 11 addon slots visible on the package editor; control editor has none; typing updates the ngModel mirror; page has zero pageerror events` | UC-8 | e2e |
| T-20 | `e2e/harness/pkg-data-table/pkg-data-table.spec.ts: 3 data rows; ⋮ button opens context-menu-content with "Edit row"; export-csv download is rows.csv; pivot total text is 120` | UC-9 | e2e |
| T-21 | `e2e/harness/pkg-mixed/pkg-mixed.spec.ts: copied <ui-button data-testid="copied-button"> increments its counter; package editor shows the emoji.insert slot; zero pageerror events; the copied button's data-slot="button" element and the package's internal button inside the editor toolbar both exist (two implementations, one page)` | UC-10 | e2e |
| T-22 | `orchestrator run (integration): ng build --configuration production succeeds in the ng21 fixture for pkg-rte and pkg-data-table before ng serve` — a step in `runOne` for package specs; failure fails the label | UC-8, UC-9 | integration |
| T-23 | `package-build.ts: buildPackageTarball('rte') asserts npm pack --json file list (UC-7 inclusions/exclusions) and the packed package.json fields (sideEffects false, exports ./theme.css, peer @angular/core ^21.0.0, dependencies = the four names)` — throws on violation, runs inside the e2e leg and release preflight | UC-7, UC-5 | integration |
| T-24 | `stage-package.ts (subprocess): unknown id exits 1 with usage; no id exits 1; "rte" exits 0 and prints the file count` | UC-1 | unit (subprocess) |

Every `UC-n` (1–17) appears above.

### C.2 Test types to cover

- **Unit (vitest, CLI leg `npm run test:cli`)** — `packages/cli/scripts/stage-package-lib.spec.ts`,
  `packages/cli/scripts/release-package-lib.spec.ts`, `packages/cli/scripts/release-package.spec.ts`
  (subprocess, reuse `repo-fixtures.ts` helpers `createRepo/gitInitCommit/runScript`),
  `packages/cli/scripts/stage-package.spec.ts` (subprocess), additions to
  `e2e/orchestrator/impact.spec.ts` and a new `e2e/orchestrator/specs.spec.ts`.
  All are collected by `vitest.config.cli.ts`.
- **Integration assertions inside the orchestrator** (T-6, T-22, T-23) — they run in
  `npm run e2e -- pkg-*` and in `release:package` preflight. They are not vitest
  tests because they need a real ng-packagr build (minutes).
- **e2e (Playwright)** — three harness specs on the Angular 21 fixture.
- **Storybook / axe** — none: no new component ships.
- **Perf** — no perf claim beyond UC-6 (laziness), which is a structural assertion.

### C.3 Edge cases and failure modes the tests must cover

- Stale staged file removed on re-run (T-3); staging when `src/` does not exist yet.
- A closure `files[]` entry missing on disk → stage throws naming the file (T-3 variant).
- `import()` targets counted by the exactness audit (T-4 includes the three lazy
  imports).
- Package id typo (`rtee`) → exit 1 with usage (T-24, T-10).
- First release with no `rte-v*` tag → base ref falls back to the last commit touching
  `packages/rte-package/package.json`, then the root commit (T-14 fixture has no tag).
- Lightweight vs annotated tag: T-15 asserts `git cat-file -t <tag>` is `tag`.
- Dry-run never writes (T-14 checks `git status --porcelain` empty and no tag).
- `pkg-*` specs never call `init`/`add` unless `names` is non-empty; the ng21 fixture
  is reset between labels; the tarball is built once per run even when three labels
  need it (T-17 cannot prove the memo; T-22 leg output must show one build — the
  executing agent verifies in the run log).
- The consumer app is **zoneless** (`fixture-app/src/app/app.config.ts:9`) — copy the
  same `app.config.ts` into `fixture-app-21`; the packages must work without zone.js.
- Windows: `npm`/`npx` through `shell: true` (spawn.ts pattern), `npm pack` path with
  backslashes normalised before `npm install <tarball>`.

### C.4 Coverage expectation

- `stage-package-lib.ts`, `release-package-lib.ts`: 100 % lines (pure functions).
- `stage-package.ts`, `release-package.ts`, `package-build.ts` entries: driven by
  subprocess tests → read as ~0 % under v8 (known artifact, `vitest.config.cli.ts:36-44`);
  keep entries thin (argv, I/O, exit codes) so the ratchet holds.
- `e2e/orchestrator/specs.ts`, `impact.ts`: new branches covered by T-17/T-18.
- CLI-leg thresholds (`74/68/77/74`) must not drop; verify with `npm run coverage:cli`.

---

## D. Architecture section

### D.1 Usability — the public API

**Consumer, simple mode (everything on):**

```ts
// app.component.ts
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RichTextEditorComponent, RTE_FULL } from '@gilav21/shadcn-angular-rte';

@Component({
  selector: 'app-root',
  imports: [FormsModule, RichTextEditorComponent, RTE_FULL],
  template: `<ui-rich-text-editor uiRteFull mode="html" [(ngModel)]="html" />`,
})
export class AppComponent {
  html = signal('<p>Hello</p>');
}
```

```css
/* src/styles.css */
@import "tailwindcss";
@source "../node_modules/@gilav21/shadcn-angular-rte";
@import "@gilav21/shadcn-angular-rte/theme.css";   /* skip if already CLI-initialised */
```

**Consumer, custom mode (pick addons, typed inputs):**

```ts
import {
  RichTextEditorComponent,
  RichTextMentionsDirective,
  RichTextActionsDirective,
  type MentionItem,
  type RichTextEntitySearchFn,
  type RichTextActionDefinition,
} from '@gilav21/shadcn-angular-rte';

@Component({
  imports: [RichTextEditorComponent, RichTextMentionsDirective, RichTextActionsDirective],
  template: `
    <ui-rich-text-editor
      uiRteMentions [uiRteMentionsSearch]="search"
      uiRteActions  [uiRteActions]="actions"
      locale="he" />
  `,
})
export class DocComponent {
  readonly search: RichTextEntitySearchFn<MentionItem> = q => [{ id: '1', value: 'ann', label: `Ann ${q}` }];
  readonly actions: RichTextActionDefinition[] = [/* … */];
}
```

**Data table:**

```ts
import {
  DataTableComponent,
  DataTableContextMenuDirective,
  DataTableExportDirective,
  DataTablePivotDirective,
  type ColumnDef,
} from '@gilav21/shadcn-angular-data-table';

@Component({
  imports: [DataTableComponent, DataTableContextMenuDirective, DataTableExportDirective, DataTablePivotDirective],
  template: `<ui-data-table uiDtContextMenu uiDtExport uiDtPivot #pv="uiDtPivot" [data]="rows" [columns]="columns" />`,
})
export class SalesComponent { /* … */ }
```

**Maintainer:**

```bash
npm run stage:package -- rte              # packages/rte-package/src + theme.css (generated)
npm run build:package -- rte              # stage → ng build rte-package → npm pack → dist/packs/*.tgz
npm run e2e -- pkg-rte pkg-data-table pkg-mixed
npm run release:package -- rte patch --dry-run
npm run release:package -- rte patch      # … pushes tag, then STOPS before npm publish
```

**Exported types the consumer touches:** everything the base barrels and addon
barrels export today (`RichTextEditorComponent`, `RichTextEditorAddonHost`,
`RichTextLocale`, `RTE_FULL`, the 13 `RichText*Directive` classes,
`RichTextActionDefinition`, `MentionItem`, `RichTextEntitySearchFn`, `RichTextAiRequest`,
… ; `DataTableComponent`, `ColumnDef`, `DataTableAddonHost`, `DataTableContextMenuDirective`,
`DataTableExportDirective`, `DataTablePivotDirective`, `PivotOptions`, …). Nothing is
renamed; `public-api.ts` is `export *` only.

### D.2 Efficiency

- **Build time:** ng-packagr over 272 files ≈ 1–3 min per package; the orchestrator
  builds each package **once per run** (memoised promise keyed by id) and caches the
  ng-packagr output under `.angular/cache` like any Angular project.
- **e2e cost:** three labels ≈ 2 min each (tarball install + prod build + serve +
  Playwright) on one dedicated ng21 worker; they run **after** the main pool and do
  not slow the ~230 copy-model specs.
- **Runtime:** identical code to the copy model; `sideEffects: false` lets the
  consumer's esbuild drop unused addon directives; the 20 parser files stay lazy
  chunks (UC-6). No measured budget beyond that — there is no perf claim.
- **Repo gates:** generated `src/` is excluded everywhere (C-13) so `check:all`,
  Sonar and the vitest browser leg see no extra files.

### D.3 DX for the consuming developer

- **Learn:** one install, three CSS lines, `ui-*` selectors, `uiRte*` / `uiDt*`
  directive attributes, `[locale]`. Same docs as the copy model (`README.md`, the
  demo site) apply.
- **Ignore:** the registry, `components.json`, `init`, `add`, `update`, `doctor` —
  none exist for the package path. Versions follow `npm update`.
- **Error messages when held wrong:**
  - Forgot `@source` → the editor renders unstyled (Tailwind never saw the classes).
    README section "Nothing is styled" names this first.
  - Forgot `theme.css` → components render with browser defaults / transparent
    tokens; README section "Colours are missing".
  - Angular 20 → `npm install` peer error `@angular/core@"^21.0.0"`; README states
    the requirement in line 1 of "Requirements".
  - `--prefix` expectation → not available; README "Selectors are fixed".
  - Mixed apps: the README "Mixing with CLI-copied components" paragraph explains
    the two-singleton behaviour (a shortcut registered on the copied
    `ShortcutBindingService` is not visible to the package's editor and vice versa;
    `[locale]` must be set per instance).
- **Density / RTL / touch:** unchanged — the CSS tokens ship in `theme.css`;
  density vars are read at runtime from the consumer's stylesheet.

### D.4 Implementation options

#### Option set A — how the package sources are produced

**Option A1 — ng-packagr projects whose `src/` is generated by a registry-driven stage script (copy the closure verbatim)**
Pros: exactness is derived from the registry (the same closure `add` installs), no
second source of truth, sources compile unchanged (all-relative imports, C-5),
generated tree is disposable and git-ignored, one 300-line lib + tests.
Cons: two build pipelines (CLI + ng-packagr); the staged tree must be regenerated
before every build (enforced by `build:package` and the release preflight).

**Option A2 — point ng-packagr directly at `packages/components/` with a hand-written `public-api.ts`**
Pros: no copy step.
Cons: ng-packagr compiles every file reachable from the entry **and** `tsconfig`
`include`s — the RTE entry would pull `.spec.ts`/`.stories.ts` siblings unless
excluded by glob, and nothing prevents a barrel from reaching outside the closure
(e.g. the data-table barrel re-exports `../../lib/component-pool.service` — fine —
but a future `export *` could silently grow the package). Exactness would rest on
convention, not on a test.

**Option A3 — tsc + hand-rolled rollup (no ng-packagr)**
Pros: no new devDependency.
Cons: re-implements partial-Ivy linking metadata, FESM flattening, d.ts bundling and
the APF layout; unsupported by the Angular CLI. Rejected outright.

**✅ Chosen: Option A1**, because the registry is already the contract for "what
ships", `resolveDependencies` exists, and T-2/T-4 turn exactness into a test.

#### Option set B — how the orchestrator represents a package spec

**Option B1 — new optional fields on `ComponentSpec` (`packages`, `fixture`), `names` may be empty**
Pros: one catalogue (`ALL_COMPONENTS`), label matching (`run.ts:175-187`) unchanged,
`check-completeness` unaffected (empty `names`), impact reuses `specLabel`; three
`EXPLICIT_SPECS` rows claim the `pkg-*` folders so auto-discovery never sees them.
Cons: `validateSpecs` needs the "empty names ⇒ packages required" rule; `runOne`
gains a branch.

**Option B2 — a separate `PACKAGE_SPECS` catalogue and a third runner (`runPackageSpec`)**
Pros: zero change to `ComponentSpec`.
Cons: `parseArgs` label matching, `printSummary`, impact and completeness all need
a third list; the mixed-mode spec (package **and** `add button`) fits neither list.

**Option B3 — run package legs as `CLI_SPECS` modules (no Playwright)**
Pros: no fixture/worker changes.
Cons: no browser assertions — UC-8/9/10 are render-level; also CLI specs are pinned
to worker 0's Angular-20 fixture.

**✅ Chosen: Option B1.** Exact shape:

```ts
// e2e/orchestrator/specs.ts (additions)
export type PackageId = 'rte' | 'data-table';
export type FixtureId = 'ng20' | 'ng21';

export interface ComponentSpec {
    readonly names: readonly string[];          // may be [] when `packages` is set
    readonly initArgs?: readonly string[];
    readonly label?: string;
    readonly harnessFolder?: string;
    /** npm-pack tarballs (built once per run) installed into the fixture before `add`. */
    readonly packages?: readonly PackageId[];
    /** Which pristine fixture to use. Default 'ng20' (= e2e/fixture-app). */
    readonly fixture?: FixtureId;
}

// EXPLICIT_SPECS additions — labels are exact-match keys for `npm run e2e -- <label>`
{ names: [], packages: ['rte'],        fixture: 'ng21', label: 'pkg-rte' },
{ names: [], packages: ['data-table'], fixture: 'ng21', label: 'pkg-data-table' },
// mixed mode: CLI copy of `button` + the RTE package in ONE app
{ names: ['button'], packages: ['rte'], fixture: 'ng21', label: 'pkg-mixed' },
```

`validateSpecs`: throw `[e2e:specs] spec "<label>" has neither names nor packages`
when both are empty; a `packages` entry outside `PackageId` is a type error.

`run.ts` → `runOne` for a package spec:

1. `await worker.reset()` (ng21 worker resets `e2e/fixture-app-21`).
2. For each package id: `tarball = await ensurePackageTarball(id)` (memoised;
   `package-build.ts`).
3. If `spec.names.length > 0`: `init` + `add <names> --yes` + `npm install` (CLI path,
   exactly as today).
   Else: `npm install -D tailwindcss @tailwindcss/postcss postcss --no-audit --no-fund`,
   write `.postcssrc.json`, write `src/tailwind.css` = `consumerCssSnippet(ids)` and
   prepend `@import "./tailwind.css";` to `src/styles.scss` (mirrors what `init`
   does for the scss entry, `init-core.ts:134-139`, with the README's lines instead
   of the CLI template).
4. `npm install <abs tarball path> --no-audit --no-fund` for each package (after the
   CLI step so the CLI's `installMissingDeps` cannot remove it).
5. `installHarness(specHarness(spec), worker.fixtureApp)`.
6. `npx ng build --configuration production` (T-22) — run with `run('npx', …, {cwd})`.
7. `serve` + Playwright (unchanged).

Workers: `createWorkers(count)` is unchanged for ng20. `run.ts` partitions
`components` by `fixture`; ng21 specs run on **one** extra worker
`{ index: 'ng21', fixtureApp: FIXTURE_APP_21, port: <next free>, reset: () =>
resetFixtureApp(FIXTURE_APP_21) }` created only when at least one ng21 spec is
requested, after the ng20 pool finishes (sequential; ~3 labels). `paths.ts` adds
`FIXTURE_APP_21 = e2e/fixture-app-21` and `PACKS_DIR = e2e/.workers/_packs`
(git-ignored via the existing `e2e/.workers/` rule). `reset-app.ts` takes the
fixture path as a parameter (`git checkout HEAD -- <rel>`; `git clean -fd <rel>/`),
default `FIXTURE_APP` so `e2e:reset` keeps its meaning; `e2e:reset` also resets the
ng21 fixture.

`impact.ts`: add `PACKAGE_ROOTS` (imported from `stage-package-lib.ts` — one source)
and extend `specsTouchingComponent(name)` to also return specs whose `packages`
include an id with `name ∈ PACKAGE_ROOTS[id]`; add file rules
`/^packages\/(rte|data-table)-package\//` → that id's specs, and
`/^packages\/cli\/src\/templates\/styles\.ts$/` → all package specs (it is already
under the `packages/cli/` tripwire = ALL, so this rule is documentation; T-18 asserts
kind `'all'`).

#### Option set C — the Angular-version mismatch of the fixture

**Option C1 — a second committed fixture `e2e/fixture-app-21/`**
Pros: the Angular-20 proof for the copy model is untouched; the package legs run on
what the peer range promises; the scaffold is a copy of the existing one with bumped
versions and relaxed budgets; node_modules is preserved across resets like today.
Cons: a second `node_modules` (~300 MB, one-time); `reset`/`worker` need a path
parameter.

**Option C2 — bump `e2e/fixture-app` to Angular 21**
Pros: no new fixture.
Cons: every copy-model spec silently stops proving Angular-20 compatibility; the
`prod-build`/`add-all-smoke` CLI specs change meaning; not additive.

**Option C3 — `npm install @angular/*@21` inside the pkg leg at run time**
Cons: mutates the preserved `node_modules` of a shared worker → poisons every later
spec on that worker; rejected.

**✅ Chosen: Option C1.**

#### Option set D — theme delivery

**Option D1 — ship `theme.css` (tokens + `@theme inline` + `@layer base`) as a package asset; consumer `@import`s it after `@import "tailwindcss"`**
Pros: matches what `init` gives a CLI project; one file; Tailwind v4 processes
`@theme`/`@custom-variant` inside imported files; CLI-initialised apps skip it.
Cons: a consumer who already has tokens gets duplicate `:root` declarations if they
import both (documented: "skip if already CLI-initialised").

**Option D2 — bake the token CSS into component styles**
Cons: `:root` rules cannot live in encapsulated component styles; `ViewEncapsulation.None`
is forbidden by project policy.

**✅ Chosen: Option D1.**

#### Option set E — release verdict

**Option E1 — closure diff since the last `<id>-v*` annotated tag (reuse `release-cli.ts` git plumbing pattern)**
Pros: mirrors the CLI flow the maintainer already knows; tags are annotated so
`--follow-tags` pushes them (`reference_release-tag-annotated`).
Cons: verdict is path-based (any closure file change ⇒ REQUIRED, even a comment).

**Option E2 — content hash of the staged tree recorded in the package (compare hashes)**
Pros: exact.
Cons: needs a stage run to compute; hash must be committed somewhere; more machinery
than a solo maintainer needs.

**✅ Chosen: Option E1.**

### D.5 Risks

| Risk | Mitigation |
|---|---|
| ng-packagr inlines the lazy parser imports into the entry FESM | T-6 fails loudly; the agent stops and reports (C-14) — no silent fallback |
| `sideEffects: false` drops a module that registers something at import time | T-19 asserts all 11 toolbar slots on a **production** build (T-22) — tree-shaking regressions show as missing slots |
| Tailwind v4 skips the FESM when scanning `node_modules` | The `@source` path is explicit (Tailwind scans explicitly registered paths even when git-ignored); T-19/T-20 assert rendered geometry-independent presence only, so add one **computed-style** assertion: the package editor's toolbar has `display: flex` (proves a utility class was generated) — memory rule "assert style, not class strings" |
| Two Angular majors in one repo confuse `npm install` | The ng21 fixture has its own `package.json`/`node_modules`, never workspace-linked (C-12); root `overrides` pin `@angular/*` for the root only |
| `npm install <tarball>` reuses a stale cached extraction with the same version | Tarball integrity changes with content; the orchestrator additionally passes `--no-save`? **No** — keep `package.json` updated so `ng build` resolves it; instead delete `node_modules/@gilav21/` in the fixture before installing |
| Release script bumps then preflight fails, leaving a dirty tree | Script reverts the two files with `git checkout -- <paths>` and exits non-zero |
| Lock churn from `ng-packagr` devDep pulls unrelated upgrades | Review the lock diff for dropped packages; do not relock elsewhere |
| First scoped publish needs `--access public` | The STOP message prints the exact command with the flag |
| `pkg-*` labels break `check:completeness` | It reads `names[]` only (empty ⇒ no effect); T-17 keeps the entries loadable |

---

## E. Exact configuration files

All four are committed. `src/` and `theme.css` are generated (git-ignored).

### `packages/rte-package/package.json`

```json
{
  "name": "@gilav21/shadcn-angular-rte",
  "version": "0.1.0",
  "description": "Compiled Angular rich-text editor from shadcn-angular: base editor + all 13 addons (RTE_FULL). Same ui-* selectors and inputs as the CLI copy model.",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/gilav21/shadcn-angular.git", "directory": "packages/rte-package" },
  "keywords": ["angular", "shadcn", "rich-text-editor", "wysiwyg", "tailwind"],
  "sideEffects": false,
  "exports": {
    "./theme.css": "./theme.css"
  },
  "peerDependencies": {
    "@angular/common": "^21.0.0",
    "@angular/core": "^21.0.0",
    "@angular/forms": "^21.0.0",
    "@angular/platform-browser": "^21.0.0",
    "rxjs": "^7.8.0"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.4.0",
    "tslib": "^2.3.0"
  }
}
```

`packages/data-table-package/package.json` is identical except `name`
(`@gilav21/shadcn-angular-data-table`), `description` ("Compiled Angular data
table from shadcn-angular: base table + context-menu, export and pivot addons…"),
`directory` and keywords (`data-table`, `grid`). ng-packagr merges the `exports`
map with the ones it generates (`.` → fesm/types) and copies `README.md` into
`dist/`. No `files`/`.npmignore`: `npm pack` runs inside `dist/<id>-package/`, which
holds only build output + assets (T-23 asserts the list).

### `packages/rte-package/ng-package.json`

```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/rte-package",
  "lib": {
    "entryFile": "src/public-api.ts"
  },
  "assets": ["theme.css"],
  "allowedNonPeerDependencies": ["class-variance-authority", "clsx", "tailwind-merge", "tslib"]
}
```

(`data-table-package`: `dest: "../../dist/data-table-package"`, otherwise identical.)

### `packages/rte-package/tsconfig.lib.json`

Standalone (does **not** extend the root `tsconfig.json`, whose `paths` alias and
`exclude` list are workspace concerns):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "dom"],
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "useDefineForClassFields": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "inlineSources": true,
    "types": []
  },
  "angularCompilerOptions": {
    "compilationMode": "partial",
    "strictTemplates": true,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "enableI18nLegacyMessageIdFormat": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.stories.ts"]
}
```

`useDefineForClassFields: false` and `experimentalDecorators: true` mirror the root
`tsconfig.json:13-15` the sources are written against.

### `angular.json` — two new projects (siblings of `demo`)

```json
"rte-package": {
  "projectType": "library",
  "root": "packages/rte-package",
  "sourceRoot": "packages/rte-package/src",
  "prefix": "ui",
  "architect": {
    "build": {
      "builder": "@angular/build:ng-packagr",
      "options": {
        "project": "packages/rte-package/ng-package.json",
        "tsConfig": "packages/rte-package/tsconfig.lib.json"
      }
    }
  }
},
"data-table-package": {
  "projectType": "library",
  "root": "packages/data-table-package",
  "sourceRoot": "packages/data-table-package/src",
  "prefix": "ui",
  "architect": {
    "build": {
      "builder": "@angular/build:ng-packagr",
      "options": {
        "project": "packages/data-table-package/ng-package.json",
        "tsConfig": "packages/data-table-package/tsconfig.lib.json"
      }
    }
  }
}
```

### Root `package.json` deltas

```jsonc
"workspaces": ["packages/cli", "demo"],          // was ["packages/*", "demo"] — see C-12
"scripts": {
  // …existing…
  "stage:package": "tsx packages/cli/scripts/stage-package.ts",
  "build:package": "tsx packages/cli/scripts/package-build.ts",
  "release:package": "tsx packages/cli/scripts/release-package.ts"
},
"devDependencies": {
  // …existing…
  "ng-packagr": "^21.0.0"
}
```

### Generated `packages/rte-package/src/public-api.ts` (shape, rendered by `renderPublicApi`)

```ts
// AUTO-GENERATED by stage-package — do not edit; regenerate with `npm run stage:package -- rte`.
export * from './ui/rich-text-editor';
export * from './ui/rich-text-editor/addons/actions';
export * from './ui/rich-text-editor/addons/ai';
export * from './ui/rich-text-editor/addons/colors';
export * from './ui/rich-text-editor/addons/emoji';
export * from './ui/rich-text-editor/addons/file-import';
export * from './ui/rich-text-editor/addons/history';
export * from './ui/rich-text-editor/addons/images';
export * from './ui/rich-text-editor/addons/links';
export * from './ui/rich-text-editor/addons/mentions';
export * from './ui/rich-text-editor/addons/outline';
export * from './ui/rich-text-editor/addons/slash-commands';
export * from './ui/rich-text-editor/addons/tables';
export * from './ui/rich-text-editor/addons/typography';
export * from './ui/rich-text-editor/addons/full';
```

The addon list is derived from the registry (`registry[root].addons` filtered to
the closure, sorted, `full` last) — never hand-listed. The named `export { … }`
block inside the staged `addons/full/index.ts` is what keeps `imports: [RTE_FULL]`
NG3004-safe in the consumer's AOT build; `export *` carries those names to the
package entry point (C-10). Data-table:

```ts
export * from './ui/data-table';
export * from './ui/data-table/addons/context-menu';
export * from './ui/data-table/addons/export';
export * from './ui/data-table/addons/pivot';
```

### `stage-package-lib.ts` — API (pure where possible)

```ts
export type PackageId = 'rte' | 'data-table';
export const PACKAGE_ROOTS: Readonly<Record<PackageId, readonly ComponentName[]>> = {
    'rte': ['rich-text-editor', 'rich-text-editor/full'],
    'data-table': ['data-table', 'data-table/context-menu', 'data-table/export', 'data-table/pivot'],
};
export const PACKAGE_NAMES: Readonly<Record<PackageId, string>> = {
    'rte': '@gilav21/shadcn-angular-rte',
    'data-table': '@gilav21/shadcn-angular-data-table',
};
export function isPackageId(v: string): v is PackageId;
export function computeClosure(id: PackageId): ReadonlySet<ComponentName>;      // resolveDependencies(PACKAGE_ROOTS[id])
export interface StagedFile { readonly src: string; readonly dest: string; }      // repo-relative → package-src-relative
export function stagedFiles(id: PackageId): readonly StagedFile[];              // ui/<f> and lib/<f> + lib/utils.ts, sorted, test files filtered
export function renderPublicApi(id: PackageId): string;
export function toPackageTheme(stylesTemplate: string): string;                  // strips @import "tailwindcss", the @source lines + their comment
export function consumerCssSnippet(ids: readonly PackageId[]): string;          // the README's three lines (one @source + one @import per id)
export function auditStagedImports(srcRoot: string): string[];                   // unresolved relative imports (T-4); [] when exact
export interface StageResult { readonly written: number; readonly removed: number; }
export function stagePackage(id: PackageId, repoRoot: string): StageResult;      // rm -rf src, copy, write public-api.ts + ../theme.css
```

`package-build.ts` (entry + exported `buildPackageTarball(id): Promise<string>` used
by the orchestrator): stage → `npx ng build <id>-package` → assert laziness (T-6, rte
only) → `npm pack --json --pack-destination <PACKS_DIR>` inside `dist/<id>-package` →
assert tarball contents and packed `package.json` (T-23) → return the absolute
tarball path.

### `release-package.ts` — flow

```
release:package -- <rte|data-table> <patch|minor|major> [--dry-run] [--force] [--allow-dirty] [--allow-branch] [--skip-preflight]

1. guards: clean tree (unless --allow-dirty), branch master (unless --allow-branch)
2. base ref: `git describe --tags --abbrev=0 --match '<id>-v*'` → else last commit touching packages/<id>-package/package.json → else root commit
3. verdict: packageVerdict(git diff --name-only base..HEAD, closurePaths(id), id)
     closurePaths = packages/components/ui/<files of closure> ∪ packages/components/lib/<libFiles ∪ utils.ts>
                  ∪ packages/<id>-package/{package.json,README.md,ng-package.json,tsconfig.lib.json}
                  ∪ packages/cli/src/templates/styles.ts ∪ packages/cli/scripts/stage-package*.ts ∪ packages/cli/scripts/package-build.ts
     NOT required ⇒ exit 1 unless --force (dry-run continues the rehearsal)
4. bump packages/<id>-package/package.json; prepend CHANGELOG block from
   `git log base..HEAD --no-merges -- <closure ui dirs> <closure lib files> packages/<id>-package`
   (renderReleaseNotes; header "All notable changes to `<pkg name>` (compiled package)")
5. preflight (unless --skip-preflight): buildPackageTarball(id) → `npm run e2e -- pkg-<id>` (+ `pkg-mixed` for rte)
   on failure: git checkout -- <the two files>; exit 1
6. git add -- <two files>; git commit -m "chore(<id>): release <id>-v<version>" -- <two files>
7. git tag -a <id>-v<version> -m <id>-v<version>; git push origin <branch> --follow-tags
8. STOP. Print:
     Tag <id>-v<version> pushed. Publish manually (2FA):
       cd dist/<id>-package && npm publish --access public
     Then verify: npm view <pkg name> version
```

`--dry-run` executes 1–3, computes 4 in memory, prints 5–8 as `[dry-run]` lines and
writes nothing (T-14).

### `e2e/fixture-app-21/`

Copy of `e2e/fixture-app` (tracked files only: `git ls-files e2e/fixture-app`), with:

- `package.json`: name `shadcn-angular-e2e-fixture-21`; `@angular/{common,compiler,core,forms,platform-browser,router}` `^21.2.0`; `@angular/build`, `@angular/cli`, `@angular/compiler-cli` `^21.2.0`; `rxjs ~7.8.0`, `tslib ^2.3.0`, `typescript ~5.9.2`.
- `angular.json`: project name `shadcn-angular-e2e-fixture-21`; production budgets `initial` `2MB`/`4MB` (C-15); everything else identical.
- `.gitignore`, `tsconfig*.json`, `src/**`, `public/**` identical (zoneless `app.config.ts`).

### Harness pages (sketch — `data-testid`s are the contract T-19…T-21 use)

`e2e/harness/pkg-rte/pkg-rte-demo.component.ts` — the `rte-all` page
(`e2e/harness/rte-all/rte-all-demo.component.ts`) with every `@/components/ui/…`
import replaced by `'@gilav21/shadcn-angular-rte'` (types included — UC-3), class
`PkgRteDemoComponent`, selector `app-pkg-rte-demo`. Spec: the `rte-all` slot list
(`ALL_SLOTS`, 11 entries) + control editor + ngModel mirror + `page.on('pageerror')`
counter + one computed-style assertion on the toolbar.

`e2e/harness/pkg-data-table/pkg-data-table-demo.component.ts` — one
`<ui-data-table uiDtContextMenu uiDtExport uiDtPivot #pv="uiDtPivot" #ex="uiDtExport"
#cm="uiDtContextMenu">` over the three-row Alice/Bob/Charlie dataset used by the
existing addon harnesses, with `data-testid="export-csv"` / `"run-pivot"` /
`"pivot-total"` buttons wired exactly like `data-table-export` and `data-table-pivot`
demos (copy their handlers; the `[uiDtContextMenuItems]` definition from
`data-table-context-menu`). Spec = the union of those three specs' assertions.

`e2e/harness/pkg-mixed/pkg-mixed-demo.component.ts` — `ButtonComponent` from
`'@/components/ui/button'` (CLI copy) + `RichTextEditorComponent, RTE_FULL` from the
package; template: `<ui-button data-testid="copied-button" (click)="bump()">` +
`<p data-testid="count">` + `<ui-rich-text-editor data-testid="editor" uiRteFull />`.

---

## F. Documentation deliverables (part of the tasks, not extra)

- `packages/rte-package/README.md`, `packages/data-table-package/README.md` — the
  consumer contract (UC-11) with sections: Requirements (Angular ≥ 21, Tailwind v4),
  Install, Styles (the snippet, "skip if already CLI-initialised"), Usage (simple +
  custom mode), Addons, Locale/RTL/density, Selectors are fixed, Configuration is
  inputs-only, Mixing with CLI-copied components (separate singletons), Troubleshooting
  (unstyled / missing colours / peer error), Versioning (independent of the CLI;
  Angular-major rebuilds).
- `docs/local-gates.md` — new section "`npm run release:package -- <rte|data-table>
  <patch|minor|major>`" below the `release:cli` section, same voice.
- `e2e/README.md` — "Package specs (`pkg-*`)" subsection under "Multi-component or
  special-`initArgs` specs": the `packages`/`fixture` fields, the ng21 fixture, the
  tarball memo, and that `e2e:reset` resets both fixtures.
- `.claude/CLAUDE.md` "When a CLI npm Publish Is Required" — add one paragraph:
  "The compiled packages are released separately by `release:package`; a closure
  change ships to CLI users on merge but reaches package users only after a package
  release." (Append; do not restructure.)
- Memory: add the two packages to `project_pending-releases.md` when this lands
  (they are manual publishes), per the existing pending-releases convention.

---

## G. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write the failing tests: `stage-package-lib.spec.ts` (T-1…T-5, T-7, T-8), `stage-package.spec.ts` (T-24), `release-package-lib.spec.ts` (T-10…T-13), `release-package.spec.ts` (T-14…T-16), `e2e/orchestrator/specs.spec.ts` (T-17), `impact.spec.ts` additions (T-18), the three Playwright specs (T-19…T-21), and the repo-excludes drift test (T-9). Run `npm run test:cli -- --run` and confirm every new test fails for the right reason (missing module / wrong output), then sabotage-check each one's contract per memory rule. | all UC | ⬜ Not started | — | — | — |
| 2 | `stage-package-lib.ts` + `stage-package.ts` entry; root `stage:package` script; `workspaces` pin; repo excludes (`tsconfig.json`, `tsconfig.eslint.json`, `eslint.config.mjs`, `sonar-project.properties`, `.gitignore`). T-1…T-5, T-7, T-9, T-24 green. `npm run check:all` unchanged after staging both packages. | UC-1, UC-2, UC-3, UC-4, UC-17 | ⬜ Not started | — | — | — |
| 3 | Library projects: `ng-packagr` devDep (review lock diff), `angular.json` projects, `packages/{rte,data-table}-package/{package.json,ng-package.json,tsconfig.lib.json}`; `package-build.ts` (+ `buildPackageTarball` with T-6/T-23 assertions) and `build:package` script. `npm run build:package -- rte` and `-- data-table` both succeed; inspect `dist/*/fesm2022` for the lazy chunks and record their names in the retrospective. | UC-5, UC-6, UC-7 | ⬜ Not started | — | — | — |
| 4 | READMEs for both packages rendered around `consumerCssSnippet` (T-8 green); `docs/local-gates.md`, `e2e/README.md`, `.claude/CLAUDE.md` paragraph. | UC-11 | ⬜ Not started | — | — | — |
| 5 | `e2e/fixture-app-21/` + orchestrator support: `paths.ts`, `reset-app.ts` (parameterised; `e2e:reset` resets both), `worker.ts` (ng21 worker), `specs.ts` fields + validation + three entries, `run.ts` package branch (tarball install, non-CLI Tailwind setup, prod `ng build`), `impact.ts` package rules. T-17, T-18 green. | UC-15, UC-16 | ⬜ Not started | — | — | — |
| 6 | `e2e/harness/pkg-rte/` and `e2e/harness/pkg-data-table/` demo + spec; `npm run e2e -- pkg-rte pkg-data-table` green (T-19, T-20, T-22). | UC-8, UC-9 | ⬜ Not started | — | — | — |
| 7 | `e2e/harness/pkg-mixed/`; `npm run e2e -- pkg-mixed` green (T-21). | UC-10 | ⬜ Not started | — | — | — |
| 8 | `release-package-lib.ts` + `release-package.ts`; parameterise `releaseCommitArgv` / `prependRelease` in `release-cli-lib.ts` with CLI defaults (`release-cli.spec.ts` unchanged and green); root `release:package` script. T-10…T-16 green; `npm run release:package -- rte patch --dry-run` on the real repo prints the expected rehearsal. | UC-12, UC-13, UC-14 | ⬜ Not started | — | — | — |
| 9 | Final gates: `npm run preflight`, `npm run e2e -- pkg-rte pkg-data-table pkg-mixed`, `npm run e2e:impact -- --base origin/master` (shows the three labels), `npm run sonar:gate` clean on all changed files; update `project_pending-releases.md`; fill the completion log. | all UC | ⬜ Not started | — | — | — |

Task 1 writes failing tests; each later task names the tests it turns green.
Tasks 2–4 and 5–7 touch disjoint files and may be split between two agents only
after Task 1 is committed.

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

## H. Completion Log

_Append one entry per task as it passes the review gate; never rewrite earlier entries._

| Date | Task | Score | Reviewer rationale (summary) |
|---|---|---|---|
| — | — | — | — |

---

## I. Decisions & open points resolved in this spec (for the record)

- **Script location** (C-1): `packages/cli/scripts/`, not root `scripts/`.
- **Public API** (C-10): base + every addon barrel + `full`; `export *` only; addon
  list derived from the registry.
- **Theme** (C-2): post-process `getStylesTemplate()`; never edit `templates/styles.ts`.
- **Fixture** (C-8/C-15): second fixture `e2e/fixture-app-21`, budgets 2 MB/4 MB.
- **Orchestrator** (C-9): `packages` + `fixture` fields on `ComponentSpec`; `pkg-*`
  are `EXPLICIT_SPECS`; one ng21 worker after the main pool.
- **Package deps** (C-6): four runtime deps, five peers, `allowedNonPeerDependencies`.
- **Release order** (C-11): bump before build; STOP after push; annotated tags
  `rte-v*` / `data-table-v*`; versions start at `0.1.0`.
- **Workspaces** (C-12): pinned to `packages/cli` + `demo`.
- **Laziness** (C-14): T-6 is a hard gate; inlining is reported, not accepted.
- **No CLI publish** results from this spec: nothing under `packages/cli/src/**`
  changes (`release-cli-lib.ts` is under `packages/cli/scripts/`, dev-only).
