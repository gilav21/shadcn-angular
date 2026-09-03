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
  `@angular-devkit/build-angular` pins, and npm resolves that change by pruning
  the cross-platform optional native binaries (`@rolldown/binding-linux-*`,
  `@parcel/watcher-linux-*`, `@napi-rs/nice-*`, `lmdb`) from the lockfile, which
  breaks `npm ci` on the Linux CI and Netlify builders. Not worth it for a
  build-time DoS that cannot be triggered here.

Revisit when `image-size` publishes a fixed release, or when
`@angular-devkit/build-angular` moves its `less` pin forward on its own.

## Lockfile maintenance note

Regenerating `package-lock.json` on Windows — whether from scratch or via an
incremental `npm install` — prunes optional native binaries for other platforms
and silently drops entries the Linux builders need. Master's lockfile also
carries pre-existing drift that any refresh will collapse. When a bump only needs
a handful of versions changed, edit those entries in place (version, `resolved`,
`integrity`, and any exact dependency pins) and prove the result with `npm ci`,
rather than letting npm rewrite the whole tree.
