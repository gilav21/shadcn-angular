#!/usr/bin/env bash
#
# Regenerate package-lock.json on Linux, from inside WSL.
#
# Why this exists: npm reifies the lockfile from what is installed on disk, so
# regenerating on Windows records only win32 binaries for optional native deps
# (esbuild, lightningcss, rollup, …). Netlify installs with `npm ci`, which
# refuses to deviate from the lockfile, and its Linux build then has no binaries
# to run — see the comment in .github/workflows/e2e.yml, which works around the
# same limitation with `npm install`.
#
# Resolving under Linux with the Node version Netlify uses produces a lockfile
# that carries every platform's binaries, so `npm ci` works on Netlify, in CI,
# and on a developer's Windows machine alike.
#
# Only the workspace manifests are copied into the Linux filesystem: the lock is
# a function of package.json alone, and a native-filesystem resolve avoids the
# slow /mnt path and never touches the Windows node_modules tree.
#
# NOTE: this deliberately resolves from scratch rather than seeding the scratch
# directory with the current lockfile. Seeding was measured: it preserves every
# resolved version (0 changes, 0 removals) but does NOT add the binaries this
# exists to add — @esbuild/linux-x64, lightningcss-linux-x64-gnu and
# @rollup/rollup-linux-x64-gnu were all still missing afterwards. A from-scratch
# resolve is what produces the complete set, at the cost of floating every
# dependency inside its declared semver range. Read the diff before committing:
# a float can enable a new lint rule or want a newer Playwright browser.
#
# Usage (from the repo root, in Git Bash / PowerShell):
#     npm run relock
#
set -euo pipefail

NODE_MAJOR=22                      # matches Netlify's build image
SCRATCH="$HOME/.cache/shadcn-relock"

repo_root() {
  # This script lives in <repo>/scripts.
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

REPO="$(repo_root)"

echo "[relock] repo    : $REPO"

# --- Node ------------------------------------------------------------------
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use "$NODE_MAJOR" >/dev/null 2>&1 || nvm install "$NODE_MAJOR" >/dev/null
fi

if [ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]; then
  echo "[relock] ERROR: need Node $NODE_MAJOR, found $(node -v)." >&2
  echo "[relock] Install it with: nvm install $NODE_MAJOR" >&2
  exit 1
fi

echo "[relock] node    : $(node -v)  npm $(npm -v)  ($(uname -s))"

# --- Stage the manifests ---------------------------------------------------
rm -rf "$SCRATCH"
mkdir -p "$SCRATCH"

# Every workspace manifest, plus the root one. `find` rather than `git ls-files`
# because a Windows-created worktree's .git points at a `D:/…` gitdir that Linux
# git cannot follow.
( cd "$REPO" && find . -maxdepth 3 -name package.json -not -path '*/node_modules/*' -not -path './dist/*' ) \
  | sed 's|^\./||' \
  | while IFS= read -r rel; do
      mkdir -p "$SCRATCH/$(dirname "$rel")"
      cp "$REPO/$rel" "$SCRATCH/$rel"
    done

echo "[relock] staged  : $(find "$SCRATCH" -name package.json | wc -l) manifest(s)"

# --- Resolve ---------------------------------------------------------------
# Two passes: after one pass npm can leave transitive entries out of the lock
# (rolldown, @oxc-project/types, @rolldown/pluginutils, @noble/hashes were all
# missing), and `npm ci` then rejects it as out of sync. The second converges.
cd "$SCRATCH"
echo "[relock] pass 1 …"
npm install --ignore-scripts --no-audit --no-fund >/dev/null
echo "[relock] pass 2 …"
npm install --ignore-scripts --no-audit --no-fund >/dev/null

# --- Verify before adopting ------------------------------------------------
node -e '
const lock = require("./package-lock.json");
const names = Object.keys(lock.packages).map(k => k.replace(/.*node_modules\//, ""));
const required = [
  "@esbuild/linux-x64", "@esbuild/win32-x64",
  "lightningcss-linux-x64-gnu", "lightningcss-win32-x64-msvc",
  "@rollup/rollup-linux-x64-gnu", "@rollup/rollup-win32-x64-msvc",
];
const missing = required.filter(r => !names.includes(r));
const RE = /(linux|darwin|win32|android|freebsd|openbsd|netbsd|sunos|aix|openharmony)[-_]/;
const platform = new Set(names.filter(n => RE.test(n)));
console.log("[relock] platform packages:", platform.size);
if (missing.length) {
  console.error("[relock] ERROR: lock is missing " + missing.join(", "));
  process.exit(1);
}
console.log("[relock] all required platform binaries present");
'

npm ci --dry-run >/dev/null 2>&1 \
  && echo "[relock] npm ci accepts the lockfile" \
  || { echo "[relock] ERROR: npm ci rejects the generated lockfile" >&2; exit 1; }

# --- Adopt -----------------------------------------------------------------
cp "$SCRATCH/package-lock.json" "$REPO/package-lock.json"
echo "[relock] wrote   : $REPO/package-lock.json"
echo "[relock] done. Review the diff, then run your usual install on Windows."
