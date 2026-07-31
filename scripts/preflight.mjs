// The full local gate. CI is deliberately minimal (one workflow: e2e.yml) —
// everything else is verified HERE, on the maintainer's machine, before the
// code leaves it. `npm run preflight` is what the pre-push hook runs, and what
// `npm run release:cli` runs before it publishes.
//
// Stages run cheapest-first and fail fast: a lint error costs ~40s, not a full
// unit-test run. Each stage's wall-clock is printed, and the final summary
// names the stage that failed.
//
// Usage:
//   npm run preflight                     # all stages, full scope
//   npm run preflight -- --since <ref>    # scope to what this branch adds
//   npm run preflight -- --skip lint      # skip a stage by id (repeatable)
//   npm run preflight -- --list           # list stage ids
//
// `--since` is what the pre-push hook uses. The full run stays the default so
// `release:cli` and a deliberate `npm run preflight` keep their teeth — notably
// the coverage ratchets, which only evaluate under `--coverage` on a full run
// and are therefore a RELEASE gate, not a per-push one.
import { execFileSync, spawnSync } from 'node:child_process';

/** @typedef {{ id: string, label: string, command: string }} Stage */

/**
 * Commands are run through the shell: on Windows `npm`/`npx` are `.cmd`
 * shims, which Node refuses to spawn with `shell: false` (EINVAL since the
 * CVE-2024-27980 fix). Every command here is a hard-coded literal — no user
 * input reaches the shell.
 *
 * @type {Stage[]}
 */
const STAGES = [
  { id: 'lint', label: 'ESLint + tsc + Angular template typecheck', command: 'npm run check:all' },
  { id: 'registry', label: 'Registry drift (sync-registry, report mode)', command: 'npm run check:registry' },
  { id: 'completeness', label: 'Story / demo-route / e2e completeness gate', command: 'npm run check:completeness' },
  // Both test stages run WITH coverage on purpose: the ratchets in vitest.config.ts /
  // vitest.config.cli.ts only evaluate under `--coverage`, and nothing else invokes
  // them (there is no CI). Without this, a contributor could delete half the tests
  // and every local gate would still pass. Measured cost of the coverage instrument-
  // ation: CLI 5s → 6s, component suite 50s → 69s (2026-07-13, warm).
  { id: 'test-cli', label: 'CLI unit tests + coverage ratchet', command: 'npm run coverage:cli' },
  { id: 'test', label: 'Component unit tests (headless browser) + coverage ratchet', command: 'npm run test:ci:coverage' },
];

/**
 * Files whose blast radius is the whole repo, so `--since` gives up on scoping
 * and runs the full stages. Mirrors the spirit of e2e/orchestrator/impact.ts:
 * shared lib and tooling can break anything, so a scoped pass there is a false
 * green.
 */
const TRIPWIRES = [
  /^packages\/components\/lib\//,
  /^packages\/cli\//,
  /^vitest\.config/,
  /^tsconfig/,
  /^eslint\.config\.mjs$/,
  /^package(-lock)?\.json$/,
  /^scripts\//,
];

/**
 * Repo-relative paths are the only thing interpolated into a shell command
 * here, so they are held to a conservative charset. Anything outside it (a
 * quote, a space, a shell metacharacter) makes the caller fall back to the
 * unscoped command rather than build a command line out of it.
 */
const SAFE_PATH = /^[\w./-]+$/;

/** Cap on interpolated paths — Windows command lines die past ~8k chars. */
const MAX_SCOPED_FILES = 60;

/** @returns {string[]} paths this branch adds on top of `base`. */
function changedSince(base) {
  const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], {
    encoding: 'utf8',
  });
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * The full stage list as `--since` runs it: everything, but with the component
 * suite UNINSTRUMENTED. Coverage instrumentation inflates setup/import from
 * seconds to minutes across ~370 files and pushes timing-sensitive specs past
 * their timeouts, so the gate starts failing on the instrumentation rather than
 * on the code. The ratchet needs a full `npm run coverage` to mean anything and
 * gates releases; `--since` is the push-time gate and never instruments.
 *
 * @returns {Stage[]}
 */
function fullStagesUninstrumented() {
  return STAGES.map((stage) => (stage.id === 'test'
    ? { ...stage, label: 'Component unit tests (headless browser)', command: 'npm run test:ci' }
    : stage));
}

/**
 * The stage list for an impacted run, or `null` when the diff trips a wire (or
 * is too large / too odd to scope safely) and the caller should run everything.
 *
 * @param {string} base
 * @returns {Stage[] | null}
 */
function impactedStages(base) {
  const changed = changedSince(base);
  if (changed.length === 0) return [];
  if (changed.some((f) => TRIPWIRES.some((t) => t.test(f)))) return null;
  if (changed.some((f) => !SAFE_PATH.test(f))) return null;

  const lintable = changed.filter((f) => /\.(ts|mts|cts|js|mjs|cjs)$/.test(f));
  if (lintable.length > MAX_SCOPED_FILES) return null;

  const stages = [];
  if (lintable.length > 0) {
    stages.push({
      id: 'lint',
      label: `ESLint (${lintable.length} changed file(s))`,
      command: `npx eslint ${lintable.join(' ')}`,
    });
  }
  // Whole-program by nature: a changed file can break a type anywhere, so these
  // are NOT scoped. They are the floor on how fast this hook can get.
  stages.push(
    { id: 'typecheck', label: 'tsc + Angular template typecheck', command: 'npm run typecheck && npm run typecheck:templates' },
    { id: 'registry', label: 'Registry drift (sync-registry, report mode)', command: 'npm run check:registry' },
    { id: 'completeness', label: 'Story / demo-route / e2e completeness gate', command: 'npm run check:completeness' },
    // No --coverage: the ratchet needs a full run to mean anything. See header.
    { id: 'test', label: 'Component unit tests related to the diff', command: `npm run test:ci -- --changed ${base}` },
  );
  return stages;
}

function parseSkips(argv) {
  const skips = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--skip' && argv[i + 1]) skips.add(argv[i + 1]);
  }
  return skips;
}

function formatDuration(ms) {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
}

function runStage(stage, index, total) {
  console.log(`\n──── [${index}/${total}] ${stage.id} — ${stage.label}\n`);
  const startedAt = Date.now();
  const result = spawnSync(stage.command, { stdio: 'inherit', shell: true });
  const elapsed = Date.now() - startedAt;
  const failed = result.status !== 0 || result.error !== undefined;
  if (result.error) console.error(result.error.message);
  return { stage, elapsed, failed };
}

function printSummary(results, totalMs) {
  console.log('\n════ preflight summary ════');
  for (const { stage, elapsed, failed } of results) {
    console.log(`  ${failed ? 'FAIL' : 'pass'}  ${stage.id.padEnd(13)} ${formatDuration(elapsed)}`);
  }
  console.log(`  total: ${formatDuration(totalMs)}`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    for (const stage of STAGES) console.log(`${stage.id.padEnd(13)} ${stage.label}`);
    return;
  }

  const skips = parseSkips(argv);
  const sinceIndex = argv.indexOf('--since');
  const base = sinceIndex === -1 ? null : argv[sinceIndex + 1];

  let selected = STAGES;
  if (base) {
    const impacted = impactedStages(base);
    if (impacted === null) {
      console.log(`[preflight] diff vs ${base} touches shared/tooling files — running the FULL gate (no coverage).`);
      selected = fullStagesUninstrumented();
    } else if (impacted.length === 0) {
      console.log(`[preflight] no changes vs ${base} — nothing to verify.`);
      return;
    } else {
      console.log(`[preflight] scoped to the diff vs ${base}.`);
      selected = impacted;
    }
  }

  const stages = selected.filter((stage) => !skips.has(stage.id));
  const results = [];
  const startedAt = Date.now();

  for (const [index, stage] of stages.entries()) {
    const result = runStage(stage, index + 1, stages.length);
    results.push(result);
    if (result.failed) {
      printSummary(results, Date.now() - startedAt);
      console.error(`\npreflight FAILED at stage "${stage.id}" — ${stage.label}`);
      console.error('Fix it and re-run `npm run preflight`. Skipped stages did not run.');
      process.exit(1);
    }
  }

  printSummary(results, Date.now() - startedAt);
  if (skips.size > 0) console.log(`  skipped: ${[...skips].join(', ')}`);
  console.log('\npreflight PASSED.');
}

main();
