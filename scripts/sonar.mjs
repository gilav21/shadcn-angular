// Local SonarQube scan runner — see docs/sonarqube-local.md.
// Requires a local SonarQube (docker run -d --name sonarqube -p 9000:9000 sonarqube:community)
// Usage (provide SONAR_TOKEN one of these ways):
//   .env file (any OS):    add `SONAR_TOKEN=<token>` to packages/.env (gitignored)
//   Windows (PowerShell):  $env:SONAR_TOKEN="<token>"; npm run sonar
//   macOS / Linux:         SONAR_TOKEN=<token> npm run sonar
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolveSonarToken } from './sonar-token.mjs';

const token = resolveSonarToken();

const host = process.env.SONAR_HOST_URL ?? 'http://host.docker.internal:9000';

// In a git worktree `.git` is a file holding `gitdir: <absolute host path>`.
// Only the worktree directory is mounted into the scanner container, so that
// path does not resolve there and Sonar's JGit-based SCM detection aborts the
// whole analysis with RepositoryNotFoundException. Disabling SCM is scoped to
// worktrees; a normal checkout keeps blame-based new-code detection.
const inWorktree = statSync('.git', { throwIfNoEntry: false })?.isFile() ?? false;

execFileSync(
  'docker',
  [
    'run', '--rm',
    '-e', `SONAR_HOST_URL=${host}`,
    '-e', `SONAR_TOKEN=${token}`,
    '-v', `${process.cwd()}:/usr/src`,
    'sonarsource/sonar-scanner-cli',
    ...(inWorktree ? ['-Dsonar.scm.disabled=true'] : []),
  ],
  { stdio: 'inherit' },
);
