// Local SonarQube scan runner — see docs/sonarqube-local.md.
// Requires a local SonarQube (docker run -d --name sonarqube -p 9000:9000 sonarqube:community)
// Usage (provide SONAR_TOKEN one of these ways):
//   .env file (any OS):    add `SONAR_TOKEN=<token>` to packages/.env (gitignored)
//   Windows (PowerShell):  $env:SONAR_TOKEN="<token>"; npm run sonar
//   macOS / Linux:         SONAR_TOKEN=<token> npm run sonar
//
// Two modes:
//   npm run sonar        scan only — for iterating on issues. Issue detection
//                        never reads coverage, so this is complete for that
//                        purpose; it just says loudly when the coverage report
//                        it uploads was measured on a different tree.
//   npm run sonar:gate   the done-gate: the same scan, but with coverage that
//                        is guaranteed to describe THIS tree — re-measured
//                        first unless the fingerprint proves it is current.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSonarToken } from './sonar-token.mjs';
import { treeHash } from './tree-hash.mjs';

const gate = process.argv.includes('--gate');
const TREE_HASH_FILE = join('coverage', '.tree-hash');

function coverageIsCurrent() {
  try {
    return readFileSync(TREE_HASH_FILE, 'utf8').trim() === treeHash();
  } catch {
    return false;
  }
}

if (gate) {
  if (coverageIsCurrent()) {
    console.log('[sonar:gate] coverage fingerprint matches this tree — reusing the report.');
  } else {
    console.log('[sonar:gate] coverage is missing or measured on a different tree — re-running `npm run coverage`.');
    const coverage = spawnSync(process.execPath, [join('scripts', 'coverage.mjs')], { stdio: 'inherit' });
    if (coverage.status !== 0) process.exit(coverage.status ?? 1);
  }
} else if (!coverageIsCurrent()) {
  console.warn(
    '\n[sonar] WARNING: coverage/lcov.info is missing or was measured on a different tree.\n' +
    '        Issues reported by this scan are still valid — issue detection does not read coverage —\n' +
    '        but the coverage figures will not describe this code. For the done-gate run `npm run sonar:gate`.\n',
  );
}

const token = resolveSonarToken();

const host = process.env.SONAR_HOST_URL ?? 'http://host.docker.internal:9000';

// In a git worktree `.git` is a file holding `gitdir: <absolute host path>`.
// Only the worktree directory is mounted into the scanner container, so that
// path does not resolve there and Sonar's JGit-based SCM detection aborts the
// whole analysis with RepositoryNotFoundException. Disabling SCM is scoped to
// worktrees; a normal checkout keeps blame-based new-code detection.
const inWorktree = statSync('.git', { throwIfNoEntry: false })?.isFile() ?? false;

// Parallel agents each scan their own branch. Without a distinct project key
// they all write into `shadcn-angular`, so every agent's "no new issues"
// verdict is measured against a project polluted by the others' in-flight
// code. Set SONAR_PROJECT_KEY per agent to get an isolated project; unset, the
// behaviour is unchanged.
const projectKey = process.env.SONAR_PROJECT_KEY;

execFileSync(
  'docker',
  [
    'run', '--rm',
    '-e', `SONAR_HOST_URL=${host}`,
    '-e', `SONAR_TOKEN=${token}`,
    '-v', `${process.cwd()}:/usr/src`,
    'sonarsource/sonar-scanner-cli',
    ...(inWorktree ? ['-Dsonar.scm.disabled=true'] : []),
    ...(projectKey
      ? [`-Dsonar.projectKey=${projectKey}`, `-Dsonar.projectName=${projectKey}`]
      : []),
  ],
  { stdio: 'inherit' },
);
