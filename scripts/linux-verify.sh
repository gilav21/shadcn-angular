#!/usr/bin/env bash
#
# Run the test suites against the Linux install that netlify-repro.sh created.
#
# netlify-repro.sh proves the deploy builds; this proves the same lockfile also
# satisfies the unit tests, the CLI tests and the e2e suite on Linux, which is
# what CI runs. Reuses that script's scratch tree, so run it after.
#
# Usage (from the repo root):
#     npm run verify:linux
#
set -uo pipefail          # deliberately not -e: every stage should report

NODE_MAJOR=22
SCRATCH="$HOME/.cache/shadcn-netlify-repro"

if [ ! -d "$SCRATCH/node_modules" ]; then
  echo "[verify] no install at $SCRATCH — run scripts/netlify-repro.sh first" >&2
  exit 1
fi

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  nvm use "$NODE_MAJOR" >/dev/null 2>&1 || nvm install "$NODE_MAJOR" >/dev/null
fi

cd "$SCRATCH"
echo "[verify] node $(node -v) on $(uname -s), tree: $SCRATCH"

# The e2e runner restores its fixture app between specs with
# `git checkout HEAD -- e2e/fixture-app`, so the tree has to be a git
# repository. netlify-repro.sh clones the upstream repo to provide one WITH
# history; a single synthetic commit is enough for the fixture reset but not for
# migrate / migrate-build / doctor-lib-drift / rte-image-seam-upgrade, which
# search back through commits for a blob predating a marker.
if [ ! -e .git ]; then
  echo "[verify] WARNING: no git history here — expect 4 history-dependent e2e specs to fail"
  git init -q -b master
  git -c user.email=verify@example.com -c user.name=Verify add -A
  git -c user.email=verify@example.com -c user.name=Verify commit -qm "verify baseline" --no-verify
fi
git -c user.email=verify@example.com -c user.name=Verify add -A >/dev/null 2>&1 || true
git -c user.email=verify@example.com -c user.name=Verify commit -qm "verify: working tree under test" --no-verify >/dev/null 2>&1 || true
echo "[verify] HEAD $(git rev-parse --short HEAD), $(git rev-list --count HEAD) commit(s) of history"

# The browser suites need a Linux Chromium; the Windows download does not apply.
echo "[verify] installing chromium for playwright …"
npx playwright install chromium > /tmp/verify-pw.log 2>&1 \
  && echo "[verify] chromium: OK" \
  || { echo "[verify] chromium: FAILED"; tail -5 /tmp/verify-pw.log; }

run_stage() {
  local id="$1"; shift
  echo "[verify] ---- $id: running …"
  local start=$SECONDS
  if "$@" > "/tmp/verify-$id.log" 2>&1; then
    echo "[verify] ---- $id: PASS ($((SECONDS-start))s)"
    grep -aE "Tests +[0-9]+|Test Files|passed" "/tmp/verify-$id.log" | tail -2
    return 0
  fi
  echo "[verify] ---- $id: FAIL ($((SECONDS-start))s)"
  grep -aE "FAIL|✗|Error|error TS|Tests +[0-9]+" "/tmp/verify-$id.log" | head -15
  return 1
}

# Optional stage filter: `linux-verify.sh e2e` reruns just that one.
ONLY="${1:-all}"
want() { [ "$ONLY" = all ] || [ "$ONLY" = "$1" ]; }

rc=0
want cli  && { run_stage cli   npm run test:cli -- --run || rc=1; }
want unit && { run_stage unit  npm run test:ci           || rc=1; }
want e2e  && { run_stage e2e   npm run e2e               || rc=1; }

echo "[verify] ============================"
[ $rc -eq 0 ] && echo "[verify] ALL LINUX STAGES PASSED" || echo "[verify] SOME STAGES FAILED (logs in /tmp/verify-*.log)"
exit $rc
