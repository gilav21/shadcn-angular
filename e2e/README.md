# End-to-End Test Harness

A rerunable per-component pipeline that gates "tests pass" → "publish to
npm". It actually runs `init`, `add`, `npm install`, `ng serve`, and uses
Playwright to assert each shipped component is interactive in a real
Angular project.

## Why

Unit, sync-registry, and spec tests all run with mocked `fs`/`fetch`. They
can't catch:

- A `--prefix` rewrite that breaks selectors only at install time.
- A registry entry that lists a file the source tree no longer ships.
- A peer-dep that was added to a component but forgotten in
  `npmDependencies`.
- A new component whose `index.ts` exports a sub-component that was
  deleted in a refactor.
- A template that compiles in the demo app (workspace-linked) but fails
  in a real consumer's project (no workspace link).

This suite installs each component into a pristine Angular 20 fixture the
same way a user would, then drives Playwright at the resulting page.

## Quick start

```bash
# One-time setup
npm install
npx playwright install chromium

# Run a single component end-to-end (headless, fast)
npm run e2e -- button

# Run a subset
npm run e2e -- button dialog popover

# Run everything (15 components + prefix smoke test)
npm run e2e
```

The orchestrator builds the CLI lazily — `npm run e2e:build-cli` is only
needed if you want to force a rebuild.

## Incremental CI runs

The CI workflow (`.github/workflows/e2e.yml`) only runs the subset of
specs the PR's diff actually touches. The selection is registry-
driven: for each changed file, the analyzer asks the CLI registry
which component owns it (via `files[]` / `libFiles[]`), then walks
the reverse-dep graph and schedules every spec that installs an
affected component.

- **Tripwire files** (CLI source, orchestrator, fixture-app, the
  Playwright config, the workflow, `package.json` /
  `package-lock.json`) → run all specs.
- **A component file** (`packages/components/ui/<X>/**` or a
  `libFiles` entry in `packages/components/lib/`) → resolve owner
  via the registry, walk reverse-deps, schedule the matching specs.
  Editing `ui/button/button.component.ts` schedules `button` and
  every spec whose `names[]` includes button, plus components that
  list button in their `dependencies[]`.
- **A shared lib file** (e.g. `lib/chart.utils.ts`) → schedules
  exactly the chart specs (instead of triggering ALL via tripwire,
  as the older path-convention analyzer did).
- **A harness file** (`e2e/harness/<label>/**`) → run just that label.
- **Anything else** (docs, demo app, storybook) → suite is skipped
  entirely and the workflow reports success.

Pushes to master always run the full suite as a safety net regardless
of what changed.

A pre-flight `sync-registry` step runs before the impact analyzer.
If the registry drifts from disk, CI fails fast with a pointer to
`npm run sync-registry:fix` — guarantees the analyzer's lookups are
based on current truth.

Preview the decision locally:

```bash
# Against master
npm run e2e:impact -- --base origin/master

# Against a specific commit
npm run e2e:impact -- --base HEAD~5
```

Diagnostics print to stderr; the single decision line (`ALL`, `NONE`,
or `spec1 spec2 …`) prints to stdout so the workflow can capture it.

## Interactive / visible modes

By default the suite runs Chromium headless, so the run prints results
but you never see a browser window. Three modes let you watch the run —
flags can be combined with any component subset and apply to every
component the orchestrator iterates over.

```bash
# Visible browser, autonomous run (best for "show me what's happening")
npm run e2e:headed -- button
npm run e2e -- button --headed

# Playwright UI Mode — timeline, time-travel snapshots, watch mode.
# Blocks until you close the UI. Best for authoring or debugging a spec.
npm run e2e:ui -- button
npm run e2e -- button --ui

# Playwright Inspector — pause-on-every-action, step through.
npm run e2e:debug -- button
npm run e2e -- button --debug
```

`--ui` and `--debug` open an interactive window per component, so
running the full suite with them queues up 16 interactive sessions one
after another — you almost always want to combine them with a single
component name.

## Pipeline per component

For each component `<name>`:

1. **Reset** the fixture-app to its committed pristine state
   (`git checkout HEAD -- e2e/fixture-app && git clean -fd e2e/fixture-app/`).
   `node_modules` and `.angular/cache` are gitignored and survive reset
   so subsequent components reuse the cache.
2. **Init**: `node packages/cli/dist/index.js init --yes` inside the fixture.
3. **Add**: `node packages/cli/dist/index.js add <name> --yes`.
4. **Install**: `npm install` (cached after the first cold run).
5. **Install harness**: copy `e2e/harness/<name>/<name>-demo.component.ts`
   into `src/app/test-pages/`, write a one-route `app.routes.ts`.
6. **Serve**: `ng serve --port 4250 --no-open`, wait for ready (up to 120s).
7. **Playwright**: run `e2e/harness/<name>/<name>.spec.ts`.
8. **Teardown**: tree-kill `ng serve`.

## Timing

Per-component time on a cold cache (first run): ~60-120s. On a warm cache
(node_modules and `.angular/cache` populated): ~30-60s.

Full suite, cold: **~20-30 min**. Plan accordingly — it's a pre-release
gate, not something to run on every save.

## Layout

```text
e2e/
  README.md                       # this file
  playwright.config.ts            # baseURL=4250, workers=1, no webServer block
  fixture-app/                    # pristine Angular 20 scaffolding (committed)
  orchestrator/
    run.ts                        # entry point; parses --component args
    paths.ts                      # path constants
    reset-app.ts                  # git checkout + clean, dirty-check assertions
    run-cli.ts                    # lazy CLI build + spawn + npm install
    install-harness.ts            # copy demo page + rewrite app.routes.ts
    serve.ts                      # ng serve + tree-kill + port preflight
  harness/
    button/  badge/  input/  …    # one folder per spec
      <name>-demo.component.ts    # standalone Angular component
      <name>.spec.ts              # Playwright spec
    prefix-button/                # --prefix flag end-to-end check
```

## Adding a new component to the suite

**One command, zero other edits**:

```bash
npm run e2e:scaffold -- <name>
```

The scaffolder reads the CLI registry for `<name>`, parses
`packages/components/ui/<name>/index.ts` to find every exported
class, and writes a working harness pair:

```
e2e/harness/<name>/
  <name>-demo.component.ts    # standalone Angular component
                              # mounts <ui-<name>> with a data-testid
                              # on the root and on each sub-component
  <name>.spec.ts              # passing smoke (root is visible)
```

Run it immediately to confirm:

```bash
npm run e2e -- <name>
```

Then extend `<name>.spec.ts` with the real behavioral assertions
you want — the sub-component `data-testid`s in the demo are already
wired up. The orchestrator's auto-discovery picks up the new spec
automatically (no edit to `specs.ts`). CI's impact analyzer reads
the registry, so a future change to `packages/components/ui/<name>/`
will schedule this spec without any further wiring.

If the component isn't yet registered, the scaffolder runs
`sync-registry --fix` for you. If the name is a typo, it suggests
the closest registry key:

```
$ npm run e2e:scaffold -- radoi-group
[e2e:scaffold] "radoi-group" not in registry — running sync-registry --fix to pick it up…
All components are in sync.
Unknown component: radoi-group  — did you mean radio-group?
```

### Multi-component or special-`initArgs` specs

Single-component specs are auto-discovered from the
`e2e/harness/<name>/` folder. Multi-component specs and ones that
need a custom `init` command (e.g. `init --prefix acme`) still
register explicitly in `e2e/orchestrator/specs.ts`:

```ts
// e2e/orchestrator/specs.ts
const EXPLICIT_SPECS: readonly ComponentSpec[] = [
    {
        names: ['input', 'label', 'button', 'dialog'],
        label: 'form-flow',
    },
    // …
];
```

The `names` list is read by both the runner (for `add a b c --yes`)
and the impact analyzer (so changes to any of those components
schedule the spec). No separate dependency map.

### Package specs (`pkg-*`)

The compiled npm packages (`@gilav21/shadcn-angular-rte`,
`@gilav21/shadcn-angular-data-table`) are proven by installing a real
`npm pack` tarball into a pristine app — no CLI involvement at all.
Two extra `ComponentSpec` fields drive that:

```ts
{ names: [], packages: ['rte'], fixture: 'ng20', label: 'pkg-rte' },
{ names: [], packages: ['rte'], fixture: 'ng21', label: 'pkg-rte-ng21',
  harnessFolder: 'pkg-rte' },
// mixed mode: a CLI-copied component AND the package in one app
{ names: ['button'], packages: ['rte'], fixture: 'ng20', label: 'pkg-mixed' },
```

- **`packages`** — tarballs to build and install. `names` may be empty
  *only* when this is set (a spec that installs nothing would serve an
  empty app and "pass"), and such a spec must carry an explicit `label`.
- **`fixture`** — `'ng20'` (default, `e2e/fixture-app`) or `'ng21'`
  (`e2e/fixture-app-21`). The packages declare a peer range spanning both
  Angular majors, so each is run on **both** — that pair is the evidence
  behind the README's compatibility claim, and a test asserts no package
  is proven on only one.

These are `EXPLICIT_SPECS` entries by necessity: auto-discovery would turn
`e2e/harness/pkg-rte/` into `{ names: ['pkg-rte'] }`, and validation would
then abort the whole orchestrator on an unknown component name. The ng20 and
ng21 specs deliberately share a harness folder — same demo page, different
Angular version underneath.

What a package leg does: build the tarball (once per run, memoised), install
it, wire up Tailwind by hand from the README's own snippet, run a
**production** `ng build` (`ng serve` skips budgets and the full optimizer, so
an AOT or tree-shaking regression would otherwise stay hidden), then serve and
run Playwright.

ng21 specs run on one dedicated worker *after* the ng20 pool, since that
fixture is a separate checkout with its own `node_modules`. `npm run
e2e:reset` resets both fixtures.

**Budget note — this affects the whole Angular-20 suite.** The RTE closure
bundles to ~1.11 MB initial, which failed the ng20 fixture's original
production budget (500 kB warn / 1 MB error), so **both** fixtures now use
2 MB / 4 MB. That is a deliberate trade with a real cost: the CLI specs that
also run production builds there — `add-all-smoke`, `prod-build`,
`migrate-build` — had their only size guard raised along with it, so a
copy-model size regression under 4 MB no longer trips them. Scoping the
budget per spec would need a second Angular configuration in the fixture;
that is deliberately out of scope (spec §B.4 excludes bundle-size budgets),
but it is a knowing gap, not an oversight.

### Inspecting the registry

The `why` CLI command shows what a component is made of and what
depends on it — useful when picking dependencies or sizing a
refactor:

```bash
npx shadcn-angular why button
#   Files (3):     button/button.component.html …
#   Direct dependencies: ripple
#   Reverse dependents (18): bento-grid, calendar, chat, …
```

Keep harness pages small. They confirm a real consumer can install
and use the component; they aren't feature demonstrations.

## Verifying the harness itself works

The cheapest smoke test is the **deliberate regression**: break a
component's selector, rerun, confirm the spec fails, then revert.

```bash
# Manually edit packages/components/ui/button/button.component.ts
#   selector: 'ui-button'  →  selector: 'ui-broken-button'
npm run e2e -- button
# Spec must FAIL (Angular can't match the harness's <ui-button> tag).
# Revert the change; rerun; spec must pass.
```

Do this once after any change to the orchestrator code itself.

## Troubleshooting

**Port 4250 already in use** — a previous run leaked the dev server.
Windows: `netstat -ano | findstr :4250` then `taskkill /F /PID <pid>`.
POSIX: `lsof -i :4250` then `kill -9 <pid>`. The orchestrator fails fast
on a busy port rather than picking a different one, because Playwright's
`baseURL` is hardcoded.

**Fixture is dirty after a failed run** — the orchestrator's
`assertFixtureClean` will flag this on the next run. To reset on demand:
`npm run e2e:reset` (runs the same `git checkout HEAD -- e2e/fixture-app
&& git clean -fd e2e/fixture-app/` the orchestrator uses between specs).

**`ng serve` never becomes ready** — usually means a compile error in the
harness page. Check the spawned stdout for the actual diagnostic. The
orchestrator forwards stdio.

**`npm install` is glacially slow on the first run** — it has to
download the full Angular 20 dependency closure into the fixture's
`node_modules`. After that it's cached. To force a cold-cache run, delete
`e2e/fixture-app/node_modules` and `e2e/fixture-app/.angular`.

**Playwright browser missing** — run `npx playwright install chromium`
once. The CI workflow (if/when added) needs the same step.

## What the suite intentionally does NOT cover

- Compound components (`accordion`, `tabs`, `sidebar`, `data-table`,
  `command`) — they each need a 30-60 line harness; tracked for a follow-up.
- Visual regression — Playwright supports screenshot diffing but it's
  flake-prone on Windows; we assert DOM and state, not pixels.
- Server-side rendering — components run client-side only in the fixture.
- Production builds — only `ng serve` (dev mode). A `ng build` smoke
  test could be added per component but adds minutes per run.
