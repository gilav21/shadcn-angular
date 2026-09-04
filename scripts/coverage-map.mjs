import fs from 'node:fs';

/** lcov counter prefixes mapped to the record field each one fills. */
const COUNTERS = { 'LF:': 'lf', 'LH:': 'lh', 'BRF:': 'brf', 'BRH:': 'brh', 'FNF:': 'fnf', 'FNH:': 'fnh' };

function emptyRecord(file) {
  return { file: file.replaceAll('\\', '/'), lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0, uncovered: [] };
}

/** Apply one non-`SF:` lcov line to the record being built. */
function applyLine(cur, line) {
  for (const [prefix, field] of Object.entries(COUNTERS)) {
    if (line.startsWith(prefix)) { cur[field] = +line.slice(prefix.length); return; }
  }
  if (!line.startsWith('DA:')) return;
  const [ln, hits] = line.slice(3).split(',');
  if (+hits === 0) cur.uncovered.push(+ln);
}

/** Parse an lcov file into per-file records. */
function parseLcov(p) {
  if (!fs.existsSync(p)) return [];
  const out = [];
  let cur = null;
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('SF:')) cur = emptyRecord(line.slice(3));
    else if (!cur) continue;
    else if (line === 'end_of_record') { out.push(cur); cur = null; }
    else applyLine(cur, line);
  }
  return out;
}

function pct(a, b) { return b ? (a / b) * 100 : 100; }

function report(label, path, topN) {
  const recs = parseLcov(path);
  if (!recs.length) { console.log(`\n${label}: report missing at ${path}`); return; }
  const tot = recs.reduce((a, r) => ({
    lf: a.lf + r.lf, lh: a.lh + r.lh, brf: a.brf + r.brf, brh: a.brh + r.brh, fnf: a.fnf + r.fnf, fnh: a.fnh + r.fnh,
  }), { lf: 0, lh: 0, brf: 0, brh: 0, fnf: 0, fnh: 0 });

  console.log(`\n${'='.repeat(78)}\n${label}\n${'='.repeat(78)}`);
  console.log(`files ${recs.length} | lines ${pct(tot.lh, tot.lf).toFixed(2)}% (${tot.lf - tot.lh} uncovered of ${tot.lf})`);
  console.log(`branches ${pct(tot.brh, tot.brf).toFixed(2)}% (${tot.brf - tot.brh} uncovered of ${tot.brf}) | funcs ${pct(tot.fnh, tot.fnf).toFixed(2)}% (${tot.fnf - tot.fnh} uncovered of ${tot.fnf})`);

  const missing = recs.map(r => ({ ...r, miss: r.lf - r.lh, pctL: pct(r.lh, r.lf) }))
    .filter(r => r.miss > 0)
    .sort((a, b) => b.miss - a.miss);

  console.log(`\n-- Top ${topN} files by UNCOVERED LINES (absolute) --`);
  console.log('miss  line%   branch%  file');
  for (const r of missing.slice(0, topN)) {
    console.log(
      String(r.miss).padStart(4),
      (r.pctL.toFixed(1) + '%').padStart(6),
      (pct(r.brh, r.brf).toFixed(1) + '%').padStart(8),
      ' ' + r.file.replace(/^.*?(packages|demo|e2e|scripts)\//, '$1/'),
    );
  }

  const cum = missing.reduce((a, r) => a + r.miss, 0);
  let running = 0, n80 = 0;
  for (const r of missing) { running += r.miss; n80++; if (running >= cum * 0.8) break; }
  console.log(`\nConcentration: ${n80} files hold 80% of all uncovered lines (${cum} total across ${missing.length} files).`);

  const zero = missing.filter(r => r.lh === 0);
  if (zero.length) {
    console.log(`\n-- ${zero.length} files with ZERO coverage (never imported by a test) --`);
    for (const r of zero.slice(0, 20)) console.log(String(r.lf).padStart(5), 'lines  ' + r.file.replace(/^.*?(packages|demo|e2e|scripts)\//, '$1/'));
  }
  return { recs, missing };
}

const topN = Number(process.argv[2] ?? 25);
report('CLI  (packages/cli)', 'coverage-cli/lcov.info', topN);
report('COMPONENTS (packages/components)', 'coverage/lcov.info', topN);
