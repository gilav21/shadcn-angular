// Shared SONAR_TOKEN resolution for the sonar scripts.
// Order: process.env.SONAR_TOKEN, then a local (gitignored) .env file —
// packages/.env first, then the repo-root .env — so the token doesn't have to
// be exported in every shell.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tokenFromEnvFiles() {
  for (const file of [path.join(repoRoot, 'packages', '.env'), path.join(repoRoot, '.env')]) {
    if (!existsSync(file)) continue;
    for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line.startsWith('SONAR_TOKEN')) continue;
      const rest = line.slice('SONAR_TOKEN'.length).trimStart();
      if (!rest.startsWith('=')) continue;
      return rest.slice(1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

/** Resolve the SonarQube token, or exit(1) with guidance if it can't be found. */
export function resolveSonarToken() {
  const token = process.env.SONAR_TOKEN ?? tokenFromEnvFiles();
  if (token) return token;

  console.error('SONAR_TOKEN is not set and was not found in packages/.env or .env.');
  console.error('Generate one in SonarQube → My Account → Security → Generate Token, then either:');
  console.error('  - add `SONAR_TOKEN=<token>` to packages/.env, or');
  console.error('  - Windows:  $env:SONAR_TOKEN="<token>"; npm run sonar');
  console.error('  - bash:     SONAR_TOKEN=<token> npm run sonar');
  process.exit(1);
}
