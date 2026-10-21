# Dependency alerts: what was done and what is accepted

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
