// `npm run coverage` — both coverage legs, then the lcov path fix, then a
// fingerprint of the tree they measured.
//
// The two legs are independent (the CLI suite is plain node, the component
// suite is a headless browser), so they run at the same time: measured
// 2026-09-03, browser 100s + CLI 16s in sequence became ~100s together. The
// browser leg streams to the terminal; the CLI leg is captured and printed
// after it, so the two summaries do not interleave.
//
// The fingerprint (`coverage/.tree-hash`, see tree-hash.mjs) is written only
// when both legs pass. `npm run sonar` compares it to the tree it is about to
// scan, and `npm run sonar:gate` uses it to skip a re-run when nothing changed.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { treeHash } from './tree-hash.mjs';

const VITEST = join('node_modules', 'vitest', 'vitest.mjs');
export const TREE_HASH_FILE = join('coverage', '.tree-hash');

function run(args, { capture }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [VITEST, ...args], {
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let output = '';
    if (capture) {
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
    }
    child.on('exit', (code) => resolve({ code: code ?? 1, output }));
  });
}

const startedAt = Date.now();
const [browser, cli] = await Promise.all([
  run(['--run', '--coverage'], { capture: false }),
  run(['--config', 'vitest.config.cli.ts', '--run', '--coverage'], { capture: true }),
]);

process.stdout.write(`\n──── CLI suite (ran alongside the browser suite)\n${cli.output}`);

const fix = spawnSync(process.execPath, [join('scripts', 'fix-lcov.mjs')], { stdio: 'inherit' });
const failed = browser.code !== 0 || cli.code !== 0 || fix.status !== 0;
const elapsed = Math.round((Date.now() - startedAt) / 1000);

if (failed) {
  console.error(`\n[coverage] FAILED after ${elapsed}s (browser exit ${browser.code}, cli exit ${cli.code}) — no tree fingerprint written, so \`npm run sonar\` will report this coverage as stale.`);
  process.exit(1);
}

mkdirSync('coverage', { recursive: true });
writeFileSync(TREE_HASH_FILE, `${treeHash()}\n`, 'utf8');
console.log(`\n[coverage] both legs passed in ${elapsed}s; tree fingerprint written to ${TREE_HASH_FILE}.`);
