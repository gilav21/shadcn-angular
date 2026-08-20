import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Lists open SonarQube issues for exactly the files this bundle touched.
 * Temporary tooling — deleted once the gate is closed.
 *
 * Per-FILE queries rather than one project query: the project's
 * `**\/coverage/**` exclusion misses `coverage-*\/`, so the generated
 * lcov-report HTML contributes ~43k junk issues that swamp any project-wide
 * search. Verified against a control file known to have issues.
 */
const token = /^SONAR_TOKEN=(.*)$/m.exec(readFileSync('.env', 'utf8'))?.[1]?.trim();
const auth = 'Basic ' + Buffer.from(`${token}:`).toString('base64');
const key = process.argv[2] ?? 'shadcn-angular-component-features';
const base = 'http://localhost:9000';

const files = execSync('git diff --name-only 4232d229..HEAD', { encoding: 'utf8' })
    .split('\n')
    .map(f => f.trim())
    .filter(Boolean)
    .filter(f => f.startsWith('packages/components/') || f.startsWith('demo/src/'))
    .filter(f => !f.endsWith('registry.json'));

console.log(`checking ${files.length} changed files\n`);

let found = 0;
for (const f of files) {
    const url = `${base}/api/issues/search?componentKeys=${encodeURIComponent(`${key}:${f}`)}&resolved=false&ps=100`;
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) { console.log(`  ?? ${f} — ${res.status}`); continue; }
    const json = await res.json();
    if (json.total === 0) continue;
    found += json.total;
    console.log(`${f} — ${json.total} issue(s)`);
    for (const i of json.issues) {
        console.log(`   ${i.severity} ${i.rule} :${i.line ?? '-'}  ${i.message}`);
    }
}

console.log(found === 0 ? '\nCLEAN — 0 open issues on changed files' : `\nTOTAL ${found} issue(s) to fix`);
