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
//   npm run preflight                 # all stages
//   npm run preflight -- --skip lint  # skip a stage by id (repeatable)
//   npm run preflight -- --list       # list stage ids
import { spawnSync } from 'node:child_process';

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
  const stages = STAGES.filter((stage) => !skips.has(stage.id));
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
