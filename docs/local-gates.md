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
| 4 | `test-cli`     | CLI unit tests (node)                               |
| 5 | `test`         | component unit tests (headless browser)             |

```bash
npm run preflight                 # all stages
npm run preflight -- --list       # stage ids
npm run preflight -- --skip test  # skip a stage by id (repeatable)
```

It prints a per-stage wall-clock summary and names the stage that failed.

Deliberately **not** in preflight:

- `test-storybook:a11y` — RED by design (see `docs/a11y-backlog.md`). It is a
  manual triage command, never a gate.
- `e2e` — ~7 min, and CI already runs the impacted subset per PR.
- `sonar` — needs Docker + a token; run it before declaring a task done
  (`.claude/CLAUDE.md` §4).

## Git hooks

Installed by `npm install` via the `prepare` script
([`simple-git-hooks`](https://github.com/toplenboren/simple-git-hooks) —
zero-dependency, no postinstall binary download, and the hook body is a single
`npm run …` line, so nothing bash-specific runs on Windows). Re-install
manually with `npx simple-git-hooks`.

| hook       | runs                                    | measured wall-clock (2026-07-13, warm) |
|------------|-----------------------------------------|--------------------|
| pre-commit | `lint-staged` → `eslint --fix` on staged files | **10 s** for a 10-file commit (scales with staged file count) |
| pre-push   | `preflight` (2m 30s) + `test-storybook` (60 s) | **3 m 30 s** |

**pre-commit is intentionally lint-only.** Scoping unit tests to the staged
files is not cheap here: the component suite runs in a real browser, and
booting it costs more than the lint pass even for one file. A pre-commit hook
that takes minutes gets `--no-verify`'d into uselessness, which is worse than
not having one. Tests run at push time instead.

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
