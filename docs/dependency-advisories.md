# Dependency Advisories

Status of `npm audit` findings on the workspace, and the rationale for any that
are deliberately left open. Re-check with `npm audit` after any dependency change.

## Accepted (no upstream fix available)

### `image-size` — 3 high (via `less`)

- **Advisories:** ICNS parser DoS via infinite loop; JXL and HEIF parsers DoS via
  infinite loops. Both are `<=2.0.2`.
- **Why it is not fixed:** `2.0.2` is the latest published `image-size`. There is
  no non-vulnerable release to move to.
- **Path:** `vite → less@4.4.2 → image-size@0.5.5` (an *optional* dependency of
  `less`). `less` and `@angular-devkit/build-angular` are reported only because
  they carry it transitively.
- **Exposure:** Build-time only, and this project compiles CSS with Tailwind — no
  `.less` source is ever passed through the LESS image-dimension path, and the
  parsers are never handed untrusted images. Nothing reaches a consumer of the
  published CLI, whose runtime dependencies do not include `less`.
- **Rejected workaround:** overriding `less` to `^4.9.1` (which swaps
  `image-size` for `probe-image-size`) forces `less` off the exact `4.4.2` that
  `@angular-devkit/build-angular` pins. When it was tried, npm removed
  `image-size` without actually adding `probe-image-size` — an accidental
  prune, not an upgrade. Not worth chasing for a build-time DoS that cannot be
  triggered here.

Revisit when `image-size` publishes a fixed release, or when
`@angular-devkit/build-angular` moves its `less` pin forward on its own.

## Lockfile maintenance note

Regenerating `package-lock.json` on Windows records only win32 variants of the
optional native binaries (esbuild, rollup, lightningcss, …). That is fine:
both builders that install this repo — the e2e workflow and Netlify — run
`npm install --no-audit --no-fund`, which resolves the missing variants at
install time and never writes the lock back. Nothing needs a Linux-complete
lockfile, and the WSL "relock" scripts that used to produce one are gone.

What still deserves care is the *diff*: a fresh resolve on top of a stale lock
can float `^` ranges and, as seen on 2026-09-03, an incremental `npm install`
against drifted entries dropped `@angular/animations`/`forms`/`router` outright.
After any regeneration, read the lock diff for removed packages and unexpected
version moves, and prove the result with `npm ci` before committing. For a
handful of pinned bumps, editing the entries in place (version, `resolved`,
`integrity`) keeps the diff to exactly the intended change.
