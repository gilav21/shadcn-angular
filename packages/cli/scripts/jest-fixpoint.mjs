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
console.log(`Round: installing ${verified.length} components into the jest fixture…`);
rmSync(path.join(FIX, 'src'), { recursive: true, force: true });
rmSync(path.join(FIX, 'components.lock.json'), { force: true });
const add = spawnSync(process.execPath, [CLI, 'add', ...verified, '--include-tests', '--yes'], { cwd: FIX, stdio: 'inherit' });
if (add.status !== 0) { console.error('install failed'); process.exit(2); }
const utils = path.join(FIX, 'src/components/lib/utils.ts');
if (!existsSync(utils)) { mkdirSync(path.dirname(utils), { recursive: true }); copyFileSync(path.join(REPO, 'packages/components/lib/utils.ts'), utils); }

spawnSync(process.execPath, [JEST, '--config', 'jest.config.cjs', '--json', `--outputFile=${RESULTS}`], { cwd: FIX, stdio: 'inherit' });
const res = JSON.parse(readFileSync(RESULTS, 'utf8'));
const failedFiles = res.testResults.filter((r) => r.status === 'failed').map((r) => r.name);
const compOf = (file) => {
    const m = file.split(path.sep).join('/').match(/ui\/([^/]+)\//);
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
