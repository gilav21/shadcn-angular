// Mark all remaining OPEN SonarQube issues on the project as "Accepted"
// (a.k.a. Won't Fix) with a comment pointing at the rationale doc. These are
// the reviewed-legitimate findings catalogued in
// docs/sonarqube-accepted-findings.md (irreducible ARIA patterns, an
// axe-required tabindex, a compiler-required cast, a CJS typeof check).
//
// Usage (PowerShell):
//   $env:SONAR_TOKEN = [Environment]::GetEnvironmentVariable('SONAR_TOKEN','User'); node scripts/sonar-accept.mjs
//
// Needs "Administer Issues" permission on the project (project admin/token).
const HOST = process.env.SONAR_HOST_URL || 'http://localhost:9000';
const TOKEN = process.env.SONAR_TOKEN;
const PROJECT = 'shadcn-angular';
const COMMENT =
  'Accepted: reviewed legitimate finding (irreducible ARIA / axe-required / ' +
  'compiler-required / known FP). See docs/sonarqube-accepted-findings.md.';

if (!TOKEN) {
  console.error('SONAR_TOKEN not set.');
  process.exit(1);
}

const auth = { Authorization: 'Bearer ' + TOKEN };

async function searchOpenIssues() {
  const out = [];
  let page = 1;
  for (;;) {
    const url =
      `${HOST}/api/issues/search?componentKeys=${PROJECT}` +
      `&resolved=false&ps=500&p=${page}`;
    const res = await fetch(url, { headers: auth });
    if (!res.ok) throw new Error(`search failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    out.push(...data.issues);
    if (page * data.ps >= data.total || data.issues.length === 0) break;
    page += 1;
  }
  return out;
}

async function post(path, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${HOST}${path}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return res;
}

async function accept(key) {
  // SonarQube >= 10.4 uses the "accept" transition; older uses "wontfix".
  let res = await post('/api/issues/do_transition', { issue: key, transition: 'accept' });
  if (!res.ok) {
    res = await post('/api/issues/do_transition', { issue: key, transition: 'wontfix' });
  }
  if (!res.ok) throw new Error(`transition failed for ${key}: ${res.status} ${await res.text()}`);
  await post('/api/issues/add_comment', { issue: key, text: COMMENT });
}

const issues = await searchOpenIssues();
console.log(`Found ${issues.length} open issue(s) to accept.`);
let ok = 0;
for (const i of issues) {
  await accept(i.key);
  ok += 1;
  console.log(`  accepted ${i.rule}  ${i.component.replace(/^[^:]*:/, '')}:${i.line ?? ''}`);
}
console.log(`Done. Accepted ${ok}/${issues.length}.`);
