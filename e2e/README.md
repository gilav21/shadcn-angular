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
npm run e2e:component -- button

# Run a subset
npm run e2e:component -- button dialog popover

# Run everything (15 components + prefix smoke test)
npm run e2e
```

The orchestrator builds the CLI lazily — `npm run e2e:build-cli` is only
needed if you want to force a rebuild.

## Interactive / visible modes

By default the suite runs Chromium headless, so the run prints results
but you never see a browser window. Three modes let you watch the run —
flags can be combined with any component subset and apply to every
component the orchestrator iterates over.

```bash
# Visible browser, autonomous run (best for "show me what's happening")
npm run e2e:headed -- button
npm run e2e:component -- button --headed

# Playwright UI Mode — timeline, time-travel snapshots, watch mode.
# Blocks until you close the UI. Best for authoring or debugging a spec.
npm run e2e:ui -- button
npm run e2e:component -- button --ui

# Playwright Inspector — pause-on-every-action, step through.
npm run e2e:debug -- button
npm run e2e:component -- button --debug
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

1. Create `e2e/harness/<name>/<name>-demo.component.ts`. Standalone
   component, imports only what `add <name>` provides, exposes at least
   two `data-testid` hooks (one to find the component, one to read state).
2. Create `e2e/harness/<name>/<name>.spec.ts`. Use `page.goto('/')` and
   target the `data-testid` hooks — assertions should describe behavior,
   not styling.
3. Add the component to `ALL_COMPONENTS` in
   `e2e/orchestrator/run.ts`.
4. Run `npm run e2e:component -- <name>` and iterate.

Keep harness pages small — 10-30 lines each. They are not feature
demonstrations; they exist to confirm the component reaches the user in
working condition.

## Verifying the harness itself works

The cheapest smoke test is the **deliberate regression**: break a
component's selector, rerun, confirm the spec fails, then revert.

```bash
# Manually edit packages/components/ui/button/button.component.ts
#   selector: 'ui-button'  →  selector: 'ui-broken-button'
npm run e2e:component -- button
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
`assertFixtureClean` will flag this on the next run. You can also reset
manually: `git checkout HEAD -- e2e/fixture-app && git clean -fd e2e/fixture-app/`.

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
