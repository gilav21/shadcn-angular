# Dependency alerts: what was done and what is accepted

## Triage of 2026-11-25 (90 open: 2 critical, 35 high, 41 medium, 12 low)

Where the alerts live: 58 in the root `package-lock.json`, 28 in `e2e/fixture-app-21/package-lock.json`, 3 in
`demo/package.json` (`@angular/router`), 1 in `packages/cli/package.json` (`zod`). Only the last one is in something
that ships to consumers; the rest is development tooling, the test fixture, or the demo site.

### Applied in this change (73 of the 90 expected to clear on the next Dependabot scan)

The counts are mine, from matching each advisory's vulnerable range against the locked versions (plus the three for the
demo's router pin, which has no lockfile); Dependabot's own rescan after the merge is the authority, and these numbers
should be corrected from it.

- **Root lockfile, in-range bumps** with `npm update <names> --package-lock-only`: `hono` 4.13.22, `@hono/node-server`
  2.1.11, `qs` 6.17.1, `fast-uri` 3.1.9, `follow-redirects` 1.16.3, `launch-editor` 2.14.2, `serialize-javascript` 7.1.4,
  `vite` 7.3.8, `undici` 6.29.1 and 7.30.1, `webpack-dev-server` 5.2.7, `webpack-dev-middleware` 7.4.6, `storybook`
  10.6.9 (the critical one), plus the Angular build chain (`@angular/build`, `@angular/cli`, `@angular-devkit/build-angular`
  21.2.21 -> 21.2.31), which brings `piscina` 5.3.2 (the other critical), `@modelcontextprotocol/sdk` 1.32.1 and `zod` 4.6.6
  into the root copy.
- **Pinned families, edited in place** (version, tarball, integrity and dependency pins copied from the registry's own
  metadata, then `npm ci` to prove it): the nine Angular overrides 21.2.22 -> 21.2.26 (root `overrides` and the demo's exact
  pins, which fixes the three `@angular/router` advisories), the vitest family 4.1.10 -> 4.1.12 (`npm update` cannot move
  it: each `@vitest/*` package pins the others exactly), `body-parser` 2.4.0, `brace-expansion` 5.0.12.
- **`e2e/fixture-app-21/package-lock.json`**: `hono`, `@hono/node-server`, `qs`, `fast-uri` and `undici` 6.x.
- Checked: `npm ci` installs the lock exactly, `typecheck`, the full test suite and the demo build pass. Three `@emnapi/*`
  entries that a plain update dropped from the fixture lock are restored, since `@napi-rs/wasm-runtime` still asks for them.
  The `--before` date cutoff of the earlier triage was not needed: the resolver crash does not occur on npm 11.5.1, and a
  cutoff would have excluded the fixes.
- **What changed in the root lock's shape** (31 entries removed, 40 added; read this before auditing a build regression):
  the 22 `@oxc-resolver/binding-*` platform packages and `oxc-resolver` reappear nested under `storybook`; the CLI
  workspace's own copy of the MCP SDK is hoisted to the root; `less` 4.4.2 -> 4.9.0 swaps `image-size` and `pify` for
  `probe-image-size` 7.5.0; the build chain now nests a second `webpack` (5.112.0) beside the top-level 5.105.2, with
  `minimizer-webpack-plugin` 5.14.1 and fresh `enhanced-resolve`, `schema-utils` and `watchpack` copies; a few more nested
  copies are deduped (`readable-stream`, `semver`, `@noble/hashes`).
- **Accepted tradeoff, not a passed check:** `oxc-resolver` goes down, 11.24.2 -> 11.21.2, because `storybook` 10.6.9 (the
  fix for its critical alert) pins 11.21.2 exactly. Nothing else ends lower than it started.

**Bumping the Angular pins.** Angular is declared in three places: the nine `overrides` in the root `package.json`, the
demo's exact pins in `demo/package.json` (and its workspace entry in the root lock), and the version table in `README.md`
(`npm run docs:readme`, which follows the demo's pins). `packages/cli/scripts/angular-pins.spec.ts` fails if the first two
disagree; the README is checked by `npm run docs:check`. `npm update` cannot move them. Edit the nine lock entries in place from
`npm view <pkg>@<version> --json` (`version`, `resolved` = `dist.tarball`, `integrity` = `dist.integrity`, and the
`dependencies`, `peerDependencies`, `engines` blocks), then prove it with `npm ci`, `typecheck`, the tests and the demo build.
`e2e/fixture-app-21` is not a fourth pin: it declares Angular as `^21.2.0` ranges and resolves them in its own lock, so it
moves with an in-range `npm update` of its Angular packages (all of them together, see the open alerts below).

### Still open, and why (17 after this change)

Counted per advisory, not per package: one package can carry several.

| Alerts | Why they stay |
|---|---|
| 13: `e2e/fixture-app-21`, MCP SDK 1.31.0 (3), `undici` 7.29.1 (5) and `vite` 7.3.6 (5) | Test fixture app (a pristine Angular install the e2e suite copies components into), never shipped, never exposed to input. Its `@angular/cli` 21.2.26 pins the SDK exactly and its `@angular/build` 21.2.26 pins `undici` and `vite` exactly. `npm update` moves the CLI (to 21.2.31) but leaves `@angular/build` where it is even though the manifest allows `^21.2.0`. The CLI and the builder are released together and share `@angular-devkit/*` internals, so moving only one leaves a pair Angular never shipped; the fixture waits for a bump of the whole chain. (The root lock is different and safe: its build chain moved together to 21.2.31, and the runtime packages it sits beside, still at 21.2.26, only need the builder's `^21` peer range.) |
| 1: `i18next` 25.7.4 (fix 26.3.4) | Major bump of a documentation-tooling dependency. |
| 1: `webpack-dev-middleware` 6.1.3 | The copy nested in `@storybook/builder-webpack5`, which asks for 6.x. The 7.x copy is patched. Development server only. |
| 2: `zod` 3.25.76, one in the root lock and one in `packages/cli/package.json` | The advisory covers every 3.x (`< 4.6.6`), so the fix is a major move of the CLI to zod 4. The CLI one is the only alert in something that ships to consumers. **Closed by the follow-up change below**: the alert clears on merge, but users get the fix only with the next CLI release. |

### Follow-up: the CLI moves to zod 4 (closes the last alert in something that ships)

`packages/cli/package.json`: `zod` `^3.25.76` -> `^4.6.6`; the lock resolves 4.6.7 and the root-lock copy of zod 3 is gone.
Why this is safe to do: the CLI uses zod only to describe its MCP tools (`string`, `boolean`, `number`, `array`, `enum`
with `.describe`, `.optional`, `.min`, `.max`, `.int`), and the MCP SDK it ships with accepts `^3.25 || ^4.0`. What a client
sees from `tools/list` for all 22 tools was dumped before and after: after sorting keys the only difference is that
`additionalProperties: false` is no longer advertised at the root of each `inputSchema`. The server still ignores an
undeclared argument and still rejects a wrongly typed one with `-32602` (measured on zod 4; zod 3's default object mode also
strips unknown keys); `server.spec.ts` now holds that contract (advertised `integer` / 1..5 / required, and rejection before
a destructive handler runs). **Reaches consumers only with the next CLI release**, since the range is part of the published
manifest: the Dependabot alert clears when this merges, the fix ships when the CLI is published.
After that release, 15 alerts remain: the 13 fixture ones, `i18next` and `webpack-dev-middleware`.

## Earlier triage (2026-10-17)

Superseded where the section above says so: `piscina`, `@angular/build`, `@angular-devkit/build-angular`,
`webpack-dev-server` and `@angular/router` listed below as waiting for an Angular bump are fixed by the 2026-11-25 change.

Triage of the GitHub Dependabot alerts on `master` (50 open on 2026-10-17: 5 critical, 13 high,
26 medium, 6 low), all in `package-lock.json` except one in `demo/package.json`.

**What ships.** The npm packages carry only their own `dependencies`; consumers resolve those at
install time, so this repository's lockfile does not reach them. The one declared floor that does
ship is `packages/cli`'s `@modelcontextprotocol/sdk`. Everything else flagged is development
tooling (the Angular build chain, Storybook, compodoc, vitest) that never handles untrusted input
here.

## Applied

- `packages/cli`: `@modelcontextprotocol/sdk` floor raised from `^1.29.0` to `^1.31.0` (the patched
  line; the workspace resolves 1.32.1). Consumers can no longer resolve a vulnerable SDK. This is a
  manifest change in a published package, so it needs a CLI release.
- Lockfile, 25 targeted bumps within their existing ranges, nothing removed, nothing downgraded:
  `handlebars` 4.7.10, `shell-quote` 1.12.0, `proxy-addr` 2.0.8, `axios` 1.20.0, `compression` 1.8.2,
  `js-yaml` 4.3.2, `source-map-js` 1.2.2, `undici` 6.29.0, `hono` 4.13.13, `ip-address` 10.7.4,
  `fast-uri` 3.1.8, `brace-expansion`, `joi`, `morgan`, `postcss-selector-parser`.
  Done with `npm update <names> --package-lock-only --before=2026-10-12` and checked with
  `npm ci --dry-run`. A plain `npm audit fix` is not usable here: it moved 102 entries and, under
  the date cutoff the resolver needs (see below), rolled some packages back.

## Accepted, with the reason

| Alert | Why it stays |
|---|---|
| `piscina` (critical), `@angular/build`, `@angular-devkit/build-angular`, `ng-packagr`, `webpack-dev-server` | Fixed only by moving the whole Angular build chain, which this repository pins through root `overrides`. Build-time only; the advisory needs attacker-controlled worker options. Revisit with the next Angular patch bump. |
| `@angular/router` (high) | Server-side-rendering denial of service. Neither the library nor the demo is server-rendered. The fix exists on the 21.x line (21.2.25); take it with the next coordinated Angular bump, not alone. |
| `@modelcontextprotocol/sdk` at the repo root (1.30.0) | Pinned by `@angular/cli`'s own dependency. The shipped CLI workspace uses its own 1.32.1 copy. |
| `@compodoc/compodoc` 2.0.0, `@storybook/angular` 6.5.16 (what audit offers for `braces`, `chokidar`, `fast-glob`, `micromatch`, `undici`, `webpack-dev-middleware`, `http-cache-semantics`) | Only fixable by major, breaking changes to the docs and Storybook tooling. Development-only. |

## Why the date cutoff

An `npm` resolver crash (`Cannot read properties of null (reading 'edgesOut')`) has affected fresh
dependency resolves since a package published on 2026-10-15. `--before=2026-10-12` avoids it. Drop
the flag when the resolver is fixed.
