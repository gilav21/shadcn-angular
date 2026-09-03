# Local gates — preflight, git hooks, releases

CI is deliberately minimal (one workflow: `e2e.yml`). Everything else is
verified **on your machine, before the code leaves it**. This doc is the
contract for that.

## `npm run preflight`

The full local gate. Stages run cheapest-first and fail fast, so a lint error
costs ~1 minute, not a full test run:

| # | stage          | what it runs                                        |
|---|----------------|-----------------------------------------------------|
| 1 | `lint`         | `check:all` — eslint (cached) + tsc (incremental) + Angular template typecheck |
| 2 | `registry`     | `sync-registry.ts` in report mode — exits 1 on drift |
| 3 | `completeness` | `check-completeness.ts` — story / demo route / e2e   |
| 4 | `test-cli`     | CLI unit tests (node). Holds the generated-docs drift detectors, so it is **never scoped away**. Coverage on a full run |
| 5 | `test`         | component unit tests (headless browser). With coverage on a full run |

ESLint and tsc keep their caches under `node_modules/.cache/`, so a full
`check:all` is ~2 min cold and well under a minute warm (eslint 103s → 3s,
tsc 11s → 4s, measured 2026-09-03). `ngc` has no incremental mode and stays at
~23s; it is the floor.

### The inner loop

The browser suite compiles with the Analog plugin's `fastCompile`, which skips
Angular's template type-checking inside vitest — `ngc` is the template gate, and
every path above runs it. One spec file is ~7s wall (was 35s); the full suite is
~60s (was ~100s). So after an edit:

```bash
npx vitest --run packages/components/ui/<name>/<name>.component.spec.ts  # ~7s
npx vitest packages/components/ui/<name>/                                # watch mode
```

`npm run typecheck:templates` is the one thing the fast path will not tell you
about; run it (or `check:all`) before you push if you touched a template.

```bash
npm run preflight                 # all stages
npm run preflight -- --list       # stage ids
npm run preflight -- --skip test  # skip a stage by id (repeatable)
```

It prints a per-stage wall-clock summary and names the stage that failed.

### The coverage ratchets gate releases, not pushes

The coverage thresholds in `vitest.config.ts` / `vitest.config.cli.ts` only
evaluate under `--coverage`. A **full** `npm run preflight` runs both test
stages instrumented, and `npm run release:cli` runs the full preflight — so a
release cannot lower coverage below the recorded floor.

The **pre-push hook does not**. It runs `preflight --since <merge-base>`, which
never instruments: coverage instrumentation inflates setup/import across ~500
browser spec files and pushes timing-sensitive specs past their timeouts, so the
hook would start failing on the instrumentation rather than on the code. Be
clear about what that means: a push *can* lower coverage; a release cannot. If
you want the ratchet's verdict before pushing, run `npm run preflight` by hand.

### What the pre-push gate does NOT guarantee

Be honest about the blast radius. A green `preflight` means: it lints, it
type-checks (incl. Angular templates), the registry is not drifted, every
component has a story + routed demo + e2e *entry*, both unit suites pass, and —
on a full run only — line/branch/function coverage is **at or above the
recorded floor**. It does **not** mean:

- **the e2e suite passes** — `preflight` never runs it (~7 min). Run
  `npm run e2e:impact -- --base origin/master` (or the full `npm run e2e`)
  before anything that touches the registry, the CLI, or shared `lib/`.
- **coverage is *good*** — the thresholds are a floor measured on the current
  tree, not a quality bar. New code can be entirely untested and still clear
  them as long as the aggregate does not drop below the floor.
- **SonarQube is clean** — needs Docker + a token; still a separate, manual
  done-gate (`.claude/CLAUDE.md` §4).
- **it renders correctly** — nothing in `preflight` looks at a rendered
  component. The Storybook axe pass that does is run by the **hooks**, not by
  `preflight` (see below).

Deliberately **not** in preflight:

- `test-storybook:a11y` — it is a *hook* stage, not a preflight stage, so that
  `preflight` stays a pure static/unit gate and the browser work happens once.
- `e2e` — ~7 min, and CI already runs the impacted subset per PR.
- `sonar` — needs Docker + a token; run it before declaring a task done
  (`.claude/CLAUDE.md` §4).

## Git hooks

Installed by `npm install` via the `prepare` script
([`simple-git-hooks`](https://github.com/toplenboren/simple-git-hooks) —
zero-dependency, no postinstall binary download, and the hook body is a single
`npm run …` line, so nothing bash-specific runs on Windows). Re-install
manually with `npx simple-git-hooks`.

| hook       | runs                                    | measured wall-clock (2026-09-03) |
|------------|-----------------------------------------|--------------------|
| pre-commit | `lint-staged` → `eslint --fix` on staged files. Nothing else — a commit is local; the audits run at push | a few seconds |
| pre-push   | `preflight --since <merge-base>`, then `a11y-staged --since` — details below | scoped **~1–2 min** · tripwired **~4 min** |

The scoped pre-push runs: eslint on the changed files, tsc + Angular template
typecheck, registry, completeness, **`test-cli`** (always), the component tests
related to the diff, then axe over the touched components' stories. When the
diff touches shared `lib/`, the CLI, tooling or the manifests (`TRIPWIRES` in
`preflight.mjs`) scoping is given up and the full, uninstrumented gate runs.

The merge-base scoping means "what this branch adds", not "what the last commit
touched" — rebasing or amending cannot shrink the audited set.

### The a11y (axe) gate

`.storybook/test-runner.ts` runs every story through axe when `STORYBOOK_A11Y=1`.
The full pass is green (926/926) and **must stay green — fix the component,
never the assertion**. It runs in the **pre-push** hook, scoped to the diff
(`scripts/a11y-staged.mjs --since <merge-base>`):

| in the diff | what runs |
|---|---|
| nothing UI-ish (docs, CLI, e2e, scripts) | nothing — skipped, ~0 s |
| `packages/components/ui/<name>/**` | axe over *those components'* `*.stories.ts` only |
| a **global** file (`.storybook/**`, `lib/**`, any `*.css`, a flat file under `ui/`) or a component with no story | the **full** pass: 926 stories, ~76 s |

The global fallback is the point: a change to `lib/a11y.ts` or to the global
stylesheet can break the a11y of any component, so scoping it to the (empty)
set of touched components would be a false green.

**Honest cost.** Booting Storybook (~25 s) dominates a scoped run: auditing one
component's stories is ~5–10 s, everything else is boot. It is paid once per
push, not once per commit. If you keep `npm run storybook` running while you
work, the hook reuses it and the scoped pass costs ~11 s.

To audit a component *before* pushing, run it directly:
`node scripts/a11y-staged.mjs` (staged files) or `npm run test-storybook:a11y`
(everything).

### The escape hatch

```bash
git commit --no-verify      # skip pre-commit
git push --no-verify        # skip pre-push
SKIP_SIMPLE_GIT_HOOKS=1 …   # skip either, without the git flag
```

Legitimate uses:

- **WIP commits on a scratch branch** you will squash before pushing.
- **Docs-only / typo commits** with no code surface.
- **You just ran `npm run preflight` by hand** and nothing changed since.
- **The gate is broken, not your code** (a flaky browser boot, an offline
  registry fetch) — but then fix the gate in the same session.

Not legitimate: "it's slow and I'm in a hurry" on a push to `master`. That is
the exact failure mode this replaces.

## `npm run release:cli -- <patch|minor|major>`

The local release flow for the published CLI package. Never publishes
unverified code, and — more usefully — **tells you when you don't need to
publish at all**:

> The CLI fetches the registry manifest and all component/lib source from the
> git branch **at runtime**. Component edits, lib edits and `registry.json`
> data edits therefore ship the moment they land on `master`, with **no npm
> publish**. A publish is only required when the *bundled* CLI changes: code
> under `packages/cli/src/**`, the `ComponentDefinition` manifest *shape*, the
> utils baselines, or the package's own packaging files.
> (`.claude/CLAUDE.md` → "When a CLI npm Publish Is Required".)

The script computes that verdict for you by diffing the tree against the last
`cli-v*` tag and classifying every changed path. If nothing bundled changed it
**aborts** — pass `--force` to override.

Flow: clean-tree + branch guard → publish verdict → `preflight` → version bump
→ `CHANGELOG.md` regenerated from conventional commits touching
`packages/cli/` → release commit → `npm publish` (`prepublishOnly` rebuilds
`dist/`) → `git tag cli-v<version>` → `git push --follow-tags`.

```bash
npm run release:cli -- patch --dry-run   # full rehearsal, changes nothing
npm run release:cli -- minor             # for real
```

Flags: `--dry-run`, `--force` (publish anyway despite a "not required"
verdict), `--allow-dirty`, `--allow-branch` (release off a non-`master`
branch), `--skip-preflight` (you own the consequences).
