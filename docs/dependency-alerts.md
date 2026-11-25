# Dependency alerts: what was done and what is accepted

## Triage of 2026-11-25 (90 open: 2 critical, 35 high, 41 medium, 12 low)

Where the alerts live: 58 in the root `package-lock.json`, 28 in `e2e/fixture-app-21/package-lock.json`, 3 in
`demo/package.json` (`@angular/router`), 1 in `packages/cli/package.json` (`zod`). Only the last one is in something
that ships to consumers; the rest is development tooling, the test fixture, or the demo site.

### Applied in this change (73 of the 90 clear on the next Dependabot scan)

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
- Checked after each step: no entry removed, no version lowered (a plain `npm update` lowered `oxc-resolver` once; that was
  `storybook` 10.6.9 pinning 11.21.2 exactly, upstream's choice), `npm ci` installs the lock, typecheck, the full test suite and
  the demo build pass. The `--before` date cutoff of the earlier triage was not needed: the resolver crash does not occur on
  npm 11.5.1, and a cutoff would have excluded the fixes.

### Still open, and why (17 after this change; 1 more closes with the CLI `zod` change)

| Alert | Why it stays |
|---|---|
| `e2e/fixture-app-21`: `@modelcontextprotocol/sdk` 1.31.0, `undici` 7.29.1, `vite` 7.3.6 | Test fixture app (a pristine Angular install the e2e suite copies components into), pinned by its own Angular CLI chain; never shipped, never exposed to input. Moves with the next fixture Angular bump. |
| `i18next` 25.7.4 (fix 26.3.4) | Major bump of a documentation-tooling dependency. |
| `webpack-dev-middleware` 6.1.3 | The copy nested in `@storybook/builder-webpack5`, which asks for 6.x. The 7.x copy is patched. Development server only. |
| `zod` 3.25.76 in the root lock and `packages/cli/package.json` | The advisory covers every 3.x (`< 4.6.6`), so the fix is a major move of the CLI to zod 4: its own change with its own CLI release. |

## Earlier triage (2026-10-17)

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
