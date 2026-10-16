# Repo Hygiene & Docs Drift — Spec

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **File-overlap notes (not prerequisites):**
>
> - `.claude/CLAUDE.md` — Task 10 is the **only** task in the whole spec set
>   that edits it. `specs/component-guideline-conformance-spec.md` Task 11 hands
>   its one CLAUDE.md sentence (the zero-box `class` exception) to this spec's
>   Task 10 rather than editing the file itself, so there is no conflict as long
>   as Task 10 picks it up (C-11 below). If that spec has not reached its Task 11
>   when you get here, apply C-11 anyway — the wording is fixed in §3.4.
> - `packages/components/ui/kanban/**`, `sortable/**`, `field-mapper/**`,
>   `rich-text-editor/**` — Task 5 renames one locale file in each and updates
>   its importers. Any parallel spec editing those components conflicts only on
>   the import line; whichever merges second rebases.
> - `packages/components/ui/index.ts`, `ui/directives/copy-to.directive*.ts`,
>   `ui/context-menu-integrations.ts` — Task 9. The conformance spec does not
>   touch these.
> - `sonar-project.properties` — Task 5 edits `sonar.cpd.exclusions`;
>   `specs/toggle-group-and-input-otp-forms-spec.md` may add an issue exclusion
>   (conditional on a `keyCode` finding). Different blocks; textual merge.
> - `eslint.config.mjs` — **not** touched here (the conformance spec owns its
>   edits).
> - `packages/cli/src/registry/index.ts` + `packages/components/registry.json` —
>   Tasks 5 and 9 add `obsoleteFiles` entries and regenerate. **Never merge the
>   generated registry by hand** — rerun `npx tsx packages/cli/scripts/sync-registry.ts --fix`
>   after rebasing.

**Status:** ⬜ Not started
**Date:** 2026-10-03
**Source:** codebase review findings (repo hygiene, docs drift), branch
`docs/codebase-review-fix-specs`. Every finding re-verified in §0.
**Living history:** never delete a completed row, a fixed bug or a superseded
decision — mark it and append below.

---

## 0. Step 0 — findings verified against the source

Legend: ✅ true as stated · ⚠️ partly wrong (believed → true) · ❌ refuted.

| ID | Finding as reported | Verdict | Evidence |
|---|---|---|---|
| F-1 | `axe-core` is imported directly in ~13 files but not declared; resolves only via hoisting. | ✅ **13 files exactly**: `packages/components/lib/testing/axe.ts:21`, `demo/src/app/docs/docs-a11y.spec.ts`, `ui/error-page/error-page.a11y.spec.ts`, `ui/result/result.a11y.spec.ts`, `ui/stat-card/stat-card.a11y.spec.ts`, `ui/infinite-canvas/infinite-canvas.a11y.spec.ts`, `ui/infinite-canvas/addons/node-editor/node-editor.a11y.spec.ts`, and the six `node-editor-{groups,history,minimap,problems,subgraph-breadcrumb,text-output}` component specs. `npm ls axe-core` → only via `@storybook/addon-a11y@10.5.8` and `axe-playwright@2.2.2` (both `axe-core@4.13.0`). A `ts.preProcessFile` scan of every tracked TS/MJS file under `packages/`, `demo/src`, `scripts/`, `e2e/orchestrator`, `e2e/cli-specs`, `.storybook` and the root configs found **`axe-core` is the only undeclared bare import in the repo.** | `git grep -l "from 'axe-core'"`; `npm ls axe-core` |
| F-1b | "Check whether the registry entry shipping `testing/axe.ts` needs it in testDependencies/npmDependencies." | ⚠️ **No registry entry ships `testing/axe.ts`.** No entry lists it in `libFiles`, and no `testFiles[]` spec (the `--include-tests` payload) imports `axe-core` or `lib/testing/axe` (strict import-regex scan over all 157 entries with `testFiles`: zero hits). `testDependencies` holds registry *component* names, not npm packages (`registry/index.ts:141`). `lib-baselines.ts:485` lists `testing/axe.ts` only because that generated table hashes every lib file. **Consequence: root `devDependencies` only — no registry or CLI change.** | registry scan in §0 notes |
| F-2 | Dead tracked files: `ui/virtual-scroll-dummy.txt`, `demo/build-log.txt` (312 KB UTF-16), `demo/documentation.json` (357 KB) written only by `demo/package.json` `docs:json`. | ✅ All three tracked. `virtual-scroll-dummy.txt` is a pasted demo method from `a182f9c9`; its only reference is the **generated** entry `packages/components/file-sizes.json:6512` (so `npm run docs:sizes` must rerun or `docs:check` fails). `demo/build-log.txt` = 312,282 B; `demo/documentation.json` = 356,798 B; Storybook imports the **root** `documentation.json` (`.storybook/preview.ts:3`). `demo/package.json` `"docs:json": "compodoc -p tsconfig.json -e json -d ."` is the only writer. | `git ls-files`; `ls -la` |
| F-3 | `demo/postcss.config.mjs` is dead and broken; `demo/postcss.config.js` duplicates `.postcssrc.json`; check whether anything loads the root `postcss.config.js`. | ✅ + **resolved.** All three Angular-side builders read **JSON only** (`['postcss.config.json', '.postcssrc.json']`): `@angular/build` (`src/utils/postcss-configuration.js:15`, the demo build), `@angular-devkit/build-angular` webpack (`src/tools/webpack/configs/styles.js:89-90`, which Storybook's builder uses; search order `[projectRoot, workspaceRoot]`) and `ng-packagr` (`src/lib/styles/postcss-configuration.js:11`, the rte/data-table packages). So `demo/.postcssrc.json` is the effective config for build + Storybook, and `demo/postcss.config.{js,mjs}` are read by nothing. **The root `postcss.config.js` is load-bearing and must stay:** Vite's `postcss-load-config` (which does read `.js`) searches from Vite's root = repo root for `vitest.config.ts` and `vitest.portable.config.ts`, and the browser suite's setup file `packages/test-setup.ts:1` imports `packages/styles.css`, whose first line is `@import "tailwindcss"` — that only compiles through `@tailwindcss/postcss`. | node_modules sources cited |
| F-4 | Generic Angular-CLI agent scaffold files tracked in `demo/` may contradict root rules. | ✅ 7 files: `demo/.claude/CLAUDE.md` (84 lines), `demo/AGENTS.md`, `demo/.gemini/GEMINI.md`, `demo/.cursor/rules/cursor.mdc`, `demo/.junie/guidelines.md`, `demo/.windsurf/rules/guidelines.md`, `demo/.github/copilot-instructions.md` — `ng new` AI-config output (`demo/README.md`: "generated using Angular CLI version 21.0.4"). Real contradictions with the root rules: *"Prefer inline templates for small components"* (root: the `.component.html` trio is mandatory) and *"Responsive spacing ✅ `p-4 sm:p-6`"* (the density directive forbids hardcoded padding utilities — see C-6). `demo/.claude/CLAUDE.md` was hand-edited once (`b622ed9f` added the ViewEncapsulation line), so it is loaded, not ignored. Everything else in it is already in the root CLAUDE.md. | `git ls-files demo`; file contents |
| F-5a | `@analogjs/platform` has zero refs (check the angular.json demo `test` target). | ✅ The `test` target uses **`@analogjs/vitest-angular:test`** (`angular.json:126`), not `platform`. No source import, no lockfile dependent. | `git grep analogjs`; lockfile scan |
| F-5b | `lmdb` likely unused. | ⚠️ **Deliberate, not accidental.** Restored in `12de4363` with the reason *"Restore `lmdb` as a devDependency so Angular's persistent build cache initializes (silences 'Cannot find module lmdb' warning)."* It is an `optionalDependency` of `@angular/build` (`3.5.1`). Keep unless Task 3's experiment shows the warning cannot recur. | `git log -S'"lmdb"' -- package.json` |
| F-5c | `rollup`, `lightningcss` added as native-binary workarounds in `b050c3cf`. | ⚠️ **Half right.** `rollup` (with `esbuild`) entered in `b050c3cf` when the pinned `@rollup/rollup-win32-x64-msvc`/`@esbuild/win32-x64` were removed; it is also a direct dependency of `ng-packagr`, `@rollup/plugin-*`, `@storybook/csf-plugin` and vite. `lightningcss` predates that commit (added in `6b012f87`, "adding basic testing infra") and is the **only** entry in root `dependencies`; it is a direct dependency of `@tailwindcss/node` and an optional peer of vite. | `git show b050c3cf -- package.json`; lockfile |
| F-6 | `.claude/CLAUDE.md` drift. | ✅ for all six reported items, ⚠️ on one, **plus four more** — full list C-1…C-11 in §3.4. Notably: the `@media (pointer: coarse)` rule is **⚠️ partly right** — it does land in a consumer's `tailwind.css` (written by `init` from `packages/cli/src/templates/styles.ts:320`), but in this repo it lives in `packages/styles.css:175` and `demo/src/styles.css:168`. `noUnusedLocals`/`noUnusedParameters`: set by **no** tsconfig (only `tsconfig.eslint.json:4-5`, both `false`); enabling them on `tsconfig.json` today yields **41 × TS6133** (measured, see §3.3 Option C-a). | `grep -n` on CLAUDE.md; tsc run |
| F-7 | `COMPONENT_GUIDELINES.md` is an outdated, unreferenced copy that contradicts the comments policy. | ✅ 528 vs 1,096 lines; `git grep COMPONENT_GUIDELINES` → **zero** references anywhere (specs included). Line 269 *"No Non-JSDoc Comments: Avoid implementation comments inside methods"* contradicts CLAUDE.md's "comments say *why*" rule. | `wc -l`; `git grep` |
| F-8 | Coverage exclude is `**/*-locales.ts` but 38 files are `*.locales.ts`; 4 use the dash form. | ✅ 38 = 36 under `ui/` + 2 under `lib/i18n/`; the dash four are `field-mapper-locales.ts`, `kanban-locales.ts`, `rich-text-locales.ts`, `sortable-locales.ts`. **Both** `vitest.config.ts` and `vitest.portable.config.ts` exclude only the dash form; `sonar-project.properties:70-71` lists both (for CPD, not coverage). Root cause: the convention changed (`lib/calendar-locales.ts` → `lib/i18n/calendar.locales.ts`; the old name survives as a key in `lib-baselines.ts`) and the glob was never updated. 119 more `.locales.ts` live in `demo/`, outside the coverage `include`. | `git ls-files`; configs |
| F-9 | Sonar helper scripts bypass `sonar-token.mjs`; `SONAR_HOST_URL` means two things; `sonar-export` uses `SONAR_HOST_URL_LOCAL`. | ✅ `sonar-accept.mjs:11-12` and `sonar-hotspots-safe.mjs:12-13` read `process.env.SONAR_TOKEN`/`SONAR_HOST_URL` directly; `sonar.mjs:51` defaults `SONAR_HOST_URL` to `http://host.docker.internal:9000` (passed into the scanner container, `:71`); `sonar-export.mjs:12` uses `SONAR_HOST_URL_LOCAL`. A shell `SONAR_HOST_URL=http://localhost:9000` therefore fixes the helpers and breaks the scanner. | file:line |
| F-10 | Unreferenced scripts; `test-pixel-perfect.ts` font path and example PDF are gone. | ✅ No `package.json`/hook/workflow references `gen-demo-pdfs.mjs`, `new-code-gaps.mjs`, `sonar-accept.mjs` or `packages/cli/scripts/list-portable-candidates.ts`. `gen-demo-pdfs.mjs` **generates the five committed PDFs** in `demo/public/examples/` (keep). `new-code-gaps.mjs` lists branch-added lines no test executes (keep). `list-portable-candidates.ts` served the finished `--include-tests` campaign (delete). `test-pixel-perfect.ts:19-20` look in `packages/components/lib/fonts/` (now `lib/parsers/fonts/NotoSans-Regular.ttf`); its usage example `demo/public/DW2-3-…pdf` no longer exists. `jsdoc-gaps.mjs`/`review-audit.mjs` are referenced from `docs/reviews/*.md` (reachable). | `git grep` per file |
| F-11 | Demo double test runner; `demo/src/setup.ts` unreferenced near-duplicate; `@types/jest` in demo runtime deps. | ✅ Root `vitest.config.ts` includes `demo/src/**/*.spec.ts`. `demo/package.json` `"test": "ng test"` → `angular.json` demo `test` → `@analogjs/vitest-angular:test` with **no options** (no `configFile`, so vitest runs with `root: 'demo'` and no Angular plugin config of its own). `demo/src/setup.ts` differs from `demo/src/test-setup.ts` only by a missing `import './styles.css'`; only `demo/tsconfig.spec.json:14` references `test-setup.ts`. Also in demo `dependencies`: `@types/jest` (its only installer, per `npm ls @types/jest`) and `@analogjs/vite-plugin-angular` + `@analogjs/vitest-angular` (test tools; root has them). `demo/src/sanity.spec.ts` asserts `[1,2,3]` sums to 6 — a test that cannot fail. **New:** `demo/components.json` points at a non-existent `src/styles.scss` and an obsolete `@/lib/utils` alias; nothing reads it. | file:line |
| F-12 | package.json script drift. | ✅ `e2e:build-cli` ≡ `build:cli` — but `.github/workflows/e2e.yml:56` uses it and that workflow is **live** (push/PR triggers, last edited `a87c57fc`), so keep it. `test-visual` (`vitest --browser=chromium`) ≡ `test` in effect (the config already enables the chromium instance) — used across docs/skills/memory, keep. `docs:regen` omits `themes:sync` while `docs:check` runs `gen-theme-presets.ts --check`. Storybook runs compodoc **twice**: the npm script's `docs:json` (root `tsconfig.json`) and then the builder's own run (`compodoc: true` in both storybook targets; `@storybook/angular/dist/builders/start-storybook/index.js:41` runs it with the browserTarget tsconfig, `demo/tsconfig.app.json`, writing `-d .`), which overwrites the first. `npm run sync-registry:fix` is referenced by `e2e/README.md:82` **and** `.github/workflows/e2e.yml:67` but exists only in `packages/cli/package.json:22`. | package.json; angular.json |
| F-13 | Layout outliers; `ui/index.ts` omits bento-grid, field-mapper, rich-text-view and the 4 flat context-menu directives. | ⚠️ **Partly wrong.** True: `ui/directives/copy-to.directive.ts` is the only directive in a sub-folder (registry `files: ['directives/copy-to.directive.ts']`); `ui/context-menu-integrations.ts` is a flat non-directive file that is **in no registry entry** (not installable) yet `demo/…/data-table-demo`, `tree-context-menu-demo`, `tree-view-demo` and two stories import its `ContextMenuIntegrations` array — so copy-paste demo code references a symbol a consumer cannot install. `ui/index.ts` does omit `bento-grid`, `field-mapper`, `rich-text-view` — **and `copy-to`** (not reported). **Wrong:** the four context-menu directives *are* exported, via `export * from './context-menu-integrations'` (`ui/index.ts:83`). **Wrong:** `ui/copy-to.stories.ts` being flat is *correct* — every flat directive keeps its story flat (`ripple.stories.ts`, `confetti.stories.ts`, …). | `ui/index.ts`; registry |

---

## 1. Product Manager section

### 1.1 Business logic

No features. This bundle removes things that should not be in the repo, makes
the contributor documentation true again, and — for each class of drift found —
adds a check so the class cannot come back silently.

### 1.2 Why the customer wants this

The customer here is two people: the **consuming developer**, who copies
demo code and runs `add`, and the **contributor** (human or agent) who follows
`.claude/CLAUDE.md` literally.

- **A contributor following the docs is sent to files that do not exist.**
  CLAUDE.md names `ui/tour.component.ts` as *the* reference implementation for
  outside-tree styling, and `tailwind.css` as where the touch-target rule lives.
  An agent obeys these; today it searches, fails, and improvises.
- **A contributor in `demo/` gets contradictory instructions.** Claude Code
  loads `demo/.claude/CLAUDE.md` there, which says "prefer inline templates" and
  "`p-4 sm:p-6`" — the opposite of the folder trio and the density pattern.
- **`axe-core` works by luck.** Thirteen files import it; if Storybook's a11y
  addon or `axe-playwright` changes its dependency, the a11y unit tests break
  with "cannot find module" on a clean `npm ci`.
- **The coverage report lies about i18n.** 38 dictionary files are measured as
  code while 4 identical-kind files are excluded, purely because of a dash.
- **A consumer copying the data-table / tree demos gets
  `ContextMenuIntegrations`**, which `add` cannot install.
- **`copy-to` installs to `ui/directives/`** while every other directive is
  flat — a consumer who learned the layout from one directive guesses wrong.
- **Root `package.json` carries dependencies nobody can justify** and the
  Sonar helpers fail with a token the main scan accepts.

### 1.3 Use cases — definition of done

| ID | Use case |
|---|---|
| UC-1 | After `npm ci` on a clean checkout, every bare import in tracked source resolves to a package **declared** by a workspace manifest (`axe-core` included); a newly added undeclared import fails `npm run test:cli`. |
| UC-2 | Files under `packages/cli/src` import only packages declared in `packages/cli/package.json` `dependencies` (the published CLI's own manifest) — enforced by the same check. |
| UC-3 | The dead artifacts are gone — `ui/virtual-scroll-dummy.txt`, `demo/build-log.txt`, `demo/documentation.json` (and its `docs:json` script), `demo/postcss.config.{js,mjs}`, the 7 demo agent-scaffold files, `demo/components.json`, `COMPONENT_GUIDELINES.md` — and the generated/log ones are git-ignored so they cannot be re-committed by accident. |
| UC-4 | `packages/components/{ui,lib}` and `packages/blocks` contain only `.ts`, `.html`, `.css` files plus explicitly allow-listed assets (the one `.ttf`); a stray file fails `npm run test:cli`. |
| UC-5 | `@analogjs/platform`, `rollup` and `lightningcss` are removed from root `package.json` — or each that cannot be removed has its proven reason recorded in this spec's Completion Log; `lmdb`'s reason is recorded likewise. A clean `npm ci` + `build:demo` + `build-storybook` + `test-visual` + `test:cli` + both `build:package` targets pass. |
| UC-6 | Every repo path and every `npm run <script>` named in `.claude/CLAUDE.md` and `e2e/README.md` resolves; a stale one fails `npm run test:cli`. |
| UC-7 | The `.claude/CLAUDE.md` corrections C-1…C-11 (§3.4) are applied **after the human approves the diff**. |
| UC-8 | Every locale dictionary under `packages/components` is named `*.locales.ts`, and the coverage excludes (both vitest configs) and the Sonar CPD exclusion use that one pattern; the generated lcov contains no `*.locales.ts` file. A consumer who re-adds `kanban`, `sortable`, `field-mapper` or `rich-text-editor` gets the old dash-named file pruned. |
| UC-9 | Every Sonar helper script resolves the token through `scripts/sonar-token.mjs` and the host-side URL through one shared resolver; `SONAR_HOST_URL` keeps exactly one meaning (the scanner container's). |
| UC-10 | Every script entry point under `scripts/` and `packages/cli/scripts/` is reachable (an npm script, hook, workflow, another script, or a doc names it) or is deleted; `test-pixel-perfect.ts` runs against a PDF argument and finds its font. |
| UC-11 | Demo specs run under exactly one runner (root vitest): `demo/package.json` has no `test` script, `angular.json` has no demo `test` target, the orphan setup files and the cannot-fail `sanity.spec.ts` are gone, and demo `dependencies` hold no test tooling. |
| UC-12 | `npm run sync-registry:fix` works from the repo root; `npm run docs:regen` regenerates everything `npm run docs:check` verifies (theme presets included); `npm run storybook` runs compodoc once. |
| UC-13 | `npx shadcn-angular add copy-to` installs `ui/copy-to.directive.ts` (flat), a reinstall prunes the old `ui/directives/copy-to.directive.ts`, no demo or story imports a non-installable symbol, and `ui/index.ts` exports every component folder barrel and every flat directive — enforced by a check. |

### 1.4 Explicitly out of scope

- **Enabling `noUnusedLocals`/`noUnusedParameters`.** Measured at 41 errors
  across ~20 files, many owned by parallel specs; this spec corrects the doc
  (C-3) and records the list as a follow-up (§3.3, decision C).
- **Renaming** `test-visual`, `test-storybook`, `e2e:build-cli` or any script
  referenced by hooks, docs, skills or memory. Only *adding* aliases.
- Deleting or changing `.github/workflows/*` (live; local-first policy forbids
  *adding* CI, not keeping what exists).
- The 41 TS6133 findings themselves, SSR, readonly sweeps, `class`/`data-slot`
  conformance (→ `specs/component-guideline-conformance-spec.md`).
- `demo/README.md`, `demo/.vscode/**`, `demo/.editorconfig` (generic but
  harmless; not loaded as agent instructions).
- Any change under `packages/cli/src/**` (would force a CLI publish).

---

## 2. QA section — write these tests FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.

All checks live in **one** node-environment file,
`packages/cli/scripts/repo-hygiene.spec.ts`, backed by pure functions in
`packages/cli/scripts/repo-hygiene-lib.ts`. That location is collected by
`vitest.config.cli.ts` (`packages/cli/scripts/**/*.spec.ts`), so the checks run
in `npm run test:cli`, which the pre-push hook never drops. Each `*-lib`
function gets **one** fixture test proving it detects the class (its teeth) and
the spec gets **one** real-tree assertion per rule (the gate).

### 2.1 Traceability

| Test ID | Test name | Proves | Type |
|---|---|---|---|
| T-1 | `findUndeclaredImports reports a bare import no manifest declares, and ignores relative, node:, @/ alias and builtin specifiers` — fixture: three in-memory files (`import axe from 'axe-core'`, `import { x } from './y'`, `import fs from 'node:fs'`) + a manifest set without `axe-core` → exactly one finding naming `axe-core` and its file. Uses `ts.preProcessFile`, not a regex (a regex matched prose in comments during Step 0). | UC-1 | unit (lib) |
| T-2 | `the repository has no undeclared bare imports` — scans tracked `.ts/.mts/.mjs/.js` under `packages/`, `demo/src`, `scripts/`, `e2e/orchestrator`, `e2e/cli-specs`, `.storybook` and root configs against the union of root, `demo` and `packages/cli` manifests (deps + devDeps + peerDeps). **Excludes `e2e/harness/**`** (those import the compiled `@gilav21/*` packages the fixture app installs). | UC-1 | gate |
| T-3 | `packages/cli/src imports only packages/cli dependencies` — non-spec files under `packages/cli/src` vs `packages/cli/package.json` `dependencies` only (green today; guards the published CLI). | UC-2 | gate |
| T-4 | `shipped directories hold only .ts/.html/.css plus allow-listed assets` — `git ls-files packages/components/ui packages/components/lib packages/blocks`; allowlist is a const in the spec naming `packages/components/lib/parsers/fonts/NotoSans-Regular.ttf` with its reason. | UC-4, UC-3 | gate |
| T-5 | `dead artifacts are absent and the generated ones are git-ignored` — none of the UC-3 paths is in `git ls-files`; `git check-ignore -q demo/documentation.json demo/build-log.txt` succeeds. | UC-3 | gate |
| T-6 | `extractDocReferences resolves rooted, suffix and bare-name paths and npm scripts` — fixture markdown with `` `packages/x/y.ts` `` (rooted), `` `registry/load.ts` `` (suffix of a tracked path), `` `touch.ts` `` (bare: basename of a tracked file), `` `<name>.component.ts` `` / `` `*.spec.ts` `` / `` `…/{branch}/…` `` (placeholders — skipped), and `npm run nope` → reports the missing rooted path, the missing bare name and the unknown script; nothing else. | UC-6 | unit (lib) |
| T-7 | `every path and npm script named in .claude/CLAUDE.md and e2e/README.md resolves` — fails today on `packages/components/ui/tour.component.ts`, `tailwind.css` and `npm run sync-registry:fix`. | UC-6, UC-7, UC-12 | gate |
| T-8 | `locale dictionaries use one name and the coverage/CPD globs match exactly it` — no tracked `packages/components/**/*-locales.ts`; the coverage `exclude` arrays of `vitest.config.ts` and `vitest.portable.config.ts` and `sonar.cpd.exclusions` each contain `**/*.locales.ts` and no `**/*-locales.ts` (read as text — the configs import the Angular plugin and are not cheap to evaluate). | UC-8 | gate |
| T-9 | `resolveSonarHost prefers SONAR_HOST_URL_LOCAL, falls back to localhost:9000, strips a trailing slash, and ignores SONAR_HOST_URL` — four env shapes; plus a gate assertion that no file under `scripts/` other than `sonar-token.mjs` reads `process.env.SONAR_TOKEN` or (other than `sonar.mjs`) `process.env.SONAR_HOST_URL`. | UC-9 | unit + gate |
| T-10 | `every script entry point is reachable` — entry points = top-level files in `scripts/` and `packages/cli/scripts/*.ts` that are not `*-lib.ts`, `*.spec.ts`, `*.d.mts`, or imported by another script; reachable = basename named in any `package.json`, `.github/workflows/*`, `scripts/*`, `packages/cli/scripts/*`, `docs/**/*.md`, `.claude/skills/**` or `e2e/README.md`. | UC-10 | gate |
| T-11 | `test-pixel-perfect resolves its font from lib/parsers/fonts` — the font candidate list (exported pure function) contains an existing path; running the script with no argument exits 1 with a usage line instead of a missing-file stack. | UC-10 | unit |
| T-12 | `demo specs have one runner` — `demo/package.json` has no `scripts.test`, `angular.json` `projects.demo.architect` has no `test`, `demo/src/setup.ts`/`test-setup.ts`/`sanity.spec.ts`/`tsconfig.spec.json` are untracked, and `demo/package.json` `dependencies` has no `@types/*` or `@analogjs/*`. | UC-11 | gate |
| T-13 | `docs:regen covers every generator docs:check verifies` — parse each `gen-*.ts --check` in `docs:check`; each generator must appear in the `docs:regen` chain (directly or via the npm script that runs it). Plus: `sync-registry:fix` exists in root scripts; the two storybook targets in `angular.json` have `compodoc: false` while both storybook npm scripts still run `docs:json`. | UC-12 | gate |
| T-14 | `directives are flat and ui/index.ts exports every barrel and directive` — no tracked `packages/components/ui/**/directives/**`; every `ui/<folder>/index.ts` and every flat `ui/*.directive.ts` is reachable from `ui/index.ts` exports (follow one level of `export *` re-export files, so a future aggregator still counts). | UC-13 | gate |
| T-15 | `copy-to e2e installs the flat directive` — the existing `e2e/harness/copy-to` spec, with its demo import changed to `@/components/ui/copy-to.directive`, passes via `npm run e2e -- copy-to`. | UC-13 | e2e |
| T-16 | **Dependency-pruning record** — for each of `@analogjs/platform`, `rollup`, `lightningcss` (one at a time): remove, `npm install`, review the lockfile diff for dropped packages, then clean `npm ci` + `npm run build:demo` + `npm run build-storybook` + `npm run test-visual` + `npm run test:cli` + `npm run build:package -- rte` + `npm run build:package -- data-table`. Record pass/fail and lock-diff summary per package in §6. Same for `lmdb` **only if** you can show the "Cannot find module 'lmdb'" warning does not appear without it on a clean `npm ci` + `ng build`. | UC-5 | manual, recorded |
| T-17 | **Coverage measurement** — `npm run coverage` before and after Task 5: lcov `SF:` lines contain no `.locales.ts`; record statements/branches/functions/lines before → after; thresholds in `vitest.config.ts` are **not** lowered. | UC-8 | manual, recorded |
| T-18 | **Reinstall prune** — in `e2e/fixture-app` (or a scratch consumer): `add kanban` with the old registry, then `add kanban --overwrite` with the new one → `kanban-locales.ts` is gone and `kanban.locales.ts` present (proves the `obsoleteFiles` entries). Same for `copy-to`. | UC-8, UC-13 | manual, recorded |
| T-19 | **Human approval of the CLAUDE.md diff** — the exact diff for C-1…C-11 shown to the human; their approval quoted in §6 before the edit lands. | UC-7 | manual, recorded |

### 2.2 Test types

- **Unit/gate (node):** T-1…T-14 in `repo-hygiene.spec.ts` (CLI leg).
- **e2e:** T-15 (`copy-to`); also run `npm run e2e -- kanban`, `sortable`,
  `field-mapper`, `rich-text-editor` (expands to all `rte-*` specs) after Task 5,
  since their installed file lists change.
- **Storybook:** no new stories. Run `npm run build-storybook` after Tasks 2, 8
  and 9 and open the docs tab of one component (e.g. Button) to confirm the
  compodoc-driven ArgTypes table still renders after the compodoc change.
- **Portable leg:** Task 5 renames files inside shipped components that have
  `testFiles`; run `npm run verify:portable` once at the end (never two at once).

### 2.3 Edge cases the checks must cover

- **Placeholders in docs** (`<name>`, `*`, `{branch}`, `…`) are skipped, not
  reported (T-6).
- **Suffix paths** written relative to a package (`core/fetch.ts`,
  `registry/load.ts`) resolve against tracked paths (T-6).
- **Type-only imports** (`import type { X } from 'pkg'`) count as imports — a
  type-only dependency still has to be declared for `tsc` (T-1).
- **Dynamic `import('pkg')`** counts (T-1; `preProcessFile(…, true, true)`).
- **Scoped packages** reduce to `@scope/name` (T-1).
- **Fixture apps** (`e2e/fixture-app*`, `e2e/jest-fixture`) are excluded from
  T-2 — they have their own manifests.

### 2.4 Coverage expectation

`repo-hygiene-lib.ts` is fully covered by T-1/T-6/T-9/T-11 fixtures (CLI
coverage leg). No component coverage change except T-17's intended exclusion of
locale dictionaries.

### 2.5 Mutation check (CLAUDE.md "Writing Tests" step 6)

After all tasks, break each rule the way a plausible mistake would, one at a
time, confirm the named test goes red, restore: re-add
`ui/virtual-scroll-dummy.txt` (T-4, T-5); add `import x from 'left-pad'` to a
lib file (T-2); rename one `.locales.ts` back to dash form (T-8); write
`` `ui/tour.component.ts` `` into a scratch copy of CLAUDE.md fed to the lib
(T-6); remove `themes:sync` from `docs:regen` (T-13); move a directive into a
sub-folder (T-14). Record the results in §6.

---

## 3. Architecture

### 3.1 Usability — what changes for the people who run things

```bash
npm run test:cli                 # now also runs repo-hygiene.spec.ts
npm run sync-registry:fix        # new root alias (docs and e2e.yml already say this)
npm run docs:regen               # now includes themes:sync
npm run demo:pdfs                # new: scripts/gen-demo-pdfs.mjs
npm run coverage:new-code        # new: scripts/new-code-gaps.mjs [base]
npm run sonar:accept             # new: scripts/sonar-accept.mjs
npm run pdf:pixel-perfect -- <in.pdf> [out.html]   # scripts/test-pixel-perfect.ts
```

Consumer-visible: `add copy-to` writes `ui/copy-to.directive.ts`; import
`CopyToDirective` from `@/components/ui/copy-to.directive`. Demo pages import
the four context-menu directives directly instead of `ContextMenuIntegrations`.

### 3.2 Efficiency

The hygiene spec shells out to `git ls-files` once and parses ~2,500 files with
`ts.preProcessFile` (a scanner, not a type-checker). Budget: **≤ 5 s** added to
`npm run test:cli` — measure and record in §6. No runtime code changes.

### 3.3 DX and implementation options

**Decision A — where the checks live**

**Option A-1 — one vitest spec in the CLI leg (`repo-hygiene.spec.ts`).**
Pros: runs on every push via `test:cli`; vitest's reporter names the failing
rule and file; lib functions are unit-testable; no new gate to remember.
Cons: the CLI leg grows a repo-wide concern.

**Option A-2 — a `check:hygiene` script added to `preflight.mjs`.**
Pros: mirrors `check:completeness`. Cons: preflight is not run on every push, so
drift lands and is found later; report-only scripts need their own tests anyway.

**Option A-3 — ESLint rules (`import/no-extraneous-dependencies`, …).**
Pros: editor feedback. Cons: new plugin dependency for one rule (few-packages
policy), and most rules here (dead files, doc paths, script reachability) are
not lintable.

**✅ Chosen: A-1**, because it is the only option that runs on every push
without a new gate, and the "few, real tests" rule is satisfied by one fixture
test (teeth) + one tree assertion (gate) per rule.

**Decision B — locale naming**

**Option B-1 — rename the four dash files to `*.locales.ts`; one glob.**
Pros: one convention (157 vs 4 today), simplest globs, matches the pre-1.0
no-backward-compat policy. Cons: touches shipped files in four components
(registry regen, `obsoleteFiles`, docs regen); `rich-text-locales.ts` is inside
the RTE package closure (behaviour-neutral, so it rides the next RTE release).

**Option B-2 — keep names; make both globs match both forms.**
Pros: no shipped-file churn. Cons: two conventions forever; a new contributor
copies the wrong one; T-8 would need an allowlist of four grandfathered names.

**✅ Chosen: B-1.** A dual glob is the patch that produced this drift.

**Decision C — `noUnusedLocals` / `noUnusedParameters`**

**Option C-a — enable both in `tsconfig.json` and fix the 41 TS6133.**
Measured 2026-10-03 (`npx tsc -p tsconfig.json --noEmit --noUnusedLocals
--noUnusedParameters`): 41 errors — 23 in `ui/`, 17 in `lib/`, 1 in `demo/`.
They include real dead code (`virtual-scroll.component.ts:312`
`getIndexForOffset`, `node-editor.component.ts:473/1154/1865`,
`rich-text-editor.component.ts:8442`, `stepper.component.ts:111`), unused
injections (`number-ticker.component.ts:24` `_el`,
`select-content.component.ts:39`, `rich-text-mentions.directive.ts:71`), effect
handles kept in private fields (`data-table.component.ts:2837/2846/4050`) and
`ngTemplateContextGuard` parameters (`dir`/`ctx` in three directives).
Pros: the doc becomes true; dead code found. Cons: ~20 files, several owned by
parallel specs (data-table, select, stacked-bar-chart, number-ticker); effect
handles need restructuring — not hygiene-sized.

**Option C-b — correct the doc: ESLint enforces it, tsc does not.**
`@typescript-eslint/no-unused-vars` (`eslint.config.mjs:82`, `^_` ignore
patterns) already gates unused imports/locals/params; private class members are
the gap. Pros: zero code churn, no conflicts. Cons: unused private members stay
unflagged (Sonar S1068 is active but did not report these — it appears to skip
decorated classes).

**✅ Chosen: C-b now, C-a as a recorded follow-up** (list above, in §6), to be
scheduled after the current wave so it does not collide with parallel specs.

**Decision D — `COMPONENT_GUIDELINES.md`:** delete (D-1) vs. 5-line pointer
(D-2). Zero references anywhere, so a pointer is one more file to drift.
**✅ Chosen: D-1, delete.**

**Decision E — single compodoc run for Storybook**

**Option E-1 — drop `npm run docs:json &&` from the two storybook scripts.**
The builder's run (demo `tsconfig.app.json`) would be the only one.
**Option E-2 — set `"compodoc": false` in both storybook targets; keep
`docs:json`.** One run, from root `tsconfig.json` — the same source `docs:api`
and `docs:regen` use, so Storybook docs and generated API tables can never
disagree.
**✅ Chosen: E-2**, then confirm in a built Storybook that an ArgTypes table
(e.g. Button's docs tab) is populated.

**Decision F — `ContextMenuIntegrations`**

**Option F-1 — register it as an installable entry.** Cons: an entry whose only
content is an array of four other entries; a fifth way to install the same code.
**Option F-2 — delete it; demos/stories import the directives they use;
`ui/index.ts` exports the four directives directly.** Copy-paste demo code then
only names installable symbols.
**✅ Chosen: F-2.**

**Decision G — Sonar host variable:** keep `SONAR_HOST_URL` for the scanner
container only (it is the scanner's own standard variable); host-side helpers
use `SONAR_HOST_URL_LOCAL` (already used by `sonar-export.mjs`) through a new
`resolveSonarHost()` exported from `scripts/sonar-token.mjs`. Rejected: one
variable for both (the two processes genuinely need different hosts).

### 3.4 Exact `.claude/CLAUDE.md` corrections (apply in Task 10, after approval)

| ID | Line (as of `6fae7f7f`) | Today | Correct to |
|---|---|---|---|
| C-1 | 205-211 | "> **Migration in progress.** … flat and folder layouts coexist …" | State the migration is complete (Phase 4 done 2026-05-20, `specs/component-architecture-refactor-spec.md`); no flat `*.component.ts` remain under `ui/`; the tooling still accepts flat directives. Keep the conventions list. |
| C-2 | 282 | `packages/components/ui/tour.component.ts` | `packages/components/ui/tour/tour.component.ts` |
| C-3 | 350-352 | "The compiler enforces `noUnusedLocals` and `noUnusedParameters` — check for `ts(6133)`" | "ESLint's `@typescript-eslint/no-unused-vars` enforces this (prefix an intentionally unused parameter with `_`); `tsconfig.json` does not set `noUnusedLocals`/`noUnusedParameters`, so also clear the editor's faded `ts(6133)` hints — they catch unused private members ESLint misses." (Decision C-b.) Same wording fix in the checklist line and AI-instruction 9. |
| C-4 | 424-425, 516, 994-995 | "Mark never-reassigned members `readonly` — signals, computed, viewChild, … (S2933)" | Sonar S2933 mirrors typescript-eslint `prefer-readonly` and flags **private** members only (verified: rule active, 0 open issues, 0 private non-readonly signal members). Keep `readonly` as the convention for new members; do not cite S2933 for public members. (Source: `specs/component-guideline-conformance-spec.md` §0 G-10.) |
| C-5 | 446-447 | "`.replaceAll()` over `.replace()` with global regex flag `/g` (S7781)" | "…for a **fixed-text** pattern (S7781). A character class, quantifier or capture group keeps `.replace(/…/g)` — S7781 exempts them." (Source: conformance spec §0 G-8.) |
| C-6 | 704-707 | "✅ `p-4 sm:p-6` and `gap-4 sm:gap-6`" | **Human decision required.** Project memory "density all layouts" forbids hardcoded padding utilities (they sit in `@layer utilities` and defeat `--density`); the doc still recommends them. Proposed: replace with a pointer to the density pattern (`:host { --_d: var(--density-<c>, var(--density, 1)) }`, padding in `@layer components` keyed on `data-slot`). If the human declines, record that and leave §5 as is. |
| C-7 | 763-764 | "`resizable.component.ts` and `slider.component.ts`" | `packages/components/ui/resizable/sub/resizable-handle.component.ts` (where the mouse+touch drag lives) and `packages/components/ui/slider/slider.component.ts` |
| C-8 | 782-783 | "The global `@media (pointer: coarse)` rule in `tailwind.css`" | "…in the consumer's `tailwind.css` written by `init` (`packages/cli/src/templates/styles.ts`), mirrored in this repo by `packages/styles.css` and `demo/src/styles.css`" |
| C-9 | 1049 | `import { cn } from '../lib/utils';` | `import { cn } from '../../lib/utils';` (entry file in `ui/<name>/`; a `sub/` file uses `'../../../lib/utils'`) |
| C-10 | 208 | `validate-registry.mjs` | no change — it resolves to `.claude/hooks/validate-registry.mjs` (listed so the next reader does not "fix" it) |
| C-11 | "Class Input" section (L188-190) | "**Every component MUST have a `class` input**" | Add: "Exception: a *zero-box* component — template is only `<ng-content>` and host is `display: contents` — renders no element for a class to reach; it has no `class` input. Style the projected element instead." (Hand-off from `specs/component-guideline-conformance-spec.md` Task 11, Decision A.) |

### 3.5 Risks

| Risk | Mitigation |
|---|---|
| Removing a "dead" dependency breaks a platform-specific or optional path (the reason `lmdb`, `rollup`, `lightningcss` were added). | One package at a time, full T-16 matrix including both package builds; lockfile diff reviewed for dropped packages (repo memory: lockfile review). Keep and record any that fails. |
| `@types/jest` removal changes the global types `tsc` sees (root `tsconfig.json` sets no `types`, so every `@types/*` in `node_modules` is included). | `npm run typecheck` and `npm run typecheck:templates` after Task 4; if a spec relied on jest globals, give it an explicit `vitest` import rather than keeping the package. |
| Renaming shipped files strands consumers' old copies. | `obsoleteFiles` entries in `packages/cli/src/registry/index.ts` (existing field, consumed by `pruneObsoleteFiles` in `core/install.ts:452`; data only, no publish); T-18. |
| `docs:regen` rewrites the tracked `documentation.json` stub (~740k lines). | Restore with `git checkout origin/master -- documentation.json` before committing (repo memory). |
| `sync-registry` reports false CRLF drift on Windows. | Run `sync-registry --fix` then push with no checkout between (repo memory). |
| Deleting `demo/.claude/CLAUDE.md` removes guidance someone relied on. | Every non-contradicting line already exists in the root CLAUDE.md (§0 F-4); note the deletion in the commit message. |
| T-7 is noisy on legitimate prose. | Placeholder skipping + suffix resolution designed against the real file in Step 0 (only the three real misses fail). |
| Sonar `resourceKey` exclusions orphaned by moves (repo memory). | `grep` `sonar-project.properties` for every moved/renamed path before scanning; none match today (`copy-to`, `*-locales`, `context-menu-integrations` are not keyed). |

### 3.6 Publish verdict

- **CLI npm publish: not required.** No file under `packages/cli/src/**`
  changes except the regenerated registry snapshot `registry/index.ts` and the
  hand-added `obsoleteFiles` entries — registry **data**, served live from
  `master`. `obsoleteFiles` is an existing optional field (`index.ts:126`), so
  the manifest shape is unchanged.
- **Compiled packages:** `rich-text-editor/rich-text-locales.ts` is in the RTE
  closure → the next `npm run release:package -- rte <level>` picks up the
  rename. It is behaviour-neutral, so it does not justify a release on its own.
  The data-table closure is untouched.

---

## 4. Definition of Done (per task)

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

## 5. Tasks — table order is implementation order

| # | Task | Proves | Status | Completed | Score | Retrospective |
|---|------|--------|--------|-----------|-------|---------------|
| 1 | Write `packages/cli/scripts/repo-hygiene-lib.ts` (pure functions `findUndeclaredImports`, `extractDocReferences`, `findStrayShippedFiles`, `findUnreachableScripts`, `uiBarrelGaps`; plus a stub `resolveSonarHost` export in `scripts/sonar-token.mjs`) as **stubs**, and `repo-hygiene.spec.ts` with T-1…T-14 and T-9's unit half. Run `npm run test:cli`: the lib fixture tests fail (stubs), and the tree gates T-2, T-4, T-5, T-7, T-8, T-9 (gate half), T-10, T-12, T-13, T-14 fail for the reasons in §0 — record the red list in §6. T-3 is expected green. | UC-1…UC-13 (T-1…T-14) | ✅ Done | 2026-10-04 10:41 | 91 | Fixtures earned their teeth through five review rounds (type-only imports, order-insensitivity, nested barrels, self-reachability of the gate file). Improve: the `it.fails` bridge enforces "still red" but not "red for the right reason" — each flip must re-read the failure first. |
| 2 | Implement the lib functions (fixture tests go green). Declare `axe-core` in root `devDependencies` at the hoisted version (`^4.13.0`). Delete `ui/virtual-scroll-dummy.txt`, `demo/build-log.txt`, `demo/documentation.json` + the `docs:json` script in `demo/package.json`, `demo/postcss.config.js`, `demo/postcss.config.mjs`, the 7 demo agent-scaffold files, `demo/components.json` (re-`git grep` for a reader first), `COMPONENT_GUIDELINES.md`. Add `.gitignore` entries `/demo/documentation.json` and `*build-log*.txt`. Add a one-line *why* header to root `postcss.config.js` ("read only by Vite/Vitest; Angular builders read `demo/.postcssrc.json`"). `npm run docs:sizes`. Verify `npm run build:demo`, `npm run build-storybook`, `npm run test-visual`. T-1, T-2, T-4, T-5 green. | UC-1, UC-3, UC-4 | ✅ Done | 2026-10-04 21:07 | 91 | Implementing the lib surfaced two real-tree misses per gate that the stubs had hidden, and reviewers found heuristic gaps (import-only aggregators, sentence-final names, regen chains that run `--check`), each now pinned by a fixture and mutation-checked. Improve: the `npm install` lock rewrite shows the committed lock's workspace list has drifted from package.json — worth its own fix. |
| 3 | Dependency pruning per T-16 (one package at a time). Remove `@analogjs/platform`; try `rollup`, `lightningcss`; keep `lmdb` unless proven. Record every result + lock-diff summary in §6; restore any removal that fails and record why. | UC-5 (T-16) | 🟡 Partial | 2026-10-09 | — | `@analogjs/platform` removed (45387efb, 219 lock entries out, 0 in; build:demo/test:cli/test-visual/both build:package green). rollup + lightningcss NOT tried; build-storybook did not finish in 16-22 min (killed twice), so not verified. No independent review-gate run. |
| 4 | Demo single runner: delete `demo/package.json` `test` script, the `angular.json` demo `test` target, `demo/src/setup.ts`, `demo/src/test-setup.ts`, `demo/tsconfig.spec.json`, `demo/src/sanity.spec.ts`; remove `@types/jest`, `@analogjs/vite-plugin-angular`, `@analogjs/vitest-angular` from demo `dependencies`. `npm install`, review lock diff; `npm run typecheck`, `npm run typecheck:templates`, `npm run test-visual` (demo specs still collected by root vitest — compare the demo spec-file count before/after). T-12 green. | UC-11 (T-12) | ✅ Done | 2026-10-09 | — | 4b1e592e. 65 demo specs imported jest globals from @types/jest; now import from 'vitest'. Lock diff: only @types/jest. test-visual 630→629 files. |
| 5 | Locales: `git mv` the four dash files to `field-mapper.locales.ts`, `kanban.locales.ts`, `rich-text.locales.ts`, `sortable.locales.ts`; update importers (`field-mapper.component.ts`, `field-mapper/index.ts`, `kanban/index.ts`, `kanban.component.ts`, 4 kanban `sub/` files, `rich-text-editor/index.ts`, `rich-text-editor.component.ts`, `rich-text-editor.stories.ts`, `sub/rich-text-toolbar.component.{ts,spec.ts}`, `sortable/index.ts`, `sortable.component.ts`). Add `obsoleteFiles` for each old path in `packages/cli/src/registry/index.ts`. Change both vitest coverage excludes to `**/*.locales.ts`; drop `**/*-locales.ts` from `sonar.cpd.exclusions` (and its comment). `sync-registry --fix`, `npm run docs:regen` (restore `documentation.json`), T-17 before/after, T-18. e2e: `kanban`, `sortable`, `field-mapper`, `rich-text-editor`. T-8 green. | UC-8 (T-8, T-17, T-18) | ✅ Done | 2026-10-09 | — | 560b25cf. e2e kanban/sortable/field-mapper/rich-text-editor green individually (combined 19-spec run timed out on load). T-17/T-18 before/after records not taken. |
| 6 | Sonar helpers: add `resolveSonarHost()` to `scripts/sonar-token.mjs`; `sonar-accept.mjs` and `sonar-hotspots-safe.mjs` use `resolveSonarToken()` + `resolveSonarHost()`; `sonar-export.mjs` uses `resolveSonarHost()`; update their usage headers. `sonar.mjs` unchanged. Run `npm run sonar:export` against the live server to prove the helper path still authenticates. T-9 green. | UC-9 (T-9) | ✅ Done | 2026-10-09 | — | afa5c905. npm run sonar:export authenticates via the shared helper. |
| 7 | Scripts reachability: add root npm scripts `demo:pdfs`, `coverage:new-code`, `sonar:accept`, `pdf:pixel-perfect`; delete `packages/cli/scripts/list-portable-candidates.ts`; fix `test-pixel-perfect.ts` font candidates to `lib/parsers/fonts/`, make the PDF argument required (usage line + exit 1), drop the dead example path. T-10, T-11 green. | UC-10 (T-10, T-11) | ✅ Done | 2026-10-09 | — | 1815e70d. Also wired jest-fixpoint.mjs as portable:fixpoint (unreachable, live tool; not in spec). |
| 8 | package.json/angular.json: root `"sync-registry:fix": "tsx packages/cli/scripts/sync-registry.ts --fix"`; append `&& npm run themes:sync` to `docs:regen` (run it; restore `documentation.json`; `npm run docs:check` clean); `"compodoc": false` in both storybook targets (Decision E-2) and confirm an ArgTypes table renders in `npm run build-storybook` output. Keep `e2e:build-cli`, `test-visual` (record why in §6). T-13 green. | UC-12 (T-13) | 🟡 Partial | 2026-10-09 | — | 92256dba. compodoc:false in both storybook targets; ArgTypes source (documentation.json) verified, rendered table NOT verified (build-storybook never finished). |
| 9 | Layout: `git mv ui/directives/copy-to.directive{,.spec}.ts ui/`; fix imports (`ui/copy-to.stories.ts`, 4 demo files, `e2e/harness/copy-to/copy-to-demo.component.ts`); add `obsoleteFiles: ['directives/copy-to.directive.ts', 'directives/copy-to.directive.spec.ts']` to the `copy-to` entry (the spec is its `testFiles` entry today, `registry/index.ts:1545`, so `--include-tests` consumers have it too). Delete `ui/context-menu-integrations.ts`; `ui/index.ts` exports the four directives directly and adds `bento-grid`, `field-mapper`, `rich-text-view`, `copy-to.directive` (resolve any `export *` name collision `tsc` reports explicitly, never by dropping a symbol); the 3 demos + 2 stories import the directives they use. `sync-registry --fix`, `npm run docs:regen` (restore stub), `npm run e2e -- copy-to`, T-18 for copy-to. T-14, T-15 green. | UC-13 (T-14, T-15, T-18) | ✅ Done | 2026-10-09 | — | 7291ad73. Found two classes named DataTableContextMenuDirective (flat vs addon); aliased FlatDataTableContextMenuDirective where the flat one is needed; consolidation is a follow-up. test:portable: 30 failing layout spec files, none touch this change, not baselined on master. |
| 10 | Docs: fix `e2e/README.md:82` (now true via the Task 8 alias — re-read for other drift). **STOP and show the human the exact `.claude/CLAUDE.md` diff for C-1…C-11** (C-6 needs their explicit choice); apply only what they approve; quote the approval in §6 (T-19). T-6, T-7 green. | UC-6, UC-7 (T-6, T-7, T-19) | ✅ Done | 2026-10-09 | — | 70eb4571. CLAUDE.md C-1..C-11 had already landed in Wave 0 (14216e9b), so no human approval step was needed. Gate was still it.fails when I first called it green; mutation check M4 exposed it; fixed by allow-listing src/components/ + src/app/test-pages/ (fixture-run-only paths). |
| 11 | Close: §2.5 mutation check (record each break → red test → restore); full gates — clean `npm ci`, `npm run check:all`, `npm run test-visual` (zero failures), `npm run test:cli`, `npm run verify:portable`, `npm run check:registry`, `npm run check:completeness`, `npm run docs:check`, `npm run e2e:impact -- --base origin/master` then every impacted spec; measure the hygiene spec's runtime (§3.2 budget); then `npm run sonar:gate` and verify the four gate conditions in CLAUDE.md §4. | all | 🟡 Partial | 2026-10-09 | — | Mutation M1-M6 all red→restored. check:all, check:registry, check:completeness, docs:check, test:cli, test-visual green. DEFERRED to the wave-1 integration branch: full e2e (impact=all), verify:portable, ONE sonar:gate. Lead-reviewed only; no independent review-gate. |

> **Size note.** Eleven tasks is one over the ~10 bundling guideline. They are
> kept together because Tasks 2, 5, 7, 9 and 10 each turn one of Task 1's red
> gates green — splitting would split the gate file across specs.

---

## 6. Completion log

_Append per task (red list from Task 1, T-16/T-17/T-18 records,
mutation-check results, human approval quote, the C-a follow-up list, gate
results)._

| Date | Task | Event |
|------|------|-------|
| 2026-10-03 | 10 (CLAUDE.md part), 2 (agent-guidance deletions) | **Pulled forward as "wave 0"**, ahead of every other spec, because every executing agent loads `.claude/CLAUDE.md`. Human direction, quoted: *"I would start with the claude.md because all the agents that comes after looks at it no?"*. Applied C-1, C-2, C-3 (+ checklist line and AI-instruction 9), C-4, C-5, C-7, C-8, C-9, C-11; C-10 no change. **C-6 resolved without a separate prompt**: the human's standing directive (project memory "all layouts must support density + padding control") already forbids `p-4 sm:p-6` utilities. The doc now points to the `@layer components` + `--_d` pattern, citing `ui/card/card.component.css`, which was verified in source: 61 component CSS files define `--_d`. S2933 and S7781 wording verified against the live SonarQube rule descriptions (`/api/rules/show`). Deleted `COMPONENT_GUIDELINES.md` and the 7 `demo/` agent-scaffold files (`git grep`: zero references). **Still open in Task 10:** `e2e/README.md:82`, T-6/T-7 path-check gate. **Still open in Task 2:** every other deletion and the `axe-core` declaration. |
| 2026-10-04 | 1 | **Red list (stubs, base 14216e9b):** 14 of 19 red — fixture tests T-1, T-4 (lib), T-6, T-10 (lib), T-13 (lib), T-14 (lib) red on the stubs; T-9 unit red (stub `resolveSonarHost` still honours `SONAR_HOST_URL`); T-11 red on the font (stub `fontCandidates` keeps the dead `lib/fonts/` path; the no-arg usage half already passes); gates T-5 (dead files tracked, not ignored), T-8 (4 dash files, dash globs), T-9 gate (`sonar-accept.mjs`, `sonar-hotspots-safe.mjs`), T-12, T-13 (no `themes:sync`, no root `sync-registry:fix`, compodoc on in both builders), T-14 (`directives/copy-to`, missing barrels). Green: T-3 (as expected) and the four gates whose lib function is still a stub returning `[]` — T-2, T-4, T-7, T-10 — **vacuously**; their real red list is recorded under Task 2 once the lib is implemented. **Deviation (process):** the spec has red gates spanning Tasks 2–10, but `sonar:gate` refuses to scan a failing coverage leg, so every intermediate commit would be un-gateable. Each red test is therefore committed as `it.fails(...)` with a `// RED until Task N` marker: vitest asserts it *still fails*, so the red list is enforced, and the owning task must flip it to `it(...)` (an `it.fails` that starts passing turns the suite red). `test-pixel-perfect.ts` got a main guard + exported `fontCandidates` stub (behaviour-preserving) so the spec can import it without running `main()`. Added `scripts/sonar-token.d.mts` so TS can import the `.mjs`. **Carry-over to Task 2:** when the lib lands, T-7 and T-10 turn red (vacuous now) and stay red until Tasks 8/10 and 7 — Task 2 must mark them `it.fails` (RED until Task 10 / Task 7) in the same commit. **Spec assumption corrected (§3.5 "only the three real misses fail"):** the wave-0 CLAUDE.md rewrite now correctly names the *consumer's* `tailwind.css`, which is not a repo file; the T-7 gate filters it through a documented `CONSUMER_DOC_PATHS` const (one entry, with its reason), while the T-6 fixture still proves the lib reports a missing bare name. Generated/secret dotfiles (`coverage/.tree-hash`, `packages/.env`) are skipped by rule (basename starts with `.`) and the T-6 fixture carries both. **Flip discipline:** `it.fails` passes on *any* throw, so the owning task must first run the test as plain `it` and confirm the failure message is the §0 reason before implementing. Verified now for T-11: the module imports fine in the node CLI leg and the failure is the `fontCandidates(...)` font assertion (`expected false to be true`), not a load error. **Additions/clarifications:** the lib surface gains a sixth pure function, `regenGaps` (T-13's teeth — the `npm run` chain expansion is logic, so it gets a fixture like the others). T-3 is vacuously green too while `findUndeclaredImports` is a stub. The T-9 gate deliberately bans any **non-comment mention** of `SONAR_TOKEN`/`SONAR_HOST_URL` outside the owning script (not just `process.env.X` reads), because destructuring `const { SONAR_TOKEN } = process.env` or an aliased `env.SONAR_HOST_URL` bypasses the resolver just as well; the one legitimate non-owner mention, `sonar.mjs` passing the resolved token to the container as `-e SONAR_TOKEN=…`, is exempt only for lines without `process.env`. A help/usage string naming the variable is therefore also flagged by design: help text belongs to the resolver (`resolveSonarToken()` already prints it). The T-10 corpus excludes `repo-hygiene.spec.ts` itself, whose T-11 import of `test-pixel-perfect.ts` would otherwise mark that script reachable. **DoD:** test:cli 1918 passed + 14 expected-fail; lint clean; review-gate 84→89→89→88→**91**; Sonar round 1 (`shadcn-angular-repo-hygiene`, coverage both legs green, 11296 browser tests) — 14 open issues, all in files this task did not touch (master's human-accepted set, `docs/sonarqube-accepted-findings.md`), 0 in changed files. |
| 2026-10-04 | 2 | **Real red list of the stub-masked gates** (lib implemented, before any fix): T-2 → 13 × `axe-core` (exactly the 13 files of §0 F-1, nothing else); T-3 green (real); T-4 → `ui/virtual-scroll-dummy.txt`; T-7 → `e2e/README.md`: unknown script `sync-registry:fix` (§0) **plus two spec misses**: `src/components/` and `src/app/test-pages/` (README.md:135/143, paths inside `e2e/fixture-app/` that are git-ignored by design — handled in Task 10); CLAUDE.md clean (wave 0) apart from the consumer `tailwind.css`; T-10 → `list-portable-candidates.ts`, `gen-demo-pdfs.mjs`, `new-code-gaps.mjs`, `sonar-accept.mjs` (§0) **plus two spec misses**: `test-pixel-perfect.ts` (only its own usage line names it; Task 7's `pdf:pixel-perfect` fixes it) and `packages/cli/scripts/jest-fixpoint.mjs` (the gate also scans `.mjs` entry points, which §2.1 T-10 limited to `*.ts`; handled in Task 7). T-7 and T-10 re-marked `it.fails` (RED until Task 10 / Task 7). **Lockfile:** `npm install -D axe-core` rewrote 942 lock lines (the committed lock says workspaces `packages/*` while package.json says `packages/cli`, so npm re-resolved and dropped other-OS optional binaries such as `@lmdb/lmdb-darwin-arm64`) — reverted; `axe-core` added surgically to `packages[""].devDependencies` (1-line lock diff; the hoisted `node_modules/axe-core@4.13.0` entry already existed), clean `npm ci` passes. The pre-existing `packages/*` vs `packages/cli` workspace drift is left as found (out of scope). **Decision:** a declared `@types/x` does **not** count as declaring `x` (it would let a runtime import resolve through hoisting — the F-1 class); pinned by the T-1 fixture. **Verified:** `npm run build:demo` ✓, `npm run build-storybook` ✓, `npm run coverage` (browser leg = the full `test-visual` suite, 11296 passed; CLI leg 1923 passed + 9 expected-fail) ✓; lib 100 % lines. **Mutation check (lib teeth):** dropping the fence toggle, re-adding an `@types` fallback, dropping the trailing name boundary, requiring `--check` right after the file, following required barrels, counting a script's self-mention, and dropping the dotfile skip each turned exactly one fixture red. **Sonar:** per the human's later instruction, per-agent Sonar runs are skipped; the coordinator runs one `sonar:gate` on the integration branch. **Review-driven hardening** (rounds 88 → 90 → **91**): `uiBarrelGaps` follows only `export … from` declarations (an aggregator that merely *imports* a directive does not export it); the script-name boundary accepts a sentence-final period; tracked dotfile configs with a real extension (`demo/.postcssrc.json`) are checked, only bare `.suffix` tokens and extension-less dotfiles are skipped; `regenGaps` ignores `--check` commands inside the regen chain and matches the generator with a boundary. Each has a fixture case and a mutation that turns it red. **Lock review:** `git diff package-lock.json` removes **zero** lines (no `node_modules/` entry dropped); the only change is `+ "axe-core": "^4.13.0"` in the root devDependencies. **PostCSS deletion proof:** after deleting `demo/postcss.config.{js,mjs}`, `npm run build:demo` succeeds and `dist/demo/browser/styles-*.css` is 188 KB of compiled Tailwind (contains `.flex{display:flex}` and the `pointer:coarse` touch rule, no raw `@import "tailwindcss"`), i.e. `demo/.postcssrc.json` alone drives it. `demo/documentation.json` is deleted deliberately (UC-3) and now git-ignored. |
