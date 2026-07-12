// Storybook test-runner launcher — see .storybook/test-runner.ts.
// Boots a Storybook dev server (unless one is already listening), waits for its
// story index, runs @storybook/test-runner (play functions + axe a11y checks
// from the test-runner config) against it, then tears the server down.
//
// Two entry points, both running every story through a real browser:
//
//   npm run test-storybook        stories + play functions only (axe OFF). Green,
//                                 ~64s — this is the pre-push gate.
//   npm run test-storybook:a11y   the same run with axe a11y assertions ON. RED today:
//                                 the library has a real a11y backlog, tracked in
//                                 docs/a11y-backlog.md. It is meant to fail until that
//                                 debt is paid — do not soften it to make it pass.
//
// Extra args pass through to the runner:
//   npm run test-storybook -- button                      # Jest name filter
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

function runTestRunner() {
  return new Promise((resolve) => {
    const runner = spawn(
      'npx',
      ['test-storybook', '--url', url, ...runnerArgs],
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
