#!/usr/bin/env bash
#
# Reproduce Netlify's deploy build locally, under Linux, from inside WSL.
#
# Netlify builds on Ubuntu with Node 22 and installs from the committed
# lockfile, so a build that only ever runs on Windows cannot tell you whether
# the deploy will work. This copies the working tree into the Linux filesystem
# (without node_modules, so the install is genuinely fresh), installs the way
# Netlify does, and runs Netlify's build command.
#
# Usage (from the repo root):
#     npm run verify:netlify
#
set -euo pipefail

NODE_MAJOR=22
SCRATCH="$HOME/.cache/shadcn-netlify-repro"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use "$NODE_MAJOR" >/dev/null 2>&1 || nvm install "$NODE_MAJOR" >/dev/null
fi

echo "[netlify] node $(node -v), npm $(npm -v) on $(uname -s)"

# Clone first, then overlay the working tree. The clone is what gives the
# scratch real git history: four e2e specs (migrate, migrate-build,
# doctor-lib-drift, rte-image-seam-upgrade) walk back through commits looking
# for a blob that predates a marker, and they cannot pass against a tree with a
# single synthetic commit. The overlay is what makes it the tree you are
# actually testing, uncommitted changes included.
UPSTREAM="${SHADCN_UPSTREAM:-/mnt/d/Development/shadcd/shadcn-angular}"

rm -rf "$SCRATCH"
if [ -d "$UPSTREAM/.git" ]; then
  echo "[netlify] cloning $UPSTREAM (for git history) …"
  git clone -q --no-checkout "$UPSTREAM" "$SCRATCH"
  git -C "$SCRATCH" checkout -q --detach HEAD 2>/dev/null || true
else
  echo "[netlify] WARNING: no upstream repo at $UPSTREAM — history-dependent e2e specs will fail"
  mkdir -p "$SCRATCH"
fi

echo "[netlify] overlaying the working tree (excluding node_modules) …"
tar -C "$REPO" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    --exclude=coverage \
    --exclude=coverage-cli \
    --exclude=.angular \
    --exclude=storybook-static \
    -cf - . | tar -C "$SCRATCH" -xf -

cd "$SCRATCH"
echo "[netlify] npm ci …"
if npm ci --no-audit --no-fund > /tmp/netlify-install.log 2>&1; then
  echo "[netlify] npm ci: OK"
else
  echo "[netlify] npm ci: FAILED"
  tail -20 /tmp/netlify-install.log
  exit 1
fi

echo "[netlify] linux binaries actually installed:"
for p in node_modules/@esbuild/linux-x64 node_modules/lightningcss; do
  [ -e "$p" ] && echo "   present: $p" || echo "   MISSING: $p"
done

echo "[netlify] npm --workspace demo run build …"
if npm --workspace demo run build > /tmp/netlify-build.log 2>&1; then
  echo "[netlify] BUILD OK"
  echo "[netlify] output: $(find dist/demo/browser -type f 2>/dev/null | wc -l) files in dist/demo/browser"
  exit 0
fi

echo "[netlify] BUILD FAILED"
tail -30 /tmp/netlify-build.log
exit 1
