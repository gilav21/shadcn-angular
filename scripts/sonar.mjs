// Local SonarQube scan runner — see docs/sonarqube-local.md.
// Requires a local SonarQube (docker run -d --name sonarqube -p 9000:9000 sonarqube:community)
// Usage:
//   Windows (PowerShell):  $env:SONAR_TOKEN="<token>"; npm run sonar
//   macOS / Linux:         SONAR_TOKEN=<token> npm run sonar
import { execFileSync } from 'node:child_process';

const token = process.env.SONAR_TOKEN;
if (!token) {
  console.error('SONAR_TOKEN is not set.');
  console.error('Generate one in SonarQube → My Account → Security → Generate Token, then:');
  console.error('  Windows:  $env:SONAR_TOKEN="<token>"; npm run sonar');
  console.error('  bash:     SONAR_TOKEN=<token> npm run sonar');
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
