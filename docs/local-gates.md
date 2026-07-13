# Local gates — preflight, git hooks, releases

CI is deliberately minimal (one workflow: `e2e.yml`). Everything else is
verified **on your machine, before the code leaves it**. This doc is the
contract for that.

## `npm run preflight`

The full local gate. Stages run cheapest-first and fail fast, so a lint error
costs ~1 minute, not a full test run:

| # | stage          | what it runs                                        |
|---|----------------|-----------------------------------------------------|
| 1 | `lint`         | `check:all` — eslint + tsc + Angular template typecheck |
| 2 | `registry`     | `sync-registry.ts` in report mode — exits 1 on drift |
| 3 | `completeness` | `check-completeness.ts` — story / demo route / e2e   |
| 4 | `test-cli`     | CLI unit tests (node) **with coverage** — trips the ratchet in `vitest.config.cli.ts` |
| 5 | `test`         | component unit tests (headless browser) **with coverage** — trips the ratchet in `vitest.config.ts` |

```bash
npm run preflight                 # all stages
npm run preflight -- --list       # stage ids
npm run preflight -- --skip test  # skip a stage by id (repeatable)
```

It prints a per-stage wall-clock summary and names the stage that failed.

### Why the test stages run with coverage

The coverage thresholds in `vitest.config.ts` / `vitest.config.cli.ts` only
evaluate under `--coverage`. Nothing but `npm run coverage` used to pass that
flag, and nothing invoked it — so the "ratchet" gated **nothing**: half the
tests could be deleted and every gate still went green. Both test stages now run
with coverage, so a coverage regression fails the push. Measured cost of the
instrumentation (2026-07-13, warm): CLI 5s → 6s, component suite 50s → 69s.

`npm run release:cli` runs `preflight`, so a release is covered by the same
ratchet; there is no separate coverage stage to forget.

### What the pre-push gate does NOT guarantee

Be honest about the blast radius. A green `preflight` means: it lints, it
type-checks (incl. Angular templates), the registry is not drifted, every
component has a story + routed demo + e2e *entry*, both unit suites pass, and
line/branch/function coverage is **at or above the recorded floor**. It does
**not** mean:

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

| hook       | runs                                    | measured wall-clock (2026-07-13) |
|------------|-----------------------------------------|--------------------|
| pre-commit | `lint-staged` → `eslint --fix` on staged files, then **`a11y:staged`** — axe over the staged components' stories | **~4 s** (docs/CLI-only commit — axe skipped) · **~40 s** (one component, cold Storybook) · **~11 s** (one component, Storybook already running) |
| pre-push   | `preflight` (2m 47s — incl. coverage) + **`test-storybook:a11y`** (1m 19s: 25 s boot + 51 s for 926 stories **with axe on**) | **~4 m 06 s** |

### The a11y (axe) gate

`.storybook/test-runner.ts` runs every story through axe when `STORYBOOK_A11Y=1`.
The full pass is green (926/926) and **must stay green — fix the component,
never the assertion**. It is wired into both hooks, at different scopes:

- **pre-commit → scoped** (`scripts/a11y-staged.mjs`). It reads
  `git diff --cached` and audits only what you touched:

  | staged                                                        | what runs |
  |---------------------------------------------------------------|-----------|
  | nothing UI-ish (docs, CLI, e2e, scripts)                       | nothing — skipped, ~0 s |
  | `packages/components/ui/<name>/**`                              | axe over *that component's* `*.stories.ts` only |
  | a **global** file — `.storybook/**`, `packages/components/lib/**`, any `*.css`, or a flat shared directive/pipe directly under `ui/` | the **full** axe pass |

  The global fallback is the point: a change to `lib/a11y.ts` or to the global
  stylesheet can break the a11y of any component, so scoping it to the (empty)
  set of touched components would be a false green.

- **pre-push → full.** `test-storybook:a11y` replaces the old plain
  `test-storybook` in the push hook. It is a strict superset — same stories,
  same play functions, plus the axe assertions — so nothing was dropped, and the
  hook got *cheaper* than running both (net **+11 s** over the old pre-push).

**Honest cost.** Booting Storybook (~25 s) dominates the scoped run: auditing one
component's stories is ~5–10 s, everything else is boot. If you keep
`npm run storybook` running while you work, the hook reuses it and a scoped
commit costs ~11 s; from cold it is ~40 s. That is the deliberate trade: a
commit that touches a component pays ~40 s to learn *immediately* that it broke
`button-name` or `color-contrast`, instead of finding out minutes later at push
time — and a commit that touches no component pays nothing.

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
