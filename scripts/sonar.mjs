// Local SonarQube scan runner — see docs/sonarqube-local.md.
// Requires a local SonarQube (docker run -d --name sonarqube -p 9000:9000 sonarqube:community)
// Usage (provide SONAR_TOKEN one of these ways):
//   .env file (any OS):    add `SONAR_TOKEN=<token>` to packages/.env (gitignored)
//   Windows (PowerShell):  $env:SONAR_TOKEN="<token>"; npm run sonar
//   macOS / Linux:         SONAR_TOKEN=<token> npm run sonar
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Fallback: read SONAR_TOKEN from a local (gitignored) .env file so it doesn't
// have to be exported in every shell. Checks packages/.env then the repo-root .env.
function tokenFromEnvFiles() {
  for (const file of [path.join(repoRoot, 'packages', '.env'), path.join(repoRoot, '.env')]) {
    if (!existsSync(file)) continue;
    const match = /^\s*SONAR_TOKEN\s*=\s*(.+?)\s*$/m.exec(readFileSync(file, 'utf8'));
    if (match) return match[1].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const token = process.env.SONAR_TOKEN ?? tokenFromEnvFiles();
if (!token) {
  console.error('SONAR_TOKEN is not set and was not found in packages/.env or .env.');
  console.error('Generate one in SonarQube → My Account → Security → Generate Token, then either:');
  console.error('  - add `SONAR_TOKEN=<token>` to packages/.env, or');
  console.error('  - Windows:  $env:SONAR_TOKEN="<token>"; npm run sonar');
  console.error('  - bash:     SONAR_TOKEN=<token> npm run sonar');
  process.exit(1);
}

const host = process.env.SONAR_HOST_URL ?? 'http://host.docker.internal:9000';

execFileSync(
  'docker',
  [
    'run', '--rm',
    '-e', `SONAR_HOST_URL=${host}`,
    '-e', `SONAR_TOKEN=${token}`,
    '-v', `${process.cwd()}:/usr/src`,
    'sonarsource/sonar-scanner-cli',
  ],
  { stdio: 'inherit' },
);
