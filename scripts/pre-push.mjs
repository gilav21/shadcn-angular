// The pre-push gate. Runs the SAME checks as `npm run preflight` + the axe
// pass, but scoped to what the branch actually adds — because an 8-minute hook
// is one that gets bypassed, and a bypassed hook protects nothing.
//
// Scope comes from the merge-base with the integration branch, so it is "what
// this branch adds", not "what the last commit touched": rebasing or amending
// cannot shrink the audited set.
//
// Scoping is given up (full gate) when the diff touches shared lib or tooling —
// see TRIPWIRES in preflight.mjs. The coverage ratchets deliberately do NOT run
// here; they need a full `npm run coverage` and gate releases instead.
import { execFileSync, spawnSync } from 'node:child_process';

const INTEGRATION_BRANCHES = ['origin/master', 'origin/main', 'master', 'main'];

function tryGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * The commit this branch forked from. Prefers the upstream of the current
 * branch (correct for a long-lived feature branch pushed repeatedly), then
 * falls back to the integration branch.
 *
 * @returns {string | null} null when no base can be resolved — caller runs the full gate.
 */
function resolveBase() {
  const upstream = tryGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const candidates = upstream ? [upstream, ...INTEGRATION_BRANCHES] : INTEGRATION_BRANCHES;
  for (const candidate of candidates) {
    if (!tryGit(['rev-parse', '--verify', '--quiet', candidate])) continue;
    const mergeBase = tryGit(['merge-base', candidate, 'HEAD']);
    if (mergeBase) return mergeBase;
  }
  return null;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

/**
 * Fallback for when no base ref resolves (detached HEAD, no remote): run every
 * stage, still without the coverage ratchet — same policy as `--since`, just
 * without a diff to scope by. `--skip test` drops preflight's instrumented
 * suite; `test:ci` runs the same suite uninstrumented in its place.
 */
function runFullGate() {
  return run('npm', ['run', 'preflight', '--', '--skip', 'test'])
    || run('npm', ['run', 'test:ci'])
    || run('npm', ['run', 'test-storybook:a11y']);
}

const base = resolveBase();

if (base === null) {
  console.log('[pre-push] no base ref resolved — running the FULL gate.');
  process.exit(runFullGate());
}

console.log(`[pre-push] scoping to changes since ${base.slice(0, 8)}.`);

// `preflight --since` handles both shapes itself: scoped when the diff is
// ordinary, full-but-uninstrumented when it trips a tripwire. Either way it
// never runs the coverage ratchet — that belongs to `npm run coverage`.
const preflight = run('npm', ['run', 'preflight', '--', '--since', base]);
if (preflight !== 0) process.exit(preflight);

process.exit(run('node', ['scripts/a11y-staged.mjs', '--since', base]));
