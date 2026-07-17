# jest-fixture — the jest leg of the `--include-tests` gate

A real **jest + jest-preset-angular + zone.js** consumer. It exists to prove
that the specs shipped by `add --include-tests` actually run on jest — through
the `vitest-compat` shim — not just on our own vitest setup.

## How a component becomes "verified portable"

A component only ships its tests once it clears **both legs** of the gate, at
100% line coverage. The verified set lives in
`packages/components/portable-tests.json`; `sync-registry` emits `testFiles`
only for the components listed there (and hard-fails if any of their specs are
non-portable — a missing `from 'vitest'` import, `vi.mock`/`vi.hoisted`, a
fake-timer options object, a deep/unshipped import).

Run the gate with:

```bash
npm run build:cli                                   # the jest leg installs via the built CLI
npx tsx packages/cli/scripts/verify-portable.ts <component...> --jest
npx tsx packages/cli/scripts/verify-portable.ts --all --jest
```

- **vitest jsdom leg** (`vitest.portable.config.ts`): specs run under jsdom,
  no browser, `globals: false` — coverage scoped to the component's source must
  reach 100% (or the floor recorded in `portable-tests.json` `coverageExceptions`,
  which needs a documented reason).
- **jest leg** (this fixture, `run.mjs`): the component is installed with
  `add --include-tests` and its specs run under real jest+zone. This catches
  zone-behavioral failures the zoneless vitest leg cannot.

Run the jest leg alone:

```bash
node e2e/jest-fixture/run.mjs button badge …
```

## Making a component portable (campaign)

When a component fails the gate:

1. **jsdom failure** — a spec relies on real-browser behavior (layout,
   `showPopover()`, etc.). Move just those specs to `*.browser.spec.ts`
   (kept internal, run only by our real-browser suite, never shipped).
2. **coverage < 100%** — add tests for the uncovered branches, or, only for
   genuinely browser-only lines, record a `coverageExceptions` entry with a
   reason.
3. **jest leg failure at 100% jsdom** — a zone-vs-zoneless behavior difference.
   Adjust the spec to be runner-agnostic, or split the offending case to
   `*.browser.spec.ts`.

Then add the component to `portable-tests.json`, run `sync-registry --fix`, and
re-run the gate.

## Note

Installed component sources land in `src/` and are git-ignored — the fixture is
config only; the component under test is installed fresh each run.
