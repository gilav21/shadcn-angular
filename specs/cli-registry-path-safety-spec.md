# CLI — Registry Path & Name Safety

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-10-03
> **Source:** code review of `packages/cli/src` (branch `docs/codebase-review-fix-specs`).
> **Living history:** never delete a completed row, a fixed bug or a superseded
> decision — mark it and append below.

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Merge-order note (not a prerequisite):** two sibling specs edit some of the
> same files, in different functions:
> `specs/cli-install-integrity-spec.md` (`core/install.ts`, `core/merge.ts`,
> `core/lib-reconcile.ts`, `commands/add.ts`, `commands/diff.ts`,
> `mcp/tools/write-tools.ts`) and `specs/cli-network-and-package-manager-spec.md`
> (`registry/load.ts` — `fetchManifest` only; `utils/package-manager.ts` —
> `getPackageManager` only). Merge **this spec first**; the others rebase onto
> it. Its sink guards throw errors that the integrity spec then records as
> install failures.

---

## The invariant

> **No path or name that comes from a registry manifest can make the CLI read,
> write or delete outside the consumer's project, or be interpreted as anything
> but data.**

**Trust model, stated so the agent does not over- or under-build.** A registry
(the default GitHub one, a `--registry` fork, `components.json` `registry`, or
the MCP `registry` argument a prompt-injected agent may be talked into) is
trusted to supply the **content** of the files it declares under the consumer's
ui / blocks / lib directories — that is the product. It is **not** trusted to
choose **where** a file goes outside those directories, to delete anything
except a file that is provably its own and unedited, or to put text into a
place that is executed or parsed as code by something other than the files it
ships: the package-manager command line, the generated shortcut index, the
consumer's own templates and imports.

Four sub-rules, each one sentence:

- **R1 (paths)** — every path a manifest declares is a relative POSIX path of
  `[A-Za-z0-9._-]` segments separated by single `/`, with no `.` or `..`
  segment, so it cannot name anything outside the directory it is joined to.
- **R2 (names)** — every manifest key is a component key
  (`^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)?$`) equal to its entry's `name`,
  every name reference resolves to an **own** key, and every lookup of a name
  that came from a user, an agent or a manifest checks own properties only.
- **R3 (package specs)** — every `npmDependencies` element is a plain registry
  package spec (`name` or `name@range`), and the package-manager command
  separates options from package specs so no spec can be parsed as a flag.
- **R4 (code tokens)** — every manifest string the CLI interpolates into
  consumer source (addon `attach` symbol and selector, `shortcutDefinitions`
  `exportName` / `componentName`) is an identifier / selector token.

Enforcement is **defence in depth**: rules are checked once when the manifest is
loaded (`registry/load.ts`) **and** every destructive filesystem sink fed by
registry data resolves its path through the existing guard
`resolveProjectPath(base, rel)` (`utils/paths.ts:74-81`) and refuses to escape.

---

## 0. Step-0 verification — what the source actually says

Every finding was re-read in the tree on 2026-10-03. ✓ = confirmed as stated;
⚠️ = the finding was wrong or incomplete (the original belief is kept, the truth
is added); ➕ = a member of the same class the review did not list.

| # | Finding | Verdict | Evidence |
| --- | --- | --- | --- |
| V1 | `isValidRegistryEntry` only checks `name` is a string and `files` is an array; never validates element contents, and never validates `libFiles`, `peerFiles`, `obsoleteFiles`, `requiresBaseFiles`, `shortcutDefinitions`, `npmDependencies`, `dependencies`, `optionalDependencies`, `parent`. (`testFiles` / `addons` / `testDependencies` are checked to be string arrays — not their contents.) | ✓ | `registry/load.ts:47-62` |
| V2 | Manifest paths reach `path.join` at write / delete / read sinks: `core/merge.ts:190` (read) and `:221` (write, `mergeWriteFile`); `core/install.ts:203` (lib write via `installLibFiles`), `:458` + `:464` (`pruneObsoleteFiles` → `fs.remove`); `core/lib-reconcile.ts:67` (read) and `:137-139` (`refreshLibFiles` write); `core/plan.ts:46` (read). | ✓ | as cited |
| V3 | ➕ Component **names** also reach path sinks: `core/migrate-core.ts:247` `fs.remove(path.join(uiDir, name))` inside the private `rollbackPartialNewFolders` (recursive directory delete, called from the exported `runMigration` at `:312`) and `:140-143` `deleteLegacyFiles` (`${name}${suffix}`). A manifest key `../../src` would make a rolled-back migrate delete the consumer's `src/`. | ➕ | as cited |
| V4 | ➕ A manifest key `__proto__` survives `JSON.parse` as an own key, passes `isValidRegistryShape` (it walks `Object.values`), and `Object.assign(mutable, data)` at `load.ts:121` then **re-prototypes** the live registry object instead of adding an entry. Probed: after the assign, `Object.keys` drops the key and `'files' in registry` becomes `true`. | ➕ | `load.ts:117-124`; probe run 2026-10-03 |
| V5 | ➕ Code-injection sinks: `utils/shortcut-registry.ts:31-39` interpolates `sourceFile`, `exportName`, `componentName` verbatim into the generated `shortcut-registry.index.ts`; `core/apply-wire.ts:194` inserts `attach.selector` into the consumer's template and `parseAttachSymbol` (`apply-wire.ts:25-28`) feeds the `attach.import` symbol into the consumer's imports. `attach.snippet` is declared but never read (grep: 0 uses) — no rule needed. | ➕ | as cited |
| V6 | `isComponentName` uses `name in registry` (`registry/index.ts:2255-2257`); `validateComponents` uses `c in registry` (`commands/add.ts:69`); ➕ `commands/diff.ts:56` too. All four inherited names are accepted: `isComponentName` returns `true` for `constructor`, `toString`, `__proto__`, `hasOwnProperty` (probed). | ✓ | as cited; probe |
| V7 | ⚠️ The review said `add constructor` crashes "in `plan.ts:~91`". The crash is at **`core/plan.ts:93`** (`for (const file of component.files)` → `TypeError: component.files is not iterable`). `resolveDependencies(['constructor'])` does **not** throw — `Object.prototype.constructor.dependencies` is `undefined`, so `?? []` hides it. Every caller of `isComponentName` that then reads `registry[name].files` crashes the same way: `update.ts:27`→`:34`, `why.ts:47`, MCP `read-tools.ts:49,66,87,104,151`, `write-tools.ts:33`. | ⚠️ corrected | probe 2026-10-03 |
| V8 | ➕ `resolvePreset` tests `preset in d.presets` (`core/presets.ts:55`): `--preset constructor` passes the check and `for (const key of d.presets[preset])` throws `TypeError: d.presets[preset] is not iterable` (probed). Same in MCP `add_component.preset`. | ➕ | probe |
| V9 | A `dependencies` entry naming a missing key crashes `resolveDependencies` (`core/resolve.ts:8`, `TypeError: Cannot read properties of undefined (reading 'dependencies')`, probed). ➕ Also reachable **without** a bad manifest: MCP `add_component` validates `names` only (`write-tools.ts:33`, `:140`) — `optionalDeps` and preset addon keys go straight into `performInstall` (`write-tools.ts:145-157`); the MCP path skips the CLI's `offeredPreselection` filter (`add.ts:173-188`). ➕ Dangling `testDependencies` hit the same crash via `expandForTests` (`install.ts:289-291`). | ✓ + ➕ | as cited; probe |
| V10 | `npmDependencies` are passed to `execa(packageManager, args)` as positional args with no `--` (`utils/package-manager.ts:25-47`). Verified on this machine: `npm install -- --registry=http://127.0.0.1:9` treats the token as a package spec (fails with ENOENT on a folder named `--registry=…`), while **without** `--` npm 11.5.1 parses it as a flag ("up to date"); `bun add -- --registry=…` (Bun 1.2.23) rejects it as `unrecognised dependency format`. **pnpm and yarn are not installed here — their `--` behaviour is UNVERIFIED.** | ✓ | probe 2026-10-03 |
| V11 | ⚠️ "No shell injection, execa uses no shell" is true on POSIX only. On Windows execa 9.6.1 (`node_modules/execa/package.json`) uses `cross-spawn`, which runs `.cmd` shims (`npm.cmd`, `pnpm.cmd`) through `cmd.exe` with metacharacter escaping. Escaping holds, so flag injection (R3) remains the real risk; R3's allow-list also removes any reliance on that escaping. | ⚠️ nuance | `execa/package.json:55` (`cross-spawn ^7.0.6`) |
| V12 | ⚠️ Severity context: the real `packages/components/registry.json` declares **zero** `npmDependencies` (0 occurrences), no suspicious path in any path field, no dangling reference, all 192 keys equal their `name` and match the R2 key pattern, all `attach` symbols are identifiers and selectors match `^[A-Za-z][\w-]*$` (kebab element selectors like `ui-node-editor` and constants like `STDLIB_NODE_TYPES` included). So every rule below is **zero-regression** for the default registry; the exposure is forks, `components.json` `registry`, and the MCP `registry` argument. Also `installPackages` is reached from `doctor --fix` (`commands/doctor.ts:225`, deps from `:88`), not only `add`. | ✓ | scan of `registry.json` 2026-10-03 |
| V13 | ⚠️ The review said `pruneObsoleteFiles` "should prune only status `'clean'`; untracked → keep + warn". **Partly wrong.** Pruning untracked files is deliberate (report B7): projects installed before `components.lock.json` existed have **no** baseline, and `install.spec.ts:319-330` asserts that such a file is pruned. Pruning only `clean` would leave every pre-lockfile project with the stale duplicate B7 exists to remove. **The bug is narrower:** an untracked file is pruned whatever its content — a file the user edited before the lockfile existed is deleted. The codebase already has the right test for "provably ours": `componentFileHash(content) ∈ COMPONENT_BASELINES`, used by `core/clean-reinstall.ts:159`, mirroring `isPristineLib` for lib files (`lib-reconcile.ts:51-53`, `install.ts:180`). Verified: the historical blob `git show e57aa555^:packages/components/ui/page-builder/property-editor.component.ts` hashes (`componentFileHash(…, 'ui', '@/components/lib')`) into `COMPONENT_BASELINES`. **And** the existing test `install.spec.ts:319` asserts the bug: it prunes an untracked file with arbitrary (mocked) content. | ⚠️ corrected | as cited; probe |
| V14 | No spec covers traversal rejection: `registry/load.spec.ts:155-285` tests shape only. No spec for `utils/package-manager.ts` exists. | ✓ | `ls packages/cli/src/utils/*.spec.ts` |
| V15 | Existing guard: `resolveProjectPath(cwd, inputPath)` resolves and throws `Path must stay inside the project directory: <input>` when `path.relative` starts with `..` or is absolute (`utils/paths.ts:74-81`). It is already used for alias / `--path` resolution but **not** for registry-relative files. | ✓ | as cited |
| V16 | User/agent-supplied lib paths reach the same write sink: `refresh-lib --files` (`commands/refresh-lib.ts:15-19`) and MCP `refresh_lib.files` (`write-tools.ts:449`) → `refreshLibCore` → `refreshLibFiles` (`lib-reconcile.ts:137`). The R1 load check cannot see these; the sink guard must. | ➕ | as cited |

### Refuted / corrected findings (summary)

- ⚠️ V7 — crash site is `plan.ts:93`, not resolution; `resolveDependencies` silently accepts inherited names.
- ⚠️ V11 — "execa uses no shell" is POSIX-only; on Windows `cross-spawn` goes through `cmd.exe` with escaping.
- ⚠️ V13 — "prune only `clean`" would regress B7; the correct rule is *clean, or untracked and byte-matching a published baseline*; the existing B7 test asserts the bug and must be fixed, not kept.
- ⚠️ V10 — `--` verified for npm and bun only; pnpm / yarn must be verified by the executing agent before `--` is used for them (Task 6).

---

## B. Product Manager section

### B.1 Business logic

The CLI and its MCP server install files described by a registry manifest that
can come from anywhere the developer (or an agent acting for them) points it.
After this spec, a manifest that tries to name a file outside the install
directory, delete something it does not own, smuggle a flag into the package
manager, or inject code into a generated file or the consumer's templates is
**rejected when it is loaded**, with a message saying which entry, which field,
and which value. Separately, every destructive operation re-checks its path, so
even a value that never went through the loader (a `--files` argument, an
in-memory registry) cannot escape. Names the developer types that merely
*look like* object internals (`constructor`, `toString`) are reported as unknown
components instead of crashing the CLI. Re-installs delete an obsolete file only
when it is provably the library's own unedited file.

### B.2 Why the customer wants this

- **A registry fork is a supply-chain input.** Teams point the CLI at a fork
  (`--registry`, `components.json` `registry`) or let an AI agent run the MCP
  server, which accepts a `registry` argument. Today a single manifest line
  `"obsoleteFiles": ["../../../.env"]` deletes the developer's `.env` on the
  next `add`, and `"files": ["../../.github/workflows/x.yml"]` writes a CI
  workflow. The only workaround is to read every fork's `registry.json` by hand
  before running anything — nobody does.
- **"I ran `add constructor` and got a stack trace."** A typo or an odd name
  produces `TypeError: component.files is not iterable` instead of the normal
  *Invalid component* list. The workaround is guessing.
- **"The CLI deleted my file."** A file the developer edited before the lockfile
  existed is deleted on re-install because it has no baseline. The workaround is
  committing before every `add`.

### B.3 Use cases = definition of done

All observable from the terminal, the MCP client, or the filesystem.

- **UC-1** Given a registry whose manifest has, in **any** path field (`files`,
  `peerFiles`, `libFiles`, `obsoleteFiles`, `testFiles`, `requiresBaseFiles`,
  `shortcutDefinitions[].sourceFile`), a value outside R1 — parent traversal,
  absolute POSIX, Windows drive (`C:/…`, `C:x`), backslash, empty or `.`
  segment, control character — any command prints `⚠ Could not use the
  registry manifest from <url>: <entry>.<field> contains "<value>" (<reason>);
  using the bundled copy, which may be stale.` (`<url>` is the local
  `registry.json` path in monorepo mode) and proceeds on the bundled
  snapshot. No file outside the project is read, written or deleted.
- **UC-2** Given a path that never went through the loader (an in-memory
  registry entry, `refresh-lib --files ../../x.ts`, MCP `refresh_lib`
  `files: ["../../x.ts"]`), every destructive sink refuses it with
  `Path must stay inside the project directory: <path>`; the attempt is
  reported (warning today; a recorded failure once the integrity spec lands)
  and no file outside the target directory changes.
- **UC-3** A manifest whose key is not a component key (`__proto__`,
  `../../src`, `Button`), whose key differs from its `name`, or which references
  a missing key in `dependencies`, `testDependencies`,
  `optionalDependencies[].name`, `addons`, any `presets` value, or `parent` is
  rejected at load with a UC-1-style message naming the entry and reference.
- **UC-4** `add constructor`, `update toString`, `diff hasOwnProperty`,
  `why __proto__`, and the MCP tools `get_component` / `why` /
  `get_install_plan` / `add_component` / `update_component` with such a name
  answer exactly as for any other unknown name (`Invalid component(s): …` +
  exit 1, or the tool's `Unknown component…` error) — never a `TypeError`.
- **UC-5** `add rich-text-editor --preset constructor` (and MCP
  `add_component` `preset: "constructor"`) exits 1 / errors with
  `Unknown preset "constructor" for rich-text-editor. Available: core, writing,
  media, styling, everything`.
- **UC-6** MCP `add_component` with an unknown name in `optionalDeps` or
  `overwrite` returns `Unknown component(s): <names>` and writes nothing; a
  preset addon key the live manifest does not define is skipped with the same
  warning the CLI prints, not crashed on.
- **UC-7** A manifest `npmDependencies` element that is not a plain registry
  package spec (`--registry=http://evil`, `-g`, `file:../x`,
  `git+https://…`, `https://…/x.tgz`, `pkg@ 1`, an uppercase name) is
  rejected at load. Valid specs (`zod`, `@scope/pkg@^1.2.3`) install with
  the package manager's options and package specs separated by `--` (for every
  package manager verified to accept it, see V10 / Task 6).
- **UC-8** A manifest whose addon `attach.import` symbol is not a JS identifier,
  whose `attach.selector` is not `^[A-Za-z][\w-]*$`, or whose
  `shortcutDefinitions` `exportName` / `componentName` is not an identifier /
  component key is rejected at load.
- **UC-9** Re-installing a component deletes an obsolete file only when it is
  `clean` against the lockfile, or untracked **and** byte-matching a published
  baseline. An untracked obsolete file that matches no published baseline is
  kept, with `Kept <file>: it differs from every version we shipped (delete it
  manually if intended).`; a `modified` one is kept with today's message.
- **UC-10** The committed `packages/components/registry.json` and the bundled
  snapshot pass the stricter validator (no consumer of the default registry
  sees a fallback warning), and `npm run e2e -- button` and
  `npm run e2e -- page-builder` still pass.

### B.4 Explicitly out of scope

- Fetch timeouts, package-manager detection — `specs/cli-network-and-package-manager-spec.md`.
- Exit codes / failure recording / ref advance — `specs/cli-install-integrity-spec.md`.
- Verifying file **content** from a fork (signatures, hashes) — the trust model
  accepts content.
- Validating the manifest at **build** time in `sync-registry` /
  `validate-registry.mjs` — the generator derives paths from the filesystem.
- Failing hard (instead of falling back to the bundled snapshot) when an
  explicit `--registry` manifest is rejected — existing fallback semantics are
  kept; listed as a risk (§D.5).
- Windows reserved device names (`nul.ts`, `con/`) and symlinked target
  directories.
- Reworking `registry/index.ts`' `defineRegistry` typing.

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> Follow `.claude/CLAUDE.md` "Writing Tests": one test per behaviour, one
> representative per input class, real-shaped inputs, assert state through the
> public surface. Then mutation-check the change (§C.5).

Runner: `npm run test:cli` (`vitest --config vitest.config.cli.ts`). Coverage
leg: `npm run coverage:cli`.

### C.1 Traceability table

| Test ID | Test name | Proves | Type | File |
| --- | --- | --- | --- | --- |
| T-1 | `rejects a manifest with any path that could resolve outside its install dir` — `it.each` over the R1 classes (`../../x.ts`, `/etc/passwd`, `C:/Windows/x.ts`, `C:x.ts`, `..\\..\\x.ts`, `a//b.ts`, `a/./b.ts`, `a/b\u0000.ts`), each placed in a **different** path field (`files`, `peerFiles`, `libFiles`, `obsoleteFiles`, `testFiles`, `requiresBaseFiles`, `shortcutDefinitions[0].sourceFile`, then `files` again), each inside an otherwise real entry copied from `registry.json` (`button`) | UC-1 | unit | `registry/manifest-rules.spec.ts` (new) |
| T-2 | `accepts the committed registry.json and the bundled snapshot` — reads `packages/components/registry.json` from disk and the imported `registry` literal; asserts `findManifestViolations(...)` is `[]` for both | UC-10 | unit (real data) | `registry/manifest-rules.spec.ts` |
| T-3 | `rejects keys that are not component keys and references that do not resolve to own keys` — `it.each`: `__proto__` key (built with `JSON.parse`, the shape the loader really receives), `../../src` key, `Button` key, key ≠ `name`, dangling `dependencies`, `testDependencies`, `optionalDependencies[].name`, `addons`, `presets` value, addon `parent`; the violation message names the entry and the reference | UC-3 | unit | `registry/manifest-rules.spec.ts` |
| T-4 | `accepts plain registry package specs and rejects everything a package manager would read as a flag, path, URL or git spec` — accept `zod`, `@scope/pkg@^1.2.3`, `pkg@~1.0`, `pkg@1.x`; reject `--registry=http://evil`, `-g`, `file:../x`, `git+https://h/r.git`, `https://h/x.tgz`, `pkg@ 1`, `Pkg` | UC-7 | unit | `registry/manifest-rules.spec.ts` |
| T-5 | `rejects attach and shortcut tokens that would inject code` — reject selector `x (click)="a()"`, symbol `A } from 'x'; evil(); import { B`, shortcut `componentName` `a', definitions: x }]; evil(); //`, `exportName` `A;evil`; real tokens are covered by T-2 | UC-8 | unit | `registry/manifest-rules.spec.ts` |
| T-6 | `loadRegistry warns with the violation and applies the bundled snapshot` — fetch stub returns the real manifest with one `obsoleteFiles: ['../../../.env']` injected into `page-builder`; assert the warning contains `page-builder.obsoleteFiles` and `../../../.env`, and `registry['page-builder'].obsoleteFiles` equals the bundled value | UC-1 | unit | `registry/load.spec.ts` |
| T-7 | `performInstall never writes or deletes outside the target dir, even with an unvalidated in-memory registry` — **real temp dirs** (`mkdtemp` → `root/project/src/components/ui`, sentinel `root/.env` and `root/project/.env`); in-memory entry with `files: ['x/x.component.ts', '../../../escape.ts']` and `obsoleteFiles: ['../../../.env']`; fetch mocked to return real-shaped TS; assert `x/x.component.ts` written, `root/escape.ts` absent, both sentinels still present with original content, a warning containing `Path must stay inside the project directory` | UC-2 | unit (real fs) | `core/path-safety.spec.ts` (new) |
| T-8 | `refreshLibFiles refuses a lib path that escapes the lib dir` — real temp dirs; `refreshLibCore(..., { files: ['utils.ts', '../../../escape.ts'] })`; `utils.ts` refreshed, nothing written outside, warning names the path | UC-2 | unit (real fs) | `core/path-safety.spec.ts` |
| T-9 | `migrate rollback and legacy-file deletion never remove outside the ui dir` — real temp dirs; (a) `deleteLegacyFiles(uiDir, ['../outside' as ComponentName])`; (b) exported `runMigration(plan, …)` with `plan.structural = ['../outside']`, `performInstall` / `detectConflicts` mocked the way `migrate-core.spec.ts:42-50` already mocks them (returns `installed: []`, so the private `rollbackPartialNewFolders` runs); the sibling `root/project/src/components/outside.component.ts` and `root/project/src/components/outside/` survive; the error names the path | UC-2 | unit (real fs) | `core/path-safety.spec.ts` |
| T-10 | `isComponentName accepts own keys only` — `it.each`: `button` and `data-table/export` → `true`; `constructor`, `toString`, `__proto__`, `hasOwnProperty` → `false` | UC-4 | unit | `registry/registry-meta.spec.ts` |
| T-11 | `add exits 1 with "Invalid component(s): constructor" instead of throwing` — existing `add()` shell (mocked fs/prompts/ora, `ExitError`); assert the logged line and that `detectConflicts` was not reached | UC-4 | unit | `commands/add.spec.ts` |
| T-12 | `diff reports Unknown component for an inherited name and continues` | UC-4 | unit | `commands/diff.spec.ts` (new — none exists) or the nearest existing diff test file |
| T-13 | `resolvePreset reports an inherited preset name as unknown and lists the available names` | UC-5 | unit | `core/presets.spec.ts` |
| T-14 | `resolveDependencies throws UnknownComponentError naming the missing dependency and its dependent` — in-memory registry `a → b`, `b` absent | UC-3, UC-6 | unit | `core/resolve.spec.ts` |
| T-15 | `add_component rejects unknown optionalDeps and overwrite names and writes nothing; skips a preset key the manifest does not define with a warning` | UC-6 | unit (mock `performInstall`) | `mcp/tools/write-tools.spec.ts` |
| T-16 | `installPackages separates options from package specs with -- for every verified package manager` — `execa` mocked (this spec **creates** `utils/package-manager.spec.ts`; the network spec extends it); `it.each` over npm / bun (+ pnpm / yarn only if Task 6 verified them); assert full argv, e.g. `['install', '-D', '--', 'zod', '@scope/pkg@^1.2.3']` | UC-7 | unit | `utils/package-manager.spec.ts` (new) |
| T-17 | `prunes an obsolete file only when it is provably ours and unedited` — `it.each` over the four classes: `clean` (lockfile baseline equals content) → pruned; untracked + content = the real historical blob from `git show e57aa555^:packages/components/ui/page-builder/property-editor.component.ts` (committed as a fixture file next to the spec) → pruned; untracked + that blob with one edited line → **kept** + `Kept … differs from every version we shipped` warning; `modified` → kept + today's warning. **Replaces** the bug-asserting case at `install.spec.ts:319-330` (fix that test, per "Writing Tests › When a bug…" case 1) | UC-9 | unit | `core/install.spec.ts` |
| T-18 | `e2e: button and page-builder consumer installs still pass` — `npm run e2e -- button`, `npm run e2e -- page-builder` | UC-10 | e2e | existing harnesses |

Every UC-1 … UC-10 appears at least once.

### C.2 Test types

- **Unit** (vitest node) — validator tests are pure and data-driven against the
  real manifest. Sink tests (T-7 … T-9) use **real temp directories**, not the
  `fs-extra` mock that `install.spec.ts` uses — the outcome ("nothing outside
  changed") is only observable on a real filesystem. Mock only `fetch` /
  `./fetch.js` and `./ref.js` (`resolveRef` → `null`) so no network is touched.
- **e2e** — T-18 only: the stricter loader and the guarded sinks must not break
  a real consumer install. No new harness.
- No Storybook / a11y — no UI. No perf claim — validation is `O(manifest)`
  once per source (§D.2).

### C.3 Edge cases and failure modes the tests must cover

- Each R1 class lands in a **different** field (T-1), so a validator that only
  checks `files` fails the suite.
- `__proto__` must be built with `JSON.parse` (T-3) — an object literal
  `{ __proto__: … }` sets the prototype and never creates the key, which would
  make the test pass vacuously.
- Windows forms are tested on every OS: the rule is lexical (R1 forbids `\` and
  `:`), so it does not depend on `path.win32`.
- An empty `npmDependencies: []`, `obsoleteFiles: []` → valid.
- The bundled snapshot and the committed manifest (T-2) — the over-strict
  failure mode (every consumer falls back, silently stale) is as bad as the
  under-strict one.
- Untracked obsolete file **with** a baseline match vs. one line edited (T-17):
  same path, same status, different content — the only input pair that
  discriminates the content rule.
- MCP preset key absent from the live manifest (T-15) — reachable even with a
  valid manifest when the server's applied source differs from the one that
  declared the preset.

### C.4 Coverage expectation

New files ≥ 95 % lines: `registry/manifest-rules.ts`. Touched files must not
drop below their current `npm run coverage:cli` line coverage:
`registry/load.ts`, `registry/index.ts`, `core/resolve.ts`, `core/presets.ts`,
`core/merge.ts`, `core/install.ts`, `core/lib-reconcile.ts`,
`core/migrate-core.ts`, `commands/add.ts`, `commands/diff.ts`,
`mcp/tools/write-tools.ts`, `utils/package-manager.ts`.

### C.5 Mutation check (mandatory before Task 7)

Back up, break, run, restore — derived from the rules, not from the assertions:

1. R1: drop the `..` segment check → T-1 red. Check only `files` → T-1 red.
2. R1: allow `\` → T-1 red.
3. R2: revert `isComponentName` to `in` → T-10, T-11 red. Skip the `parent`
   reference check → T-3 red.
4. R2: revert `presets.ts:55` to `in` → T-13 red.
5. R3: remove `--` → T-16 red. Accept specs starting with `-` → T-4 red.
6. R4: loosen selector to `.+` → T-5 red.
7. Sinks: remove the guard from `mergeWriteFile` → T-7 red; from
   `pruneObsoleteFiles` → T-7 red; from `refreshLibFiles` → T-8 red; from
   `rollbackPartialNewFolders` → T-9 red.
8. Prune: revert to "anything not `modified`" → T-17 red; restrict to `clean`
   only → T-17 red (the pristine-untracked class).
9. Over-strict: make R1 reject `.` inside a segment (`button.component.ts`) →
   T-2 red.

Every break must turn a test red; a survivor means a missing or weak test.

---

## D. Architecture section

### D.1 Usability — the public API

No new CLI flags, no new MCP inputs. The developer-visible surface is messages.

**Simple mode** — nothing changes for the default registry:

```bash
npx @gilav21/shadcn-angular add data-table --yes
```

**Custom mode** — a fork with a bad manifest:

```bash
npx @gilav21/shadcn-angular add button --registry https://example.com/fork/packages/components
# ⚠ Could not use the registry manifest from https://example.com/fork/packages/components/registry.json:
#   page-builder.obsoleteFiles contains "../../../.env" (path leaves its install directory);
#   using the bundled copy, which may be stale.
```

```bash
npx @gilav21/shadcn-angular add constructor
# Invalid component(s): constructor
# Available components: accordion, alert, …
```

CLI-internal exports (new module `packages/cli/src/registry/manifest-rules.ts`):

```ts
/** One reason a manifest cannot be trusted, phrased for the developer. */
export interface ManifestViolation {
  readonly entry: string;     // registry key, e.g. "page-builder"
  readonly field: string;     // e.g. "obsoleteFiles", "attach.selector", "dependencies"
  readonly value: string;     // the offending value, verbatim (JSON-escaped when printed)
  readonly reason: string;    // e.g. "path leaves its install directory"
}
/** Every violation of R1–R4 in a parsed manifest; [] when it is safe to apply. */
export function findManifestViolations(data: Record<string, unknown>): ManifestViolation[];
export function isSafeRelativePath(value: string): boolean;   // R1
export function isComponentKey(value: string): boolean;       // R2 key pattern
export function isRegistryPackageSpec(value: string): boolean; // R3
export function isIdentifier(value: string): boolean;         // R4 symbol / exportName
export function isAttachSelector(value: string): boolean;     // R4 selector
```

`core/resolve.ts` gains `export class UnknownComponentError extends Error`
(message: `Unknown component "b" (required by "a")`).

### D.2 Efficiency

Validation walks the manifest once per source (manifests are cached per source,
`load.ts:103`), ~192 entries × ~10 fields — microseconds. Sink guards are one
`path.resolve` + `path.relative` per file. No meaningful perf concern; no
budget needed.

### D.3 DX for the consuming developer

- **Must learn:** nothing for the default registry. Fork maintainers learn the
  four rules from the warning text, which names entry, field, value and reason.
- **Error texts (exact):**

| Situation | Text |
| --- | --- |
| manifest rejected | `⚠ Could not use the registry manifest from <url>: <entry>.<field> contains "<value>" (<reason>); using the bundled copy, which may be stale.` — when there are several violations, the first three are listed, then `(+N more)` (decided in Task 1: violations joined with `, `, the count appended after the third, before the `;`) |
| `<field>` labels (decided in Task 1) | the manifest field name (`files`, `obsoleteFiles`, `dependencies`, `npmDependencies`, `parent`); an element of an object list is indexed (`shortcutDefinitions[0].sourceFile`, `optionalDependencies[2].name`); a preset value is `presets.<preset>`; an addon attach is `attach.import` / `attach.selector`; a bad key is `key`, a key ≠ name mismatch is `name` |
| R1 reason | `path leaves its install directory` |
| R2 reasons | `not a component key` · `key does not match its name "<name>"` · `refers to "<name>", which this registry does not define` |
| R3 reason | `not a plain registry package spec (name or name@range)` |
| R4 reasons | `not a JavaScript identifier` · `not a selector token` · a shortcut `componentName` is a component key, so it gets R2's `not a component key` |
| sink refused | `Path must stay inside the project directory: <path>` (existing `resolveProjectPath` text) |
| inherited name | existing `Invalid component(s): …` / `Unknown component(s): …` |
| prune kept (untracked, no baseline) | `Kept <file>: it differs from every version we shipped (delete it manually if intended).` |

### D.4 Implementation options

#### (a) Where the rules are enforced

**Option 1 — Load-time validation only**
Pros: one place; bad manifests never reach the in-memory registry.
Cons: values that never pass the loader (`--files`, MCP `files`, the in-memory
registry tests and future code paths build) are unprotected; one future field
added without a rule silently reopens the hole.

**Option 2 — Sink guards only**
Pros: protects every path regardless of origin.
Cons: does nothing for R2–R4 (names, flags, code tokens are not paths);
failures surface mid-install, after some files were written, instead of before
anything happens.

**Option 3 — Both: load-time rules for all of R1–R4, plus `resolveProjectPath`
at every destructive registry-fed sink**
Pros: rejects the whole bad manifest before any write; destructive sinks stay
safe against inputs that bypass the loader. Cons: two places to keep in sync
(mitigated: the sink guard is the existing, generic `resolveProjectPath`, not a
second copy of R1).

**✅ Chosen: Option 3**, because the review's own direction asked for defence in
depth and V16 proves a loader-only fix leaves `refresh-lib --files` open.

Sinks to guard (write / delete, registry- or argument-fed): `merge.ts`
`decideMergeFile` + `mergeWriteFile` (resolve once, reuse); `install.ts`
`installLibFiles`, `pruneObsoleteFiles`; `lib-reconcile.ts` `classifyLibFile`,
`refreshLibFiles`; `migrate-core.ts` `deleteLegacyFiles`,
`rollbackPartialNewFolders`. Read-only existence checks elsewhere
(`plan.ts:46`, `update.ts:34`, `doctor.ts:75`, `apply-core.ts:95`,
`install.ts:225`) are covered by R1 at load and are **not** changed — keeping
the diff small. Where a sink sits inside a `try` that turns errors into
warnings, the guard's throw becomes that warning (T-7).

#### (b) Path rule shape (R1)

**Option 1 — Deny-list** (`..`, leading `/`, drive letter, `\`).
Pros: permissive. Cons: every missed form is a bypass — the RTE audit's open
redirect survived two such attempts (`.claude/CLAUDE.md` "Fixing Bugs").

**Option 2 — Allow-list** `^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$` plus "no
segment is `.` or `..`".
Pros: closed by construction — `\`, `:`, control chars, spaces, `%` cannot
appear; verified to accept every path in the real manifest (V12). Cons: a
future file name with another character needs a rule change (deliberate).

**✅ Chosen: Option 2.**

#### (c) Own-key lookups (R2)

**Option 1 — `Object.hasOwn(registry, name)` in `isComponentName`, and route
`add.ts:69` / `diff.ts:56` through `isComponentName`; `Object.hasOwn` in
`presets.ts:55`; reject `__proto__` and non-key names at load.**
Pros: minimal; keeps the registry a plain object every module already imports.

**Option 2 — Rebuild the registry as `Object.create(null)` or a `Map`.**
Pros: inherited names vanish structurally. Cons: `registry` is an exported
typed object literal read by ~60 call sites and by `defineRegistry` typing;
`applyManifest` mutates it in place by design (`load.ts:1-12`). Large blast
radius for no extra protection once R2 holds.

**✅ Chosen: Option 1.**

#### (d) npm spec separation (R3)

**Option 1 — Validate specs at load only.**
**Option 2 — `--` only.** Cons: unverified for pnpm / yarn (V10); does not stop
`file:` / git / URL specs, which install arbitrary code outside the registry.
**Option 3 — Both:** R3 allow-list at load (primary control) **and** `--` for
every package manager the executing agent verifies in Task 6.

**✅ Chosen: Option 3.** If pnpm or yarn cannot be verified, they get no `--`
and the R3 allow-list alone carries the rule; record which in the completion
log.

#### (e) Obsolete-file prune rule

**Option 1 — Prune `clean` only** (the review's proposal). Cons: regresses B7
for every pre-lockfile project (V13).
**Option 2 — Prune `clean`, or `untracked` + `componentFileHash(content,
prefix, utilsAlias) ∈ COMPONENT_BASELINES`** — the same test
`clean-reinstall.ts:159` already uses.
Pros: keeps B7; deletes nothing that is not provably ours. Cons: a pre-lockfile
file whose version predates the baselines is kept (safe direction).

**✅ Chosen: Option 2.**

### D.5 Risks

| Risk | Mitigation |
| --- | --- |
| Over-strict rule makes every consumer fall back to the stale bundled snapshot. | T-2 runs the rules on the committed manifest **and** the snapshot; T-18 runs real consumer installs. |
| A rejected explicit `--registry` manifest falls back to the bundled snapshot while files are still fetched from the fork (pre-existing fallback semantics). | Out of scope; the warning names the URL. Content trust is unchanged; paths are now safe in both manifests. Noted for a follow-up. |
| Sonar S3776 in `findManifestViolations`. | One small checker per field family (`checkPaths`, `checkNames`, `checkNpm`, `checkTokens`), each ≤ 15. |
| `sync-registry` later emits a path the allow-list rejects. | T-2 fails in `test:cli` on that very commit — the generator and the validator meet in CI-equivalent local gates. |
| pnpm / yarn treat `--` differently. | Task 6 verifies before enabling; otherwise R3 alone. |
| Merge conflicts with the integrity / network specs. | Merge this one first (banner). |

### D.6 Publish verdict

**A CLI npm publish IS required.** Every change is CLI logic under
`packages/cli/src/**` (`registry/load.ts` validator, new
`registry/manifest-rules.ts`, `core/*`, `commands/*`, `mcp/tools/*`,
`utils/package-manager.ts`) — boundary checked against `.claude/CLAUDE.md`
"When a CLI npm Publish Is Required". No registry data changes, so nothing goes
live on merge alone. The manifest **shape** is unchanged; the validator only
gets stricter, so already-installed CLIs keep parsing the live manifest.
**Publish is manual (passkey / 2FA) and is done by the human after the PR is
merged to `master`.** Adding the PR to the pending-releases memory is the
lead's job, not this spec's.

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Write failing tests T-1 … T-17 (T-17 by **fixing** the bug-asserting case at `install.spec.ts:319-330`; commit the historical `property-editor.component.ts` blob as a fixture). Confirm each fails for the right reason. | UC-1 … UC-9 | ✅ Done | 2026-10-04 10:35 | 92 | 59 cases red for the stated reason (0 pre-existing failures at 14216e9b). Reviewers caught potency gaps a happy-path pass missed: no inherited-name reference row, and a T-7 sentinel that the Task 5 content rule would have kept anyway. Both fixed by sampling the class, not adding tests. Later: decide message formats in the spec before pinning them in tests. |
| 2 | `registry/manifest-rules.ts` (R1–R4 + `findManifestViolations`); wire into `isValidRegistryShape` / `loadRegistry` so the fallback warning names the first violations (§D.3) | UC-1, UC-3, UC-7, UC-8, UC-10 | ✅ Done | 2026-10-04 | 92 | The allow-list rules made every §C.5 mutation for R1–R4 go red on the first run, and the real manifest plus the bundled snapshot pass. The reviewer found an unspecified class: keys and preset names print outside the JSON-quoted value, so a hostile ESC/CSI reached the terminal. That is now escaped, and both C0 and C1 are sampled. Later: `manifestLocation` repeats `fetchManifest`'s source decision; fold it into one helper when the network spec rewrites `fetchManifest`. |
| 3 | Own-key lookups: `isComponentName` → `Object.hasOwn`; `add.ts:69` and `diff.ts:56` → `isComponentName`; `presets.ts:55` → `Object.hasOwn`; `UnknownComponentError` in `resolve.ts`; MCP `add_component` validates `optionalDeps` + `overwrite` and filters preset keys like the CLI's `offeredPreselection` | UC-4, UC-5, UC-6 | ✅ Done | 2026-10-04 | 93 | Five small edits, and every UC-4 caller (update, why, MCP read and update tools) is fixed through `isComponentName` alone. `resolve.ts` checks its own imported `registry`, so partial registry mocks in tests stay consistent. Later: nothing catches `UnknownComponentError` yet; turning it into an exit code or recorded failure belongs to `cli-install-integrity-spec`. |
| 4 | Sink guards via `resolveProjectPath` in `merge.ts`, `install.ts` (`installLibFiles`, `pruneObsoleteFiles`), `lib-reconcile.ts` (`classifyLibFile`, `refreshLibFiles`), `migrate-core.ts` (`deleteLegacyFiles`, `rollbackPartialNewFolders`) | UC-2 | ⬜ Not started | — | — | — |
| 5 | Prune rule: `clean` or (`untracked` and `componentFileHash ∈ COMPONENT_BASELINES`); new keep-warning text | UC-9 | ⬜ Not started | — | — | — |
| 6 | Verify `--` on pnpm (v9) and yarn (v1 + berry) in a throw-away temp dir (`npx pnpm@9 add -- --registry=http://127.0.0.1:9`, same for `yarn@1` / `yarn@4`), record results in the completion log, then insert `--` in `installPackages` for every verified manager | UC-7 | ⬜ Not started | — | — | — |
| 7 | Gates: mutation check §C.5; `npm run test:cli`; `npm run coverage:cli`; `npm run lint`; `npm run e2e -- button` and `npm run e2e -- page-builder` (T-18); `npm run sonar:gate` with the four verdict checks from `.claude/CLAUDE.md` §4; record "**CLI publish required — manual, after merge**" in the completion log | all | ⬜ Not started | — | — | — |

Task sizing: one coherent commit per row. Tasks 3–6 are independent after 2 and
may be done in any order by one agent, but the table order is the default.

### Implementation notes the executing agent must honour

- State the rule (R1–R4) in the commit message of the task that implements it,
  then re-read the diff against it (`.claude/CLAUDE.md` "Fixing Bugs" §3).
- Run the consumers, not just the edited folder: `npm run test:cli` in full —
  `resolveDependencies`, `isComponentName` and `performInstall` are used by
  every command and the MCP server.
- Never hand-edit `registry.json`; this spec changes no registry data.
- No new runtime dependencies (no `validate-npm-package-name`; R3 is a regex
  derived from npm's documented name rules: lowercase, ≤ 214 chars, optional
  `@scope/`, no leading `.` or `_`, URL-safe characters).
- Sonar rules from `.claude/CLAUDE.md` §4 apply: `readonly`, no nested
  ternaries, cognitive complexity ≤ 15, `RegExp.exec`, no negated if/else.

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
| 1 | 2026-10-04 10:35 | Failing tests T-1 … T-17 | 92 (rounds: 88, 89, 92) | Reviewer: every §C.5 mutation turns a test red. T-7 puts a byte-exact published file outside the ui dir, so the prune guard is visible even after the content rule lands. T-17's row pairing separates the status-only, content-only and clean-only rules. Deviations, all recorded: the `<field>` labels and the multi-violation layout are fixed in §D.3. T-9b uses the real installer with an empty write set (no I/O) instead of mocks. T-11 asserts that no `fetch` happened, standing in for "`detectConflicts` not reached". Extra rows: `constructor` in T-13/T-14 and in a T-3 reference, R3 leading `.`/`_`/>214 chars, empty lists. Plus one extra load test for `(+N more)`. **Task 6 verification done early** (it needs no code): `-- --registry=http://127.0.0.1:9` is rejected as a package spec by npm 11.5.1 (ENOENT), pnpm 9.15.9 (`ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER`), yarn 1.22.22 (fetches it as a package name → 405), yarn 4.18.1 ("didn't match the required format") and bun 1.2.23 ("unrecognised dependency format"). `-D -- is-number@7.0.0` installs normally on all five. Sonar scan 1 (tests only): 14 open, exactly master's 14 manual Won't-Fix findings, 0 in changed files. Verdict rule escalated to the human. |
| 2 | 2026-10-04 | `manifest-rules.ts` + loader wiring | 92 | Reviewer: R1–R4 are allow-lists that match the spec. Probes rejected `npm:x@1`, `github:a/b`, `x@@1`, `%`, NUL and every Windows form. BUNDLED is applied without caching the rejected manifest. The shape check now requires typed lists for every V1 field. Concerns fixed: control characters in keys, preset names and reasons are escaped (new load.spec case covers C0 and C1); comments note where R3 is stricter than npm, and that `manifestLocation` must stay in sync with `fetchManifest`. Mutations (all RED): drop the `..` check, check only `files`, allow `\`, reject dots inside a segment (over-strict), skip `parent`, use `in` for references, allow a leading `-`, selector `.+`, key check off, drop the escaping, ignore C1. **Per-agent Sonar dropped by the human (2026-10-04)**: one `sonar:gate` will run on the merged integration branch. |
| 3 | 2026-10-04 | Own-key lookups | 93 | Reviewer: R2 Option 1 done in five edits. Every UC-4 caller (`update.ts:27`, `why.ts:47`, `read-tools.ts:49,66,87,104,151`, `write-tools.ts` update_component) validates through the fixed `isComponentName` before indexing. MCP add_component validates `optionalDeps` and `overwrite`, and skips undefined preset keys with the CLI's exact warning. Mutations (all RED): `isComponentName`/presets/resolve/add/diff via `in`, resolve guard removed, MCP validating names only, no preset filter, preset warnings dropped. Open: `UnknownComponentError` is uncaught. Only a manifest that skips the loader can raise it, and catching it belongs to the integrity spec. |
