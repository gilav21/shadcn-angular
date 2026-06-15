// Export all open SonarQube issues for the project to sonar-issues.json and
// print a by-rule summary. Runs on the host, so it talks to localhost:9000.
// Usage (provide SONAR_TOKEN one of these ways):
//   .env file (any OS):    add `SONAR_TOKEN=<token>` to packages/.env (gitignored)
//   Windows (PowerShell):  $env:SONAR_TOKEN="<token>"; npm run sonar:export
//   macOS / Linux:         SONAR_TOKEN=<token> npm run sonar:export
import { writeFileSync } from 'node:fs';
import { resolveSonarToken } from './sonar-token.mjs';

const token = resolveSonarToken();

const host = (process.env.SONAR_HOST_URL_LOCAL ?? 'http://localhost:9000').replace(/\/$/, '');
const project = process.env.SONAR_PROJECT ?? 'shadcn-angular';
const headers = { Authorization: `Bearer ${token}` };

const all = [];
let page = 1;
for (;;) {
  const url = `${host}/api/issues/search?componentKeys=${project}&resolved=false&ps=500&p=${page}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`HTTP ${res.status} from ${url}\n${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  all.push(...data.issues);
  if (page * 500 >= data.total || data.issues.length === 0) break;
  if (++page > 20) break; // API caps at 10k results
}

writeFileSync(
  'sonar-issues.json',
  JSON.stringify(
    all.map((i) => ({
      rule: i.rule,
      severity: i.severity,
      type: i.type,
      file: (i.component ?? '').replace(`${project}:`, ''),
      line: i.line,
      message: i.message,
    })),
    null,
    2,
  ),
);

const byRule = {};
for (const i of all) byRule[i.rule] = (byRule[i.rule] ?? 0) + 1;
console.log(`Exported ${all.length} issues -> sonar-issues.json\n`);
console.log('By rule (top to bottom):');
for (const [rule, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
  console.log(String(n).padStart(5), rule);
}
