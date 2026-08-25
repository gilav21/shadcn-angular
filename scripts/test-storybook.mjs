// Storybook test-runner launcher — see .storybook/test-runner.ts.
// Boots a Storybook dev server (unless one is already listening), waits for its
// story index, runs @storybook/test-runner (play functions + axe a11y checks
// from the test-runner config) against it, then tears the server down.
//
// Two entry points, both running every story through a real browser:
//
//   npm run test-storybook        stories + play functions only (axe OFF), ~64s.
//   npm run test-storybook:a11y   the same run with axe a11y assertions ON — a strict
//                                 superset, and what the pre-push hook runs. Green
//                                 (926/926) and it must stay that way: fix the
//                                 component, never soften the assertion.
//   npm run a11y:staged           the axe run scoped to the staged components — the
//                                 pre-commit hook (see scripts/a11y-staged.mjs).
//
// Extra args pass through to the runner. Against a local Storybook the runner is not
// in index-json mode, so jest's test files ARE the story files and a positional arg is
// a testPathPattern regex over their paths:
//   npm run test-storybook -- button                      # only stories whose path matches /button/
//   npm run test-storybook -- --url http://localhost:6006 # reuse a running Storybook
//
// Env:
//   STORYBOOK_A11Y=1   force the axe assertions ON  (what :a11y sets)
//   STORYBOOK_A11Y=0   force the axe assertions OFF (the default)
// See .storybook/test-runner.ts for where axe is injected.
import { spawn, execFileSync } from 'node:child_process';

// Storybook's Webpack 5 bundle of ~130 Angular story files is slow to come up
// (tens of minutes on a cold cache on Windows), so the boot budget is generous —
// but it is still bounded, so a broken Storybook fails instead of hanging forever.
const BOOT_TIMEOUT_MS = 45 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
// Use `localhost`, not `127.0.0.1`: Storybook's dev server binds IPv6 (::1) here,
// so a hard-coded IPv4 probe never sees it come up.
const DEFAULT_URL = 'http://localhost:6006';

/**
 * How many story files run at once.
 *
 * `test-storybook` wraps Jest, whose default is one worker per CPU minus one.
 * Every worker drives its OWN Chromium against a SINGLE Storybook dev server,
 * so the default scales the client side of a client/server pair and nothing
 * else: on a 32-thread machine, 31 browsers queue on one server, the machine
 * becomes unusable, and `page.goto` starts timing out after 30s. Those show up
 * as "Test suite failed to run" — which reads like an accessibility failure and
 * is really just congestion.
 *
 * Four is well inside what one dev server serves comfortably. Raise it with
 * STORYBOOK_MAX_WORKERS if a machine can genuinely take more.
 */
const DEFAULT_MAX_WORKERS = 4;

function maxWorkersArg(existing) {
  if (existing.some((a) => a.startsWith('--maxWorkers'))) return [];
  const configured = Number.parseInt(process.env.STORYBOOK_MAX_WORKERS ?? '', 10);
  const workers = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_WORKERS;
  return [`--maxWorkers=${workers}`];
}

const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const url = urlFlag === -1 ? DEFAULT_URL : args[urlFlag + 1];
const runnerArgs = urlFlag === -1 ? args : [...args.slice(0, urlFlag), ...args.slice(urlFlag + 2)];

const isWindows = process.platform === 'win32';

async function isUp() {
  try {
    const res = await fetch(`${url}/index.json`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    // Connection refused / timeout while Storybook is still compiling — not up yet.
    return false;
  }
}

async function waitForStorybook(child) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Storybook exited with code ${child.exitCode} before it was ready.`);
    }
    if (await isUp()) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Storybook did not become ready at ${url} within ${BOOT_TIMEOUT_MS / 1000}s.`);
}

function startStorybook() {
  console.log(`[test-storybook] booting Storybook at ${url} …`);
  return spawn(
    'npx',
    ['ng', 'run', 'demo:storybook', '--ci', '--quiet'],
    { stdio: ['ignore', 'inherit', 'inherit'], shell: isWindows },
  );
}

// Must be synchronous: an async kill races `process.exit()` below, which on Windows
// leaves the Storybook tree alive holding the inherited stdout pipe open — the run
// then never terminates for whatever is reading it.
function stopStorybook(child) {
  if (!child || child.exitCode !== null) return;
  if (isWindows) {
    try {
      // /T kills the whole tree: `npx` → `ng` → the Storybook dev server.
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Already gone (or never started) — nothing left to kill.
    }
  } else {
    child.kill('SIGTERM');
  }
}

// Auditing a story with axe costs far more than just rendering it — the biggest
// ones (a 10k-row virtualised data table) blow past the runner's default 15s
// per-test budget on the axe pass alone. Raise the ceiling for that pass only, so
// a slow audit is reported as an a11y result rather than a timeout. This is a time
// budget, not a relaxation of what axe checks.
const A11Y_TEST_TIMEOUT_MS = 90_000;

function runTestRunner() {
  const timeoutArgs =
    process.env.STORYBOOK_A11Y === '1' && !runnerArgs.some((a) => a.startsWith('--testTimeout'))
      ? [`--testTimeout=${A11Y_TEST_TIMEOUT_MS}`]
      : [];

  return new Promise((resolve) => {
    const runner = spawn(
      'npx',
      ['test-storybook', '--url', url, ...maxWorkersArg(runnerArgs), ...timeoutArgs, ...runnerArgs],
      { stdio: 'inherit', shell: isWindows },
    );
    runner.on('exit', (code) => resolve(code ?? 1));
  });
}

let storybook;
let exitCode = 1;
const started = Date.now();

try {
  if (await isUp()) {
    console.log(`[test-storybook] reusing the Storybook already listening at ${url}.`);
  } else {
    storybook = startStorybook();
    await waitForStorybook(storybook);
  }
  console.log(`[test-storybook] Storybook ready after ${Math.round((Date.now() - started) / 1000)}s — running stories.`);
  exitCode = await runTestRunner();
} catch (error) {
  console.error(`[test-storybook] ${error.message}`);
  exitCode = 1;
} finally {
  stopStorybook(storybook);
}

console.log(`[test-storybook] finished in ${Math.round((Date.now() - started) / 1000)}s (exit ${exitCode}).`);
process.exit(exitCode);
