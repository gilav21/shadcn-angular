import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/**
 * Cross the branch diff against both lcov reports to list the lines this
 * branch ADDED that no test executes. Summary percentages cannot answer
 * "which of my new lines are untested" — this can.
 */

const base = process.argv[2] ?? 'master';

/** Add every line number a `@@ -a,b +c,d @@` hunk header introduces. */
function addHunkLines(target, header) {
  const m = /\+(\d+)(?:,(\d+))?/.exec(header);
  if (!m) return;
  const start = +m[1];
  const count = m[2] === undefined ? 1 : +m[2];
  for (let i = 0; i < count; i++) target.add(start + i);
}

/** Map each changed file to the set of line numbers this branch added. */
function changedLines() {
  const out = execFileSync('git', ['diff', '-U0', '--ignore-cr-at-eol', `${base}...HEAD`], { encoding: 'utf8', maxBuffer: 1e9 });
  const byFile = new Map();
  let file = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('+++ b/')) {
      file = line.slice(6).trim();
      if (!byFile.has(file)) byFile.set(file, new Set());
    } else if (line.startsWith('@@') && file) {
      addHunkLines(byFile.get(file), line);
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

/**
 * True when Sonar would analyse this path: `sonar.sources=packages` minus the
 * exclusions in sonar-project.properties (specs, stories, fixtures, the staged
 * package trees and any *.config.ts).
 */
function isAnalysedSource(file) {
  if (!file.endsWith('.ts')) return false;
  if (/\.spec\.ts$|\.stories\.ts$|-fixtures\.ts$/.test(file)) return false;
  if (!file.startsWith('packages/')) return false;
  if (/^packages\/[^/]*-package\/src\//.test(file)) return false;
  return !/\.config\.[^/]*ts$/.test(file);
}

/** One file's added-line tally against its coverage record. */
function tally(file, lines, record) {
  if (!record) return { file, added: lines.size, miss: lines.size, noReport: true };
  const instrumented = [...lines].filter(l => record.uncovered.has(l) || record.covered.has(l));
  if (!instrumented.length) return null;
  const miss = instrumented.filter(l => record.uncovered.has(l));
  return { file, added: instrumented.length, miss: miss.length, lines: miss.slice(0, 8) };
}

const rows = [];
let totalNew = 0, totalMiss = 0;
for (const [file, lines] of changed) {
  if (!isAnalysedSource(file)) continue;
  const row = tally(file, lines, cov.get(file));
  if (!row) continue;
  totalNew += row.added;
  totalMiss += row.miss;
  if (row.miss) rows.push(row);
}

rows.sort((a, b) => b.miss - a.miss);
console.log(`\nNEW-CODE COVERAGE vs ${base}`);
console.log(`instrumented new lines: ${totalNew} | uncovered: ${totalMiss} | covered: ${((1 - totalMiss / (totalNew || 1)) * 100).toFixed(2)}%\n`);
console.log('miss / added  file');
for (const r of rows) {
  console.log(String(r.miss).padStart(4) + ' /' + String(r.added).padStart(5), ' ' + r.file + (r.noReport ? '   [NO COVERAGE REPORT — never imported by a test]' : ''));
  if (r.lines) console.log('              lines: ' + r.lines.join(', ') + (r.miss > 8 ? ' …' : ''));
}
