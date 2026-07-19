import { spawnSync } from 'node:child_process';
import { rmSync, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const FIX = path.join(REPO, 'e2e/jest-fixture');
const CLI = path.join(REPO, 'packages/cli/dist/index.js');
const JEST = path.join(REPO, 'node_modules/jest/bin/jest.js');
const PT = path.join(REPO, 'packages/components/portable-tests.json');
const RESULTS = path.join(FIX, 'jest-results.json');

const cfg = JSON.parse(readFileSync(PT, 'utf8'));
const verified = cfg.verified;
// Addons (parent/addon keys) install via `add <base> --with <key>`, not a bare
// `add <key>`; base components install directly.
const bases = verified.filter((n) => !n.includes('/'));
const addonsByBase = {};
for (const n of verified) {
    if (!n.includes('/')) continue;
    const base = n.split('/')[0];
    addonsByBase[base] ??= [];
    addonsByBase[base].push(n);
}
console.log(`Round: installing ${bases.length} base components + ${verified.length - bases.length} addons into the jest fixture…`);
rmSync(path.join(FIX, 'src'), { recursive: true, force: true });
rmSync(path.join(FIX, 'components.lock.json'), { force: true });
const add = spawnSync(process.execPath, [CLI, 'add', ...bases, '--include-tests', '--yes'], { cwd: FIX, stdio: 'inherit' });
if (add.status !== 0) { console.error('base install failed'); process.exit(2); }
for (const [base, keys] of Object.entries(addonsByBase)) {
    // `--with` takes a single comma-separated list (not repeated flags).
    const r = spawnSync(process.execPath, [CLI, 'add', base, '--with', keys.join(','), '--include-tests', '--yes'], { cwd: FIX, stdio: 'inherit' });
    if (r.status !== 0) { console.error(`addon install failed for ${base}`); process.exit(2); }
}
const utils = path.join(FIX, 'src/components/lib/utils.ts');
if (!existsSync(utils)) { mkdirSync(path.dirname(utils), { recursive: true }); copyFileSync(path.join(REPO, 'packages/components/lib/utils.ts'), utils); }

spawnSync(process.execPath, [JEST, '--config', 'jest.config.cjs', '--json', `--outputFile=${RESULTS}`], { cwd: FIX, stdio: 'inherit' });
const res = JSON.parse(readFileSync(RESULTS, 'utf8'));
const failedFiles = res.testResults.filter((r) => r.status === 'failed').map((r) => r.name);
const compOf = (file) => {
    const p = file.split(path.sep).join('/');
    const am = p.match(/ui\/([^/]+)\/addons\/([^/]+)\//);
    if (am) return `${am[1]}/${am[2]}`;
    const m = p.match(/ui\/([^/]+)\//);
    return m ? m[1] : null;
};
const failedComps = new Set(failedFiles.map(compOf).filter(Boolean));

console.log(`\nTests: ${res.numFailedTests} failed / ${res.numTotalTests} total across ${res.numTotalTestSuites} suites.`);
if (failedComps.size === 0) { console.log('STABLE — all shipped specs pass jest.'); process.exit(0); }
console.log('Failing components:', [...failedComps].sort((a, b) => a.localeCompare(b)).join(', '));
const kept = verified.filter((n) => !failedComps.has(n));
const exc = { ...cfg.coverageExceptions };
for (const n of failedComps) delete exc[n];
writeFileSync(PT, JSON.stringify({ verified: kept, coverageExceptions: exc }, null, 2) + '\n');
console.log(`Dropped ${failedComps.size} → ${kept.length} verified remain.`);
process.exit(10);
