import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/**
 * Cross the branch diff against both lcov reports to list the lines this
 * branch ADDED that no test executes. Summary percentages cannot answer
 * "which of my new lines are untested" — this can.
 */

const base = process.argv[2] ?? 'master';

function changedLines() {
  const out = execFileSync('git', ['diff', '-U0', '--ignore-cr-at-eol', `${base}...HEAD`], { encoding: 'utf8', maxBuffer: 1e9 });
  const byFile = new Map();
  let file = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('+++ b/')) { file = line.slice(6).trim(); if (!byFile.has(file)) byFile.set(file, new Set()); }
    else if (line.startsWith('@@') && file) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (m) { const start = +m[1], count = m[2] === undefined ? 1 : +m[2]; for (let i = 0; i < count; i++) byFile.get(file).add(start + i); }
    }
  }
  return byFile;
}

function lcovUncovered(p) {
  const map = new Map();
  if (!fs.existsSync(p)) return map;
  let cur = null;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      cur = line.slice(3).replaceAll('\\', '/');
      const i = cur.search(/(packages|demo|e2e|scripts)\//);
      cur = i >= 0 ? cur.slice(i) : cur;
      if (!map.has(cur)) map.set(cur, { uncovered: new Set(), covered: new Set() });
    } else if (line.startsWith('DA:') && cur) {
      const [ln, hits] = line.slice(3).split(',');
      map.get(cur)[+hits === 0 ? 'uncovered' : 'covered'].add(+ln);
    }
  }
  return map;
}

const changed = changedLines();
const cov = new Map([...lcovUncovered('coverage/lcov.info'), ...lcovUncovered('coverage-cli/lcov.info')]);

const rows = [];
let totalNew = 0, totalMiss = 0;
for (const [file, lines] of changed) {
  if (!/\.ts$/.test(file)) continue;
  if (/\.spec\.ts$|\.stories\.ts$|-fixtures\.ts$/.test(file)) continue;
  // Match sonar-project.properties: sources=packages, minus its exclusions.
  if (!file.startsWith('packages/')) continue;
  if (/^packages\/[^/]*-package\/src\//.test(file)) continue;
  if (/\.config\.[^/]*ts$/.test(file)) continue;
  const c = cov.get(file);
  if (!c) { rows.push({ file, added: lines.size, miss: lines.size, noReport: true }); totalNew += lines.size; totalMiss += lines.size; continue; }
  const instrumented = [...lines].filter(l => c.uncovered.has(l) || c.covered.has(l));
  const miss = instrumented.filter(l => c.uncovered.has(l));
  if (!instrumented.length) continue;
  totalNew += instrumented.length; totalMiss += miss.length;
  if (miss.length) rows.push({ file, added: instrumented.length, miss: miss.length, lines: miss.slice(0, 8) });
}

rows.sort((a, b) => b.miss - a.miss);
console.log(`\nNEW-CODE COVERAGE vs ${base}`);
console.log(`instrumented new lines: ${totalNew} | uncovered: ${totalMiss} | covered: ${((1 - totalMiss / (totalNew || 1)) * 100).toFixed(2)}%\n`);
console.log('miss / added  file');
for (const r of rows) {
  console.log(String(r.miss).padStart(4) + ' /' + String(r.added).padStart(5), ' ' + r.file + (r.noReport ? '   [NO COVERAGE REPORT — never imported by a test]' : ''));
  if (r.lines) console.log('              lines: ' + r.lines.join(', ') + (r.miss > 8 ? ' …' : ''));
}
